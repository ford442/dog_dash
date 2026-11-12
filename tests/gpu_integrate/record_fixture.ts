/**
 * Records tests/fixtures/gpu_integrate/golden.json from the JS integrate.
 *
 *   npm run gpu-integrate:record
 *
 * Re-record only after an intentional change to the JS particle/debris
 * integrate (or the scenario), and change kernels.ts + f32_reference.ts to
 * match in the same commit.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { roundSnapshots, runScenario, SCENARIO } from './scenario';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'fixtures', 'gpu_integrate', 'golden.json');

const snapshots = roundSnapshots(await runScenario());
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
    note: 'Golden output of the JS particle/debris integrate. Re-record with `npm run gpu-integrate:record`.',
    scenario: SCENARIO,
    snapshots
}) + '\n');

const summary = snapshots.map(s => `${s.system}@${s.step}: ${s.count} live / ${s.drawn} drawn`).join('\n  ');
console.log(`wrote ${out}\n  ${summary}`);
