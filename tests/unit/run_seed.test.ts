import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRng } from '../../src/run_seed/rng.ts';
import {
    createDefaultRunSeed,
    serializeRunSeed,
    parseRunSeed,
    seedsMatch
} from '../../src/run_seed/codec.ts';
import { RUN_SEED_SCHEMA_VERSION } from '../../src/run_seed/types.ts';
import { beginRun, getRunRngFork } from '../../src/run_seed/run_context.ts';

test('SeededRng is deterministic for the same seed', () => {
    const a = new SeededRng(12345);
    const b = new SeededRng(12345);
    const drawsA: number[] = [];
    const drawsB: number[] = [];
    for (let i = 0; i < 100; i++) {
        drawsA.push(a.random());
        drawsB.push(b.random());
    }
    assert.deepEqual(drawsA, drawsB);
});

test('SeededRng differs for different seeds', () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    assert.notEqual(a.random(), b.random());
});

test('fork produces stable substreams', () => {
    const root = new SeededRng(999);
    const fork1a = root.fork('obstacles');
    const fork1b = root.fork('obstacles');
    const fork2 = root.fork('candy');
    assert.equal(fork1a.random(), fork1b.random());
    assert.notEqual(fork1a.random(), fork2.random());
});

test('getRunRngFork is cached across calls', () => {
    beginRun({
        version: RUN_SEED_SCHEMA_VERSION,
        campaignId: 'campaign',
        rngSeed: 42,
        modifiers: []
    });
    assert.equal(getRunRngFork('obstacles'), getRunRngFork('obstacles'));
    assert.notEqual(getRunRngFork('obstacles'), getRunRngFork('candy'));
});

test('serializeRunSeed round-trips', () => {
    const seed = {
        version: RUN_SEED_SCHEMA_VERSION as 1,
        campaignId: 'campaign' as const,
        rngSeed: 0xdeadbeef,
        modifiers: [{ kind: 'ng_plus' as const, tier: 2 }]
    };
    const parsed = parseRunSeed(serializeRunSeed(seed));
    assert.deepEqual(parsed, seed);
});

test('parseRunSeed rejects wrong version', () => {
    const bad = JSON.stringify({ version: 99, campaignId: 'campaign', rngSeed: 1, modifiers: [] });
    assert.equal(parseRunSeed(bad), null);
});

test('parseRunSeed rejects malformed JSON', () => {
    assert.equal(parseRunSeed('not-json'), null);
});

test('parseRunSeed rejects invalid campaignId', () => {
    const bad = JSON.stringify({ version: 1, campaignId: 'sandbox', rngSeed: 1, modifiers: [] });
    assert.equal(parseRunSeed(bad), null);
});

test('seedsMatch compares modifiers', () => {
    const a = {
        version: RUN_SEED_SCHEMA_VERSION as 1,
        campaignId: 'campaign' as const,
        rngSeed: 1,
        modifiers: [] as const
    };
    const b = { ...a, modifiers: [{ kind: 'ng_plus' as const, tier: 1 }] };
    assert.equal(seedsMatch(a, a), true);
    assert.equal(seedsMatch(a, b), false);
});

test('createDefaultRunSeed returns valid schema', () => {
    const seed = createDefaultRunSeed();
    assert.equal(seed.version, RUN_SEED_SCHEMA_VERSION);
    assert.equal(seed.campaignId, 'campaign');
    assert.ok(seed.rngSeed > 0);
    assert.deepEqual(seed.modifiers, []);
});
