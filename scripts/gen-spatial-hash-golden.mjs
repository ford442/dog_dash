/**
 * gen-spatial-hash-golden.mjs
 * Regenerate tests/fixtures/spatial_hash/golden.txt from the shipping
 * AssemblyScript binary (public/build/optimized.wasm). Run after an intentional
 * change to assembly/spatial_hash.ts (npm run build:wasm && npm run copy:wasm first),
 * then port the same change to cpp/src/spatial_hash.cpp.
 *
 *   node scripts/gen-spatial-hash-golden.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOLDEN_PATH, buildFixtureScene, runFixture, serializeGolden, diffAgainstGolden, parseGolden } from './spatial_hash_fixture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bytes = fs.readFileSync(path.join(repoRoot, 'public/build/optimized.wasm'));
const { instance } = await WebAssembly.instantiate(bytes, {
    env: { abort: () => { throw new Error('wasm abort'); } },
});

const scene = buildFixtureScene();
const results = runFixture(instance.exports, scene);

// The AS module must agree with itself (scalar vs SIMD, first-hit) before we freeze it.
const text = serializeGolden(scene, results);
const selfCheck = diffAgainstGolden(results, parseGolden(text).expected);
if (selfCheck.length > 0) {
    console.error('❌ AS scalar / SIMD / first-hit disagree; not writing golden:\n' + selfCheck.slice(0, 10).join('\n'));
    process.exit(1);
}

const out = path.join(repoRoot, GOLDEN_PATH);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, text);
const totalHits = results.reduce((n, r) => n + r.scalar.reduce((m, h) => m + h.length, 0), 0);
console.log(`✅ Wrote ${GOLDEN_PATH} (${scene.entities.length} entities, ${scene.queries.length} queries × ${scene.cellSizes.length} cell sizes, ${totalHits} hits)`);
