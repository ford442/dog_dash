import * as THREE from 'three';

export interface InteractionResult {
    type: 'kitty_wave' | 'bunny_heal' | 'lantern_pop' | 'tarsier_cheer' | 'tarsier_panic' | 'otter_gift' | 'otter_sploosh' | 'penguin_slide' | 'penguin_ice_trail' | 'seal_clap' | 'seal_bubble_puff' | 'astro_bunny_lucky' | 'astro_bunny_sparkle' | 'lemur_heart_gift' | 'lemur_panic';
    position: THREE.Vector3;
    bonus?: number;
    healthRestore?: number;
    /** Seconds of slide-assist buff for the player (penguin belly slide). */
    slideAssistDuration?: number;
}

export type TrappedFriendKind = 'kitty' | 'bunny' | 'tarsier' | 'moonpup' | 'otter' | 'penguin' | 'sealpup' | 'astrobunny' | 'lemur';

export const TRAPPED_FRIEND_COLORS: Record<TrappedFriendKind, number> = {
    kitty: 0xfff0f5,
    bunny: 0xffd9a0,
    tarsier: 0xb088ff,
    moonpup: 0xffe4b5,
    otter: 0xc9a86c,
    penguin: 0xe8e8f0,
    sealpup: 0xd4c4b0,
    astrobunny: 0xfff0f5,
    lemur: 0xb8a0cc
};
