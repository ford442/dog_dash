import { strict as assert } from 'node:assert';
import { test, afterEach } from 'node:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { loadWasm, missingSpatialHashExports, SPATIAL_HASH_EXPORTS, WasmBackend } from '../../src/wasm_loader.ts';

// VITE_CPP_WASM research flag must fail closed when game_cpp.wasm cannot drive SpatialIndex.

const ROOT = new URL('../../', import.meta.url);
const CPP_WASM = new URL('public/build/game_cpp.wasm', ROOT);

/** Minimal module exporting only `memory` — stands in for a stale pre-spatial-hash C++ binary. */
const MEMORY_ONLY_WASM = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x05, 0x03, 0x01, 0x00, 0x01,
    0x07, 0x0a, 0x01, 0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00,
]);

const g = globalThis as Record<string, unknown>;
const realFetch = globalThis.fetch;
const hadWindow = 'window' in g;

async function installFetch(cppBytes: Uint8Array | null): Promise<void> {
    const asBytes = await readFile(new URL('public/build/optimized.wasm', ROOT));
    g.window = {};
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('game_cpp.wasm')) {
            return cppBytes ? new Response(cppBytes) : new Response(null, { status: 404 });
        }
        if (url.endsWith('optimized.wasm')) return new Response(asBytes);
        return new Response(null, { status: 404 });
    }) as typeof fetch;
}

afterEach(() => {
    globalThis.fetch = realFetch;
    if (!hadWindow) delete g.window;
});

test('missingSpatialHashExports lists every absent symbol', () => {
    assert.deepEqual(missingSpatialHashExports({}), [...SPATIAL_HASH_EXPORTS]);
    const full = Object.fromEntries(SPATIAL_HASH_EXPORTS.map((n) => [n, () => 0]));
    assert.deepEqual(missingSpatialHashExports(full), []);
});

test('C++ binary without spatial-hash exports is rejected (console + breadcrumb), AS loads instead', async () => {
    await installFetch(MEMORY_ONLY_WASM);
    const errors: unknown[] = [];
    const realError = console.error;
    console.error = (...args: unknown[]) => { errors.push(args.join(' ')); };
    try {
        const handle = await loadWasm(WasmBackend.Cpp);
        assert.ok(handle, 'AS fallback handle');
        assert.equal(handle.backend, WasmBackend.AssemblyScript);
        assert.equal(typeof handle.exports.queryRadius, 'function');
        const win = g.window as { wasmBackend?: string; wasmBackendRejected?: string };
        assert.equal(win.wasmBackend, WasmBackend.AssemblyScript);
        assert.match(win.wasmBackendRejected ?? '', /missing spatial-hash exports.*allocEntities/);
        assert.ok(errors.some((e) => String(e).includes('Rejected experimental C++ WASM')), 'console.error on rejection');
    } finally {
        console.error = realError;
    }
});

test('missing game_cpp.wasm leaves a rejection breadcrumb and loads AS', async () => {
    await installFetch(null);
    const realWarn = console.warn;
    console.warn = () => {};
    try {
        const handle = await loadWasm(WasmBackend.Cpp);
        assert.equal(handle?.backend, WasmBackend.AssemblyScript);
        assert.match((g.window as { wasmBackendRejected?: string }).wasmBackendRejected ?? '', /^cpp: HTTP 404/);
    } finally {
        console.warn = realWarn;
    }
});

test('built C++ research binary loads with the spatial hash and matches the AS golden', { skip: !existsSync(CPP_WASM) && 'game_cpp.wasm not built (npm run build:cpp-wasm)' }, async () => {
    await installFetch(new Uint8Array(await readFile(CPP_WASM)));
    const handle = await loadWasm(WasmBackend.Cpp);
    assert.ok(handle);
    assert.equal(handle.backend, WasmBackend.Cpp);
    assert.equal((g.window as { wasmBackendRejected?: string | null }).wasmBackendRejected, null);
    assert.equal(handle.simd, handle.exports.simdSupported!() === 1);

    const { GOLDEN_PATH, parseGolden, runFixture, diffAgainstGolden } = await import('../../scripts/spatial_hash_fixture.mjs');
    const golden = parseGolden(await readFile(new URL(GOLDEN_PATH, ROOT), 'utf8'));
    const problems = diffAgainstGolden(runFixture(handle.exports, golden.scene), golden.expected);
    assert.deepEqual(problems.slice(0, 5), []);
});
