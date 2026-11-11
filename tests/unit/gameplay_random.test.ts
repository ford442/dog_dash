import test from 'node:test';
import assert from 'node:assert/strict';
import { beginRun } from '../../src/run_seed/run_context.ts';
import { gameplayRandom, gameplayRange } from '../../src/run_seed/gameplay_random.ts';
import { RUN_SEED_SCHEMA_VERSION } from '../../src/run_seed/types.ts';

const seed = (rngSeed: number) => ({ version: RUN_SEED_SCHEMA_VERSION, campaignId: 'campaign' as const, rngSeed, modifiers: [] });

test('gameplayRandom replays identically for the same seed', () => {
    beginRun(seed(777));
    const a = Array.from({ length: 20 }, () => gameplayRandom('obstacles'));
    beginRun(seed(777));
    const b = Array.from({ length: 20 }, () => gameplayRandom('obstacles'));
    assert.deepEqual(a, b);
});

test('streams are independent: extra draws on one never shift another', () => {
    beginRun(seed(9));
    const plain = Array.from({ length: 10 }, () => gameplayRandom('pickups'));
    beginRun(seed(9));
    const interleaved: number[] = [];
    for (let i = 0; i < 10; i++) {
        gameplayRandom('environment');
        gameplayRandom('environment');
        interleaved.push(gameplayRandom('pickups'));
    }
    assert.deepEqual(interleaved, plain);
});

test('different seeds give different worlds', () => {
    beginRun(seed(1));
    const a = gameplayRandom('enemies');
    beginRun(seed(2));
    const b = gameplayRandom('enemies');
    assert.notEqual(a, b);
});

test('gameplayRange stays in bounds', () => {
    beginRun(seed(3));
    for (let i = 0; i < 1000; i++) {
        const v = gameplayRange('boss', -2, 5);
        assert.ok(v >= -2 && v < 5);
    }
});
