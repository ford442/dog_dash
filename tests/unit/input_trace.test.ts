import test from 'node:test';
import assert from 'node:assert/strict';
import {
    decodeInputTrace,
    encodeInputTrace,
    inputTraceLength,
    InputTraceWriter
} from '../../src/ghost_run/input_trace.ts';
import { GhostRunRecorder } from '../../src/ghost_run/recorder.ts';
import { fromStored, toStored } from '../../src/ghost_run/codec.ts';
import { GhostAction } from '../../src/ghost_run/types.ts';
import { RUN_SEED_SCHEMA_VERSION } from '../../src/run_seed/types.ts';

const SEED = { version: RUN_SEED_SCHEMA_VERSION, campaignId: 'campaign' as const, rngSeed: 42, modifiers: [] };

test('input trace RLE round-trips', () => {
    const masks = [0, 0, 0, GhostAction.UP, GhostAction.UP, GhostAction.UP | GhostAction.FIRE, 0, 0];
    const rle = encodeInputTrace(masks);
    assert.deepEqual(rle, [3, 0, 2, GhostAction.UP, 1, GhostAction.UP | GhostAction.FIRE, 2, 0]);
    assert.deepEqual(decodeInputTrace(rle), masks);
    assert.equal(inputTraceLength(rle), masks.length);
});

test('InputTraceWriter matches the batch encoder', () => {
    const masks = [1, 1, 2, 2, 2, 0, 1];
    const w = new InputTraceWriter();
    for (const m of masks) w.push(m);
    assert.deepEqual(w.toArray(), encodeInputTrace(masks));
    assert.equal(w.stepCount(), masks.length);
});

test('decodeInputTrace rejects malformed runs', () => {
    assert.throws(() => decodeInputTrace([1]));
    assert.throws(() => decodeInputTrace([0, 1]));
    assert.throws(() => decodeInputTrace([1, -1]));
});

test('ghost recorder stores the per-step input trace and start chapter, and the codec keeps them', () => {
    const rec = new GhostRunRecorder();
    rec.begin(SEED);
    rec.setStartChapter(4);
    for (let i = 0; i < 90; i++) {
        rec.recordInput(i < 30 ? GhostAction.UP : 0);
        rec.tick(1 / 60, i, 0, 0);
    }
    const recording = rec.stop()!;
    assert.equal(recording.startChapter, 4);
    assert.equal(recording.touchUsed, false);
    assert.deepEqual(recording.inputs, [30, GhostAction.UP, 60, 0]);
    assert.ok(Math.abs(rec.getElapsed() - 1.5) < 1e-9);

    const back = fromStored(toStored(recording));
    assert.deepEqual(back.inputs, recording.inputs);
    assert.equal(back.startChapter, 4);
});

test('recordings made before input traces still decode', () => {
    const legacy = { version: 1 as const, seed: SEED, base: { t: 0, x: 0, y: 0, actions: 0 }, deltas: [], duration: 0 };
    const back = fromStored(legacy);
    assert.equal(back.inputs, undefined);
    assert.equal('startChapter' in back, false);
});
