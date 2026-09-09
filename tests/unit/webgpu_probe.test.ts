import { strict as assert } from 'node:assert';
import { test, beforeEach } from 'node:test';

import {
    detectBrowser,
    getWebGpuProbeResult,
    probeWebGpu,
    resetWebGpuProbeForTests,
    shouldSkipGpuBoot
} from '../../src/webgpu_probe';

type TestWindow = {
    location: { search: string };
    isSecureContext: boolean;
    webgpuProbe?: unknown;
};

function setupDom(search = '', isSecureContext = true): TestWindow {
    const win: TestWindow = { location: { search }, isSecureContext };
    (globalThis as { window?: unknown }).window = win;
    return win;
}

function setNavigator(value: unknown): void {
    Object.defineProperty(globalThis, 'navigator', {
        value,
        configurable: true,
        writable: true
    });
}

/** A canvas stub that records whether anyone asked it for a WebGL context. */
function fakeCanvas(webgpuContext: unknown = null) {
    const requested: string[] = [];
    return {
        requested,
        getContext(kind: string) {
            requested.push(kind);
            return kind === 'webgpu' ? webgpuContext : null;
        }
    };
}

beforeEach(() => {
    resetWebGpuProbeForTests();
    setupDom();
    setNavigator({ userAgent: '', gpu: undefined });
});

test('detectBrowser tells Edge and Chrome apart from userAgentData', () => {
    setNavigator({
        userAgent: '',
        userAgentData: {
            brands: [
                { brand: 'Not/A)Brand', version: '99' },
                { brand: 'Chromium', version: '128' },
                { brand: 'Microsoft Edge', version: '128' }
            ]
        }
    });
    assert.equal(detectBrowser(), 'Microsoft Edge 128');

    setNavigator({
        userAgent: '',
        userAgentData: {
            brands: [
                { brand: 'Not/A)Brand', version: '99' },
                { brand: 'Chromium', version: '127' },
                { brand: 'Google Chrome', version: '127' }
            ]
        }
    });
    assert.equal(detectBrowser(), 'Google Chrome 127');
});

test('detectBrowser falls back to the user-agent string', () => {
    setNavigator({ userAgent: 'Mozilla/5.0 Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0' });
    assert.equal(detectBrowser(), 'Microsoft Edge 127');

    setNavigator({ userAgent: 'Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36' });
    assert.equal(detectBrowser(), 'Google Chrome 126');

    setNavigator({ userAgent: 'Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36 OPR/112.0.0.0' });
    assert.equal(detectBrowser(), 'Opera 112');

    setNavigator({ userAgent: 'Mozilla/5.0 Gecko/20100101 Firefox/129.0' });
    assert.equal(detectBrowser(), 'Firefox 129');

    setNavigator({ userAgent: 'Mozilla/5.0 (Macintosh) Version/17.5 Safari/605.1.15' });
    assert.equal(detectBrowser(), 'Safari 17');

    setNavigator({ userAgent: 'something/unrecognised' });
    assert.equal(detectBrowser(), 'unknown');
});

test('shouldSkipGpuBoot reads the URL flag', () => {
    setupDom('');
    assert.equal(shouldSkipGpuBoot(), false);
    setupDom('?skip_gpu_boot');
    assert.equal(shouldSkipGpuBoot(), true);
    setupDom('?other=1&skip_gpu_boot');
    assert.equal(shouldSkipGpuBoot(), true);
});

test('a browser without navigator.gpu fails at the right stage and never asks for WebGL', async () => {
    const canvas = fakeCanvas();
    const outcome = await probeWebGpu(canvas as unknown as HTMLCanvasElement);

    assert.equal(outcome.ok, false);
    assert.equal(outcome.result.stage, 'no-navigator-gpu');
    assert.match(outcome.result.reason, /navigator\.gpu/);
    assert.equal(outcome.result.adapter, null);

    // The invariant that matters: no WebGL context was ever requested.
    assert.deepEqual(canvas.requested, []);
});

test('an insecure context is reported distinctly from missing WebGPU', async () => {
    setupDom('', false);
    setNavigator({ userAgent: '', gpu: { requestAdapter: async () => null } });

    const outcome = await probeWebGpu(fakeCanvas() as unknown as HTMLCanvasElement);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.result.stage, 'insecure-context');
});

test('a null adapter and a throwing requestDevice are separate stages', async () => {
    setNavigator({ userAgent: '', gpu: { requestAdapter: async () => null } });
    let outcome = await probeWebGpu(fakeCanvas() as unknown as HTMLCanvasElement);
    assert.equal(outcome.result.stage, 'adapter');

    resetWebGpuProbeForTests();
    setNavigator({
        userAgent: '',
        gpu: {
            requestAdapter: async () => ({
                info: { vendor: 'test-vendor', architecture: 'test-arch', device: 'dev', description: 'd' },
                features: new Set(['depth-clip-control']),
                limits: { maxTextureDimension2D: 8192, maxBufferSize: 1024 },
                requestDevice: async () => { throw new Error('device lost'); }
            }),
            getPreferredCanvasFormat: () => 'bgra8unorm'
        }
    });
    outcome = await probeWebGpu(fakeCanvas() as unknown as HTMLCanvasElement);
    assert.equal(outcome.result.stage, 'device');
    assert.match(outcome.result.reason, /device lost/);
    // Adapter details survive a device failure — that is what makes a
    // Chrome-vs-Edge comparison possible.
    assert.equal(outcome.result.adapter?.vendor, 'test-vendor');
    assert.deepEqual(outcome.result.adapter?.features, ['depth-clip-control']);
});

test('the probe runs once and later calls reuse the memoised outcome', async () => {
    let adapterRequests = 0;
    setNavigator({
        userAgent: '',
        gpu: {
            requestAdapter: async () => { adapterRequests++; return null; }
        }
    });

    const canvas = fakeCanvas() as unknown as HTMLCanvasElement;
    const first = await probeWebGpu(canvas);
    const second = await probeWebGpu(canvas);
    const third = await probeWebGpu(canvas);

    assert.equal(adapterRequests, 1, 'requestAdapter must run exactly once');
    assert.equal(first.result, second.result);
    assert.equal(second.result, third.result);
});

test('the breadcrumb is published and readable without triggering a probe', async () => {
    setNavigator({ userAgent: 'Mozilla/5.0 Chrome/127.0.0.0 Safari/537.36', gpu: undefined });
    assert.equal(getWebGpuProbeResult(), null);

    await probeWebGpu(fakeCanvas() as unknown as HTMLCanvasElement);

    const published = getWebGpuProbeResult();
    assert.ok(published);
    assert.equal(published?.ok, false);
    assert.equal(published?.browser, 'Google Chrome 127');
    assert.equal(published?.stage, 'no-navigator-gpu');
    // Must survive JSON round-tripping — it goes into bug reports.
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(published)));
});

test('?skip_gpu_boot short-circuits before any GPU call', async () => {
    setupDom('?skip_gpu_boot');
    let touched = false;
    setNavigator({
        userAgent: '',
        gpu: { requestAdapter: async () => { touched = true; return null; } }
    });

    const outcome = await probeWebGpu(fakeCanvas() as unknown as HTMLCanvasElement);
    assert.equal(outcome.result.stage, 'skipped');
    assert.equal(touched, false, 'skip_gpu_boot must not reach the GPU');
});
