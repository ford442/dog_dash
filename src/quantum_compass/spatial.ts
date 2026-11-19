/**
 * Feeds Quantum Compass targets into the gameplay spatial hash on their own
 * `CollisionLayer.Rare` layer. Only runs while the compass is on, and the
 * records are appended after every gameplay entity, so campaign runs without
 * the compass build exactly the hash they always did.
 */
import type * as THREE from 'three';
import { game } from '../game_runtime';
import { CollisionLayer, type SpatialIndex } from '../spatial_index';
import type { GeologicalWorldPort } from '../ports/geological_world_port';
import { isRareResource } from './picker';

/** Broad-phase radius each rare record is inserted with (the compass query does the reach). */
const RARE_RADIUS = 1;

let tracking = false;

export function setQuantumCompassTracking(on: boolean): void {
    tracking = on;
}

export function isQuantumCompassTracking(): boolean {
    return tracking;
}

function addAll(index: SpatialIndex, list: readonly THREE.Object3D[] | undefined): void {
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
        const obj = list[i];
        // Mined / cleaned-up props leave the scene graph before they leave their list.
        if (!obj.parent || !obj.visible || !isRareResource(obj.userData)) continue;
        const p = obj.position;
        index.add(p.x, p.y, p.z, RARE_RADIUS, CollisionLayer.Rare, i, 'rare', obj);
    }
}

export function collectRareSpatial(index: SpatialIndex, world: GeologicalWorldPort): void {
    addAll(index, world.magmaHearts);
    addAll(index, world.iceNeedleClusters);
    addAll(index, world.geodes);
    addAll(index, game.derelictBuoyManager?.getUnhackedBuoys?.());
}
