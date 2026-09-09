import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PositionInterpolator } from '../../src/main/render_interpolation.ts';

test('getInterpolated returns null before any step is recorded', () => {
    const interpolator = new PositionInterpolator();
    assert.equal(interpolator.hasSample(), false);
    assert.equal(interpolator.getInterpolated(0.5), null);
});

test('the first recorded step has no previous state to blend from', () => {
    const interpolator = new PositionInterpolator();
    interpolator.recordStep(new THREE.Vector3(10, 0, 0));
    const blended = interpolator.getInterpolated(0.5)!;
    assert.equal(blended.x, 10);
});

test('blends between the last two recorded steps', () => {
    const interpolator = new PositionInterpolator();
    interpolator.recordStep(new THREE.Vector3(0, 0, 0));
    interpolator.recordStep(new THREE.Vector3(10, 0, 0));

    assert.equal(interpolator.getInterpolated(0)!.x, 0);
    assert.equal(interpolator.getInterpolated(1)!.x, 10);
    assert.equal(interpolator.getInterpolated(0.5)!.x, 5);
});

test('after multiple steps in one frame, only the last two states are blended', () => {
    const interpolator = new PositionInterpolator();
    interpolator.recordStep(new THREE.Vector3(0, 0, 0));
    interpolator.recordStep(new THREE.Vector3(10, 0, 0));
    interpolator.recordStep(new THREE.Vector3(20, 0, 0));
    interpolator.recordStep(new THREE.Vector3(30, 0, 0));

    // Must blend between 20 and 30, not between the very first (0) and last (30).
    assert.equal(interpolator.getInterpolated(0)!.x, 20);
    assert.equal(interpolator.getInterpolated(1)!.x, 30);
});

test('getInterpolated clamps alpha outside [0, 1]', () => {
    const interpolator = new PositionInterpolator();
    interpolator.recordStep(new THREE.Vector3(0, 0, 0));
    interpolator.recordStep(new THREE.Vector3(10, 0, 0));

    assert.equal(interpolator.getInterpolated(-5)!.x, 0);
    assert.equal(interpolator.getInterpolated(5)!.x, 10);
});

test('reset clears the sample', () => {
    const interpolator = new PositionInterpolator();
    interpolator.recordStep(new THREE.Vector3(1, 2, 3));
    interpolator.reset();
    assert.equal(interpolator.hasSample(), false);
    assert.equal(interpolator.getInterpolated(0.5), null);
});
