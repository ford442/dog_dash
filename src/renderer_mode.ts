import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

import {
    probeWebGpu,
    type WebGpuProbeResult
} from './webgpu_probe';

/**
 * Dog Dash renders through WebGPU only.
 *
 * The WebGL2 path was removed deliberately: a silent fallback made WebGPU
 * failures invisible, so a Chrome failure and an Edge failure looked identical
 * from the outside. Boot now hard-fails with a diagnostic screen instead.
 * Restoring a WebGL renderer is a later issue wave — see
 * docs/RENDERER_FALLBACK.md.
 */
export type RendererBackend = 'webgpu' | 'webgl';
export type GameRenderer = WebGPURenderer | THREE.WebGLRenderer;

export type RendererInitResult = {
    renderer: GameRenderer;
    backend: RendererBackend;
    requestedBackend: RendererBackend;
    fallbackReason?: string;
};

declare global {
    interface Window {
        usingWebGPU?: boolean;
        /**
         * Retained for the material-lite guards scattered through the visual
         * systems. Always false now — no WebGL context is ever created.
         */
        usingWebGL?: boolean;
        rendererType?: RendererBackend;
        rendererFallbackReason?: string;
    }
}

/** Raised when the boot probe fails. Carries the probe JSON for the UI. */
export class WebGpuBootError extends Error {
    readonly probe: WebGpuProbeResult;

    constructor(probe: WebGpuProbeResult) {
        super(`WebGPU boot failed at "${probe.stage}": ${probe.reason}`);
        this.name = 'WebGpuBootError';
        this.probe = probe;
    }
}

export function hasDebugUrlFlag(name: string): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has(name) || params.get(name) === '1' || params.get(name) === 'true';
}

/**
 * WebGPU is the only backend. Kept as a function so callers and docs keep a
 * single place to read the intended backend from.
 */
export function getRequestedRendererBackend(): RendererBackend {
    return 'webgpu';
}

function setRendererGlobals(backend: RendererBackend, fallbackReason?: string): void {
    window.usingWebGPU = backend === 'webgpu';
    window.usingWebGL = false;
    window.rendererType = backend;
    window.rendererFallbackReason = fallbackReason || '';
}

/**
 * Runs the boot probe and builds the WebGPU renderer on the device it
 * produced.
 *
 * The probed device is handed to `WebGPURenderer` rather than letting it
 * request its own — that is what keeps "one adapter, one device" true for the
 * whole page. On failure this throws {@link WebGpuBootError}; it never creates
 * a `webgl` or `webgl2` context to keep something on screen.
 */
export async function createGameRenderer(
    canvas: HTMLCanvasElement,
    options: { antialias?: boolean; basePixelRatio?: number } = {}
): Promise<RendererInitResult> {
    const antialias = options.antialias ?? true;
    const basePixelRatio = options.basePixelRatio ?? 1;

    const outcome = await probeWebGpu(canvas);
    if (!outcome.ok) {
        setRendererGlobals('webgpu', outcome.result.reason);
        throw new WebGpuBootError(outcome.result);
    }

    let renderer: WebGPURenderer;
    try {
        // `device` + `context` come from the probe, so the renderer adopts them
        // instead of running its own adapter/device request.
        renderer = new WebGPURenderer({
            canvas,
            antialias,
            device: outcome.device,
            context: outcome.context
        });
        await renderer.init();
    } catch (error) {
        const reason = error instanceof Error
            ? `WebGPU renderer initialization failed: ${error.message}`
            : 'WebGPU renderer initialization failed.';
        setRendererGlobals('webgpu', reason);
        throw new WebGpuBootError({ ...outcome.result, ok: false, reason, stage: 'canvas-context' });
    }

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio * basePixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    setRendererGlobals('webgpu');
    console.info('[renderer] active=webgpu (WebGL path deferred)');

    return {
        renderer,
        backend: 'webgpu',
        requestedBackend: 'webgpu'
    };
}
