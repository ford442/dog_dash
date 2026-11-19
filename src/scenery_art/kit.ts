/**
 * Shared helpers for scenery assets (issue #418: scenery, backdrops and
 * flavor creatures as game assets).
 *
 * Scenery reuses the hazard kit's merge (`mergeKitParts`: many parts → one
 * vertex-coloured geometry, one draw call) and the pickup kit's
 * `sharedGeometry` cache. On top of that, `mergeMaskedParts` writes a per-part
 * `aMask` float so one instanced material can treat two regions differently
 * (rock vs crystal, leaf vs glowing bulb) without a second draw call.
 *
 * Everything here is deterministic and visual-only (position hashes, no RNG),
 * so shared geometry looks the same on every boot, in replays and in the
 * `?gallery` review page.
 */

import * as THREE from 'three';
import { hash3, mergeKitParts, type KitPart } from '../hazard_art/kit';

export { hash3, fbm3, mergeKitParts, placed, shade, fibonacciSphere } from '../hazard_art/kit';
export type { KitPart } from '../hazard_art/kit';
export { sharedGeometry } from '../pickup_art/shapes';

export interface MaskedPart extends KitPart {
    /** Written to the `aMask` attribute for every vertex of this part (default 0). */
    mask?: number;
}

function mergedVertexCount(geo: THREE.BufferGeometry): number {
    return geo.index ? geo.index.count : geo.attributes.position.count;
}

/**
 * `mergeKitParts` plus an `aMask` float attribute (one value per part). The
 * parts are disposed after merging, as with `mergeKitParts`.
 */
export function mergeMaskedParts(parts: MaskedPart[]): THREE.BufferGeometry {
    const masks: number[] = [];
    for (const part of parts) {
        const n = mergedVertexCount(part.geometry);
        const m = part.mask ?? 0;
        for (let i = 0; i < n; i++) masks.push(m);
    }
    const merged = mergeKitParts(parts);
    merged.setAttribute('aMask', new THREE.Float32BufferAttribute(masks, 1));
    return merged;
}

/** Triangle count of a geometry (indexed or not). For budget notes and tests. */
export function triangleCount(geo: THREE.BufferGeometry): number {
    return Math.floor(mergedVertexCount(geo) / 3);
}

/**
 * Drop the triangles whose centroid fails `keep`. Returns a new non-indexed
 * geometry (position only; normals are recomputed by the merge). The source
 * is disposed. Used to carve openings (geode mouths, cracks) out of a shell.
 */
export function filterTriangles(
    geo: THREE.BufferGeometry,
    keep: (centroid: THREE.Vector3) => boolean
): THREE.BufferGeometry {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const pos = src.attributes.position;
    const out: number[] = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
        a.fromBufferAttribute(pos, i);
        b.fromBufferAttribute(pos, i + 1);
        c.fromBufferAttribute(pos, i + 2);
        m.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        if (!keep(m)) continue;
        out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
    if (src !== geo) src.dispose();
    geo.dispose();
    const res = new THREE.BufferGeometry();
    res.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    return res;
}

/**
 * Displace every vertex radially by `radius(dir)` (dir = unit direction from
 * the origin). Shared vertices of an indexed geometry move together, so the
 * surface stays watertight. Mutates and returns `geo`.
 */
export function displaceRadial(geo: THREE.BufferGeometry, radius: (dir: THREE.Vector3) => number): THREE.BufferGeometry {
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const len = v.length() || 1;
        v.multiplyScalar(1 / len);
        const r = radius(v);
        pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    }
    pos.needsUpdate = true;
    return geo;
}

/**
 * Crystal prism along +Y: `sides`-sided column with a pointed tip, base at
 * the origin. No base cap (it sits inside a host body).
 */
export function crystalPrism(len: number, r: number, sides = 5, tip = 0.3): THREE.BufferGeometry {
    const profile = [
        new THREE.Vector2(r * 0.85, 0),
        new THREE.Vector2(r, len * (1 - tip)),
        new THREE.Vector2(0, len)
    ];
    return new THREE.LatheGeometry(profile, sides);
}

/** Place a +Y-oriented part so that +Y points along `dir`, its base at `base`. */
export function alongDirection(
    geo: THREE.BufferGeometry,
    base: THREE.Vector3,
    dir: THREE.Vector3,
    spin = 0
): THREE.BufferGeometry {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
    geo.applyMatrix4(new THREE.Matrix4().compose(base, q, new THREE.Vector3(1, 1, 1)));
    return geo;
}

/**
 * A leaf blade along +Y, folded along its midrib so it has volume from the
 * side: 4 triangles. `width` is the half-width at the widest point, `fold`
 * pushes the midrib out along +Z.
 */
export function leafBlade(length: number, width: number, fold = 0.25): THREE.BufferGeometry {
    const w = width, l = length;
    const base = [0, 0, 0];
    const tip = [0, l, 0];
    const left = [-w, l * 0.45, 0];
    const right = [w, l * 0.45, 0];
    const rib = [0, l * 0.45, w * fold];
    const tris = [
        base, left, rib, rib, left, tip,
        base, rib, right, rib, tip, right
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    return geo;
}

/** Deterministic pseudo-random in [0, 1) from an integer seed (visual-only). */
export function seeded(seed: number, salt = 0): number {
    return hash3(seed * 1.37 + 0.11, salt * 2.71 + 0.53, seed * 0.29 + salt * 0.71);
}
