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

// Same seed + same per-step input trace -> identical end pose, whatever the
// display rate. The headless chapter replays (tests/replay/) check this on
// the real sim; this pins the contract on the accumulator alone with a toy
// momentum sim that has a seeded random gust each step.
test('same seed + same input trace gives an identical end pose at 30 / 60 / 144 Hz', async () => {
    const { SeededRng } = await import('../../src/run_seed/rng.ts');
    const { decodeInputTrace, encodeInputTrace } = await import('../../src/ghost_run/input_trace.ts');

    const traceRng = new SeededRng(99);
    const trace = encodeInputTrace(Array.from({ length: 600 }, () => (traceRng.random() < 0.4 ? 1 : 0)));

    function run(displayHz: number) {
        const inputs = decodeInputTrace(trace);
        const rng = new SeededRng(1234);
        let x = 0, y = 0, vy = 0, step = 0, acc = 0;
        while (step < inputs.length) {
            const { steps, remainder } = advanceAccumulator(acc, 1 / displayHz);
            acc = remainder;
            for (let i = 0; i < steps && step < inputs.length; i++, step++) {
                const thrust = inputs[step] ? 30 : -18;
                vy += (thrust - vy) * 0.1 + (rng.random() - 0.5);
                y += vy * SIM_STEP;
                x += 8 * SIM_STEP;
            }
        }
        return { x, y, vy };
    }

    const at60 = run(60);
    assert.deepEqual(run(30), at60);
    assert.deepEqual(run(144), at60);
});
