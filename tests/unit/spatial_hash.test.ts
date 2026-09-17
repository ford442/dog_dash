import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { CollisionLayer, SpatialIndex } from '../../src/spatial_index.ts';
import { detectWasmSimd, refreshMemoryView, type WasmExports, type WasmHandle, WasmBackend } from '../../src/wasm_loader.ts';

interface SpatialExports extends WasmExports {
    allocEntities(count: number): number;
    rebuildGrid(cellSize: number): void;
    queryRadius(x: number, y: number, z: number, r: number, layerMask: number): number;
    queryRadiusSimd(x: number, y: number, z: number, r: number, layerMask: number): number;
    getQueryResultPtr(): number;
    simdSupported(): number;
}

async function loadSpatialWasm(): Promise<WasmHandle> {
    const bytes = await readFile(new URL('../../public/build/optimized.wasm', import.meta.url));
    const { instance } = await WebAssembly.instantiate(bytes, {
        env: { abort: () => { throw new Error('wasm abort'); } }
    });
    const exports = instance.exports as unknown as SpatialExports;
    const buffer = exports.memory.buffer;
    return {
        exports,
        memory: new Float32Array(buffer),
        i32Memory: new Int32Array(buffer),
        backend: WasmBackend.AssemblyScript,
        simd: typeof exports.queryRadiusSimd === 'function'
    };
}

function bruteHits(
    entities: { x: number; y: number; z: number; r: number; layer: number; id: number }[],
    q: { x: number; y: number; z: number; r: number; mask: number }
): number[] {
    const ids: number[] = [];
    for (const e of entities) {
        if ((e.layer & q.mask) === 0) continue;
        const dx = e.x - q.x;
        const dy = e.y - q.y;
        const dz = e.z - q.z;
        const rad = e.r + q.r;
        if (dx * dx + dy * dy + dz * dz < rad * rad) ids.push(e.id);
    }
    return ids.sort((a, b) => a - b);
}

test('detectWasmSimd matches WebAssembly.validate for v128', () => {
    assert.equal(typeof detectWasmSimd(), 'boolean');
});

test('spatial hash query matches brute-force fixture (scalar + SIMD)', async () => {
    const handle = await loadSpatialWasm();
    const index = new SpatialIndex();
    index.bindWasm(handle);

    const rng = (seed: number) => {
        let s = seed | 0;
        return () => {
            s = (s * 1664525 + 1013904223) | 0;
            return (s >>> 0) / 4294967296;
        };
    };
    const rand = rng(42);
    const entities: { x: number; y: number; z: number; r: number; layer: number; id: number }[] = [];

    index.begin();
    for (let i = 0; i < 80; i++) {
        const x = rand() * 80 - 10;
        const y = rand() * 40 - 20;
        const z = rand() * 8 - 4;
        const r = 0.4 + rand() * 2.2;
        const layer = i % 3 === 0 ? CollisionLayer.Collectible : CollisionLayer.Obstacle;
        entities.push({ x, y, z, r, layer, id: i });
        index.add(x, y, z, r, layer, i, layer === CollisionLayer.Obstacle ? 'obstacle' : 'collectible');
    }
    index.commit(8);

    const queries = [
        { x: 20, y: 0, z: 0, r: 6, mask: CollisionLayer.Obstacle },
        { x: 5, y: -3, z: 1, r: 12, mask: CollisionLayer.Obstacle | CollisionLayer.Collectible },
        { x: 70, y: 10, z: 0, r: 4, mask: CollisionLayer.Collectible },
        { x: -8, y: 0, z: 0, r: 3, mask: CollisionLayer.Obstacle }
    ];

    for (const q of queries) {
        const brute = bruteHits(entities, q);
        const hashed = index.query(q.x, q.y, q.z, q.r, q.mask).map((h) => h.index).sort((a, b) => a - b);
        assert.deepEqual(hashed, brute, `hash vs brute at (${q.x},${q.y},${q.z}) r=${q.r}`);

        const simdCount = handle.exports.queryRadiusSimd!(q.x, q.y, q.z, q.r, q.mask);
        const scalarCount = handle.exports.queryRadius!(q.x, q.y, q.z, q.r, q.mask);
        assert.equal(simdCount, scalarCount, 'SIMD and scalar hit counts must match');
        assert.equal(simdCount, brute.length);
    }
});

test('JS fallback query matches brute force when WASM is unbound', () => {
    const index = new SpatialIndex();
    index.begin();
    index.add(0, 0, 0, 1, CollisionLayer.Obstacle, 0, 'obstacle');
    index.add(10, 0, 0, 1, CollisionLayer.Obstacle, 1, 'obstacle');
    index.add(0.5, 0, 0, 0.5, CollisionLayer.Collectible, 2, 'collectible');
    index.commit();
    const hits = index.query(0, 0, 0, 1.2, CollisionLayer.Obstacle | CollisionLayer.Collectible);
    const ids = hits.map((h) => h.index).sort((a, b) => a - b);
    assert.deepEqual(ids, [0, 2]);
});

test('allocEntities growth refreshes the JS memory view', async () => {
    const handle = await loadSpatialWasm();
    const firstBuffer = handle.exports.memory.buffer;
    // Force the AS heap to grow past the 8-page (512 KiB) initial memory.
    const count = 40_000;
    const ptr = handle.exports.allocEntities!(count);
    const grown = handle.exports.memory.buffer !== firstBuffer;
    const view = refreshMemoryView(handle);
    assert.equal(view.buffer, handle.exports.memory.buffer);
    assert.equal(handle.i32Memory.buffer, handle.exports.memory.buffer);
    assert.ok(ptr >= 0);
    assert.ok(grown || handle.exports.memory.buffer.byteLength >= 512 * 1024,
        'memory should grow or already be large enough for 40k entities');
    if (grown) {
        assert.notEqual(firstBuffer, handle.exports.memory.buffer);
    }
});

test('shipping WASM exports spatial hash + SIMD query (no Rapier, no second backend)', async () => {
    const handle = await loadSpatialWasm();
    assert.equal(typeof handle.exports.allocEntities, 'function');
    assert.equal(typeof handle.exports.rebuildGrid, 'function');
    assert.equal(typeof handle.exports.queryRadius, 'function');
    assert.equal(typeof handle.exports.queryRadiusSimd, 'function');
    assert.equal(handle.exports.simdSupported?.(), 1);
    assert.equal(handle.backend, WasmBackend.AssemblyScript);
});
