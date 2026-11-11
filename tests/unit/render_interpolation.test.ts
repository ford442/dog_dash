import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ObjectInterpolator, PositionInterpolator } from '../../src/main/render_interpolation.ts';

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

// --- ObjectInterpolator: projectiles, slingables, boss -----------------------

function stepAll(interp: ObjectInterpolator, objects: THREE.Object3D[]): void {
    interp.beginStep();
    for (const o of objects) interp.record(o);
    interp.endStep();
}

test('ObjectInterpolator blends each tracked object and restore() puts the sim pose back', () => {
    const interp = new ObjectInterpolator();
    const bolt = new THREE.Object3D();
    const boss = new THREE.Object3D();

    stepAll(interp, [bolt, boss]);
    bolt.position.set(1, 0, 0);
    boss.position.set(0, 2, 0);
    stepAll(interp, [bolt, boss]);

    interp.applyBlend(0.5);
    assert.equal(bolt.position.x, 0.5);
    assert.equal(boss.position.y, 1);
    interp.restore();
    assert.equal(bolt.position.x, 1);
    assert.equal(boss.position.y, 2);
});

test('ObjectInterpolator forgets objects not recorded in the latest step', () => {
    const interp = new ObjectInterpolator();
    const bolt = new THREE.Object3D();
    stepAll(interp, [bolt]);
    assert.equal(interp.size(), 1);
    stepAll(interp, []);
    assert.equal(interp.size(), 0);

    // Respawned from the pool somewhere else: starts fresh, no blend from the old spot.
    bolt.position.set(3, 0, 0);
    stepAll(interp, [bolt]);
    interp.applyBlend(0);
    assert.equal(bolt.position.x, 3);
    interp.restore();
});

test('ObjectInterpolator snaps instead of streaking across a teleport', () => {
    const interp = new ObjectInterpolator(8);
    const bolt = new THREE.Object3D();
    stepAll(interp, [bolt]);
    bolt.position.set(50, 0, 0);
    stepAll(interp, [bolt]);
    interp.applyBlend(0);
    assert.equal(bolt.position.x, 50);
    interp.restore();
    assert.equal(bolt.position.x, 50);
});
