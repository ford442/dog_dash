import * as THREE from 'three';
import { createGravityAnchorAtPosition, createGeodeAtPosition, createIceNeedleClusterAtPosition } from '../environment';
import type { SlingableObjectConfig } from '../slingable_objects';
import { game } from '../game_runtime';

export function spawnTarsiersForGravityAnchor(anchor: THREE.Group) {
    if (game.debugSystem.isEnabled('spaceFriends')) {
        const count = 2 + Math.floor(Math.random() * 3);
        game.friendsManager.spawnTarsiersNearAnchor(anchor.position, count);
    }
}

function maybeSpawnLemurOnProp(anchor: THREE.Object3D, perchType: 'geode' | 'gravityAnchor' | 'iceNeedle' | 'industrial') {
    if (!game.debugSystem.isEnabled('spaceFriends')) return;
    const cfg = game.levelManager.config[game.levelManager.currentLevel];
    game.friendsManager.maybeSpawnLemurOnPerch(anchor, perchType, cfg);
}

export function createGravityAnchorWithTarsiers(x: number, y: number, z: number, biome: number = 0) {
    const anchor = createGravityAnchorAtPosition(x, y, z, biome);
    spawnTarsiersForGravityAnchor(anchor);
    maybeSpawnLemurOnProp(anchor, 'gravityAnchor');
    return anchor;
}

export function createGeodeAtPositionWithLemur(x: number, y: number, z: number) {
    const geode = createGeodeAtPosition(x, y, z);
    maybeSpawnLemurOnProp(geode, 'geode');
    return geode;
}

export function createIceNeedleClusterAtPositionWithLemur(x: number, y: number, z: number) {
    const cluster = createIceNeedleClusterAtPosition(x, y, z);
    maybeSpawnLemurOnProp(cluster, 'iceNeedle');
    return cluster;
}

export function createSlingableObjectAtPosition(
    x: number,
    y: number,
    z: number,
    options: SlingableObjectConfig = {}
) {
    return game.slingableObjectSystem.createObject(new THREE.Vector3(x, y, z), options);
}
