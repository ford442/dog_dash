import test from 'node:test';
import assert from 'node:assert/strict';
import { comboCorridorRandom } from '../../src/combo_corridor_rng.ts';
import { beginRun } from '../../src/run_seed/run_context.ts';
import { RUN_SEED_SCHEMA_VERSION } from '../../src/run_seed/types.ts';

function draws(n: number): number[] {
    const values: number[] = [];
    for (let i = 0; i < n; i++) values.push(comboCorridorRandom());
    return values;
}

test('comboCorridorRandom is deterministic for the same run seed', () => {
    beginRun({ version: RUN_SEED_SCHEMA_VERSION, campaignId: 'campaign', rngSeed: 777, modifiers: [] });
    const a = draws(10);

    beginRun({ version: RUN_SEED_SCHEMA_VERSION, campaignId: 'campaign', rngSeed: 777, modifiers: [] });
    const b = draws(10);

    assert.deepEqual(a, b);
});

test('comboCorridorRandom differs for different run seeds', () => {
    beginRun({ version: RUN_SEED_SCHEMA_VERSION, campaignId: 'campaign', rngSeed: 1, modifiers: [] });
    const a = draws(5);

    beginRun({ version: RUN_SEED_SCHEMA_VERSION, campaignId: 'campaign', rngSeed: 2, modifiers: [] });
    const b = draws(5);

    assert.notDeepEqual(a, b);
});

test('comboCorridorRandom stays in [0, 1)', () => {
    beginRun({ version: RUN_SEED_SCHEMA_VERSION, campaignId: 'campaign', rngSeed: 42, modifiers: [] });
    for (const v of draws(200)) {
        assert.ok(v >= 0 && v < 1);
    }
});
