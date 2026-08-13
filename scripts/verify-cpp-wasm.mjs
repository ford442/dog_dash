/**
 * verify-cpp-wasm.mjs
 * Smoke-check that public/build/game_cpp.wasm exists and instantiates with
 * the exports wasm_loader.ts expects for WasmBackend.Cpp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const required = [
    'memory',
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
];

const missing = required.filter((name) => typeof exports[name] !== 'function' && name !== 'memory');
if (missing.length > 0) {
    console.error('❌ C++ WASM missing exports:', missing.join(', '));
    process.exit(1);
}

if (!(exports.memory instanceof WebAssembly.Memory)) {
    console.error('❌ C++ WASM missing memory export');
    process.exit(1);
}

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

// Light call smoke for noise (Option B biome-noise consumer — src/biome_noise.ts)
const n = exports.fractalNoise2D(1.23, 4.56, 4, 2.0, 0.5);
if (!Number.isFinite(n)) {
    console.error('❌ fractalNoise2D produced non-finite value');
    process.exit(1);
}

console.log(`✅ C++ WASM verified (${wasmPath})`);
