/**
 * spatial_hash_fixture.mjs
 * Shared golden fixture for the spatial-hash ABI (assembly/spatial_hash.ts and
 * its research mirror cpp/src/spatial_hash.cpp).
 *
 * - scripts/gen-spatial-hash-golden.mjs writes tests/fixtures/spatial_hash/golden.txt
 *   from the shipping AssemblyScript binary.
 * - tests/unit/spatial_hash.test.ts asserts AS still reproduces it (so the
 *   fixture cannot drift from shipping behaviour).
 * - scripts/verify-cpp-wasm.mjs and cpp/tests/test_spatial_hash.cpp assert the
 *   C++ build reproduces it.
 *
 * Floats are stored as f32 bit patterns (hex) so every reader parses them exactly.
 */

export const GOLDEN_PATH = 'tests/fixtures/spatial_hash/golden.txt';

/** Required spatial-hash exports; must match src/wasm_loader.ts SPATIAL_HASH_EXPORTS. */
export const SPATIAL_HASH_EXPORTS = [
    'allocEntities',
    'getEntityPtr',
    'getEntityCount',
    'rebuildGrid',
    'queryRadius',
    'queryRadiusSimd',
    'queryRadiusFirst',
    'getQueryResultPtr',
    'getQueryCount',
    'simdSupported',
];

const LAYERS = [1, 2, 4, 8];

function lcg(seed) {
    let s = seed | 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) | 0;
        return (s >>> 0) / 4294967296;
    };
}

/** Deterministic scene: entities + queries, run at several cell sizes. */
export function buildFixtureScene() {
    const rand = lcg(0x5eed);
    const f = Math.fround;
    const entities = [];
    for (let i = 0; i < 400; i++) {
        entities.push({
            x: f(rand() * 300 - 60),
            y: f(rand() * 80 - 40),
            z: f(rand() * 24 - 12),
            r: f(0.25 + rand() * 3.5),
            layer: LAYERS[i % LAYERS.length] | (i % 7 === 0 ? 16 : 0),
            id: i * 3 + 7, // id != index, catches index/id mix-ups
        });
    }
    // Oversized entity: span exceeds MAX_CELL_SPAN and gets capped around its centre.
    entities.push({ x: f(40), y: f(0), z: f(0), r: f(50), layer: 2, id: 9001 });
    // Exactly on cell boundaries / negative cells.
    entities.push({ x: f(-8), y: f(-8), z: f(0), r: f(0.5), layer: 1, id: 9002 });
    entities.push({ x: f(16), y: f(-0), z: f(-16), r: f(1), layer: 1, id: 9003 });

    const queries = [];
    for (let i = 0; i < 64; i++) {
        queries.push({
            x: f(rand() * 300 - 60),
            y: f(rand() * 80 - 40),
            z: f(rand() * 24 - 12),
            r: f(0.5 + rand() * 10),
            mask: [1, 2, 4, 8, 3, 15, 16, 31][i % 8],
        });
    }
    queries.push({ x: f(85), y: f(0), z: f(0), r: f(1), mask: 2 });    // inside the oversized radius, outside its capped cells
    queries.push({ x: f(40), y: f(0), z: f(0), r: f(0), mask: 31 });   // zero radius
    queries.push({ x: f(0), y: f(0), z: f(0), r: f(5), mask: 0 });     // empty mask
    queries.push({ x: f(-8), y: f(-8), z: f(0), r: f(0.75), mask: 1 }); // boundary entity
    queries.push({ x: f(100), y: f(0), z: f(0), r: f(40), mask: 31 });  // wide query, many cells

    return { cellSizes: [8, 3.5, 0], entities, queries }; // 0 → DEFAULT_CELL fallback
}

/** Write `entities` into the module's AOS buffer. Returns nothing; refreshes views internally. */
function writeEntities(exports, entities) {
    const ptr = exports.allocEntities(entities.length);
    const f32 = new Float32Array(exports.memory.buffer); // after alloc: memory may have grown
    const base = ptr >>> 2;
    for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        const o = base + i * 6;
        f32[o] = e.x;
        f32[o + 1] = e.y;
        f32[o + 2] = e.z;
        f32[o + 3] = e.r;
        f32[o + 4] = e.layer;
        f32[o + 5] = e.id;
    }
}

function readHits(exports, count) {
    const ptr = exports.getQueryResultPtr();
    const i32 = new Int32Array(exports.memory.buffer);
    return Array.from(i32.subarray(ptr >>> 2, (ptr >>> 2) + count));
}

/**
 * Run the fixture scene through a module's spatial-hash exports.
 * Returns `{ cell, scalar: number[][], simd: number[][], first: number[] }[]`
 * with hit ids in the order the module wrote them.
 */
export function runFixture(exports, scene) {
    const out = [];
    for (const cell of scene.cellSizes) {
        writeEntities(exports, scene.entities);
        exports.rebuildGrid(cell);
        const scalar = [];
        const simd = [];
        const first = [];
        for (const q of scene.queries) {
            const n = exports.queryRadius(q.x, q.y, q.z, q.r, q.mask);
            scalar.push(readHits(exports, n));
            const ns = exports.queryRadiusSimd(q.x, q.y, q.z, q.r, q.mask);
            simd.push(readHits(exports, ns));
            first.push(exports.queryRadiusFirst(q.x, q.y, q.z, q.r, q.mask));
        }
        out.push({ cell, scalar, simd, first });
    }
    return out;
}

const hexBuf = new DataView(new ArrayBuffer(4));
function f32Hex(v) {
    hexBuf.setFloat32(0, v, true);
    return hexBuf.getUint32(0, true).toString(16).padStart(8, '0');
}
function hexF32(h) {
    hexBuf.setUint32(0, parseInt(h, 16), true);
    return hexBuf.getFloat32(0, true);
}

/** Serialize scene + scalar results (the reference order) to the golden text format. */
export function serializeGolden(scene, results) {
    const lines = [
        '# Spatial-hash golden fixture — generated from the shipping AssemblyScript binary.',
        '# Regenerate: node scripts/gen-spatial-hash-golden.mjs   (after an intentional assembly/spatial_hash.ts change)',
        '# Floats are little-endian f32 bit patterns in hex. Hit ids are in module write order.',
        `entities ${scene.entities.length}`,
    ];
    for (const e of scene.entities) {
        lines.push(`${f32Hex(e.x)} ${f32Hex(e.y)} ${f32Hex(e.z)} ${f32Hex(e.r)} ${e.layer} ${e.id}`);
    }
    lines.push(`queries ${scene.queries.length}`);
    for (const q of scene.queries) {
        lines.push(`${f32Hex(q.x)} ${f32Hex(q.y)} ${f32Hex(q.z)} ${f32Hex(q.r)} ${q.mask}`);
    }
    for (const res of results) {
        lines.push(`cell ${f32Hex(res.cell)}`);
        for (const hits of res.scalar) {
            lines.push([hits.length, ...hits].join(' '));
        }
    }
    return lines.join('\n') + '\n';
}

/** Parse the golden text back into `{ scene, expected: { cell, hits: number[][] }[] }`. */
export function parseGolden(text) {
    const lines = text.split('\n').filter((l) => l && !l.startsWith('#'));
    let i = 0;
    const take = () => lines[i++].split(' ');
    const [, ne] = take();
    const entities = [];
    for (let k = 0; k < Number(ne); k++) {
        const [x, y, z, r, layer, id] = take();
        entities.push({ x: hexF32(x), y: hexF32(y), z: hexF32(z), r: hexF32(r), layer: Number(layer), id: Number(id) });
    }
    const [, nq] = take();
    const queries = [];
    for (let k = 0; k < Number(nq); k++) {
        const [x, y, z, r, mask] = take();
        queries.push({ x: hexF32(x), y: hexF32(y), z: hexF32(z), r: hexF32(r), mask: Number(mask) });
    }
    const expected = [];
    while (i < lines.length) {
        const [, cellHex] = take();
        const hits = [];
        for (let k = 0; k < queries.length; k++) {
            const [n, ...ids] = take().map(Number);
            if (ids.length !== n) throw new Error(`golden: hit count mismatch on query ${k}`);
            hits.push(ids);
        }
        expected.push({ cell: hexF32(cellHex), hits });
    }
    return { scene: { cellSizes: expected.map((e) => e.cell), entities, queries }, expected };
}

/**
 * Compare a module's results against the golden. Returns a list of human-readable
 * mismatches (empty = parity). Order is compared exactly: the C++ mirror walks
 * buckets in the same order as AS, so any reorder means the ports diverged.
 */
export function diffAgainstGolden(results, expected) {
    const problems = [];
    for (let c = 0; c < expected.length; c++) {
        const exp = expected[c];
        const got = results[c];
        for (let q = 0; q < exp.hits.length; q++) {
            const want = exp.hits[q].join(',');
            for (const [label, hits] of [['scalar', got.scalar[q]], ['simd', got.simd[q]]]) {
                if (hits.join(',') !== want) {
                    problems.push(`cell=${exp.cell} query#${q} ${label}: got [${hits.join(',')}] want [${want}]`);
                }
            }
            const wantFirst = exp.hits[q].length ? exp.hits[q][0] : -1;
            if (got.first[q] !== wantFirst) {
                problems.push(`cell=${exp.cell} query#${q} first: got ${got.first[q]} want ${wantFirst}`);
            }
        }
    }
    return problems;
}
