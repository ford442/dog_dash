import { strict as assert } from 'node:assert';
import { test, beforeEach } from 'node:test';

import {
    isWebGpuDeviceLost,
    onWebGpuDeviceLost,
    probeWebGpu,
    resetWebGpuProbeForTests,
    resolvePowerPreference
} from '../../src/webgpu_probe';
import { createGpuChoresAdapter } from '../../src/gpu_chores';
import {
    getGpuRenderMs,
    isGpuTimingEnabled,
    resetGpuTimingForTests,
    sampleGpuTiming,
    setGpuTimingEnabled
} from '../../src/gpu_timing';

type Lost = { reason: string; message: string };

function setupDom(search = ''): void {
    (globalThis as { window?: unknown }).window = { location: { search }, isSecureContext: true };
}

function setNavigator(value: unknown): void {
    Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
}

/**
 * A GPU that boots successfully and whose device can be "lost" on demand.
 * Records every requestAdapter call and its options.
 */
function installFakeGpu() {
    const adapterCalls: Array<GPURequestAdapterOptions | undefined> = [];
    let loseDevice!: (info: Lost) => void;
    const lost = new Promise<Lost>((resolve) => { loseDevice = resolve; });
    const device = { features: new Set<string>(), lost, addEventListener() {} };

    setNavigator({
        userAgent: 'Mozilla/5.0 Chrome/127.0.0.0 Safari/537.36',
        gpu: {
            requestAdapter: async (options?: GPURequestAdapterOptions) => {
                adapterCalls.push(options);
                return {
                    info: { vendor: 'v', architecture: 'a', device: 'd', description: '' },
                    features: new Set<string>(),
                    limits: {},
                    requestDevice: async () => device
                };
            },
            getPreferredCanvasFormat: () => 'bgra8unorm'
        }
    });

    const canvas = {
        getContext: (kind: string) => (kind === 'webgpu' ? { configure() {} } : null)
    } as unknown as HTMLCanvasElement;

    return { adapterCalls, canvas, loseDevice };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
    resetWebGpuProbeForTests();
    resetGpuTimingForTests();
    setupDom();
});

test('battery quality asks for the low-power adapter; everything else stays high-performance', async () => {
    assert.equal(resolvePowerPreference(''), 'high-performance');
    assert.equal(resolvePowerPreference('?quality=quality'), 'high-performance');
    assert.equal(resolvePowerPreference('?quality=default'), 'high-performance');
    assert.equal(resolvePowerPreference('?quality=battery'), 'low-power');
    assert.equal(resolvePowerPreference('?pixelRatio=0.5'), 'low-power');

    setupDom('?quality=battery');
    const gpu = installFakeGpu();
    const outcome = await probeWebGpu(gpu.canvas);
    assert.equal(outcome.ok, true);
    assert.deepEqual(gpu.adapterCalls, [{ powerPreference: 'low-power' }]);
    assert.equal(outcome.result.powerPreference, 'low-power');

    resetWebGpuProbeForTests();
    setupDom('');
    const gpu2 = installFakeGpu();
    await probeWebGpu(gpu2.canvas);
    assert.deepEqual(gpu2.adapterCalls, [{ powerPreference: 'high-performance' }]);
});

test('device.lost publishes a breadcrumb, notifies once, and never probes again', async () => {
    const gpu = installFakeGpu();
    const outcome = await probeWebGpu(gpu.canvas);
    assert.equal(outcome.ok, true);
    assert.equal(isWebGpuDeviceLost(), false);

    const calls: string[] = [];
    onWebGpuDeviceLost((lost) => calls.push(lost.reason));

    gpu.loseDevice({ reason: 'unknown', message: 'GPU process crashed' });
    await flush();

    assert.equal(isWebGpuDeviceLost(), true);
    assert.deepEqual(calls, ['unknown']);
    const breadcrumb = (globalThis as { window: { webgpuProbe?: { lost?: { reason: string; message: string } } } })
        .window.webgpuProbe;
    assert.equal(breadcrumb?.lost?.reason, 'unknown');
    assert.equal(breadcrumb?.lost?.message, 'GPU process crashed');
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(breadcrumb)));

    // Late subscribers still hear about it, exactly once.
    const late: string[] = [];
    onWebGpuDeviceLost((lost) => late.push(lost.reason));
    await flush();
    assert.deepEqual(late, ['unknown']);
    assert.deepEqual(calls, ['unknown']);

    // Asking for the probe again returns the memoised outcome — no second adapter.
    await probeWebGpu(gpu.canvas);
    assert.equal(gpu.adapterCalls.length, 1, 'device loss must not trigger a second requestAdapter');
});

test('a destroyed device is reported too', async () => {
    const gpu = installFakeGpu();
    await probeWebGpu(gpu.canvas);
    const reasons: string[] = [];
    onWebGpuDeviceLost((lost) => reasons.push(lost.reason));
    gpu.loseDevice({ reason: 'destroyed', message: '' });
    await flush();
    assert.deepEqual(reasons, ['destroyed']);
});

test('GPU chores detach on loss and refuse to adopt afterwards', async () => {
    const gpu = installFakeGpu();
    await probeWebGpu(gpu.canvas);
    gpu.loseDevice({ reason: 'unknown', message: 'reset' });
    await flush();

    const chores = createGpuChoresAdapter('auto');
    let adopted = false;
    const renderer = { get backend() { adopted = true; return { device: {} }; } };
    chores.attachRenderer(renderer);
    assert.equal(adopted, false, 'chores must not touch the renderer device after loss');
    assert.equal(chores.backend, 'js');
    assert.match(chores.reason, /lost/);

    // Sync ops were never on the GPU and keep working.
    assert.equal(chores.reduce(Float32Array.from([1, 2, 3]), 3, 'sum'), 6);
    assert.equal(await chores.reduceAsync(Float32Array.from([4, 5]), 2, 'max'), 5);

    chores.detachDevice('manual');
    assert.equal(chores.backend, 'js');
    assert.equal(chores.reason, 'manual');
});

test('GPU timing is off unless enabled, and divides by the frames a resolve covers', async () => {
    let resolves = 0;
    const renderer = { resolveTimestampsAsync: async () => { resolves++; return 8; } };

    sampleGpuTiming(renderer);
    assert.equal(resolves, 0, 'disabled timing must not touch the renderer');
    assert.equal(getGpuRenderMs(), null);

    setGpuTimingEnabled(true);
    sampleGpuTiming(renderer); // resolve #1 covers 1 frame → 8 ms
    sampleGpuTiming(renderer); // in flight: counted, not resolved
    sampleGpuTiming(renderer);
    await flush();
    assert.equal(resolves, 1);
    assert.equal(getGpuRenderMs(), 8);

    sampleGpuTiming(renderer); // resolve #2 covers 3 frames → 8/3 ms, smoothed
    await flush();
    assert.equal(resolves, 2);
    const ms = getGpuRenderMs()!;
    assert.ok(ms < 8 && ms > 8 / 3, `expected smoothing between 8/3 and 8, got ${ms}`);

    const failing = { resolveTimestampsAsync: async () => { throw new Error('lost'); } };
    const warn = console.warn;
    console.warn = () => {};
    try {
        sampleGpuTiming(failing);
        await flush();
    } finally {
        console.warn = warn;
    }
    assert.equal(isGpuTimingEnabled(), false, 'a failed resolve disables the readout');
});
