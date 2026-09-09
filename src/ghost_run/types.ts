import type { RunSeed } from '../run_seed/types';

export const GHOST_SCHEMA_VERSION = 1;
export const GHOST_TICK_HZ = 25;
export const GHOST_TICK_INTERVAL = 1 / GHOST_TICK_HZ;

/** Bitfield: boost|roll|bark|tether|releaseTether|fire */
export type GhostActionFlags = number;

export const GhostAction = {
    BOOST: 1,
    ROLL: 2,
    BARK: 4,
    TETHER: 8,
    RELEASE_TETHER: 16,
    FIRE: 32
} as const;

export type GhostFrame = {
    t: number;
    x: number;
    y: number;
    actions: GhostActionFlags;
};

/** Delta-compressed on disk — dt, dx, dy, actions relative to prior frame. */
export type GhostFrameDelta = {
    dt: number;
    dx: number;
    dy: number;
    actions: GhostActionFlags;
};

export type GhostRecording = {
    version: typeof GHOST_SCHEMA_VERSION;
    seed: RunSeed;
    /** First frame is absolute; rest are deltas. */
    frames: GhostFrame[];
    duration: number;
};

export type StoredGhostRecording = {
    version: typeof GHOST_SCHEMA_VERSION;
    seed: RunSeed;
    base: GhostFrame;
    deltas: GhostFrameDelta[];
    duration: number;
};
