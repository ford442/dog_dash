/**
 * gpu_chores/wasm_backend.ts
 * AssemblyScript tier for synchronous chore ops.
 *
 * Uses the *same* WASM instance gameplay collision already runs on — chores
 * only touch their own `allocChoreValues` / `allocChoreIndices` buffers, so
 * the asteroid / spore / boss hitbox buffers (and therefore collision
 * determinism) are untouched.
 *
 * A WASM build predating the chore exports simply fails `supportsChores` and
 * the adapter falls through to the JS backend.
 */

import type { ReduceOp, SyncChoresBackend } from './types';
import { compactJs, reduceJs } from './js_backend';

const REDUCE_OP_CODE: Record<ReduceOp, number> = { sum: 0, max: 1, min: 2 };

/** The chore-op subset a WASM instance must export to serve this tier. */
export interface ChoresWasmExports {
    memory: WebAssembly.Memory;
    allocChoreValues(count: number): number;
    allocChoreIndices(count: number): number;
    choresCompact(count: number, epsilon: number): number;
    choresReduce(count: number, op: number): number;
}

export function supportsChores(exports: unknown): exports is ChoresWasmExports {
    const candidate = exports as Partial<ChoresWasmExports> | null | undefined;
    return !!candidate
        && typeof candidate.allocChoreValues === 'function'
        && typeof candidate.allocChoreIndices === 'function'
        && typeof candidate.choresCompact === 'function'
        && typeof candidate.choresReduce === 'function'
        && !!candidate.memory;
}

export function createWasmChoresBackend(exports: ChoresWasmExports): SyncChoresBackend {
    // Views are rebuilt whenever WASM memory grows and detaches the old buffer.
    let buffer: ArrayBuffer | null = null;
    let f32: Float32Array | null = null;
    let i32: Int32Array | null = null;

    function refreshViews(): void {
        const current = exports.memory.buffer;
        if (buffer !== current || !f32 || !i32) {
            buffer = current;
            f32 = new Float32Array(current);
            i32 = new Int32Array(current);
        }
    }

    function writeValues(values: Float32Array, count: number): number {
        const valuesPtr = exports.allocChoreValues(count);
        refreshViews();
        f32!.set(values.subarray(0, count), valuesPtr >>> 2);
        return valuesPtr;
    }

    return {
        id: 'wasm',

        compact(values: Float32Array, count: number, out: Uint32Array, epsilon: number): number {
            const limit = Math.min(count, values.length, out.length);
            if (limit <= 0) return 0;

            writeValues(values, limit);
            const indicesPtr = exports.allocChoreIndices(limit);
            // allocChoreIndices may have grown memory and detached the views.
            refreshViews();

            const kept = exports.choresCompact(limit, epsilon);
            if (kept <= 0) return 0;

            const base = indicesPtr >>> 2;
            for (let i = 0; i < kept; i++) {
                out[i] = i32![base + i];
            }
            return kept;
        },

        reduce(values: Float32Array, count: number, op: ReduceOp): number {
            const limit = Math.min(count, values.length);
            if (limit <= 0) return 0;

            writeValues(values, limit);
            return exports.choresReduce(limit, REDUCE_OP_CODE[op]);
        }
    };
}

/** Escape hatch used by tests and by the adapter when WASM is unavailable. */
export const jsFallbackOps = { compactJs, reduceJs };
