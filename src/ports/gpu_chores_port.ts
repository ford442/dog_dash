import type { ReduceOp } from '../gpu_chores/types';

/**
 * Non-authoritative helper compute for visual systems.
 *
 * Deliberately thin: only the two synchronous, CPU-exact ops render code
 * needs. Chores never own gameplay state — see docs/GPU_CHORES.md.
 */
export interface GpuChoresPort {
    /** Indices of entries above `epsilon`, in input order. Returns the count. */
    compact(values: Float32Array, count: number, out: Uint32Array, epsilon?: number): number;
    /** Reduce over `values[0..count)`. */
    reduce(values: Float32Array, count: number, op: ReduceOp): number;
}
