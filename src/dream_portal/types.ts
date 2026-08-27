/**
 * Dream Portal types, theme colors, and small helpers.
 */

import * as THREE from 'three';
import type { PlayerMotionPort } from '../ports';

export const DEFAULT_DURATION = 35;
export const DEFAULT_TOY_COUNT = 18;
export const DEFAULT_ORB_COUNT = 8;
export const DEFAULT_HAZARD_COUNT = 4;

/** The player's X is frozen inside the pocket, so the room scrolls past them
 *  instead — same side-scroller reading, zero drift in the main world. */
export const ROOM_SCROLL_SPEED = 7;

export const PROMPT_RADIUS = 26;
export const ENTER_RADIUS = 3.2;
export const TOY_COLLECT_RADIUS = 2.4;
export const HAZARD_RADIUS = 2.6;
export const EXIT_RING_RADIUS = 3.6;
/** Exit ring stays inert briefly so arriving next to it can't bounce you out. */
export const EXIT_ARM_DELAY = 2.0;
export const TRANSITION_DURATION = 0.45;

export const TOY_SCORE = 60;
export const TOY_CORES = 2;
export const COMPLETION_CORES = 12;
export const COMPLETION_SCORE = 250;

export const THEME_COLORS = {
    pastel: { sky: 0x2b1f4a, glow: 0xffc8f0, accent: 0x9fe8ff },
    candy: { sky: 0x3a1730, glow: 0xffd1e8, accent: 0xffe9a8 },
    aurora: { sky: 0x102a3a, glow: 0xa8ffe0, accent: 0xc8b4ff }
} as const;

export type DreamPortalTheme = keyof typeof THEME_COLORS;

/** Level-config placement for a single portal door. */
export type DreamPortalPlacement = {
    /** World X of the door. */
    x: number;
    y?: number;
    z?: number;
    /** Seconds the player gets inside the room (defaults to 35). */
    durationSeconds?: number;
    toyCount?: number;
    orbCount?: number;
    hazardCount?: number;
    theme?: DreamPortalTheme;
};

export type DreamPortalReward = {
    cores: number;
    score: number;
    toysCollected: number;
    toysTotal: number;
    /** True when every toy in the room was gathered before the timer ran out. */
    cleared: boolean;
};

/** Everything the system needs from the game context, injected by the caller. */
export type DreamPortalCallbacks = {
    getPlayer: () => THREE.Object3D | null;
    /** Scroll speed, vertical clamp, and nudge — see `PlayerMotionPort`. */
    motion: PlayerMotionPort;
    /** Snap the camera after a teleport so it doesn't lerp across the gap. */
    snapCamera: (y: number) => void;
    spawnOrb: (x: number, y: number, z: number) => void;
    onEnter?: (portalPosition: THREE.Vector3) => void;
    onExit?: (reward: DreamPortalReward, exitPosition: THREE.Vector3) => void;
    onToyCollected?: (position: THREE.Vector3, score: number) => void;
    onBumper?: (position: THREE.Vector3) => void;
    onPromptShown?: (portalPosition: THREE.Vector3) => void;
};

export type PortalInstance = {
    group: THREE.Group;
    ring: THREE.Mesh;
    core: THREE.Mesh;
    placement: Required<Omit<DreamPortalPlacement, 'theme'>> & { theme: DreamPortalTheme };
    used: boolean;
    phase: number;
};

export type ToyState = {
    base: THREE.Vector3;
    phase: number;
    spin: number;
    scale: number;
    collected: boolean;
};

export type HazardState = {
    mesh: THREE.Mesh;
    base: THREE.Vector3;
    phase: number;
    amplitude: number;
    cooldown: number;
};

export type PortalState = 'idle' | 'entering' | 'inRoom' | 'exiting';

/**
 * The player never leaves z = 0, so every interaction test is measured in the
 * XY plane (with a loose depth tolerance) — otherwise props parked at a
 * decorative depth would be literally unreachable.
 */
export function distanceXY(a: THREE.Vector3, b: THREE.Vector3): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function makeGlowMaterial(hex: number, opacity: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
    });
}

