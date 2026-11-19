/**
 * Extractor Beam targets, read straight from the GeologicalWorld lists so the
 * beam never keeps a second global registry of flora. Allowlist:
 * jelly-moss (alive), charged geodes, kelp with a live node, magma hearts
 * in their cooldown phase (the only safe time to siphon one).
 */

import type * as THREE from 'three';
import type { ExtractCandidate } from './beam';

export interface ExtractableWorld {
    readonly jellyMosses: readonly THREE.Object3D[];
    readonly geodes: readonly THREE.Object3D[];
    readonly vacuumKelps: readonly THREE.Object3D[];
    readonly magmaHearts: readonly THREE.Object3D[];
}

const _out: ExtractCandidate<THREE.Object3D>[] = [];

function push(ref: THREE.Object3D, species: ExtractCandidate['species']): void {
    _out.push({ ref, species, x: ref.position.x, y: ref.position.y, z: ref.position.z });
}

/** Reused array — consume before the next call. */
export function collectExtractCandidates(world: ExtractableWorld): readonly ExtractCandidate<THREE.Object3D>[] {
    _out.length = 0;
    for (const moss of world.jellyMosses) {
        if (moss.visible && moss.userData.radius) push(moss, 'nebulaJellyMoss');
    }
    for (const geode of world.geodes) {
        if (geode.visible && !geode.userData.isDischarged) push(geode, 'fracturedGeode');
    }
    for (const kelp of world.vacuumKelps) {
        const nodes = kelp.userData.nodeStates as { alive: boolean }[] | undefined;
        if (kelp.visible && nodes?.some((n) => n.alive)) push(kelp, 'vacuumKelp');
    }
    for (const heart of world.magmaHearts) {
        if (heart.visible && heart.userData.coreAlive !== false && heart.userData.phase === 'cooldown') {
            push(heart, 'magmaHeart');
        }
    }
    return _out;
}
