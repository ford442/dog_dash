import * as THREE from 'three';
import { createGravityAnchorAtPosition, createGeodeAtPosition, createIceNeedleClusterAtPosition } from '../environment';
import type { GeologicalWorld } from '../geological/world';
import type { SlingableObjectConfig } from '../slingable_objects';
import { game } from '../game_runtime';
import { gameplayRandom } from '../run_seed';

export function spawnTarsiersForGravityAnchor(anchor: THREE.Group) {
    if (game.debugSystem.isEnabled('spaceFriends')) {
        const count = 2 + Math.floor(gameplayRandom('slingables') * 3);
        game.friendsManager.spawnTarsiersNearAnchor(anchor.position, count);
    }
}

function maybeSpawnLemurOnProp(anchor: THREE.Object3D | null | undefined, perchType: 'geode' | 'gravityAnchor' | 'iceNeedle' | 'industrial') {
    if (!anchor) return;
    if (!game.debugSystem.isEnabled('spaceFriends')) return;
    const cfg = game.levelManager.config[game.levelManager.currentLevel];
    game.friendsManager.maybeSpawnLemurOnPerch(anchor, perchType, cfg);
}

export function createGravityAnchorWithTarsiers(world: GeologicalWorld, x: number, y: number, z: number, biome: number = 0) {
    const anchor = createGravityAnchorAtPosition(world, x, y, z, biome);
    spawnTarsiersForGravityAnchor(anchor);
    maybeSpawnLemurOnProp(anchor, 'gravityAnchor');
    return anchor;
}

export function createGeodeAtPositionWithLemur(world: GeologicalWorld, x: number, y: number, z: number) {
    const geode = createGeodeAtPosition(world, x, y, z);
    maybeSpawnLemurOnProp(geode, 'geode');
    return geode;
}

export function createIceNeedleClusterAtPositionWithLemur(world: GeologicalWorld, x: number, y: number, z: number) {
    const cluster = createIceNeedleClusterAtPosition(world, x, y, z);
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
