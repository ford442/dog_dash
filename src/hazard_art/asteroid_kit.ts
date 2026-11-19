/**
 * Asteroid kit — a small family of shared rock geometries used by the
 * obstacle system (`createAsteroid`), the background asteroid field and the
 * ghost-debris / chroma-shift hazards.
 *
 * Five silhouettes, each built once per process and shared by every spawn
 * (`markShared`, so `disposeObject` never frees them):
 *
 * | kind       | silhouette                                   |
 * |------------|----------------------------------------------|
 * | `chunk`    | blocky rock with large flat cleavage facets  |
 * | `shard`    | long, pointed splinter                       |
 * | `cratered` | round boulder with rimmed impact craters     |
 * | `ore`      | lumpy rock with raised, glowing ore veins    |
 * | `rubble`   | elongated lumpy potato                       |
 *
 * All five are normalised so their furthest vertex sits at radius 1, which
 * keeps `scale = userData.radius` matching the collision radius.
 *
 * Geometry carries a `color` attribute (crater floors and creases darker, rims
 * and ridges lighter), so the material colour sets the chapter palette and the
 * vertex colour carries the form. The `ore` kind has two material groups:
 * 0 = rock, 1 = vein (emissive).
 */

import * as THREE from 'three';
import { markShared, noteGeometryCreated } from '../gpu_resources';
import { fbm3, hash3 } from './kit';

export type AsteroidKind = 'chunk' | 'shard' | 'cratered' | 'ore' | 'rubble';

export const ASTEROID_KINDS: readonly AsteroidKind[] = ['chunk', 'shard', 'cratered', 'ore', 'rubble'];

export interface AsteroidPalette {
    /** Rock base colour (multiplied with vertex shading). */
    rock: number;
    /** Ore-vein colour and glow. */
    vein: number;
    /** Faint rock emissive so dark chapters still read. */
    emissive: number;
}

/**
 * Per-chapter rock palettes. Chapter identity comes from colour *and* the
 * vein glow; the five shapes are shared across chapters.
 */
export const ASTEROID_PALETTES: Record<number, AsteroidPalette> = {
    // Lighter than they look on paper: vertex shading multiplies them by
    // 0.5–1.0, and the old depth fade drew every rock as a 0.4-linear grey.
    0: { rock: 0xaaa49e, vein: 0xffc040, emissive: 0x0a0a0a },
    1: { rock: 0x92ad88, vein: 0x66ff99, emissive: 0x0a180c }, // Neon Garden: mossy
    2: { rock: 0x9e94ba, vein: 0x00e5ff, emissive: 0x0c0a1e }, // Asteroid Belt: violet with cyan seams
    3: { rock: 0x76625a, vein: 0xff6a1a, emissive: 0x1e0a04 }, // Orbital Descent: charred, molten seams
    4: { rock: 0xb27a55, vein: 0xff3b1a, emissive: 0x160804 }, // Rusty Gauntlet: rust and hot ore
    5: { rock: 0xc290aa, vein: 0xff66cc, emissive: 0x180a18 }, // Astral Leviathan: coral-pink
    6: { rock: 0xb4d4e6, vein: 0x66ffff, emissive: 0x081826 }  // Aqua Expanse: ice
};

export function getAsteroidPalette(level: number): AsteroidPalette {
    return ASTEROID_PALETTES[level] ?? ASTEROID_PALETTES[0];
}

// ---------------------------------------------------------------------------
// Shape builders (unit radius, deterministic)
// ---------------------------------------------------------------------------

type Shaper = (p: THREE.Vector3) => void;

const _v = new THREE.Vector3();

/** Apply `shape` to every vertex of a (non-indexed) polyhedron, then normalise to radius 1. */
function shapeVertices(geo: THREE.BufferGeometry, shape: Shaper): void {
    const pos = geo.attributes.position;
    let maxR = 0;
    for (let i = 0; i < pos.count; i++) {
        _v.fromBufferAttribute(pos, i);
        shape(_v);
        pos.setXYZ(i, _v.x, _v.y, _v.z);
        maxR = Math.max(maxR, _v.length());
    }
    if (maxR > 0) geo.scale(1 / maxR, 1 / maxR, 1 / maxR);
}

/** Flatten everything beyond a plane: big cleavage facets. */
function planeCut(p: THREE.Vector3, normal: THREE.Vector3, offset: number): void {
    const d = p.dot(normal);
    if (d > offset) p.addScaledVector(normal, offset - d);
}

const CUT_NORMALS = [
    new THREE.Vector3(0.8, 0.5, 0.3).normalize(),
    new THREE.Vector3(-0.6, 0.7, -0.4).normalize(),
    new THREE.Vector3(-0.3, -0.8, 0.5).normalize(),
    new THREE.Vector3(0.5, -0.4, -0.75).normalize(),
    new THREE.Vector3(-0.9, -0.1, 0.4).normalize()
];

interface Crater { dir: THREE.Vector3; radius: number; depth: number }

const CRATERS: Crater[] = [
    { dir: new THREE.Vector3(-0.5, 0.35, 0.8).normalize(), radius: 0.55, depth: 0.28 },
    { dir: new THREE.Vector3(0.2, 0.9, -0.3).normalize(), radius: 0.42, depth: 0.22 },
    { dir: new THREE.Vector3(0.6, -0.3, 0.75).normalize(), radius: 0.48, depth: 0.24 },
    { dir: new THREE.Vector3(-0.2, -0.7, -0.7).normalize(), radius: 0.36, depth: 0.17 },
    { dir: new THREE.Vector3(0.85, 0.2, -0.5).normalize(), radius: 0.3, depth: 0.14 },
    { dir: new THREE.Vector3(-0.85, -0.35, 0.1).normalize(), radius: 0.34, depth: 0.16 },
    { dir: new THREE.Vector3(-0.4, 0.2, -0.9).normalize(), radius: 0.26, depth: 0.12 }
];

/** Signed crater profile at angular distance `a` (radians) from a crater centre. */
function craterProfile(a: number, c: Crater): number {
    const t = a / c.radius;
    if (t < 1) return -c.depth * (1 - t * t) + c.depth * 0.35 * Math.exp(-((t - 0.95) ** 2) / 0.015);
    // Raised rim just outside the bowl.
    return c.depth * 0.35 * Math.exp(-((t - 1.0) ** 2) / 0.02);
}

function craterField(dir: THREE.Vector3): { offset: number; inCrater: number; rim: number } {
    let offset = 0, inCrater = 0, rim = 0;
    for (const c of CRATERS) {
        const a = Math.acos(THREE.MathUtils.clamp(dir.dot(c.dir), -1, 1));
        offset += craterProfile(a, c);
        const t = a / c.radius;
        if (t < 0.9) inCrater = Math.max(inCrater, 1 - t / 0.9);
        rim = Math.max(rim, Math.exp(-((t - 1.0) ** 2) / 0.02));
    }
    return { offset, inCrater, rim };
}

/** Ore veins: thin bands where a noise field crosses its midpoint. */
function veinAmount(dir: THREE.Vector3): number {
    const n = fbm3(dir.x * 2.2 + 5, dir.y * 2.2 + 1, dir.z * 2.2 + 9, 2);
    return Math.max(0, 1 - Math.abs(n - 0.5) / 0.045);
}

const _dir = new THREE.Vector3();

function buildChunk(): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 2);
    shapeVertices(geo, (p) => {
        _dir.copy(p).normalize();
        p.multiplyScalar(1 + (fbm3(_dir.x * 1.6, _dir.y * 1.6, _dir.z * 1.6) - 0.5) * 0.45);
        p.set(p.x * 1.15, p.y * 0.9, p.z);
        CUT_NORMALS.forEach((n, i) => planeCut(p, n, 0.72 + (i % 2) * 0.08));
    });
    return geo;
}

function buildShard(): THREE.BufferGeometry {
    const geo = new THREE.OctahedronGeometry(1, 1);
    shapeVertices(geo, (p) => {
        _dir.copy(p).normalize();
        const n = fbm3(_dir.x * 2.5 + 3, _dir.y * 2.5, _dir.z * 2.5);
        p.multiplyScalar(1 + (n - 0.5) * 0.35);
        // Long axis X, slight bend so it reads as a splinter, not a lozenge.
        p.set(p.x * 1.9, p.y * 0.55 + p.x * p.x * 0.12, p.z * 0.62);
        planeCut(p, CUT_NORMALS[0], 0.9);
    });
    return geo;
}

function buildCratered(): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 4);
    shapeVertices(geo, (p) => {
        _dir.copy(p).normalize();
        const bump = (fbm3(_dir.x * 2, _dir.y * 2, _dir.z * 2) - 0.5) * 0.14;
        p.multiplyScalar(1 + bump + craterField(_dir).offset);
        p.y *= 0.92;
    });
    return geo;
}

function buildOre(): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 3);
    shapeVertices(geo, (p) => {
        _dir.copy(p).normalize();
        const lump = (fbm3(_dir.x * 1.8 + 11, _dir.y * 1.8, _dir.z * 1.8) - 0.5) * 0.5;
        const vein = veinAmount(_dir);
        p.multiplyScalar(1 + lump + vein * 0.07);
        planeCut(p, CUT_NORMALS[2], 0.78);
        planeCut(p, CUT_NORMALS[3], 0.82);
    });
    return geo;
}

function buildRubble(): THREE.BufferGeometry {
    const geo = new THREE.DodecahedronGeometry(1, 2);
    shapeVertices(geo, (p) => {
        _dir.copy(p).normalize();
        const lump = (fbm3(_dir.x * 2.8 + 7, _dir.y * 2.8 + 2, _dir.z * 2.8) - 0.5) * 0.55;
        p.multiplyScalar(1 + lump);
        p.set(p.x * 1.4, p.y * 0.78, p.z * 0.95);
        planeCut(p, CUT_NORMALS[4], 0.95);
    });
    return geo;
}

const BUILDERS: Record<AsteroidKind, () => THREE.BufferGeometry> = {
    chunk: buildChunk,
    shard: buildShard,
    cratered: buildCratered,
    ore: buildOre,
    rubble: buildRubble
};

// ---------------------------------------------------------------------------
// Vertex shading + groups
// ---------------------------------------------------------------------------

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _cc = new THREE.Vector3();
const _centroid = new THREE.Vector3();

/**
 * Bake vertex colour (crease/crater darkening, rim highlights, speckle) and,
 * for `ore`, reorder triangles into rock + vein material groups.
 */
function finish(kind: AsteroidKind, geo: THREE.BufferGeometry): THREE.BufferGeometry {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const pos = src.attributes.position;
    const triCount = pos.count / 3;

    const rockTris: number[] = [];
    const veinTris: number[] = [];
    for (let t = 0; t < triCount; t++) {
        if (kind === 'ore') {
            _a.fromBufferAttribute(pos, t * 3);
            _b.fromBufferAttribute(pos, t * 3 + 1);
            _cc.fromBufferAttribute(pos, t * 3 + 2);
            _centroid.copy(_a).add(_b).add(_cc).normalize();
            (veinAmount(_centroid) > 0.35 ? veinTris : rockTris).push(t);
        } else {
            rockTris.push(t);
        }
    }

    const order = rockTris.concat(veinTris);
    const positions = new Float32Array(order.length * 9);
    const colors = new Float32Array(order.length * 9);
    order.forEach((t, k) => {
        for (let v = 0; v < 3; v++) {
            _a.fromBufferAttribute(pos, t * 3 + v);
            positions.set([_a.x, _a.y, _a.z], k * 9 + v * 3);
            const r = _a.length();
            _dir.copy(_a).normalize();
            // Lower than the mean surface = crease or crater floor: darker.
            let k2 = 0.72 + THREE.MathUtils.clamp((r - 0.8) * 1.4, -0.3, 0.3);
            if (kind === 'cratered') {
                const f = craterField(_dir);
                k2 = 0.95 - f.inCrater * 0.5 + f.rim * 0.25;
            }
            // Speckle so flat facets aren't flat colour.
            k2 *= 0.88 + hash3(_a.x * 9.1, _a.y * 9.1, _a.z * 9.1) * 0.24;
            colors.set([k2, k2, k2], k * 9 + v * 3);
        }
    });

    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    out.computeVertexNormals();
    out.addGroup(0, rockTris.length * 3, 0);
    if (veinTris.length > 0) out.addGroup(rockTris.length * 3, veinTris.length * 3, 1);
    out.computeBoundingSphere();
    out.computeBoundingBox();
    if (src !== geo) src.dispose();
    geo.dispose();
    out.userData.asteroidKind = kind;
    return out;
}

const sharedGeometries = new Map<AsteroidKind, THREE.BufferGeometry>();

/** Shared, never-disposed unit-radius geometry for `kind`. Built on first use. */
export function getAsteroidGeometry(kind: AsteroidKind): THREE.BufferGeometry {
    let geo = sharedGeometries.get(kind);
    if (!geo) {
        geo = markShared(finish(kind, BUILDERS[kind]()));
        noteGeometryCreated();
        sharedGeometries.set(kind, geo);
    }
    return geo;
}

/**
 * A fresh, owned copy of a kit shape (no groups). For instanced users that
 * manage their own geometry lifetime (asteroid field, ghost debris).
 */
export function buildAsteroidGeometry(kind: AsteroidKind, radius = 1): THREE.BufferGeometry {
    const geo = getAsteroidGeometry(kind).clone();
    geo.clearGroups();
    geo.userData = {};
    if (radius !== 1) geo.scale(radius, radius, radius);
    return geo;
}

/**
 * Visual-only shape pick. Uses `Math.random` on purpose: the shape never
 * feeds gameplay (collision uses `userData.radius`), and drawing it from the
 * run RNG would shift every later obstacle roll.
 */
export function pickAsteroidKind(): AsteroidKind {
    const r = Math.random(); // visual-only
    if (r < 0.26) return 'chunk';
    if (r < 0.44) return 'cratered';
    if (r < 0.62) return 'rubble';
    if (r < 0.8) return 'shard';
    return 'ore';
}

/**
 * Materials for one asteroid. Per-instance because the obstacle system fades
 * `material.color` with depth. The `ore` kind returns `[rock, vein]` to match
 * its geometry groups; everything else returns a single material.
 */
export function createAsteroidMaterial(kind: AsteroidKind, level: number): THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] {
    const palette = getAsteroidPalette(level);
    const jitter = 0.9 + Math.random() * 0.2; // visual-only
    const rock = new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.rock).multiplyScalar(jitter),
        vertexColors: true,
        roughness: kind === 'shard' ? 0.7 : 0.95,
        metalness: kind === 'shard' ? 0.2 : 0.05,
        emissive: palette.emissive,
        flatShading: true
    });
    if (kind !== 'ore') return rock;
    const vein = new THREE.MeshStandardMaterial({
        color: palette.vein,
        emissive: palette.vein,
        emissiveIntensity: 0.9,
        roughness: 0.35,
        metalness: 0.4,
        flatShading: true
    });
    return [rock, vein];
}
