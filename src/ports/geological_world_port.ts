import type * as THREE from 'three';
import type { SporeCloud } from '../geological/spore_gravity';

/** Read-only view of live geological objects needed by spatial hashing and collision queries. */
export interface GeologicalWorldPort {
    readonly sporeClouds: readonly SporeCloud[];
    readonly gravityAnchors: readonly THREE.Group[];
    /** Rare-resource sources the Quantum Compass tracks (optional so test ports can omit them). */
    readonly geodes?: readonly THREE.Object3D[];
    readonly magmaHearts?: readonly THREE.Object3D[];
    readonly iceNeedleClusters?: readonly THREE.Object3D[];
}
