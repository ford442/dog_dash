import type { GhostFrame, GhostFrameDelta, GhostRecording, StoredGhostRecording } from './types';
import { GHOST_SCHEMA_VERSION } from './types';

export function compressFrames(frames: GhostFrame[]): { base: GhostFrame; deltas: GhostFrameDelta[] } {
    if (frames.length === 0) {
        return { base: { t: 0, x: 0, y: 0, actions: 0 }, deltas: [] };
    }
    const [base, ...rest] = frames;
    let prev = base;
    const deltas: GhostFrameDelta[] = [];
    for (const frame of rest) {
        deltas.push({
            dt: frame.t - prev.t,
            dx: frame.x - prev.x,
            dy: frame.y - prev.y,
            actions: frame.actions
        });
        prev = frame;
    }
    return { base, deltas };
}

export function decompressFrames(base: GhostFrame, deltas: GhostFrameDelta[]): GhostFrame[] {
    const frames: GhostFrame[] = [base];
    let prev = base;
    for (const d of deltas) {
        const frame: GhostFrame = {
            t: prev.t + d.dt,
            x: prev.x + d.dx,
            y: prev.y + d.dy,
            actions: d.actions
        };
        frames.push(frame);
        prev = frame;
    }
    return frames;
}

export function toStored(recording: GhostRecording): StoredGhostRecording {
    const { base, deltas } = compressFrames(recording.frames);
    return {
        version: GHOST_SCHEMA_VERSION,
        seed: recording.seed,
        base,
        deltas,
        duration: recording.duration
    };
}

export function fromStored(stored: StoredGhostRecording): GhostRecording {
    return {
        version: GHOST_SCHEMA_VERSION,
        seed: stored.seed,
        frames: decompressFrames(stored.base, stored.deltas),
        duration: stored.duration
    };
}
