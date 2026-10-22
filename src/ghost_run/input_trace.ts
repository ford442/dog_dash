import type { GhostActionFlags } from './types';

/**
 * Per-sim-step input trace, run-length encoded as a flat
 * `[count, mask, count, mask, ...]` array. One entry per fixed step (60 Hz),
 * so a trace replays identically regardless of the display refresh rate it
 * was recorded at.
 */
export function encodeInputTrace(masks: readonly GhostActionFlags[]): number[] {
    const out: number[] = [];
    for (const mask of masks) {
        const last = out.length - 1;
        if (last > 0 && out[last] === mask) {
            out[last - 1]++;
        } else {
            out.push(1, mask);
        }
    }
    return out;
}

export function decodeInputTrace(rle: readonly number[]): GhostActionFlags[] {
    if (rle.length % 2 !== 0) throw new Error('[input_trace] RLE array must have even length');
    const out: GhostActionFlags[] = [];
    for (let i = 0; i < rle.length; i += 2) {
        const count = rle[i];
        const mask = rle[i + 1];
        if (!Number.isInteger(count) || count < 1 || !Number.isInteger(mask) || mask < 0) {
            throw new Error(`[input_trace] invalid run at index ${i}`);
        }
        for (let n = 0; n < count; n++) out.push(mask);
    }
    return out;
}

/** Total number of steps covered by an encoded trace. */
export function inputTraceLength(rle: readonly number[]): number {
    let total = 0;
    for (let i = 0; i < rle.length; i += 2) total += rle[i];
    return total;
}

/** Appends one step at a time without materialising the full mask array. */
export class InputTraceWriter {
    private rle: number[] = [];

    reset(): void {
        this.rle = [];
    }

    push(mask: GhostActionFlags): void {
        const last = this.rle.length - 1;
        if (last > 0 && this.rle[last] === mask) {
            this.rle[last - 1]++;
        } else {
            this.rle.push(1, mask);
        }
    }

    toArray(): number[] {
        return [...this.rle];
    }

    stepCount(): number {
        return inputTraceLength(this.rle);
    }
}
