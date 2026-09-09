/**
 * gpu_chores/types.ts
 * Shared types for the GPU chores layer.
 *
 * ⚠ Chores are NOT a particle-sim port. They only ever compute *derived,
 * non-authoritative* values for rendering and HUD readouts. Gameplay state
 * (positions, velocities, collision, gravity, spore life) stays on the
 * AssemblyScript/CPU path. See docs/GPU_CHORES.md.
 */

/** Backend actually servicing a chore call. */
export type ChoresBackendId = 'webgpu' | 'wasm' | 'js';

/** Caller preference. `auto` walks WebGPU → AS/WASM → JS. */
export type ChoresPreference = 'auto' | 'webgpu' | 'wasm' | 'js';

/** Reduction kind supported by `reduce` / `reduceAsync`. */
export type ReduceOp = 'sum' | 'max' | 'min';

/**
 * Synchronous chore backend.
 *
 * Every implementation must be bit-comparable with the JS reference backend
 * for the same inputs — `tests/unit/gpu_chores.test.ts` asserts this. The
 * WebGPU device cannot service synchronous calls (readback is async), so this
 * tier is only ever AS/WASM or JS.
 */
export interface SyncChoresBackend {
    readonly id: 'wasm' | 'js';
    /**
     * Writes the index of every entry with `values[i] > epsilon` into `out`,
     * preserving input order. Returns how many indices were written.
     */
    compact(values: Float32Array, count: number, out: Uint32Array, epsilon: number): number;
    /** Reduces `values[0..count)`. Empty input returns 0 for every op. */
    reduce(values: Float32Array, count: number, op: ReduceOp): number;
}

/**
 * Optional asynchronous tier, backed by a WebGPU compute pass on the renderer's
 * existing device. Results may land a frame or more late, so they are only
 * valid for cosmetic readouts (HUD meters, juice intensity, debug counters) —
 * never for anything a frame's gameplay decisions depend on.
 */
export interface AsyncChoresBackend {
    readonly id: 'webgpu';
    reduceAsync(values: Float32Array, count: number, op: ReduceOp): Promise<number>;
    dispose(): void;
}

/** Runtime breadcrumb published on `window.gpuChores`. */
export interface ChoresBreadcrumb {
    /** Highest tier available for chore work. */
    backend: ChoresBackendId;
    /** Tier servicing synchronous calls (`compact` / `reduce`). */
    syncBackend: 'wasm' | 'js';
    /** True when `?no_gpu_compute` (or an explicit preference) disabled WebGPU. */
    gpuDisabled: boolean;
    /** Why the WebGPU tier is not in use, when it is not. */
    reason: string;
    /** Cumulative op counters, for the debug panel. */
    ops: { compact: number; reduce: number; reduceAsync: number };
}

export interface GpuChores extends ChoresBreadcrumb {
    compact(values: Float32Array, count: number, out: Uint32Array, epsilon?: number): number;
    reduce(values: Float32Array, count: number, op: ReduceOp): number;
    /**
     * Cosmetic-only reduce. Resolves from the WebGPU tier when a renderer
     * device was adopted, otherwise from the synchronous tier.
     */
    reduceAsync(values: Float32Array, count: number, op: ReduceOp): Promise<number>;
}
