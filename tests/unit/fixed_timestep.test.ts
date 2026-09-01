import test from 'node:test';
import assert from 'node:assert/strict';
import {
    advanceAccumulator,
    interpolationAlpha,
    SIM_STEP,
    SIM_HZ,
    MAX_STEPS_PER_FRAME
} from '../../src/main/fixed_timestep.ts';

test('SIM_STEP matches SIM_HZ', () => {
    assert.equal(SIM_STEP, 1 / SIM_HZ);
});

test('advanceAccumulator runs zero steps when under one SIM_STEP', () => {
    const result = advanceAccumulator(0, SIM_STEP * 0.5);
    assert.equal(result.steps, 0);
    assert.equal(result.remainder, SIM_STEP * 0.5);
});

test('advanceAccumulator runs exactly one step at the sim rate', () => {
    const result = advanceAccumulator(0, SIM_STEP);
    assert.equal(result.steps, 1);
    assert.ok(Math.abs(result.remainder) < 1e-12);
});

test('advanceAccumulator produces the same total simulated time at different frame rates', () => {
    // Simulate ~1 second of wall-clock time at three different frame rates
    // and confirm the same number of fixed steps run in each case.
    const rates = [30, 60, 144];
    const stepCounts = rates.map((hz) => {
        const frameDelta = 1 / hz;
        let acc = 0;
        let totalSteps = 0;
        for (let frame = 0; frame < hz; frame++) {
            const { steps, remainder } = advanceAccumulator(acc, frameDelta);
            totalSteps += steps;
            acc = remainder;
        }
        return totalSteps;
    });

    assert.deepEqual(stepCounts, [SIM_HZ, SIM_HZ, SIM_HZ]);
});

test('advanceAccumulator clamps a huge stall instead of spiraling', () => {
    const result = advanceAccumulator(0, 5.0); // a 5 second stall (e.g. tab backgrounded)
    assert.equal(result.steps, MAX_STEPS_PER_FRAME);
    assert.ok(result.remainder < SIM_STEP, 'backlog beyond the cap must be dropped, not queued');
});

test('advanceAccumulator never returns a negative remainder for a negative delta', () => {
    const result = advanceAccumulator(SIM_STEP * 0.5, -1);
    assert.equal(result.steps, 0);
    assert.equal(result.remainder, SIM_STEP * 0.5);
});

test('interpolationAlpha is 0 at the start of a step window and approaches 1 before the next step', () => {
    assert.equal(interpolationAlpha(0), 0);
    assert.ok(interpolationAlpha(SIM_STEP * 0.999) > 0.99);
    assert.equal(interpolationAlpha(SIM_STEP), 1);
});

test('interpolationAlpha clamps out-of-range remainders', () => {
    assert.equal(interpolationAlpha(-1), 0);
    assert.equal(interpolationAlpha(SIM_STEP * 5), 1);
});
