/**
 * Geodes (#418): a rock shell cracked open with a crystal cluster inside.
 * The two kinds differ in shape, not only colour:
 *
 * | Kind    | Shell                                   | Opening                     | Crystals                                         |
 * |---------|-----------------------------------------|-----------------------------|--------------------------------------------------|
 * | Singing | round, smooth-ish egg (icosphere d2)    | wide ragged round mouth     | crown of 5 stepped "organ pipes" fanning upward  |
 * | Storm   | flat, angular boulder (icosphere d1)    | zig-zag lightning crack     | 5 needle shards bursting sideways out of it      |
 *
 * Unit radius. The opening faces +Z tilted up, so in the side-on game camera
 * the crystals break the outline. `aMask` = 1 on crystals; the shell is drawn
 * double-sided and the material colours back faces (the inside, seen through
 * the opening) as the glowing lining.
 */

import * as THREE from 'three';
import {
    alongDirection,
    crystalPrism,
    displaceRadial,
    fbm3,
    filterTriangles,
    hash3,
    mergeMaskedParts,
    sharedGeometry,
    triangleCount,
    type MaskedPart
} from './kit';

export type GeodeKind = 'singing' | 'storm';

const tmp = new THREE.Color();

// ---------------------------------------------------------------------------
// Singing geode
// ---------------------------------------------------------------------------

/** Mouth direction (forward and up). */
const SING_MOUTH = new THREE.Vector3(0.15, 0.5, 0.85).normalize();

/** [offset across the mouth (x), length] for the organ-pipe crown. */
const SING_PIPES: Array<[number, number]> = [
    [-0.42, 1.0], [-0.21, 1.3], [0, 1.6], [0.21, 1.25], [0.42, 0.95]
];

function buildSingingGeode(): THREE.BufferGeometry {
    const shell = displaceRadial(new THREE.IcosahedronGeometry(1, 2), (d) =>
        0.92 + (fbm3(d.x * 2.1 + 3, d.y * 2.1, d.z * 2.1) - 0.5) * 0.22
    );
    shell.scale(1.05, 0.92, 1);
    // Ragged round mouth: drop the cap around SING_MOUTH with a noisy edge.
    const dir = new THREE.Vector3();
    const opened = filterTriangles(shell, (c) => {
        dir.copy(c).normalize();
        const edge = 0.6 + (hash3(Math.round(c.x * 40), Math.round(c.y * 40), Math.round(c.z * 40)) - 0.5) * 0.16;
        return dir.dot(SING_MOUTH) < edge;
    });

    const parts: MaskedPart[] = [{
        geometry: opened,
        flat: true,
        tint: (p) => tmp.set(0x6a5a80).multiplyScalar(0.75 + THREE.MathUtils.clamp(p.y, -1, 1) * 0.2).clone()
    }];

    // Organ pipes rooted at the back of the bowl, fanning out of the mouth.
    const across = new THREE.Vector3(1, 0, 0);
    // World up with the mouth component removed: "up" across the mouth.
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(SING_MOUTH, -SING_MOUTH.y).normalize();
    for (const [x, len] of SING_PIPES) {
        const base = SING_MOUTH.clone().multiplyScalar(-0.1).addScaledVector(across, x * 0.9);
        const out = SING_MOUTH.clone().addScaledVector(across, x * 0.55).addScaledVector(up, 0.25).normalize();
        const pipe = alongDirection(crystalPrism(len, 0.13, 4, 0.22), base, out, Math.PI / 4);
        parts.push({
            geometry: pipe,
            flat: true,
            mask: 1,
            tint: (p) => tmp.set(0xe6d4ff).multiplyScalar(0.7 + THREE.MathUtils.clamp(p.length() - 0.3, 0, 1) * 0.3).clone()
        });
    }
    return mergeMaskedParts(parts);
}

// ---------------------------------------------------------------------------
// Storm geode
// ---------------------------------------------------------------------------

/** Zig-zag crack height across the front face, as a function of x. */
function crackY(x: number): number {
    const t = (x * 1.6 + 10) % 1;
    const tri = t < 0.5 ? t * 2 : 2 - t * 2; // 0..1..0 triangle wave
    return 0.05 + (tri - 0.5) * 0.5;
}

/** [x on the crack, direction (x, y, z), length] for the shard burst. */
const STORM_SHARDS: Array<[number, [number, number, number], number]> = [
    [-0.55, [-0.9, 0.35, 0.4], 1.15],
    [-0.2, [-0.25, 0.9, 0.45], 1.4],
    [0.1, [0.15, 0.3, 1.0], 0.9],
    [0.35, [0.55, 0.8, 0.35], 1.25],
    [0.65, [0.95, -0.1, 0.45], 1.0]
];

function buildStormGeode(): THREE.BufferGeometry {
    // Sharp per-direction hash (no smoothing) so the boulder is all facets.
    const shell = displaceRadial(new THREE.IcosahedronGeometry(1, 1), (d) =>
        0.88 + (hash3(Math.round(d.x * 50), Math.round(d.y * 50), Math.round(d.z * 50)) - 0.5) * 0.3
    );
    shell.scale(1.25, 0.75, 0.95);
    const opened = filterTriangles(shell, (c) => !(c.z > 0.15 && Math.abs(c.y - crackY(c.x)) < 0.2));

    const parts: MaskedPart[] = [{
        geometry: opened,
        flat: true,
        tint: (p) => tmp.set(0x2a2a3c).multiplyScalar(0.8 + hash3(Math.round(p.x * 9), Math.round(p.y * 9), Math.round(p.z * 9)) * 0.4).clone()
    }];

    for (const [x, d, len] of STORM_SHARDS) {
        const base = new THREE.Vector3(x * 1.1, crackY(x) * 0.75, 0.45);
        const shard = alongDirection(crystalPrism(len, 0.1, 3, 0.55), base, new THREE.Vector3(...d), x * 2);
        parts.push({
            geometry: shard,
            flat: true,
            mask: 1,
            tint: (p) => tmp.set(0x9fd8ff).multiplyScalar(0.75 + THREE.MathUtils.clamp(p.length() - 0.5, 0, 1) * 0.35).clone()
        });
    }
    return mergeMaskedParts(parts);
}

const BUILDERS: Record<GeodeKind, () => THREE.BufferGeometry> = {
    singing: buildSingingGeode,
    storm: buildStormGeode
};

/** Shared geode geometry per kind (built once, `markShared`). */
export function getGeodeGeometry(kind: GeodeKind): THREE.BufferGeometry {
    return sharedGeometry(`scenery:geode_${kind}`, BUILDERS[kind]);
}

/** Triangle counts, for docs/ENV_ASSET_AUDIT.md and the budget test. */
export function geodeTriangleCount(kind: GeodeKind): number {
    return triangleCount(getGeodeGeometry(kind));
}
