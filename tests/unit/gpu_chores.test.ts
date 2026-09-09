import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

import { compactJs, reduceJs } from '../../src/gpu_chores/js_backend';
import { createWasmChoresBackend, supportsChores, type ChoresWasmExports } from '../../src/gpu_chores/wasm_backend';
import { createGpuChoresAdapter } from '../../src/gpu_chores';

async function loadWasmChores(): Promise<ChoresWasmExports> {
    const bytes = await readFile(new URL('../../public/build/optimized.wasm', import.meta.url));
    const { instance } = await WebAssembly.instantiate(bytes, {
        env: { abort: () => { throw new Error('wasm abort'); } }
    });
    const exports = instance.exports;
    assert.ok(supportsChores(exports), 'optimized.wasm is missing the chore exports');
    return exports as unknown as ChoresWasmExports;
}

function randomValues(n: number, seed: number): Float32Array {
    // Deterministic LCG so failures are reproducible.
    let state = seed >>> 0;
    const values = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        state = (state * 1664525 + 1013904223) >>> 0;
        values[i] = ((state / 0xffffffff) - 0.35) * 4;
    }
    return values;
}

test('compact keeps indices above epsilon, in input order', () => {
    const values = Float32Array.from([0, 0.5, -1, 0.001, 2]);
    const out = new Uint32Array(values.length);

    const kept = compactJs(values, values.length, out, 0.01);

    assert.equal(kept, 2);
    assert.deepEqual(Array.from(out.subarray(0, kept)), [1, 4]);
});

test('compact is bounded by count, values.length and out.length', () => {
    const values = Float32Array.from([1, 1, 1, 1]);

    assert.equal(compactJs(values, 2, new Uint32Array(4), 0), 2);
    assert.equal(compactJs(values, 99, new Uint32Array(4), 0), 4);
    assert.equal(compactJs(values, 4, new Uint32Array(3), 0), 3);
    assert.equal(compactJs(values, 0, new Uint32Array(4), 0), 0);
});

test('reduce matches plain loops and returns 0 for empty input', () => {
    const values = Float32Array.from([3, -1, 7, 0.5]);

    assert.equal(reduceJs(values, 4, 'max'), 7);
    assert.equal(reduceJs(values, 4, 'min'), -1);
    assert.ok(Math.abs(reduceJs(values, 4, 'sum') - 9.5) < 1e-6);

    assert.equal(reduceJs(values, 0, 'sum'), 0);
    assert.equal(reduceJs(values, 0, 'max'), 0);
    assert.equal(reduceJs(new Float32Array(0), 5, 'min'), 0);
});

test('WASM chore backend is bit-identical to the JS reference', async () => {
    const backend = createWasmChoresBackend(await loadWasmChores());

    for (const [count, seed] of [[1, 7], [63, 11], [64, 12], [65, 13], [1000, 99]] as const) {
        const values = randomValues(count, seed);

        const jsOut = new Uint32Array(count);
        const wasmOut = new Uint32Array(count);
        const jsKept = compactJs(values, count, jsOut, 0.01);
        const wasmKept = backend.compact(values, count, wasmOut, 0.01);

        assert.equal(wasmKept, jsKept, `compact count mismatch at n=${count}`);
        assert.deepEqual(
            Array.from(wasmOut.subarray(0, wasmKept)),
            Array.from(jsOut.subarray(0, jsKept)),
            `compact indices mismatch at n=${count}`
        );

        for (const op of ['sum', 'max', 'min'] as const) {
            assert.equal(
                backend.reduce(values, count, op),
                reduceJs(values, count, op),
                `reduce(${op}) mismatch at n=${count}`
            );
        }
    }
});

test('adapter falls back to JS and never adopts a device without a renderer', async () => {
    const adapter = createGpuChoresAdapter('auto');
    assert.equal(adapter.syncBackend, 'js');

    // A renderer with no WebGPU backend (WebGL, or a failed boot probe) must
    // leave chores on the CPU tiers rather than requesting a device.
    adapter.attachRenderer({ backend: {} });
    assert.equal(adapter.backend, 'js');
    assert.match(adapter.reason, /no WebGPU device/);

    adapter.attachWasm(await loadWasmChores());
    assert.equal(adapter.syncBackend, 'wasm');
    assert.equal(adapter.backend, 'wasm');

    // reduceAsync degrades to the sync tier when no GPU tier exists.
    const values = Float32Array.from([1, 5, 2]);
    assert.equal(await adapter.reduceAsync(values, 3, 'max'), 5);
});

test('kill switch pins the JS tier and refuses WASM/WebGPU adoption', async () => {
    const adapter = createGpuChoresAdapter('js');

    adapter.attachWasm(await loadWasmChores());
    adapter.attachRenderer({ backend: { device: {} } });

    assert.equal(adapter.backend, 'js');
    assert.equal(adapter.syncBackend, 'js');
    assert.equal(adapter.gpuDisabled, true);
});

test('a WASM build without chore exports is ignored, not fatal', () => {
    const adapter = createGpuChoresAdapter('auto');
    adapter.attachWasm({ memory: new WebAssembly.Memory({ initial: 1 }) });
    assert.equal(adapter.syncBackend, 'js');
    assert.equal(supportsChores(undefined), false);
});
