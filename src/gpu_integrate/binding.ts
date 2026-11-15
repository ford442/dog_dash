/**
 * gpu_integrate/binding.ts
 * CPU half of GPU-mode integrate, shared by ParticleSystem and DebrisSystem.
 *
 * Per step the owning system:
 *   1. `applyLatest(mesh)` — draw the newest finished readback (last-good).
 *   2. `uploadEmitted(count, pack)` — push state for slots emitted since the
 *      previous step (they were written to the system's CPU SoA by `emit`).
 *   3. `resetPerm(count)` and run its own lifecycle loop (life, swap-remove),
 *      mirroring every swap into `perm` with `swap(i, last)`.
 *   4. `setSlot(...)` per compacted draw slot (+ `slotColors` if coloured).
 *   5. `submit(count, delta, kept)` then `applyLatest(mesh)` again, so a
 *      synchronous kernel draws the same step.
 *
 * Results are always applied at the start of a step, before `submit` can
 * reuse a colour ticket, so matrices and colours from different steps never
 * mix.
 */

import type * as THREE from 'three';

import {
    MATRIX_FLOATS,
    READBACK_RING,
    SLOT_WORDS,
    stateFloats,
    type IntegrateKernel
} from './types';

export class IntegrateBinding {
    readonly kernel: IntegrateKernel;
    readonly perm: Uint32Array<ArrayBuffer>;
    readonly slots: Uint32Array<ArrayBuffer>;
    private readonly slotsF32: Float32Array;
    /** Colour per draw slot for this step (RGB), when the system is coloured. */
    readonly slotColors: Float32Array | null;
    private readonly colorRing: Float32Array[] | null;
    private readonly packScratch: Float32Array<ArrayBuffer>;
    private readonly stride: number;
    /** Slots `[0, synced)` already live on the GPU. */
    synced = 0;
    private appliedSeq = 0;

    constructor(kernel: IntegrateKernel, colored: boolean) {
        const capacity = kernel.capacity;
        this.kernel = kernel;
        this.stride = stateFloats(kernel.kind);
        this.perm = new Uint32Array(capacity);
        this.slots = new Uint32Array(capacity * SLOT_WORDS);
        this.slotsF32 = new Float32Array(this.slots.buffer);
        this.slotColors = colored ? new Float32Array(capacity * 3) : null;
        this.colorRing = colored
            ? Array.from({ length: READBACK_RING }, () => new Float32Array(capacity * 3))
            : null;
        this.packScratch = new Float32Array(capacity * this.stride);
    }

    get failed(): string | null {
        return this.kernel.failed;
    }

    uploadEmitted(count: number, pack: (index: number, out: Float32Array, offset: number) => void): void {
        const start = this.synced;
        const n = count - start;
        if (n <= 0) return;
        for (let j = 0; j < n; j++) pack(start + j, this.packScratch, j * this.stride);
        this.kernel.writeState(start, this.packScratch, n);
        this.synced = count;
    }

    resetPerm(count: number): void {
        const perm = this.perm;
        for (let i = 0; i < count; i++) perm[i] = i;
    }

    /** Mirrors `slot[i] = slot[last]` from the system's swap-remove. */
    swap(i: number, last: number): void {
        this.perm[i] = this.perm[last]!;
    }

    setSlot(slot: number, src: number, scale: number, spin = 0): void {
        const w = slot * SLOT_WORDS;
        this.slots[w] = src;
        this.slotsF32[w + 1] = scale;
        this.slotsF32[w + 2] = spin;
        this.slotsF32[w + 3] = 0;
    }

    submit(count: number, delta: number, kept: number): void {
        const ticket = this.kernel.step(count, delta, this.perm, this.slots, kept);
        if (ticket >= 0 && this.colorRing && this.slotColors) {
            this.colorRing[ticket]!.set(this.slotColors.subarray(0, kept * 3));
        }
        this.synced = count;
    }

    /** Draws the newest finished readback, if it is newer than what is on screen. */
    applyLatest(mesh: THREE.InstancedMesh): void {
        const result = this.kernel.takeLatest();
        if (!result || result.seq <= this.appliedSeq) return;
        this.appliedSeq = result.seq;

        const kept = result.kept;
        if (kept > 0) {
            (mesh.instanceMatrix.array as Float32Array).set(result.matrices.subarray(0, kept * MATRIX_FLOATS));
            mesh.instanceMatrix.needsUpdate = true;
            if (this.colorRing && mesh.instanceColor && result.ticket >= 0) {
                (mesh.instanceColor.array as Float32Array).set(this.colorRing[result.ticket]!.subarray(0, kept * 3));
                mesh.instanceColor.needsUpdate = true;
            }
        }
        mesh.count = kept;
    }

    dispose(): void {
        this.kernel.dispose();
    }
}
