/**
 * Shared foliage geometry (#418) for the sphere-based plants in
 * `foliage/plants_basic.ts`. Each plant is now one or two merged meshes with
 * vertex colour, instead of a sphere (plus one mesh per flower / bloom /
 * balloon). A few variants per plant are built once and shared; plants vary
 * by variant + scale.
 *
 * | Plant          | Before                                  | After                                                       |
 * |----------------|-----------------------------------------|-------------------------------------------------------------|
 * | Shrub          | sphere + 3–5 sphere "flowers" (4–6 DC)  | leaf dome + folded leaf blades; five-petal flowers (2 DC)   |
 * | Balloon bush   | 5–9 spheres (5–9 DC)                    | leafy base + balloons with knots and strings (2 DC)         |
 * | Raining cloud  | one sphere + rain                       | row of puffs with a flat, darker base + rain (2 DC)         |
 * | Floating orb   | bare sphere                             | glowing seed pod cupped by leaf sepals with a curl (1 DC)   |
 * | Flowering tree | cylinder + 5–9 sphere blooms (6–10 DC)  | forked trunk + lumpy blossom clumps with petal speckle (2 DC) |
 */

import * as THREE from 'three';
import { starShape } from '../pickup_art/shapes';
import {
    displaceRadial,
    fbm3,
    hash3,
    leafBlade,
    mergeKitParts,
    mergeMaskedParts,
    placed,
    seeded,
    shade,
    sharedGeometry,
    type KitPart,
    type MaskedPart
} from './kit';

export const FOLIAGE_VARIANTS = 3;

const tmp = new THREE.Color();
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Grey-scale vertex tint (multiplies the plant's material colour). */
function grey(k: number): THREE.Color {
    return tmp.setScalar(k).clone();
}

/** Ring of folded leaf blades around a centre, tilted out by `lean`. */
function leafRing(
    count: number,
    centre: THREE.Vector3,
    radius: number,
    len: number,
    width: number,
    lean: number,
    seed: number
): KitPart[] {
    const parts: KitPart[] = [];
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + seeded(seed, i) * 0.4;
        const l = len * (0.8 + seeded(seed, i + 40) * 0.4);
        const blade = leafBlade(l, width);
        // Lean out from the centre, rib facing outward.
        blade.applyMatrix4(new THREE.Matrix4().makeRotationX(lean + seeded(seed, i + 80) * 0.3));
        blade.applyMatrix4(new THREE.Matrix4().makeRotationY(-a + Math.PI / 2));
        blade.translate(centre.x + Math.cos(a) * radius, centre.y, centre.z + Math.sin(a) * radius);
        parts.push({ geometry: blade, flat: true, tint: (p) => grey(0.75 + THREE.MathUtils.clamp((p.y - centre.y) / l, 0, 1) * 0.35) });
    }
    return parts;
}

/** Lumpy low dome (leaf mass), base flattened at y = 0. */
function leafDome(r: number, height: number, seed: number, detail = 1): THREE.BufferGeometry {
    const geo = displaceRadial(new THREE.IcosahedronGeometry(1, detail), (d) =>
        r * (0.85 + (fbm3(d.x * 2.5 + seed, d.y * 2.5, d.z * 2.5) - 0.5) * 0.5)
    );
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        pos.setY(i, Math.max(0, y * (height / r) + height * 0.35));
    }
    return geo;
}

/** Flat five-petal flower facing +Y (8 triangles), centre at the origin. */
function flatFlower(size: number): THREE.BufferGeometry {
    const geo = new THREE.ShapeGeometry(starShape(5, 0.62), 1);
    geo.rotateX(-Math.PI / 2);
    geo.scale(size * 2, 1, size * 2);
    return geo;
}

// ---------------------------------------------------------------------------
// Shrub
// ---------------------------------------------------------------------------

function buildShrubLeaves(variant: number): THREE.BufferGeometry {
    const s = 100 + variant * 17;
    const r = 1.0 + seeded(s, 1) * 0.3;
    return mergeKitParts([
        { geometry: leafDome(r, 0.9, s), flat: true, tint: (p) => grey(0.55 + Math.min(1, p.y / 1.4) * 0.35) },
        ...leafRing(9, v(0, 0.15, 0), r * 0.75, 0.9, 0.22, 0.75, s),
        ...leafRing(6, v(0, 0.75, 0), r * 0.35, 0.7, 0.18, 0.35, s + 5)
    ]);
}

/** Where the shrub's flowers sit (top of the leaf mass). */
function shrubFlowerSpots(variant: number): THREE.Vector3[] {
    const s = 100 + variant * 17;
    const n = 4 + (variant % 2);
    const spots: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + seeded(s, i + 7);
        const rr = 0.35 + seeded(s, i + 9) * 0.45;
        spots.push(v(Math.cos(a) * rr, 1.05 + (0.8 - rr) * 0.4, Math.sin(a) * rr));
    }
    return spots;
}

function buildShrubFlowers(variant: number): THREE.BufferGeometry {
    const parts: KitPart[] = [];
    for (const p of shrubFlowerSpots(variant)) {
        parts.push({ geometry: placed(flatFlower(0.2), [p.x, p.y, p.z], [p.z * 0.4, 0, -p.x * 0.4]), tint: grey(1) });
        parts.push({ geometry: placed(new THREE.CircleGeometry(0.06, 5), [p.x, p.y + 0.01, p.z], [-Math.PI / 2 + p.z * 0.4, 0, -p.x * 0.4]), tint: new THREE.Color(0xfff2a0) });
    }
    return mergeKitParts(parts);
}

export function getShrubLeafGeometry(variant: number): THREE.BufferGeometry {
    const k = variant % FOLIAGE_VARIANTS;
    return sharedGeometry(`foliage:shrub_leaves_${k}`, () => buildShrubLeaves(k));
}

export function getShrubFlowerGeometry(variant: number): THREE.BufferGeometry {
    const k = variant % FOLIAGE_VARIANTS;
    return sharedGeometry(`foliage:shrub_flowers_${k}`, () => buildShrubFlowers(k));
}

// ---------------------------------------------------------------------------
// Balloon bush
// ---------------------------------------------------------------------------

function buildBalloonBushBase(variant: number): THREE.BufferGeometry {
    const s = 300 + variant * 11;
    return mergeKitParts([
        { geometry: leafDome(0.6, 0.45, s, 1), flat: true, tint: (p) => grey(0.55 + Math.min(1, p.y / 0.8) * 0.4) },
        ...leafRing(7, v(0, 0.05, 0), 0.45, 0.55, 0.16, 0.9, s)
    ]);
}

function buildBalloons(variant: number): THREE.BufferGeometry {
    const s = 300 + variant * 11;
    const n = 4 + variant;
    const parts: KitPart[] = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + seeded(s, i) * 0.6;
        const spread = 0.35 + seeded(s, i + 20) * 0.4;
        const top = v(Math.cos(a) * spread, 1.4 + seeded(s, i + 30) * 0.8, Math.sin(a) * spread);
        const r = 0.28 + seeded(s, i + 50) * 0.12;
        const root = v(Math.cos(a) * 0.15, 0.55, Math.sin(a) * 0.15);
        // Balloon: a sphere stretched a little toward the top, pinched by a knot.
        parts.push({ geometry: placed(new THREE.SphereGeometry(r, 9, 7), [top.x, top.y + r, top.z], [0, 0, 0], [1, 1.18, 1]), tint: grey(1) });
        parts.push({ geometry: placed(new THREE.ConeGeometry(0.06, 0.1, 5), [top.x, top.y - 0.02, top.z], [Math.PI, 0, 0]), tint: grey(0.8), flat: true });
        // String from the knot down into the leaves.
        const len = top.distanceTo(root);
        const str = new THREE.CylinderGeometry(0.012, 0.012, len, 3, 1, true);
        const mid = top.clone().add(root).multiplyScalar(0.5);
        const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), top.clone().sub(root).normalize());
        str.applyMatrix4(new THREE.Matrix4().compose(mid, q, v(1, 1, 1)));
        parts.push({ geometry: str, tint: new THREE.Color(0xf2f2f2) });
    }
    return mergeKitParts(parts);
}

export function getBalloonBushBaseGeometry(variant: number): THREE.BufferGeometry {
    const k = variant % FOLIAGE_VARIANTS;
    return sharedGeometry(`foliage:balloon_base_${k}`, () => buildBalloonBushBase(k));
}

export function getBalloonGeometry(variant: number): THREE.BufferGeometry {
    const k = variant % FOLIAGE_VARIANTS;
    return sharedGeometry(`foliage:balloons_${k}`, () => buildBalloons(k));
}

// ---------------------------------------------------------------------------
// Raining cloud
// ---------------------------------------------------------------------------

/** Cloud base height (local y); puffs are cut flat here. */
export const CLOUD_BASE_Y = -0.45;

function buildCloud(variant: number): THREE.BufferGeometry {
    const s = 500 + variant * 13;
    const puffs: Array<[number, number, number, number]> = [
        [-1.25, -0.1, 0, 0.75], [-0.45, 0.25, 0.1, 1.0], [0.5, 0.35, -0.05, 1.1], [1.35, 0.0, 0.05, 0.8], [0.1, 0.0, 0.45, 0.8]
    ];
    const parts: KitPart[] = puffs.map(([x, y, z, r], i) => {
        const rr = r * (0.9 + seeded(s, i) * 0.2);
        const geo = displaceRadial(new THREE.IcosahedronGeometry(1, 1), (d) => rr * (0.92 + hash3(Math.round(d.x * 30) + i, Math.round(d.y * 30), Math.round(d.z * 30)) * 0.12));
        geo.translate(x, y, z);
        const pos = geo.attributes.position;
        for (let k = 0; k < pos.count; k++) pos.setY(k, Math.max(CLOUD_BASE_Y, pos.getY(k)));
        return {
            geometry: geo,
            // Darker, rain-heavy belly; bright tops.
            tint: (p: THREE.Vector3) => grey(p.y <= CLOUD_BASE_Y + 0.02 ? 0.62 : 0.8 + Math.min(1, (p.y - CLOUD_BASE_Y) / 1.6) * 0.25)
        };
    });
    return mergeKitParts(parts);
}

export function getCloudGeometry(variant: number): THREE.BufferGeometry {
    const k = variant % FOLIAGE_VARIANTS;
    return sharedGeometry(`foliage:rain_cloud_${k}`, () => buildCloud(k));
}

// ---------------------------------------------------------------------------
// Floating orb → glowing seed pod
// ---------------------------------------------------------------------------

/**
 * Glowing seed pod, unit size (scale by the orb's `size`): the bulb
 * (`aMask` 1, emissive) cupped by four leaf sepals with a curled stem on top.
 */
function buildSeedPod(): THREE.BufferGeometry {
    const parts: MaskedPart[] = [
        { geometry: new THREE.IcosahedronGeometry(1, 1), mask: 1, tint: grey(1) }
    ];
    const LEAF = 0x5fbf6a;
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const blade = leafBlade(1.25, 0.55, 0.4);
        blade.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI - 0.8)); // hang down and out, cupping the bulb
        blade.applyMatrix4(new THREE.Matrix4().makeRotationY(-a + Math.PI / 2));
        blade.translate(Math.cos(a) * 0.5, 0.9, Math.sin(a) * 0.5);
        parts.push({ geometry: blade, flat: true, tint: (p) => shade(LEAF, 0.8 + Math.max(0, p.y) * 0.25) });
    }
    // Stem curl on top.
    const curl = new THREE.TorusGeometry(0.2, 0.05, 3, 8, Math.PI * 1.4);
    parts.push({ geometry: placed(curl, [0.15, 1.2, 0], [0, 0, -0.4]), tint: shade(LEAF, 0.8) });
    return mergeMaskedParts(parts);
}

export function getSeedPodGeometry(): THREE.BufferGeometry {
    return sharedGeometry('foliage:seed_pod', buildSeedPod);
}

// ---------------------------------------------------------------------------
// Flowering tree
// ---------------------------------------------------------------------------

interface TreeLayout { trunkH: number; tips: THREE.Vector3[]; clumpR: number[] }

function treeLayout(variant: number): TreeLayout {
    const s = 700 + variant * 19;
    const trunkH = 2.6 + variant * 0.5;
    const n = 4 + (variant % 2);
    // A full, wide crown: a top clump plus a ring of side clumps on the branch tips.
    const tips: THREE.Vector3[] = [v(0, trunkH + 1.5, 0)];
    const clumpR: number[] = [1.45];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + seeded(s, i) * 0.6;
        const out = 1.3 + seeded(s, i + 10) * 0.5;
        tips.push(v(Math.cos(a) * out, trunkH + 0.4 + seeded(s, i + 20) * 0.7, Math.sin(a) * out));
        clumpR.push(1.0 + seeded(s, i + 30) * 0.3);
    }
    return { trunkH, tips, clumpR };
}

function buildTreeWood(variant: number): THREE.BufferGeometry {
    const { trunkH, tips } = treeLayout(variant);
    const fork = v(0, trunkH * 0.72, 0);
    const parts: KitPart[] = [
        { geometry: placed(new THREE.CylinderGeometry(0.28, 0.45, trunkH * 0.75, 7), [0, trunkH * 0.375, 0]), tint: grey(1) }
    ];
    for (const tip of tips) {
        const len = tip.distanceTo(fork);
        const br = new THREE.CylinderGeometry(0.1, 0.22, len, 5, 1, true);
        const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), tip.clone().sub(fork).normalize());
        br.applyMatrix4(new THREE.Matrix4().compose(fork.clone().add(tip).multiplyScalar(0.5), q, v(1, 1, 1)));
        parts.push({ geometry: br, tint: grey(0.9) });
    }
    return mergeKitParts(parts);
}

function buildTreeBlossom(variant: number): THREE.BufferGeometry {
    const { tips, clumpR } = treeLayout(variant);
    const s = 700 + variant * 19;
    const parts: KitPart[] = tips.map((tip, i) => {
        const r = clumpR[i];
        const geo = displaceRadial(new THREE.IcosahedronGeometry(1, 1), (d) =>
            r * (0.82 + (fbm3(d.x * 3 + i * 7 + s, d.y * 3, d.z * 3) - 0.5) * 0.7)
        );
        geo.scale(1, 0.75, 1);
        geo.translate(tip.x, tip.y, tip.z);
        return {
            geometry: geo,
            flat: true,
            // Blossom speckle (white petals on the bloom colour), shaded underneath.
            tint: (p: THREE.Vector3) => {
                const petal = hash3(Math.round(p.x * 7), Math.round(p.y * 7), Math.round(p.z * 7)) > 0.72;
                const under = THREE.MathUtils.clamp((p.y - tip.y + r * 0.75) / (r * 1.5), 0, 1);
                return petal ? new THREE.Color(1.4, 1.35, 1.4) : grey(0.65 + under * 0.4);
            }
        };
    });
    return mergeKitParts(parts);
}

export function getTreeWoodGeometry(variant: number): THREE.BufferGeometry {
    const k = variant % FOLIAGE_VARIANTS;
    return sharedGeometry(`foliage:tree_wood_${k}`, () => buildTreeWood(k));
}

export function getTreeBlossomGeometry(variant: number): THREE.BufferGeometry {
    const k = variant % FOLIAGE_VARIANTS;
    return sharedGeometry(`foliage:tree_blossom_${k}`, () => buildTreeBlossom(k));
}
