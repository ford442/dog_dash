/**
 * gpu_integrate/f32_reference.ts
 * Synchronous TypeScript mirror of `kernels.ts`, in f32 (`Math.fround` at
 * every operation the WGSL performs).
 *
 * It exists so the whole GPU-mode pipeline — CPU lifecycle, gather
 * permutation, draw slots, colour tickets, result application — can be
 * golden-tested in Node with no GPU. The WGSL itself is checked against the
 * same fixture in a real browser (`npm run test:gpu-parity`).
 *
 * Never used at runtime; the runtime CPU path is the original JS integrate in
 * `particles.ts`.
 */

import {
    MATRIX_FLOATS,
    PARTICLE_GRAVITY,
    READBACK_RING,
    SLOT_WORDS,
    stateFloats,
    type IntegrateKernel,
    type IntegrateKind,
    type IntegrateResult
} from './types';

const f = Math.fround;
const TAU = f(6.2831855);
const PI = f(3.1415927);

/** f32 mirror of `wrapPi` in kernels.ts. */
function wrapPi(a: number): number {
    return f(a - f(TAU * Math.floor(f(f(a + PI) / TAU))));
}

/** f32 mirror of `composeMatrix` in kernels.ts. Writes 16 floats at `o`. */
export function composeMatrixF32(
    out: Float32Array, o: number,
    px: number, py: number, pz: number,
    ex: number, ey: number, ez: number,
    s: number
): void {
    const hx = wrapPi(f(ex * 0.5)), hy = wrapPi(f(ey * 0.5)), hz = wrapPi(f(ez * 0.5));
    const cx = f(Math.cos(hx)), cy = f(Math.cos(hy)), cz = f(Math.cos(hz));
    const nx = f(Math.sin(hx)), ny = f(Math.sin(hy)), nz = f(Math.sin(hz));

    const qx = f(f(f(nx * cy) * cz) + f(f(cx * ny) * nz));
    const qy = f(f(f(cx * ny) * cz) - f(f(nx * cy) * nz));
    const qz = f(f(f(cx * cy) * nz) + f(f(nx * ny) * cz));
    const qw = f(f(f(cx * cy) * cz) - f(f(nx * ny) * nz));

    const x2 = f(qx + qx), y2 = f(qy + qy), z2 = f(qz + qz);
    const xx = f(qx * x2), xy = f(qx * y2), xz = f(qx * z2);
    const yy = f(qy * y2), yz = f(qy * z2), zz = f(qz * z2);
    const wx = f(qw * x2), wy = f(qw * y2), wz = f(qw * z2);

    out[o] = f(f(1 - f(yy + zz)) * s);
    out[o + 1] = f(f(xy + wz) * s);
    out[o + 2] = f(f(xz - wy) * s);
    out[o + 3] = 0;
    out[o + 4] = f(f(xy - wz) * s);
    out[o + 5] = f(f(1 - f(xx + zz)) * s);
    out[o + 6] = f(f(yz + wx) * s);
    out[o + 7] = 0;
    out[o + 8] = f(f(xz + wy) * s);
    out[o + 9] = f(f(yz - wx) * s);
    out[o + 10] = f(f(1 - f(xx + yy)) * s);
    out[o + 11] = 0;
    out[o + 12] = px;
    out[o + 13] = py;
    out[o + 14] = pz;
    out[o + 15] = 1;
}

export function createF32ReferenceKernel(kind: IntegrateKind, capacity: number): IntegrateKernel {
    const stride = stateFloats(kind);
    const states = [new Float32Array(capacity * stride), new Float32Array(capacity * stride)];
    let cur = 0;
    let seq = 0;
    let latest: IntegrateResult | null = null;
    let failed: string | null = null;
    const slotF = new Float32Array(1);
    const slotU = new Uint32Array(slotF.buffer);
    const asF32 = (word: number) => { slotU[0] = word; return slotF[0]!; };

    return {
        id: 'f32-reference',
        kind,
        capacity,
        get failed() { return failed; },

        writeState(start, data, n) {
            states[cur]!.set(data.subarray(0, n * stride), start * stride);
        },

        step(count, delta, perm, slots, kept) {
            const src = states[cur]!;
            const dst = states[cur ^ 1]!;
            const dt = f(delta);
            const g = f(PARTICLE_GRAVITY);

            for (let i = 0; i < count; i++) {
                const s = perm[i]! * stride;
                const d = i * stride;
                if (kind === 'particles') {
                    dst[d] = f(src[s]! + f(src[s + 4]! * dt));
                    dst[d + 1] = f(src[s + 1]! + f(src[s + 5]! * dt));
                    dst[d + 2] = f(src[s + 2]! + f(src[s + 6]! * dt));
                    dst[d + 3] = 0;
                    dst[d + 4] = src[s + 4]!;
                    dst[d + 5] = f(src[s + 5]! - f(g * dt));
                    dst[d + 6] = src[s + 6]!;
                    dst[d + 7] = src[s + 7]!;
                } else {
                    dst[d] = f(src[s]! + f(src[s + 4]! * dt));
                    dst[d + 1] = f(src[s + 1]! + f(src[s + 5]! * dt));
                    dst[d + 2] = f(src[s + 2]! + f(src[s + 6]! * dt));
                    dst[d + 3] = 0;
                    for (let j = 4; j < 8; j++) dst[d + j] = src[s + j]!;
                    dst[d + 8] = f(src[s + 8]! + f(src[s + 12]! * dt));
                    dst[d + 9] = f(src[s + 9]! + f(src[s + 13]! * dt));
                    dst[d + 10] = src[s + 10]!;
                    dst[d + 11] = 0;
                    for (let j = 12; j < 16; j++) dst[d + j] = src[s + j]!;
                }
            }

            const matrices = new Float32Array(kept * MATRIX_FLOATS);
            for (let k = 0; k < kept; k++) {
                const w = k * SLOT_WORDS;
                const base = slots[w]! * stride;
                const scale = asF32(slots[w + 1]!);
                if (kind === 'particles') {
                    const spin = asF32(slots[w + 2]!);
                    composeMatrixF32(matrices, k * MATRIX_FLOATS,
                        dst[base]!, dst[base + 1]!, dst[base + 2]!, spin, 0, spin, scale);
                } else {
                    composeMatrixF32(matrices, k * MATRIX_FLOATS,
                        dst[base]!, dst[base + 1]!, dst[base + 2]!,
                        dst[base + 8]!, dst[base + 9]!, dst[base + 10]!, scale);
                }
            }

            cur ^= 1;
            seq++;
            const ticket = seq % READBACK_RING;
            latest = { seq, ticket, kept, matrices };
            return ticket;
        },

        takeLatest() {
            const result = latest;
            latest = null;
            return result;
        },

        fail(reason) {
            failed = failed ?? reason;
        },

        settled() {
            return Promise.resolve();
        },

        dispose() {
            latest = null;
        }
    };
}
