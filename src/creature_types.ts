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
        | 'geode_titan_shatter'
        | 'puff_puffer_catalog'
        | 'puff_puffer_bubble_pop';
    position: THREE.Vector3;
    cores?: number;
    score?: number;
    label?: string;
    /** Extra graze near-miss window distance (obstacle_system). */
    grazeWindowBonus?: number;
    grazeWindowDuration?: number;
}
