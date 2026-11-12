/**
 * webgpu_probe.ts
 * The single WebGPU boot probe.
 *
 * Dog Dash renders through WebGPU only. There is no WebGL fallback: if the
 * probe fails we hard-fail with a diagnostic screen so that a Chrome failure
 * and an Edge failure can be compared directly, rather than being papered over
 * by a silently different renderer.
 *
 * Invariants this module exists to hold:
 *
 *  1. **One request.** `requestAdapter()` and `requestDevice()` happen exactly
 *     once per page load. The result is memoised, so every later caller — the
 *     renderer, the GPU chores layer, debug tooling — observes the same
 *     outcome and nobody re-requests a device after a failure.
 *  2. **No WebGL, ever.** Nothing here creates a `webgl` or `webgl2` context,
 *     and no caller may create one on failure.
 *  3. **Legible failure.** `window.webgpuProbe` always ends up populated, with
 *     the stage that failed and the browser that failed it.
 *  4. **Legible loss.** A device that boots and is later lost (driver reset,
 *     GPU process crash, tab evicted on a laptop) records `lost` on the same
 *     breadcrumb and notifies {@link onWebGpuDeviceLost} subscribers. Loss is
 *     terminal for the page: nothing re-probes, the only recovery is a reload.
 */

import { parsePixelRatioPreset } from './pixel_ratio';

/** Where the probe stopped. `ok` only on full success. */
export type WebGpuProbeStage =
    | 'ok'
    | 'skipped'
    | 'no-navigator-gpu'
    | 'insecure-context'
    | 'adapter'
    | 'device'
    | 'canvas-context';

/** Identifying details of the adapter, when we got far enough to have one. */
export interface WebGpuAdapterInfo {
    vendor: string;
    architecture: string;
    device: string;
    description: string;
    /** Adapter feature names, sorted — useful when comparing two browsers. */
    features: string[];
    maxTextureDimension2D: number | null;
    maxBufferSize: number | null;
}

/** Recorded when a successfully probed device is later lost. */
export interface WebGpuDeviceLostInfo {
    /** `GPUDeviceLostReason`: `'unknown'` (driver/GPU-process loss) or `'destroyed'`. */
    reason: string;
    message: string;
    /** Milliseconds since the probe finished — "lost after 40 min" is a real symptom. */
    afterMs: number;
}

/** Serialisable probe result, published on `window.webgpuProbe`. */
export interface WebGpuProbeResult {
    ok: boolean;
    /** e.g. `"Microsoft Edge 128"`, `"Google Chrome 127"`, `"unknown"`. */
    browser: string;
    /** Empty when `ok`. Otherwise a human-readable failure cause. */
    reason: string;
    adapter: WebGpuAdapterInfo | null;
    stage: WebGpuProbeStage;
    /** Full user-agent string, so a bug report carries the exact build. */
    userAgent: string;
    /** Milliseconds the probe took — slow adapter requests are a real symptom. */
    durationMs: number;
    /** Features passed to the single `requestDevice` (never hard-required). */
    requestedFeatures?: string[];
    /** Features actually present on the created device. */
    enabledFeatures?: string[];
    /** `uncapturederror` messages recorded after device creation. */
    uncapturedErrors?: string[];
    /** The `powerPreference` passed to the single `requestAdapter`. */
    powerPreference?: GPUPowerPreference;
    /** Set once if the probed device is lost after a successful boot. */
    lost?: WebGpuDeviceLostInfo;
}

declare global {
    interface Window {
        /** Boot probe breadcrumb. Populated exactly once per page load. */
        webgpuProbe?: WebGpuProbeResult;
    }
}

/** Live handles kept only on success. */
export interface WebGpuProbeSuccess {
    result: WebGpuProbeResult;
    adapter: GPUAdapter;
    device: GPUDevice;
    context: GPUCanvasContext;
    format: GPUTextureFormat;
}

export type WebGpuProbeOutcome =
    | ({ ok: true } & WebGpuProbeSuccess)
    | { ok: false; result: WebGpuProbeResult };

/**
 * Identifies the browser well enough to tell Chrome and Edge apart, which is
 * the entire point of the probe JSON. `userAgentData.brands` distinguishes
 * them cleanly; the UA string is the fallback.
 */
export function detectBrowser(): string {
    if (typeof navigator === 'undefined') return 'unknown';

    type Brand = { brand: string; version: string };
    const brands = (navigator as Navigator & {
        userAgentData?: { brands?: Brand[] };
    }).userAgentData?.brands;

    if (Array.isArray(brands) && brands.length > 0) {
        // Skip the deliberate "Not/A)Brand" GREASE entries.
        const real = brands.filter(b => !/not.a.brand/i.test(b.brand));
        const preferred = real.find(b => /edge/i.test(b.brand))
            ?? real.find(b => !/chromium/i.test(b.brand))
            ?? real[0];
        if (preferred) return `${preferred.brand} ${preferred.version}`;
    }

    const ua = navigator.userAgent || '';

    // Order matters: an Edge UA contains "Chrome/..." *before* "Edg/...", and
    // Opera contains both. Most specific token wins, or Edge reads as Chrome
    // and the probe JSON stops being able to tell the two apart.
    const candidates: Array<[RegExp, string]> = [
        [/\bEdg(?:iOS|A)?\/(\d+)/, 'Microsoft Edge'],
        [/\bOPR\/(\d+)/, 'Opera'],
        [/\bFirefox\/(\d+)/, 'Firefox'],
        [/\bChrome\/(\d+)/, 'Google Chrome'],
        [/\bVersion\/(\d+).*\bSafari\//, 'Safari']
    ];

    for (const [pattern, name] of candidates) {
        const match = pattern.exec(ua);
        if (match) return `${name} ${match[1]}`;
    }
    return 'unknown';
}

function readAdapterInfo(adapter: GPUAdapter): WebGpuAdapterInfo {
    const info = (adapter as GPUAdapter & { info?: GPUAdapterInfo }).info;
    const limits = adapter.limits as GPUSupportedLimits | undefined;

    return {
        vendor: info?.vendor ?? '',
        architecture: info?.architecture ?? '',
        device: info?.device ?? '',
        description: info?.description ?? '',
        features: adapter.features ? [...adapter.features].sort() : [],
        maxTextureDimension2D: limits?.maxTextureDimension2D ?? null,
        maxBufferSize: limits?.maxBufferSize ?? null
    };
}

function publish(result: WebGpuProbeResult): WebGpuProbeResult {
    if (typeof window !== 'undefined') {
        window.webgpuProbe = result;
    }
    if (result.ok) {
        console.info('[webgpu-probe] ok', result);
    } else {
        console.error(`[webgpu-probe] FAILED at "${result.stage}": ${result.reason}`, result);
    }
    return result;
}

/** `?skip_gpu_boot` — headless CI and bundle checks, never a rendering path. */
export function shouldSkipGpuBoot(): boolean {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('skip_gpu_boot');
}

/**
 * Adapter power preference for the single `requestAdapter`. `?quality=battery`
 * (the same flag that selects the 0.5 pixel-ratio preset) asks for the
 * low-power adapter; everything else keeps `high-performance`.
 */
export function resolvePowerPreference(
    search = typeof window !== 'undefined' ? window.location.search : ''
): GPUPowerPreference {
    return parsePixelRatioPreset(search, 'default') === 'battery' ? 'low-power' : 'high-performance';
}

/** Optional WebGPU features we enable when the adapter has them. Never required. */
export const OPTIONAL_WEBGPU_FEATURES = ['timestamp-query'] as const;

export function shouldRequestDebugGpuFeatures(search = typeof window !== 'undefined' ? window.location.search : ''): boolean {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return params.has('debug') || params.get('debug') === '1';
}

/**
 * Features to pass as `requiredFeatures` — only those the adapter already
 * exposes, so Intel iGPUs and CI still boot. `timestamp-query` is debug-only.
 */
export function collectOptionalDeviceFeatures(
    adapter: { features?: { has: (name: string) => boolean } | Iterable<string> | Set<string> },
    debugTiming: boolean
): string[] {
    const has = (name: string) => {
        const f = adapter.features;
        if (!f) return false;
        if (typeof (f as { has?: unknown }).has === 'function') {
            return (f as { has: (n: string) => boolean }).has(name);
        }
        return [...(f as Iterable<string>)].includes(name);
    };
    const features: string[] = [];
    if (debugTiming && has('timestamp-query')) features.push('timestamp-query');
    return features;
}

export function buildDeviceDescriptor(optionalFeatures: string[]): GPUDeviceDescriptor {
    return {
        label: 'dog-dash',
        requiredFeatures: optionalFeatures as GPUFeatureName[],
        defaultQueue: { label: 'dog-dash-queue' }
    };
}

function attachUncapturedErrorListener(device: GPUDevice, result: WebGpuProbeResult): void {
    result.uncapturedErrors = result.uncapturedErrors ?? [];
    device.addEventListener('uncapturederror', (event) => {
        const gpuEvent = event as GPUUncapturedErrorEvent;
        const message = gpuEvent.error?.message ?? String(gpuEvent.error ?? 'uncaptured GPU error');
        result.uncapturedErrors = [...(result.uncapturedErrors ?? []), message].slice(-8);
        if (typeof window !== 'undefined' && window.webgpuProbe) {
            window.webgpuProbe.uncapturedErrors = result.uncapturedErrors;
        }
        console.error('[webgpu-probe] uncapturederror', message);
    });
}

type DeviceLostListener = (lost: WebGpuDeviceLostInfo, result: WebGpuProbeResult) => void;

let lostListeners: DeviceLostListener[] = [];
let lostState: { info: WebGpuDeviceLostInfo; result: WebGpuProbeResult } | null = null;

/**
 * Subscribes to loss of the probed device. If the device is already lost the
 * listener is called on the next microtask, so late subscribers (e.g. chores
 * attached after a loss) still hear about it. Returns an unsubscribe function.
 *
 * Listeners must not request a new adapter or device — loss is terminal.
 */
export function onWebGpuDeviceLost(listener: DeviceLostListener): () => void {
    if (lostState) {
        const { info, result } = lostState;
        queueMicrotask(() => listener(info, result));
        return () => {};
    }
    lostListeners.push(listener);
    return () => {
        lostListeners = lostListeners.filter(l => l !== listener);
    };
}

/** True once the probed device has been lost. */
export function isWebGpuDeviceLost(): boolean {
    return lostState !== null;
}

function attachDeviceLostListener(device: GPUDevice, result: WebGpuProbeResult, bootedAt: number): void {
    // `device.lost` may be absent on test doubles; real devices always have it.
    const lost = (device as GPUDevice & { lost?: Promise<GPUDeviceLostInfo> }).lost;
    if (!lost || typeof lost.then !== 'function') return;

    void lost.then((info) => {
        if (lostState) return;
        const record: WebGpuDeviceLostInfo = {
            reason: String(info?.reason ?? 'unknown'),
            message: info?.message || 'no message',
            afterMs: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - bootedAt)
        };
        result.lost = record;
        if (typeof window !== 'undefined' && window.webgpuProbe) {
            window.webgpuProbe.lost = record;
        }
        lostState = { info: record, result };
        console.error(`[webgpu-probe] device lost (${record.reason}): ${record.message}`, result);

        const listeners = lostListeners;
        lostListeners = [];
        for (const listener of listeners) {
            try {
                listener(record, result);
            } catch (error) {
                console.error('[webgpu-probe] device-lost listener threw', error);
            }
        }
    });
}

let pending: Promise<WebGpuProbeOutcome> | null = null;

/**
 * Runs the boot probe, or returns the memoised outcome of the run that already
 * happened. Never requests a second adapter or device — a failed probe stays
 * failed for the life of the page.
 */
export function probeWebGpu(canvas: HTMLCanvasElement): Promise<WebGpuProbeOutcome> {
    if (!pending) {
        pending = runProbe(canvas);
    }
    return pending;
}

/** The result of the probe if it has finished, else null. Never triggers one. */
export function getWebGpuProbeResult(): WebGpuProbeResult | null {
    return typeof window !== 'undefined' ? (window.webgpuProbe ?? null) : null;
}

async function runProbe(canvas: HTMLCanvasElement): Promise<WebGpuProbeOutcome> {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    const browser = detectBrowser();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const powerPreference = resolvePowerPreference();

    const fail = (stage: WebGpuProbeStage, reason: string, adapter: WebGpuAdapterInfo | null = null) => ({
        ok: false as const,
        result: publish({
            ok: false,
            browser,
            reason,
            adapter,
            stage,
            userAgent,
            durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - startedAt),
            powerPreference
        })
    });

    if (shouldSkipGpuBoot()) {
        return fail('skipped', 'GPU boot skipped by ?skip_gpu_boot.');
    }

    if (typeof navigator === 'undefined' || !navigator.gpu) {
        return fail(
            'no-navigator-gpu',
            'navigator.gpu is undefined — this browser build exposes no WebGPU implementation.'
        );
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
        return fail(
            'insecure-context',
            'WebGPU requires a secure context (https or localhost).'
        );
    }

    // ---- One and only adapter request -------------------------------------
    let adapter: GPUAdapter | null = null;
    try {
        adapter = await navigator.gpu.requestAdapter({ powerPreference });
    } catch (error) {
        return fail('adapter', `requestAdapter() threw: ${(error as Error)?.message ?? error}`);
    }
    if (!adapter) {
        return fail('adapter', 'requestAdapter() resolved to null — no compatible adapter.');
    }

    const adapterInfo = readAdapterInfo(adapter);

    const debugTiming = shouldRequestDebugGpuFeatures();
    const requestedFeatures = collectOptionalDeviceFeatures(adapter, debugTiming);
    const descriptor = buildDeviceDescriptor(requestedFeatures);

    // ---- One and only device request --------------------------------------
    let device: GPUDevice;
    try {
        device = await adapter.requestDevice(descriptor);
    } catch (error) {
        return fail('device', `requestDevice() threw: ${(error as Error)?.message ?? error}`, adapterInfo);
    }

    const enabledFeatures = device.features ? [...device.features].sort() : requestedFeatures.slice();

    // ---- Canvas context ----------------------------------------------------
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
        return fail('canvas-context', 'canvas.getContext("webgpu") returned null.', adapterInfo);
    }

    // Canvas configuration, set once here and nowhere else:
    //  - `format`: the platform's preferred swap-chain format (bgra8unorm on
    //    most desktop GPUs, rgba8unorm on some Android) — Three renders into it.
    //  - `alphaMode: 'opaque'`: the canvas never composites with the page.
    //  - `usage` left at the WebGPU default (RENDER_ATTACHMENT). Three r182
    //    only renders into the swap-chain texture, so no extra bits are needed;
    //    if that ever changes, add them here, never in chores or integrate.
    //  - no `colorSpace` / `toneMapping` (defaults: srgb / standard). Tone
    //    mapping is applied by WebGPURenderer (ACES, exposure 1.3).
    const format = navigator.gpu.getPreferredCanvasFormat();
    try {
        context.configure({ device, format, alphaMode: 'opaque' });
    } catch (error) {
        return fail(
            'canvas-context',
            `context.configure() threw: ${(error as Error)?.message ?? error}`,
            adapterInfo
        );
    }

    const bootedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    const result = publish({
        ok: true,
        browser,
        reason: '',
        adapter: adapterInfo,
        stage: 'ok',
        userAgent,
        durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - startedAt),
        requestedFeatures,
        enabledFeatures,
        uncapturedErrors: [],
        powerPreference
    });
    attachUncapturedErrorListener(device, result);
    attachDeviceLostListener(device, result, bootedAt);

    return { ok: true, result, adapter, device, context, format };
}

/** Test seam: forget the memoised probe so a fresh one can run. */
export function resetWebGpuProbeForTests(): void {
    pending = null;
    lostListeners = [];
    lostState = null;
    if (typeof window !== 'undefined') {
        delete window.webgpuProbe;
    }
}
