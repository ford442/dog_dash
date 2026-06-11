import * as THREE from 'three';
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js';
import { WebGPURenderer } from 'three/webgpu';

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
        usingWebGL?: boolean;
        rendererType?: RendererBackend;
        rendererFallbackReason?: string;
    }
}

function getRendererParam(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('renderer')?.toLowerCase() || null;
}

export function getRequestedRendererBackend(): RendererBackend {
    const param = getRendererParam();
    const params = new URLSearchParams(window.location.search);

    if (param === 'webgl' || params.has('webgl')) return 'webgl';
    return 'webgpu';
}

export function hasDebugUrlFlag(name: string): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has(name) || params.get(name) === '1' || params.get(name) === 'true';
}

function setRendererGlobals(backend: RendererBackend, fallbackReason?: string): void {
    window.usingWebGPU = backend === 'webgpu';
    window.usingWebGL = backend === 'webgl';
    window.rendererType = backend;
    window.rendererFallbackReason = fallbackReason || '';
}

function createWebGL2Renderer(canvas: HTMLCanvasElement, antialias: boolean): THREE.WebGLRenderer {
    const context = canvas.getContext('webgl2', {
        antialias,
        alpha: false,
        powerPreference: 'high-performance'
    }) as WebGL2RenderingContext | null;

    if (!context) {
        throw new Error('WebGL2 is not supported by this browser/device.');
    }

    return new THREE.WebGLRenderer({
        canvas,
        context: context as unknown as WebGLRenderingContext,
        antialias,
        powerPreference: 'high-performance'
    });
}

export function createGameRenderer(
    canvas: HTMLCanvasElement,
    options: { antialias?: boolean; basePixelRatio?: number } = {}
): RendererInitResult {
    const antialias = options.antialias ?? true;
    const basePixelRatio = options.basePixelRatio ?? 1;
    const requestedBackend = getRequestedRendererBackend();
    let backend: RendererBackend = requestedBackend;
    let renderer: GameRenderer;
    let fallbackReason: string | undefined;

    if (requestedBackend === 'webgl') {
        renderer = createWebGL2Renderer(canvas, antialias);
    } else if (!window.isSecureContext) {
        backend = 'webgl';
        fallbackReason = 'WebGPU requires a secure context; using WebGL2.';
        renderer = createWebGL2Renderer(canvas, antialias);
    } else if (!WebGPU.isAvailable()) {
        const warning = WebGPU.getErrorMessage();
        backend = 'webgl';
        fallbackReason = warning.textContent || 'WebGPU is unavailable; using WebGL2.';
        renderer = createWebGL2Renderer(canvas, antialias);
    } else {
        try {
            renderer = new WebGPURenderer({ canvas, antialias });
        } catch (error) {
            backend = 'webgl';
            fallbackReason = error instanceof Error
                ? `WebGPU renderer initialization failed: ${error.message}`
                : 'WebGPU renderer initialization failed; using WebGL2.';
            renderer = createWebGL2Renderer(canvas, antialias);
        }
    }

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio * basePixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    setRendererGlobals(backend, fallbackReason);

    if (fallbackReason) {
        console.warn(`[renderer] ${fallbackReason}`);
    }
    console.info(`[renderer] active=${backend} requested=${requestedBackend}`);

    return {
        renderer,
        backend,
        requestedBackend,
        fallbackReason
    };
}
