/**
 * gpu_chores/js_backend.ts
 * Reference implementation of every chore op.
 *
 * This backend defines the semantics; the WASM and WebGPU tiers must agree
 * with it. It is always available, so it is the terminal fallback.
 */

import type { ReduceOp, SyncChoresBackend } from './types';

export function compactJs(
    values: Float32Array,
    count: number,
    out: Uint32Array,
    epsilon: number
): number {
    const limit = Math.min(count, values.length, out.length);
    let kept = 0;
    for (let i = 0; i < limit; i++) {
        if (values[i] > epsilon) {
            out[kept++] = i;
        }
    }
    return kept;
}

export function reduceJs(values: Float32Array, count: number, op: ReduceOp): number {
    const limit = Math.min(count, values.length);
    if (limit <= 0) return 0;

    if (op === 'sum') {
        let sum = 0;
        for (let i = 0; i < limit; i++) sum += values[i];
        return sum;
    }

    let acc = values[0];
    if (op === 'max') {
        for (let i = 1; i < limit; i++) if (values[i] > acc) acc = values[i];
    } else {
        for (let i = 1; i < limit; i++) if (values[i] < acc) acc = values[i];
    }
    return acc;
}

export function createJsChoresBackend(): SyncChoresBackend {
    return {
        id: 'js',
        compact: compactJs,
        reduce: reduceJs
    };
}
