/**
 * gpu_integrate/types.ts
 * Shared types and buffer layout for the visual-particle GPU integrate.
 *
 * Ownership split (see docs/GPU_INTEGRATE.md):
 *   CPU — life, maxLife, size, colour, slot order (swap-remove), emission,
 *         draw list (compact), draw scale, particle spin.
 *   GPU — kinematics (position, velocity, debris rotation) and the per-slot
 *         instance matrix.
 * Each step the CPU uploads a gather permutation (`perm[i]` = the slot that
 * survivor `i` came from), so the GPU reproduces the JS swap-remove order
 * exactly without any sequential work on the GPU.
 */

export type IntegrateKind = 'particles' | 'debris';

/** Floats per particle in the GPU state buffer: pos.xyz_, vel.xyz_. */
export const PARTICLE_STATE_FLOATS = 8;
/** Floats per debris piece: pos.xyz_, vel.xyz_, rot.xyz_, rotSpeed.xy__. */
export const DEBRIS_STATE_FLOATS = 16;
/** 32-bit words per draw slot: src (u32), scale (f32), spin (f32), pad. */
export const SLOT_WORDS = 4;
/** Floats per instance matrix (column-major, as Three stores it). */
export const MATRIX_FLOATS = 16;
/** Particle gravity (units/s²), matching the JS integrate. */
export const PARTICLE_GRAVITY = 2.0;

export function stateFloats(kind: IntegrateKind): number {
    return kind === 'particles' ? PARTICLE_STATE_FLOATS : DEBRIS_STATE_FLOATS;
}

/** A completed readback of instance matrices for one step. */
export interface IntegrateResult {
    /** Monotonic step number; results older than one already drawn are ignored. */
    seq: number;
    /** Ticket of the colour snapshot that pairs with these matrices, or -1. */
    ticket: number;
    /** Draw slots covered (`mesh.count`). */
    kept: number;
    /** `kept * 16` floats, column-major. */
    matrices: Float32Array;
}

export interface IntegrateKernel {
    readonly id: 'webgpu' | 'f32-reference';
    readonly kind: IntegrateKind;
    readonly capacity: number;
    /** Set once the kernel can no longer be trusted; the system falls back to JS. */
    readonly failed: string | null;
    /**
     * Writes AoS state (`stateFloats(kind)` per entry) for slots
     * `[start, start + n)` into the buffer the next `step` reads.
     */
    writeState(start: number, data: Float32Array<ArrayBuffer>, n: number): void;
    /**
     * Advances `count` survivors (gathered through `perm`) by `delta` and
     * builds `kept` instance matrices from `slots`. Returns the readback
     * ticket, or -1 when no matrices are being read back for this step.
     */
    step(count: number, delta: number, perm: Uint32Array<ArrayBuffer>, slots: Uint32Array<ArrayBuffer>, kept: number): number;
    /** Newest completed result not yet taken, else null. */
    takeLatest(): IntegrateResult | null;
    /** Marks the kernel failed (device lost, validation error, …). */
    fail(reason: string): void;
    /** Test seam: resolves once every in-flight readback has landed. */
    settled(): Promise<void>;
    dispose(): void;
}

/** Number of readback/colour tickets in flight. */
export const READBACK_RING = 3;
