/**
 * Backdrop galaxy (#418): a tilted two-armed spiral disc with a bright bulge
 * and speckled star clusters along the arms, drawn by a shader on one quad.
 * It replaces three nested additive spheres (~1,200 triangles and 3 draw
 * calls per galaxy) with 2 triangles and 1 draw call.
 *
 * The disc lies in the local XY plane, so spinning the group about local Z
 * (what `loop_world.ts` does with `rotationSpeed`) turns it in its own plane.
 */

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { atan, color, cos, dot, exp, float, floor, fract, length, max, mix, pow, sin, smoothstep, step, uv, vec2 } from 'three/tsl';
import { sharedGeometry } from './kit';

/** Disc diameter in world units (the old outer cloud sphere was 30 across). */
export const GALAXY_SIZE = 40;

export function getGalaxyGeometry(): THREE.BufferGeometry {
    return sharedGeometry('scenery:galaxy_disc', () => new THREE.PlaneGeometry(GALAXY_SIZE, GALAXY_SIZE));
}

/** Spiral-galaxy material in the given tint. `twist` > 0 winds the arms tighter. */
export function createGalaxyMaterial(tint: number, twist = 5.5): MeshBasicNodeMaterial {
    const p = uv().sub(0.5).mul(2.0);
    const r = length(p);
    const theta = atan(p.y, p.x);

    // Two logarithmic-ish arms: bright where cos(2(θ + k·r)) peaks.
    const armWave = cos(theta.add(r.mul(twist)).mul(2.0)).mul(0.5).add(0.5);
    const arms = pow(armWave, float(5.0)).mul(smoothstep(1.0, 0.25, r)).mul(smoothstep(0.05, 0.18, r));

    // Star clusters: hashed cells that light up only on the arms.
    const cell = floor(p.mul(42.0));
    const h = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));
    const clusters = step(0.93, h).mul(arms).mul(1.6);

    const haze = exp(r.mul(-3.2)).mul(0.35).mul(smoothstep(1.0, 0.6, r));
    const bulge = exp(r.mul(r).mul(-60.0)).mul(1.6);

    const base = color(tint);
    const lit = base.mul(arms.mul(0.9).add(haze))
        .add(mix(base, color(0xffffff), 0.6).mul(clusters))
        .add(mix(base, color(0xfff4dd), 0.75).mul(bulge));

    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    mat.colorNode = max(lit, color(0x000000));
    return mat;
}
