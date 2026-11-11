import test from 'node:test';
import assert from 'node:assert/strict';
import { gameplayRandom } from '../../src/run_seed/gameplay_random.ts';
import { tryGetRunSeed } from '../../src/run_seed/run_context.ts';
import { SeededRng } from '../../src/run_seed/rng.ts';

// Own file (own process): beginRun() must never have run here.
test('pre-run draws come from fixed boot streams, not Math.random', () => {
    assert.equal(tryGetRunSeed(), null);
    const real = Math.random;
    Math.random = () => 0.5;
    try {
        const expected = new SeededRng(0xb007d06, 'boot').fork('creatures');
        const got = Array.from({ length: 5 }, () => gameplayRandom('creatures'));
        assert.deepEqual(got, Array.from({ length: 5 }, () => expected.random()));
    } finally {
        Math.random = real;
    }
});
