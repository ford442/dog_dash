/**
 * gpu_timing.ts
 * Debug-only GPU render-time readout, backed by the `timestamp-query` feature.
 *
 * The feature is requested only with `?debug` and only when the adapter has
 * it (see `collectOptionalDeviceFeatures`), so on most players' machines this
 * module stays disabled and costs nothing. It is never required to play.
 *
 * With `trackTimestamp` on, Three's query pool must be drained every frame or
 * it fills (2048 queries) and starts warning, so {@link sampleGpuTiming} is
 * called once per rendered frame from the game loop. Readback is async and
 * may land a frame or two late; each result is divided by the frames it
 * covers, then smoothed. Visual/debug only — nothing gameplay reads this.
 */

type TimestampHost = {
    resolveTimestampsAsync?: (type?: string) => Promise<number | undefined>;
};

let enabled = false;
let inFlight = false;
let framesSinceResolve = 0;
let smoothedMs: number | null = null;
let readout: HTMLElement | null = null;
let resolvesSinceDomWrite = 0;
let disabledNote = '';

const SMOOTHING = 0.15;
/** DOM writes every N completed resolves (~4 Hz at 60 fps). */
const DOM_WRITE_INTERVAL = 15;

export function setGpuTimingEnabled(on: boolean): void {
    enabled = on;
    if (!on) {
        smoothedMs = null;
        framesSinceResolve = 0;
    }
    writeReadout();
}

export function isGpuTimingEnabled(): boolean {
    return enabled;
}

/** Smoothed GPU render time per frame in milliseconds, or null if unknown. */
export function getGpuRenderMs(): number | null {
    return smoothedMs;
}

/** Call once per rendered frame. No-op unless timestamp tracking is on. */
export function sampleGpuTiming(renderer: unknown): void {
    if (!enabled) return;
    framesSinceResolve++;
    if (inFlight) return;

    const host = renderer as TimestampHost;
    if (typeof host?.resolveTimestampsAsync !== 'function') {
        disabledNote = 'renderer has no resolveTimestampsAsync';
        setGpuTimingEnabled(false);
        return;
    }

    const frames = framesSinceResolve;
    framesSinceResolve = 0;
    inFlight = true;
    host.resolveTimestampsAsync('render')
        .then((totalMs) => {
            if (!enabled || typeof totalMs !== 'number' || !Number.isFinite(totalMs) || frames <= 0) return;
            const perFrame = totalMs / frames;
            smoothedMs = smoothedMs === null ? perFrame : smoothedMs + (perFrame - smoothedMs) * SMOOTHING;
            if (++resolvesSinceDomWrite >= DOM_WRITE_INTERVAL) {
                resolvesSinceDomWrite = 0;
                writeReadout();
            }
        })
        .catch((error) => {
            // A failed resolve (e.g. lost device) disables the readout for the
            // rest of the page rather than retrying every frame.
            console.warn('[gpu-timing] timestamp resolve failed; disabling readout', error);
            disabledNote = 'stopped — timestamp resolve failed (device lost?)';
            setGpuTimingEnabled(false);
        })
        .finally(() => {
            inFlight = false;
        });
}

/** Adds a "GPU time" line to the debug panel's custom section. */
export function attachGpuTimingDebugSection(container: HTMLElement): void {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.15);';
    const title = document.createElement('div');
    title.textContent = 'GPU time';
    title.style.cssText = 'color:#9fdcff;font-size:11px;margin-bottom:4px;';
    readout = document.createElement('div');
    readout.id = 'debug-gpu-time';
    readout.style.cssText = 'font-size:11px;font-family:ui-monospace,monospace;';
    wrap.append(title, readout);
    container.appendChild(wrap);
    writeReadout();
}

function writeReadout(): void {
    if (!readout) return;
    if (!enabled) {
        readout.textContent = disabledNote || 'n/a — needs ?debug and an adapter with timestamp-query';
    } else if (smoothedMs === null) {
        readout.textContent = 'render: measuring…';
    } else {
        readout.textContent = `render: ${smoothedMs.toFixed(2)} ms/frame`;
    }
}

/** Test seam. */
export function resetGpuTimingForTests(): void {
    enabled = false;
    inFlight = false;
    framesSinceResolve = 0;
    smoothedMs = null;
    readout = null;
    resolvesSinceDomWrite = 0;
    disabledNote = '';
}
