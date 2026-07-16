/** Shake intensity presets for different impact types */
export enum ShakeType {
    /** Tiny wobble on small impacts */
    LIGHT = 0.5,
    /** Noticeable shake on asteroid hits */
    MEDIUM = 1.0,
    /** Big shake on boss hits/explosions */
    HEAVY = 2.0,
    /** Massive shake on player damage */
    EARTHQUAKE = 3.5
}

import * as THREE from 'three';

/** Configuration for different shake types */
interface ShakeConfig {
    intensity: number;      // Base intensity in world units
    duration: number;       // Default duration in seconds
    frequency: number;      // Shake speed (oscillations per second)
    decay: number;          // How quickly shake fades (0-1)
}

export const SHAKE_CONFIGS: Record<ShakeType, ShakeConfig> = {
    [ShakeType.LIGHT]: {
        intensity: 0.1,
        duration: 0.15,
        frequency: 15,
        decay: 0.9
    },
    [ShakeType.MEDIUM]: {
        intensity: 0.25,
        duration: 0.3,
        frequency: 12,
        decay: 0.85
    },
    [ShakeType.HEAVY]: {
        intensity: 0.5,
        duration: 0.5,
        frequency: 10,
        decay: 0.8
    },
    [ShakeType.EARTHQUAKE]: {
        intensity: 1.0,
        duration: 0.8,
        frequency: 8,
        decay: 0.75
    }
};

/** Active screen shake effect */
export interface ActiveShake {
    intensity: number;
    duration: number;
    maxDuration: number;
    frequency: number;
    decay: number;
    time: number;
    offset: THREE.Vector3;
}

// =============================================================================
// PARTICLE BURST TYPES
// =============================================================================

/** Pre-configured burst patterns for different events */
export enum BurstType {
    /** Pastel sparkles on orb collect */
    COLLECT,
    /** Fire/smoke on asteroid destroy */
    EXPLOSION,
    /** Stars/hearts on power-up */
    MAGIC,
    /** Red warning particles on hit */
    DAMAGE,
    /** Rainbow celebration on level up */
    LEVEL_UP
}

/** Configuration for each burst type */
interface BurstConfig {
    colors: number[];
    count: number;
    speed: number;
    size: number;
    spread: number;
}

export const BURST_CONFIGS: Record<BurstType, BurstConfig> = {
    [BurstType.COLLECT]: {
        colors: [0xFFD700, 0xFFB6C1, 0xE6E6FA, 0x98FF98, 0x87CEEB], // Gold + pastels
        count: 12,
        speed: 2.5,
        size: 0.4,
        spread: 0.8
    },
    [BurstType.EXPLOSION]: {
        colors: [0xFF6B35, 0xF7931E, 0xFFD23F, 0x8B4513, 0x555555], // Fire + smoke
        count: 20,
        speed: 5.0,
        size: 0.6,
        spread: 1.5
    },
    [BurstType.MAGIC]: {
        colors: [0xFF69B4, 0x9370DB, 0xFFD700, 0x00CED1, 0xFF1493], // Rainbow magic
        count: 25,
        speed: 3.5,
        size: 0.5,
        spread: 1.0
    },
    [BurstType.DAMAGE]: {
        colors: [0xFF0000, 0xFF4444, 0xFF8888, 0x8B0000], // Red warning
        count: 15,
        speed: 4.0,
        size: 0.4,
        spread: 1.2
    },
    [BurstType.LEVEL_UP]: {
        colors: [0xFFD700, 0xFFA500, 0xFF69B4, 0x00FF00, 0x00CED1], // Celebration rainbow
        count: 40,
        speed: 4.0,
        size: 0.6,
        spread: 2.0
    }
};

// =============================================================================
// FLOATING TEXT SYSTEM
// =============================================================================

/** Active floating text element */
export interface FloatingText {
    element: HTMLDivElement;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    scale: number;
    bounces: number;
    baseY: number;
}

/** Predefined text styles */
export const TEXT_COLORS = {
    gold: '#FFD700',
    pink: '#FF69B4',
    red: '#FF4444',
    green: '#98FF98',
    blue: '#87CEEB',
    purple: '#9370DB',
    rainbow: 'linear-gradient(90deg, #FF69B4, #FFD700, #00CED1, #98FF98)',
    white: '#FFFFFF'
};

// =============================================================================
// CHROMATIC ABERRATION EFFECT
// =============================================================================

/** Active chromatic flash effect */
export interface ChromaticFlash {
    intensity: number;
    duration: number;
    maxDuration: number;
    color: THREE.Color;
    time: number;
}

/** Active white flash effect */
export interface WhiteFlash {
    duration: number;
    maxDuration: number;
    element: HTMLDivElement;
}

// =============================================================================
// HIT PAUSE (FRAME FREEZE) SYSTEM
// =============================================================================

/** Hit pause state */
export interface HitPauseState {
    duration: number;
    remaining: number;
}
