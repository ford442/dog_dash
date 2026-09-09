/**
 * Victory System for Dog Dash
 * The MOST satisfying victory celebration for a 7-year-old girl! 🏆✨🌙
 * 
 * Features:
 * - Moon approach sequence with gradual slow-down
 * - Magical landing with dog victory dance
 * - Fireworks, confetti, and star rain
 * - Golden celebration atmosphere
 * - Floating thank-you notes from moon palace
 * - Play Again / Back to Menu buttons
 */

import * as THREE from 'three';

// =============================================================================
// VICTORY STATE ENUM
// =============================================================================

export { VictoryState } from './victory_state';

// =============================================================================
// TYPES AND CONFIGURATION
// =============================================================================

export interface FireworkParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    color: THREE.Color;
    type: 'spark' | 'heart' | 'star' | 'trail';
}

export interface ConfettiPiece {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotation: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    life: number;
    color: number;
}

export interface StarRainParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    twinklePhase: number;
}

export interface FloatingText {
    element: HTMLDivElement;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    scale: number;
}

export interface ThankYouNote {
    group: THREE.Group;
    velocity: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    life: number;
    message: string;
}

// Magical pastel colors for celebrations
export const CELEBRATION_COLORS = [
    0xFFD700, // Gold
    0xFF69B4, // Hot Pink
    0x9370DB, // Medium Purple
    0x00CED1, // Dark Turquoise
    0x98FB98, // Pale Green
    0xFFB6C1, // Light Pink
    0xFFA500, // Orange
    0xFF1493, // Deep Pink
];

export const CONFETTI_COLORS = [
    0xFFD700, // Gold
    0xFFB6C1, // Light Pink
    0xE6E6FA, // Lavender
    0x98FB98, // Pale Green
    0x87CEEB, // Sky Blue
    0xFFA07A, // Light Salmon
    0xDDA0DD, // Plum
    0xF0E68C, // Khaki
];

// Victory messages that float up
export const VICTORY_MESSAGES = [
    "YOU DID IT!",
    "AMAZING!",
    "WOW!",
    "⭐⭐⭐",
    "SUPER STAR!",
    "MOON MISSION COMPLETE!",
    "BEST PILOT EVER!",
    "🐕🏆🌙",
];

