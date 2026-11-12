/**
 * verify-cpp-wasm.mjs
 * Research-tree check for public/build/game_cpp.wasm (never a shipping binary):
 *   1. instantiates with the imports wasm_loader.ts provides
 *   2. exports the legacy + Verlet + noise + spatial-hash symbols the loader expects
 *   3. rebuildGrid + queryRadius / queryRadiusSimd / queryRadiusFirst reproduce the
 *      AssemblyScript golden fixture (tests/fixtures/spatial_hash/golden.txt) exactly
 *   4. light Verlet + noise call smoke
 *
 *   npm run verify:cpp-wasm
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOLDEN_PATH, SPATIAL_HASH_EXPORTS, parseGolden, runFixture, diffAgainstGolden } from './spatial_hash_fixture.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const wasmPath = path.join(repoRoot, 'public/build/game_cpp.wasm');

if (!fs.existsSync(wasmPath)) {
    console.error(`❌ Missing ${wasmPath}`);
    process.exit(1);
}

const bytes = fs.readFileSync(wasmPath);
const cppImports = {
    env: {
        emscripten_notify_memory_growth: () => {},
    },
};

const { instance } = await WebAssembly.instantiate(bytes, cppImports);
const exports = instance.exports;
// Emscripten standalone reactor: run static init before any call (wasm_loader does the same).
if (typeof exports._initialize === 'function') exports._initialize();

const required = [
    'allocAsteroids',
    'checkCollision',
    'allocSporeClouds',
    'checkSporeCollision',
    'allocBossHitboxes',
    'checkBossCollision',
    'allocPhysicsBodies',
    'stepPhysics',
    'getBodyPositionX',
    'getBodyPositionY',
    'setBodyPosition',
    'addBodyAcceleration',
    'getBodyRadius',
    'simplexNoise2D',
    'simplexNoise3D',
    'fractalNoise2D',
    'fractalNoise3D',
    ...SPATIAL_HASH_EXPORTS,
];

const missing = required.filter((name) => typeof exports[name] !== 'function');
if (missing.length > 0) {
    console.error('❌ C++ WASM missing exports:', missing.join(', '));
    process.exit(1);
}

if (!(exports.memory instanceof WebAssembly.Memory)) {
    console.error('❌ C++ WASM missing memory export');
    process.exit(1);
}

// Spatial hash: golden parity with the shipping AssemblyScript module.
const golden = parseGolden(fs.readFileSync(path.join(repoRoot, GOLDEN_PATH), 'utf8'));
const results = runFixture(exports, golden.scene);
const problems = diffAgainstGolden(results, golden.expected);
if (problems.length > 0) {
    console.error(`❌ C++ spatial hash diverges from AS golden (${problems.length} mismatches):`);
    for (const p of problems.slice(0, 10)) console.error('   ' + p);
    process.exit(1);
}
const simd = exports.simdSupported();
const queryCount = golden.scene.queries.length * golden.expected.length;
console.log(`✅ spatial hash matches AS golden (${queryCount} queries, scalar + SIMD + first; simdSupported=${simd})`);

// Light call smoke: alloc + step (same symbols jelly_moss_softbody uses)
exports.allocPhysicsBodies(2);
exports.setBodyPosition(0, 1, 2);
exports.addBodyAcceleration(0, 10, 0);
exports.stepPhysics(2, 0.016, 0);
const x = exports.getBodyPositionX(0);
if (!Number.isFinite(x)) {
    console.error('❌ stepPhysics produced non-finite position');
    process.exit(1);
}

// Light call smoke for noise (src/biome_noise.ts consumer shape)
const n = exports.fractalNoise2D(1.23, 4.56, 4, 2.0, 0.5);
if (!Number.isFinite(n)) {
    console.error('❌ fractalNoise2D produced non-finite value');
    process.exit(1);
}

console.log(`✅ C++ WASM verified (${wasmPath})`);
