import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createProceduralDog, placeProceduralDogOnRocket } from '../../src/dog_cockpit/procedural_dog.ts';

test('createProceduralDog returns named body/head/tail/ears under pilotGroup', () => {
    const { group, bones } = createProceduralDog();

    assert.equal(group.name, 'pilotGroup');
    assert.equal(bones.pilotGroup, group);
    assert.ok(bones.body, 'body');
    assert.ok(bones.head, 'head');
    assert.ok(bones.tail, 'tail');
    assert.ok(bones.leftEar, 'leftEar');
    assert.ok(bones.rightEar, 'rightEar');
    assert.ok(bones.nose, 'nose');
    assert.equal(bones.body!.name, 'body');
    assert.equal(bones.head!.name, 'head');
    assert.equal(bones.tail!.name, 'tail');
    assert.equal(bones.leftEar!.name, 'leftEar');
    assert.equal(bones.nose!.name, 'nose');

    assert.equal(bones.body!.parent, group);
    assert.equal(bones.head!.parent, bones.body);
    assert.equal(bones.leftEar!.parent, bones.head);
    assert.equal(bones.tail!.parent, bones.body);
});

test('placeProceduralDogOnRocket parents scale to rocket size', () => {
    const rocket = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
    rocket.add(hull);
    rocket.updateMatrixWorld(true);

    const { group } = createProceduralDog();
    placeProceduralDogOnRocket(group, rocket);
    rocket.add(group);

    assert.ok(group.scale.x > 0);
    assert.ok(Math.abs(group.position.y) > 0);
});
