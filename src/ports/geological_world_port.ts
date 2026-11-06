import type * as THREE from 'three';
import type { SporeCloud } from '../geological/spore_gravity';

/** Read-only view of live geological objects needed by spatial hashing and collision queries. */
export interface GeologicalWorldPort {
    readonly sporeClouds: readonly SporeCloud[];
    readonly gravityAnchors: readonly THREE.Group[];
}
