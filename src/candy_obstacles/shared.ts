/**
 * Candy Obstacles System for Dog Dash
 * Transforms asteroids into delicious sweet treats for a magical space adventure
 * Perfect for a 7-year-old girl player! 🍭🍬✨
 */

import type * as THREE from 'three';
import type { CandyAsteroid } from './candy_asteroid';
import type { GummyRing } from './gummy_ring';

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export enum CandyType {
    GUMMY = 'gummy',
    LOLLIPOP = 'lollipop',
    JELLYBEAN = 'jellybean',
    COTTON_CANDY = 'cotton_candy'
}

export enum CandyFlavor {
    STRAWBERRY = 'strawberry',   // Pink/Red
    LIME = 'lime',               // Green
    ORANGE = 'orange',           // Orange
    GRAPE = 'grape',             // Purple
    BLUEBERRY = 'blueberry',     // Blue
    LEMON = 'lemon'              // Yellow
}

export interface CollisionResult {
    candy: CandyAsteroid;
    type: 'bouncy' | 'damage' | 'collectible';
    response?: {
        bounceForce?: THREE.Vector3;
        particles?: boolean;
        sound?: string;
    };
}

export interface GummyRingCollisionResult {
    ring: GummyRing;
    type: 'thread' | 'graze' | 'destroyed';
    score?: number;
    bounceForce?: THREE.Vector3;
}

export interface CandyShard {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotation: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    life: number;
    maxLife: number;
    size: number;
    color: THREE.Color;
}

export interface SugarSparkle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    size: number;
    color: THREE.Color;
}

// ============================================================================
// COLOR PALETTES
// ============================================================================

export const CANDY_COLORS: Record<CandyFlavor, { primary: number; secondary: number; highlight: number }> = {
    [CandyFlavor.STRAWBERRY]: { primary: 0xff6b9d, secondary: 0xff8fab, highlight: 0xffb3c6 },
    [CandyFlavor.LIME]: { primary: 0x90ee90, secondary: 0x7cfc00, highlight: 0x98fb98 },
    [CandyFlavor.ORANGE]: { primary: 0xffa07a, secondary: 0xffb347, highlight: 0xffcc99 },
    [CandyFlavor.GRAPE]: { primary: 0xdda0dd, secondary: 0xda70d6, highlight: 0xe6e6fa },
    [CandyFlavor.BLUEBERRY]: { primary: 0x87ceeb, secondary: 0xadd8e6, highlight: 0xb0e0e6 },
    [CandyFlavor.LEMON]: { primary: 0xfffacd, secondary: 0xffec8b, highlight: 0xffffe0 }
};

export const LOLLIPOP_SWIRLS = [
    { primary: 0xff6b6b, secondary: 0xffffff }, // Red/White
    { primary: 0xff69b4, secondary: 0xffffff }, // Pink/White
    { primary: 0x9370db, secondary: 0xffff00 }, // Purple/Yellow (rainbow-ish)
    { primary: 0x00ced1, secondary: 0xff69b4 }, // Cyan/Pink
    { primary: 0xffa500, secondary: 0x90ee90 }  // Orange/Green
];
