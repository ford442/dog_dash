import test from 'node:test';
import assert from 'node:assert/strict';
import { beginRun, getRunRng, getRunRngFork, tryGetRunSeed } from '../../src/run_seed/run_context.ts';

test('getRunRng before beginRun falls back to an attract RNG instead of throwing', () => {
    assert.equal(tryGetRunSeed(), null);
    assert.doesNotThrow(() => getRunRng());
    assert.doesNotThrow(() => getRunRngFork('candy'));
    assert.equal(tryGetRunSeed(), null, 'attract RNG must not count as an active run');
});

test('beginRun discards the attract RNG and its cached forks', () => {
    const attractFork = getRunRngFork('obstacles');
    beginRun({ version: 1, campaignId: 'campaign', rngSeed: 4242, modifiers: [] });
    const a = getRunRngFork('obstacles').random();
    beginRun({ version: 1, campaignId: 'campaign', rngSeed: 4242, modifiers: [] });
    const b = getRunRngFork('obstacles').random();
    assert.equal(a, b);
    assert.notEqual(getRunRngFork('obstacles'), attractFork);
});
