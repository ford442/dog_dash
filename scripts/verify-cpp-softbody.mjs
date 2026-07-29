/**
 * verify-cpp-softbody.mjs
 *
 * Node smoke for Option A: exercise C++-only Verlet exports the same way
 * jelly_moss_softbody.ts does (alloc → set → accelerate → step → read).
 * Requires public/build/game_cpp.wasm (npm run build:cpp-wasm).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const wasmPath = path.join(repoRoot, 'public/build/game_cpp.wasm');

if (!fs.existsSync(wasmPath)) {
    console.error(`❌ Missing ${wasmPath} — run: npm run build:cpp-wasm`);
    process.exit(1);
}

const bytes = fs.readFileSync(wasmPath);
const { instance } = await WebAssembly.instantiate(bytes, {
    env: { emscripten_notify_memory_growth: () => {} },
});
const e = instance.exports;

const need = [
    'allocPhysicsBodies',
    'stepPhysics',
    'getBodyPositionX',
    'getBodyPositionY',
    'setBodyPosition',
    'addBodyAcceleration',
];
for (const name of need) {
    if (typeof e[name] !== 'function') {
        console.error(`❌ Missing export ${name}`);
        process.exit(1);
    }
}

const count = 6;
e.allocPhysicsBodies(count);
// Refresh view after possible growth (mirrors refreshMemoryView)
const _mem = new Float32Array(e.memory.buffer);

// Rest ring (hero core net)
for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    e.setBodyPosition(i, Math.cos(angle), Math.sin(angle));
}

// Impulse on body 0
e.addBodyAcceleration(0, 40, -15);
e.stepPhysics(count, 1 / 60, 0);

const x0 = e.getBodyPositionX(0);
const y0 = e.getBodyPositionY(0);
if (!Number.isFinite(x0) || !Number.isFinite(y0)) {
    console.error('❌ Non-finite body position after stepPhysics');
    process.exit(1);
}
if (x0 === 1 && y0 === 0) {
    console.error('❌ Body 0 did not move after impulse + step (soft-body consumer broken)');
    process.exit(1);
}

console.log(`✅ C++ soft-body Verlet consumer verified (body0 → ${x0.toFixed(4)}, ${y0.toFixed(4)})`);
