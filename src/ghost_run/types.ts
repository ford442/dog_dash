import type { RunSeed } from '../run_seed/types';

export const GHOST_SCHEMA_VERSION = 1;
export const GHOST_TICK_HZ = 25;
export const GHOST_TICK_INTERVAL = 1 / GHOST_TICK_HZ;

/**
 * Bitfield: boost|roll|bark|tether|releaseTether|fire, plus the held
 * movement keys and grenade latch. The low six bits are what the 25 Hz
 * ghost frames have always stored; the full mask is what the per-step
 * input trace (`input_trace.ts`) stores for re-simulation.
 */
export type GhostActionFlags = number;

export const GhostAction = {
    BOOST: 1,
    ROLL: 2,
    BARK: 4,
    TETHER: 8,
    RELEASE_TETHER: 16,
    FIRE: 32,
    /** Thrust: Space / W / Up, or D / Right. */
    UP: 64,
    /** Dive: A / Left. */
    DOWN: 128,
    /** Shift held (hold-to-boost, fairy-wing float). */
    RUN: 256,
    GRENADE: 512
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
    /** Chapter the run started in (absent on recordings made before input traces). */
    startChapter?: number;
    /**
     * Run-length encoded per-sim-step input masks (`input_trace.ts`). With the
     * seed and start chapter this is enough to re-simulate the run headlessly.
     */
    inputs?: number[];
    /** True if any touch input was seen — touch-only paths are not re-simulated yet. */
    touchUsed?: boolean;
};

export type StoredGhostRecording = {
    version: typeof GHOST_SCHEMA_VERSION;
    seed: RunSeed;
    base: GhostFrame;
    deltas: GhostFrameDelta[];
    duration: number;
    startChapter?: number;
    inputs?: number[];
    touchUsed?: boolean;
};
