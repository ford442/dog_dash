/**
 * gpu_integrate/kernels.ts
 * WGSL for the particle and debris integrate. Kept in-repo, like
 * gpu_chores/webgpu_backend.ts — no compute framework.
 *
 * `f32_reference.ts` mirrors these kernels operation by operation; change
 * both together and re-record the golden fixture
 * (`npm run gpu-integrate:record`).
 *
 * Bindings (shared by both entry points, explicit layout):
 *   0 params   uniform  { count, kept, delta, gravity }
 *   1 src      storage  read        state before the step
 *   2 dst      storage  read_write  state after the step (survivors, packed)
 *   3 perm     storage  read        dst[i] comes from src[perm[i]]
 *   4 slots    storage  read        { src, scale, spin, pad } per draw slot
 *   5 matrices storage  read_write  one mat4x4 per draw slot
 */

import type { IntegrateKind } from './types';

export const WORKGROUP_SIZE = 64;

const COMMON = /* wgsl */ `
struct Params {
    count: u32,
    kept: u32,
    delta: f32,
    gravity: f32,
};

struct Slot {
    src: u32,
    scale: f32,
    spin: f32,
    _pad: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> srcState: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> dstState: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> perm: array<u32>;
@group(0) @binding(4) var<storage, read> slots: array<Slot>;
@group(0) @binding(5) var<storage, read_write> matrices: array<mat4x4<f32>>;

const TAU: f32 = 6.2831855;
const PI: f32 = 3.1415927;

// WGSL only bounds sin/cos error (2^-11 absolute) inside [-pi, pi]; outside
// it, accuracy is implementation-defined. Half-angles here reach ~±7 rad, so
// reduce first. sin/cos are 2pi-periodic, so the result is unchanged.
fn wrapPi(a: vec3<f32>) -> vec3<f32> {
    return a - TAU * floor((a + PI) / TAU);
}

// Object3D.updateMatrix(): Euler XYZ -> quaternion -> Matrix4.compose(),
// uniform scale. Same operation order as three/src/math.
fn composeMatrix(p: vec3<f32>, e: vec3<f32>, s: f32) -> mat4x4<f32> {
    let h = wrapPi(e * 0.5);
    let c = cos(h);
    let n = sin(h);

    let qx = n.x * c.y * c.z + c.x * n.y * n.z;
    let qy = c.x * n.y * c.z - n.x * c.y * n.z;
    let qz = c.x * c.y * n.z + n.x * n.y * c.z;
    let qw = c.x * c.y * c.z - n.x * n.y * n.z;

    let x2 = qx + qx;
    let y2 = qy + qy;
    let z2 = qz + qz;
    let xx = qx * x2;
    let xy = qx * y2;
    let xz = qx * z2;
    let yy = qy * y2;
    let yz = qy * z2;
    let zz = qz * z2;
    let wx = qw * x2;
    let wy = qw * y2;
    let wz = qw * z2;

    return mat4x4<f32>(
        vec4<f32>((1.0 - (yy + zz)) * s, (xy + wz) * s, (xz - wy) * s, 0.0),
        vec4<f32>((xy - wz) * s, (1.0 - (xx + zz)) * s, (yz + wx) * s, 0.0),
        vec4<f32>((xz + wy) * s, (yz - wx) * s, (1.0 - (xx + yy)) * s, 0.0),
        vec4<f32>(p, 1.0)
    );
}
`;

const PARTICLES = /* wgsl */ `
${COMMON}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if (i >= params.count) { return; }
    let s = perm[i] * 2u;
    let p = srcState[s];
    var v = srcState[s + 1u];
    // Position uses the pre-gravity velocity, as in the JS loop.
    let np = vec4<f32>(p.xyz + v.xyz * params.delta, 0.0);
    v.y = v.y - params.gravity * params.delta;
    dstState[i * 2u] = np;
    dstState[i * 2u + 1u] = v;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn compose(@builtin(global_invocation_id) gid: vec3<u32>) {
    let k = gid.x;
    if (k >= params.kept) { return; }
    let slot = slots[k];
    let p = dstState[slot.src * 2u].xyz;
    matrices[k] = composeMatrix(p, vec3<f32>(slot.spin, 0.0, slot.spin), slot.scale);
}
`;

const DEBRIS = /* wgsl */ `
${COMMON}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if (i >= params.count) { return; }
    let s = perm[i] * 4u;
    let p = srcState[s];
    let v = srcState[s + 1u];
    let r = srcState[s + 2u];
    let rs = srcState[s + 3u];
    let d = i * 4u;
    dstState[d] = vec4<f32>(p.xyz + v.xyz * params.delta, 0.0);
    dstState[d + 1u] = v;
    dstState[d + 2u] = vec4<f32>(r.x + rs.x * params.delta, r.y + rs.y * params.delta, r.z, 0.0);
    dstState[d + 3u] = rs;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn compose(@builtin(global_invocation_id) gid: vec3<u32>) {
    let k = gid.x;
    if (k >= params.kept) { return; }
    let slot = slots[k];
    let base = slot.src * 4u;
    matrices[k] = composeMatrix(dstState[base].xyz, dstState[base + 2u].xyz, slot.scale);
}
`;

export function integrateWgsl(kind: IntegrateKind): string {
    return kind === 'particles' ? PARTICLES : DEBRIS;
}
