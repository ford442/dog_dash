/**
 * Shared helpers for the procedural hazard / enemy / boss kit.
 *
 * Everything here is deterministic and visual-only: geometry is shaped by a
 * position hash (never `gameplayRandom` / the run RNG, and not `Math.random`
 * either), so a shared geometry looks the same on every boot, in the replay
 * harness and in the `?gallery` review page.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Hash noise
// ---------------------------------------------------------------------------

/** Deterministic hash of a 3D point to [0, 1). */
export function hash3(x: number, y: number, z: number): number {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
    return s - Math.floor(s);
}

function smooth(t: number): number {
    return t * t * (3 - 2 * t);
}

/** Trilinear value noise in [0, 1). */
export function valueNoise3(x: number, y: number, z: number): number {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const c000 = hash3(ix, iy, iz), c100 = hash3(ix + 1, iy, iz);
    const c010 = hash3(ix, iy + 1, iz), c110 = hash3(ix + 1, iy + 1, iz);
    const c001 = hash3(ix, iy, iz + 1), c101 = hash3(ix + 1, iy, iz + 1);
    const c011 = hash3(ix, iy + 1, iz + 1), c111 = hash3(ix + 1, iy + 1, iz + 1);
    return lerp(
        lerp(lerp(c000, c100, fx), lerp(c010, c110, fx), fy),
        lerp(lerp(c001, c101, fx), lerp(c011, c111, fx), fy),
        fz
    );
}

/** Fractal value noise, roughly in [0, 1). */
export function fbm3(x: number, y: number, z: number, octaves = 3): number {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
        sum += valueNoise3(x * freq, y * freq, z * freq) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2.03;
    }
    return sum / norm;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export type VertexTint = number | THREE.Color | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color);

export interface KitPart {
    geometry: THREE.BufferGeometry;
    /** Per-vertex colour: constant or a function of (position, normal). Default white. */
    tint?: VertexTint;
    /** Keep the part's own normals (default) or recompute flat normals. */
    flat?: boolean;
}

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * Merge parts into one non-indexed geometry with `position`, `normal` and
 * `color` attributes, so a static multi-part body is one draw call. Parts are
 * disposed after merging. Smooth normals are computed on the indexed source
 * first (spheres stay round); `flat: true` gives faceted normals instead.
 */
export function mergeKitParts(parts: KitPart[]): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    for (const part of parts) {
        let geo = part.geometry;
        if (!part.flat) geo.computeVertexNormals();
        const flatGeo = geo.index ? geo.toNonIndexed() : geo;
        if (part.flat) flatGeo.computeVertexNormals();
        const pos = flatGeo.attributes.position;
        const norm = flatGeo.attributes.normal;
        const tint = part.tint ?? 0xffffff;
        const constant = typeof tint === 'function' ? null : (tint instanceof THREE.Color ? tint.clone() : new THREE.Color(tint));
        for (let i = 0; i < pos.count; i++) {
            _p.fromBufferAttribute(pos, i);
            _n.fromBufferAttribute(norm, i);
            positions.push(_p.x, _p.y, _p.z);
            normals.push(_n.x, _n.y, _n.z);
            const col = constant ?? (tint as (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color)(_p, _n);
            colors.push(col.r, col.g, col.b);
        }
        if (flatGeo !== geo) flatGeo.dispose();
        geo.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
}

/** Shorthand: transform a fresh geometry in place and return it. */
export function placed(
    geo: THREE.BufferGeometry,
    pos: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1]
): THREE.BufferGeometry {
    const m = new THREE.Matrix4().compose(
        new THREE.Vector3(...pos),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
        new THREE.Vector3(...scale)
    );
    geo.applyMatrix4(m);
    return geo;
}

/** Linear-space colour from an sRGB hex scaled by `k` (for vertex shading). */
export function shade(hex: number, k = 1): THREE.Color {
    return _c.set(hex).multiplyScalar(k).clone();
}

/** Points on a unit sphere, evenly spread (Fibonacci lattice). Deterministic. */
export function fibonacciSphere(count: number): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
        const y = 1 - (i / Math.max(1, count - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;
        pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
    }
    return pts;
}
