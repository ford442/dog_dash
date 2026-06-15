import * as THREE from 'three';

/**
 * Shared interaction result type for bespoke bestiary creatures
 * (Crystal Tarsier Guardian, Living Geode Titan, etc).
 */
export interface CreatureInteractionResult {
    type:
        | 'tarsier_guardian_blessing'
        | 'tarsier_guardian_shatter'
        | 'geode_titan_flythrough'
        | 'geode_titan_shatter';
    position: THREE.Vector3;
    cores?: number;
    label?: string;
}
