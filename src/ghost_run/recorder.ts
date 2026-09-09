import type { RunSeed } from '../run_seed/types';
import { seedsMatch } from '../run_seed/codec';
import {
    GHOST_SCHEMA_VERSION,
    GHOST_TICK_INTERVAL,
    GhostAction,
    type GhostActionFlags,
    type GhostFrame,
    type GhostRecording
} from './types';
import { fromStored, toStored } from './codec';
import type { StoredGhostRecording } from './types';

const STORAGE_KEY = 'dog_dash_ghost_v1';
const MAX_STORAGE_BYTES = 32 * 1024;

export class GhostRunRecorder {
    private frames: GhostFrame[] = [];
    private accumulator = 0;
    private elapsed = 0;
    private seed: RunSeed | null = null;
    private recording = false;

    begin(seed: RunSeed): void {
        this.seed = seed;
        this.frames = [];
        this.accumulator = 0;
        this.elapsed = 0;
        this.recording = true;
    }

    stop(): GhostRecording | null {
        this.recording = false;
        if (!this.seed || this.frames.length === 0) return null;
        return {
            version: GHOST_SCHEMA_VERSION,
            seed: this.seed,
            frames: [...this.frames],
            duration: this.elapsed
        };
    }

    /**
     * Sample player pose + action latches at ~25 Hz.
     * Call each frame after player update with logical action flags.
     */
    tick(delta: number, x: number, y: number, actions: GhostActionFlags): void {
        if (!this.recording) return;
        this.elapsed += delta;
        this.accumulator += delta;
        while (this.accumulator >= GHOST_TICK_INTERVAL) {
            this.accumulator -= GHOST_TICK_INTERVAL;
            this.frames.push({
                t: this.elapsed,
                x,
                y,
                actions
            });
        }
    }

    getFrameCount(): number {
        return this.frames.length;
    }
}

function decimateFrames(frames: GhostFrame[], factor: number): GhostFrame[] {
    if (factor <= 1) return frames;
    const out: GhostFrame[] = [];
    for (let i = 0; i < frames.length; i += factor) {
        out.push(frames[i]);
    }
    const last = frames[frames.length - 1];
    if (out[out.length - 1] !== last) out.push(last);
    return out;
}

export function saveGhostRecording(recording: GhostRecording): boolean {
    let frames = recording.frames;
    let stored = toStored({ ...recording, frames });

    const encode = () => JSON.stringify(stored);
    while (encode().length > MAX_STORAGE_BYTES && frames.length > 4) {
        frames = decimateFrames(frames, 2);
        stored = toStored({ ...recording, frames });
        console.warn('[ghost_run] Decimating frames to fit storage cap');
    }

    const json = encode();
    if (json.length > MAX_STORAGE_BYTES) {
        console.warn('[ghost_run] Recording too large after decimation — discarding');
        return false;
    }

    try {
        localStorage.setItem(STORAGE_KEY, json);
        return true;
    } catch (e) {
        console.warn('[ghost_run] Failed to save ghost:', e);
        return false;
    }
}

export function loadGhostRecording(): GhostRecording | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredGhostRecording;
        if (parsed.version !== GHOST_SCHEMA_VERSION) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        if (!parsed.base || !Array.isArray(parsed.deltas) || !parsed.seed) {
            return null;
        }
        return fromStored(parsed);
    } catch {
        return null;
    }
}

export function ghostMatchesSeed(recording: GhostRecording | null, seed: RunSeed): boolean {
    if (!recording) return false;
    return seedsMatch(recording.seed, seed);
}

export function buildActionFlags(opts: {
    wantsBoost?: boolean;
    wantsRoll?: boolean;
    wantsBark?: boolean;
    wantsTether?: boolean;
    wantsReleaseTether?: boolean;
    fire?: boolean;
}): GhostActionFlags {
    let flags: GhostActionFlags = 0;
    if (opts.wantsBoost) flags |= GhostAction.BOOST;
    if (opts.wantsRoll) flags |= GhostAction.ROLL;
    if (opts.wantsBark) flags |= GhostAction.BARK;
    if (opts.wantsTether) flags |= GhostAction.TETHER;
    if (opts.wantsReleaseTether) flags |= GhostAction.RELEASE_TETHER;
    if (opts.fire) flags |= GhostAction.FIRE;
    return flags;
}

/** Module singleton used by the game loop. */
export const ghostRunRecorder = new GhostRunRecorder();
