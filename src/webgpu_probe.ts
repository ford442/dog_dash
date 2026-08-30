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
 */

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

    const fail = (stage: WebGpuProbeStage, reason: string, adapter: WebGpuAdapterInfo | null = null) => ({
        ok: false as const,
        result: publish({
            ok: false,
            browser,
            reason,
            adapter,
            stage,
            userAgent,
            durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - startedAt)
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
        adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    } catch (error) {
        return fail('adapter', `requestAdapter() threw: ${(error as Error)?.message ?? error}`);
    }
    if (!adapter) {
        return fail('adapter', 'requestAdapter() resolved to null — no compatible adapter.');
    }

    const adapterInfo = readAdapterInfo(adapter);

    // ---- One and only device request --------------------------------------
    let device: GPUDevice;
    try {
        device = await adapter.requestDevice();
    } catch (error) {
        return fail('device', `requestDevice() threw: ${(error as Error)?.message ?? error}`, adapterInfo);
    }

    // ---- Canvas context ----------------------------------------------------
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
        return fail('canvas-context', 'canvas.getContext("webgpu") returned null.', adapterInfo);
    }

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

    const result = publish({
        ok: true,
        browser,
        reason: '',
        adapter: adapterInfo,
        stage: 'ok',
        userAgent,
        durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - startedAt)
    });

    return { ok: true, result, adapter, device, context, format };
}

/** Test seam: forget the memoised probe so a fresh one can run. */
export function resetWebGpuProbeForTests(): void {
    pending = null;
    if (typeof window !== 'undefined') {
        delete window.webgpuProbe;
    }
}
