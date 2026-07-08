import * as THREE from 'three';
import { createGravityAnchorAtPosition } from '../environment';
import type { SlingableObjectConfig } from '../slingable_objects';
import { game } from '../game_runtime';

export function spawnTarsiersForGravityAnchor(anchor: THREE.Group) {
    // Spawn 2–4 Astro Tarsiers that cling and orbit this anchor
    if (game.debugSystem.isEnabled('spaceFriends')) {
        const count = 2 + Math.floor(Math.random() * 3);
        game.friendsManager.spawnTarsiersNearAnchor(anchor.position, count);
    }
}

export function createGravityAnchorWithTarsiers(x: number, y: number, z: number, biome: number = 0) {
    const anchor = createGravityAnchorAtPosition(x, y, z, biome);
    spawnTarsiersForGravityAnchor(anchor);
    return anchor;
}

export function createSlingableObjectAtPosition(
    x: number,
    y: number,
    z: number,
    options: SlingableObjectConfig = {}
) {
    return game.slingableObjectSystem.createObject(new THREE.Vector3(x, y, z), options);
}
