/**
 * Slingable bodies: the sling-combo toys and critters you tether and fling.
 *
 * | kind           | read                                                        | tell (gameplay-linked)                          |
 * |----------------|-------------------------------------------------------------|-------------------------------------------------|
 * | `rock`         | **Pet rock**: lumpy stone, googly eyes, eye-bolt on top     | eyes widen in grab range; glow when tethered    |
 * | `chromaRock`   | **Geode**: dark stone husk with a prism-crystal cluster     | crystals cycle hue; flare when tethered         |
 * | `puffball`     | **Puffball**: fluffy spore ball, face, cheeks, stubby stem  | face widens in range, gasps while inflating     |
 * | `tetherSprite` | **Tether sprite**: teardrop sprite, paper wings, tow hook   | wings flap faster in range / tethered           |
 * | `wreckingBall` | **Wrecking ball**: studded steel ball, hazard band, chain   | chain stub sways with speed                     |
 *
 * (`toyRocket` keeps its kit-bashed body from `toy_rockets.ts`.)
 *
 * Every body is built at unit radius and scaled by the slingable's radius;
 * collision stays `obj.radius` (sphere). Per instance there is one body
 * material (the existing `bodyMaterial`: palette colour, emissive for the
 * tether glow and the geode's hue cycle); details share one material.
 * Geometry is shared. Visual-only: no RNG.
 */

import * as THREE from 'three';
import { markShared, noteMaterialCreated } from '../gpu_resources';
import { fbm3, fibonacciSphere, mergeKitParts, placed, type KitPart } from '../hazard_art/kit';
import { extrudeShape, sharedGeometry } from './shapes';

export type SlingableArtKind = 'rock' | 'puffball' | 'chromaRock' | 'tetherSprite' | 'wreckingBall';

export const SLINGABLE_ART_KINDS: readonly SlingableArtKind[] = ['rock', 'chromaRock', 'puffball', 'tetherSprite', 'wreckingBall'];

export const SLINGABLE_LABELS: Record<SlingableArtKind | 'toyRocket', string> = {
    rock: 'Pet rock (slingable)',
    chromaRock: 'Geode — chroma rock (slingable)',
    puffball: 'Puffball (slingable)',
    tetherSprite: 'Tether sprite (slingable)',
    wreckingBall: 'Wrecking ball (slingable)',
    toyRocket: 'Toy rocket wreck (slingable)'
};

/** Kinds whose faces should stay toward the camera (no free tumble). */
export const SLINGABLE_CREATURES: ReadonlySet<string> = new Set(['puffball', 'tetherSprite']);

const WHITE = new THREE.Color(1, 1, 1);
const INK = new THREE.Color(0.03, 0.03, 0.05);
const STEEL = new THREE.Color(0x8a9099);
const DARK_STEEL = new THREE.Color(0x3a3e45);
const tmp = new THREE.Color();

// ---------------------------------------------------------------------------
// Shared materials
// ---------------------------------------------------------------------------

let detailMaterial: THREE.MeshStandardMaterial | null = null;

function getDetailMaterial(): THREE.MeshStandardMaterial {
    if (!detailMaterial) {
        detailMaterial = markShared(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.25 }));
        noteMaterialCreated();
    }
    return detailMaterial;
}

/** Flat shading reads as rock; the soft kinds stay smooth. */
export function slingableUsesFlatShading(kind: SlingableArtKind): boolean {
    return kind === 'rock' || kind === 'chromaRock';
}

// ---------------------------------------------------------------------------
// Part helpers
// ---------------------------------------------------------------------------

function displace(geo: THREE.BufferGeometry, radiusAt: (dir: THREE.Vector3) => number): THREE.BufferGeometry {
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        const r = radiusAt(v);
        pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    }
    pos.needsUpdate = true;
    return geo;
}

/** Googly eye looking out along +Z, sitting on the surface at `c`. */
function googlyEye(c: [number, number, number], r: number, pupil = 0.5): KitPart[] {
    const [x, y, z] = c;
    return [
        { geometry: placed(new THREE.SphereGeometry(r, 14, 10), [x, y, z], [0, 0, 0], [1, 1, 0.7]), tint: WHITE },
        { geometry: placed(new THREE.SphereGeometry(r * pupil, 12, 8), [x, y - r * 0.12, z + r * 0.55], [0, 0, 0], [1, 1, 0.6]), tint: INK },
        { geometry: placed(new THREE.SphereGeometry(r * 0.15, 6, 4), [x + r * 0.22, y + r * 0.2, z + r * 0.78]), tint: WHITE }
    ];
}

const rockRadius = (d: THREE.Vector3) => 0.8 + 0.2 * fbm3(d.x * 1.7 + 3.1, d.y * 1.7, d.z * 1.7 - 1.3, 3);
const huskRadius = (d: THREE.Vector3) => 0.72 + 0.12 * fbm3(d.x * 2.1 - 4, d.y * 2.1 + 1, d.z * 2.1, 3);

function onRock(dir: [number, number, number], radiusAt: (d: THREE.Vector3) => number, sink = 0.96): [number, number, number] {
    const d = new THREE.Vector3(...dir).normalize();
    const r = radiusAt(d) * sink;
    return [d.x * r, d.y * r, d.z * r];
}

/** Standing eye-bolt ring + hex nut on top: the "grab me here" tow point. */
function eyeBoltParts(top: [number, number, number]): KitPart[] {
    const [x, y, z] = top;
    const nut = new THREE.CylinderGeometry(0.13, 0.15, 0.14, 6);
    return [
        { geometry: placed(nut, [x, y + 0.02, z]), tint: DARK_STEEL, flat: true },
        { geometry: placed(new THREE.TorusGeometry(0.17, 0.055, 8, 20), [x, y + 0.26, z]), tint: STEEL }
    ];
}

// ---------------------------------------------------------------------------
// Bodies (per-instance material) and details (shared material)
// ---------------------------------------------------------------------------

function buildRockBody(): THREE.BufferGeometry {
    const geo = displace(new THREE.IcosahedronGeometry(1, 2), rockRadius);
    return mergeKitParts([{
        geometry: geo,
        flat: true,
        tint: (p) => {
            const cavity = (p.length() - 0.8) / 0.2;
            return tmp.setScalar(0.55 + cavity * 0.45).clone();
        }
    }]);
}

function buildRockDetails(): THREE.BufferGeometry {
    return mergeKitParts([
        ...googlyEye(onRock([-0.33, 0.2, 0.92], rockRadius, 1.0), 0.2, 0.52),
        ...googlyEye(onRock([0.3, 0.24, 0.92], rockRadius, 1.0), 0.17, 0.52),
        // Little mossy freckles so the stone has a cheek.
        { geometry: placed(new THREE.SphereGeometry(0.07, 6, 4), onRock([-0.45, -0.12, 0.88], rockRadius, 1.0)), tint: new THREE.Color(0x6fdc8c) },
        { geometry: placed(new THREE.SphereGeometry(0.06, 6, 4), onRock([0.42, -0.1, 0.9], rockRadius, 1.0)), tint: new THREE.Color(0x6fdc8c) },
        ...eyeBoltParts(onRock([0, 1, 0], rockRadius, 0.95))
    ]);
}

/** Crystal directions + [length, radius] for the geode cluster (front / top hemisphere). */
const GEODE_CRYSTALS: Array<[[number, number, number], number, number]> = [
    [[0.1, 0.55, 0.85], 0.62, 0.17],
    [[-0.45, 0.35, 0.8], 0.5, 0.14],
    [[0.55, 0.2, 0.8], 0.48, 0.13],
    [[-0.1, 0.95, 0.25], 0.56, 0.15],
    [[0.45, 0.8, 0.1], 0.42, 0.12],
    [[-0.6, 0.75, -0.1], 0.4, 0.11],
    [[0.0, 0.05, 1.0], 0.42, 0.13],
    [[-0.35, -0.2, 0.9], 0.34, 0.1]
];

function crystalPrism(len: number, r: number): THREE.BufferGeometry {
    const profile = [
        new THREE.Vector2(0.0, 0),
        new THREE.Vector2(r * 0.9, 0),
        new THREE.Vector2(r, len * 0.7),
        new THREE.Vector2(0, len)
    ];
    return new THREE.LatheGeometry(profile, 6);
}

function buildGeodeBody(): THREE.BufferGeometry {
    const up = new THREE.Vector3(0, 1, 0);
    const parts: KitPart[] = [];
    for (const [dir, len, r] of GEODE_CRYSTALS) {
        const d = new THREE.Vector3(...dir).normalize();
        const base = huskRadius(d) * 0.6;
        const geo = crystalPrism(len * 1.25, r * 1.35);
        geo.applyMatrix4(new THREE.Matrix4().compose(
            d.clone().multiplyScalar(base),
            new THREE.Quaternion().setFromUnitVectors(up, d),
            new THREE.Vector3(1, 1, 1)
        ));
        parts.push({ geometry: geo, flat: true, tint: (p) => tmp.setScalar(0.7 + 0.3 * THREE.MathUtils.clamp((p.length() - 0.6) / 0.6, 0, 1)).clone() });
    }
    return mergeKitParts(parts);
}

function buildGeodeDetails(): THREE.BufferGeometry {
    const husk = displace(new THREE.IcosahedronGeometry(1, 2), huskRadius);
    return mergeKitParts([{
        geometry: husk,
        flat: true,
        tint: (p) => {
            const k = (p.length() - 0.72) / 0.12;
            return tmp.set(0x2c2438).multiplyScalar(0.8 + k * 0.7).clone();
        }
    }]);
}

const PUFF_TUFTS = fibonacciSphere(46);

function puffRadius(d: THREE.Vector3): number {
    let best = 0;
    for (const t of PUFF_TUFTS) best = Math.max(best, d.dot(t));
    // best ≈ 1 at a tuft centre, ~0.93 between tufts.
    const bump = THREE.MathUtils.clamp((best - 0.9) / 0.1, 0, 1);
    return 0.86 + 0.14 * bump * bump;
}

function buildPuffBody(): THREE.BufferGeometry {
    const geo = displace(new THREE.SphereGeometry(1, 40, 28), puffRadius);
    return mergeKitParts([{
        geometry: geo,
        tint: (p) => tmp.setScalar(0.78 + 0.22 * THREE.MathUtils.clamp((p.length() - 0.86) / 0.14, 0, 1)).clone()
    }]);
}

function buildPuffFace(): THREE.BufferGeometry {
    const smile = new THREE.TorusGeometry(0.13, 0.03, 6, 14, Math.PI);
    smile.rotateZ(Math.PI);
    return mergeKitParts([
        ...googlyEye([-0.26, 0.14, 0.84], 0.17, 0.58),
        ...googlyEye([0.26, 0.14, 0.84], 0.17, 0.58),
        { geometry: placed(smile, [0, -0.1, 0.95]), tint: INK },
        { geometry: placed(new THREE.SphereGeometry(0.1, 8, 6), [-0.44, -0.08, 0.82], [0, 0, 0], [1, 0.6, 0.4]), tint: new THREE.Color(0xff8fb8) },
        { geometry: placed(new THREE.SphereGeometry(0.1, 8, 6), [0.44, -0.08, 0.82], [0, 0, 0], [1, 0.6, 0.4]), tint: new THREE.Color(0xff8fb8) }
    ]);
}

function buildPuffDetails(): THREE.BufferGeometry {
    const parts: KitPart[] = [
        { geometry: placed(new THREE.CylinderGeometry(0.32, 0.42, 0.42, 12), [0, -0.98, 0]), tint: new THREE.Color(0xe8c8a0) },
        { geometry: placed(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 12), [0, -1.18, 0]), tint: new THREE.Color(0xc9a77c) }
    ];
    // Glowing spore freckles across the crown.
    const freckles: Array<[number, number, number]> = [[0.2, 0.95, 0.2], [-0.4, 0.85, 0.3], [0.5, 0.75, -0.3], [-0.2, 0.8, -0.55], [0.65, 0.55, 0.45]];
    for (const f of freckles) {
        const d = new THREE.Vector3(...f).normalize().multiplyScalar(0.97);
        parts.push({ geometry: placed(new THREE.SphereGeometry(0.075, 6, 4), [d.x, d.y, d.z]), tint: new THREE.Color(0x66ff99) });
    }
    return mergeKitParts(parts);
}

const SPRITE_PROFILE: Array<[number, number]> = [
    [0, -0.85], [0.3, -0.75], [0.55, -0.45], [0.62, -0.1], [0.52, 0.25], [0.3, 0.55], [0.1, 0.78], [0, 0.82]
];

function buildSpriteBody(): THREE.BufferGeometry {
    const geo = new THREE.LatheGeometry(SPRITE_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 20);
    return mergeKitParts([{ geometry: geo, tint: (p) => tmp.setScalar(0.75 + 0.25 * (p.y + 0.85) / 1.7).clone() }]);
}

function buildSpriteDetails(): THREE.BufferGeometry {
    const hook = new THREE.TorusGeometry(0.2, 0.05, 8, 18, Math.PI * 1.35);
    hook.rotateZ(-Math.PI * 0.55);
    const gold = new THREE.Color(0xffd36b);
    return mergeKitParts([
        ...googlyEye([-0.2, 0.0, 0.52], 0.14, 0.6),
        ...googlyEye([0.2, 0.0, 0.52], 0.14, 0.6),
        { geometry: placed(new THREE.SphereGeometry(0.05, 6, 4), [0, -0.22, 0.56]), tint: new THREE.Color(0xff6fa8) },
        // Tow hook: shank up out of the tip, then the curl.
        { geometry: placed(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 8), [0, 0.92, 0]), tint: gold },
        { geometry: placed(hook, [0.17, 1.15, 0]), tint: gold },
        { geometry: placed(new THREE.ConeGeometry(0.06, 0.14, 8), [0.36, 1.06, 0], [0, 0, Math.PI * 0.85]), tint: gold }
    ]);
}

function buildSpriteWing(): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.05);
    shape.lineTo(0.95, 0.42);
    shape.lineTo(0.62, -0.05);
    shape.lineTo(0.75, -0.32);
    shape.lineTo(0, -0.12);
    shape.lineTo(0, 0.05);
    return mergeKitParts([{
        geometry: extrudeShape(shape, 0.03, 0.008, 2),
        flat: true,
        tint: (p) => tmp.set(0xffffff).lerp(new THREE.Color(0xffc6ec), THREE.MathUtils.clamp(p.x, 0, 1)).clone()
    }]);
}

function buildWreckingBody(): THREE.BufferGeometry {
    return mergeKitParts([{
        geometry: new THREE.SphereGeometry(1, 32, 22),
        tint: (p) => tmp.setScalar(0.75 + 0.25 * Math.max(0, p.y)).clone()
    }]);
}

function buildWreckingDetails(): THREE.BufferGeometry {
    const yellow = new THREE.Color(0xffc21a);
    const black = new THREE.Color(0x141414);
    const band = new THREE.CylinderGeometry(1.035, 1.035, 0.34, 48, 1, true);
    const parts: KitPart[] = [{
        geometry: band,
        flat: true,
        tint: (p) => {
            const a = Math.atan2(p.z, p.x) / (Math.PI * 2) + 0.5;
            const stripe = Math.floor(a * 14 + p.y * 1.6) % 2 === 0;
            return (stripe ? yellow : black).clone();
        }
    }];
    for (const y of [-0.17, 0.17]) {
        parts.push({ geometry: placed(new THREE.TorusGeometry(1.035, 0.035, 6, 48), [0, y, 0], [Math.PI / 2, 0, 0]), tint: DARK_STEEL });
    }
    // Studs on two latitudes.
    for (const lat of [-0.55, 0.55]) {
        const ringR = Math.sqrt(1 - lat * lat);
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + (lat > 0 ? 0 : Math.PI / 10);
            parts.push({ geometry: placed(new THREE.SphereGeometry(0.075, 8, 6), [Math.cos(a) * ringR, lat, Math.sin(a) * ringR]), tint: STEEL });
        }
    }
    // Chain stub: mount plate, shackle, two links.
    parts.push({ geometry: placed(new THREE.CylinderGeometry(0.26, 0.3, 0.12, 12), [0, 0.98, 0]), tint: DARK_STEEL });
    parts.push({ geometry: placed(new THREE.TorusGeometry(0.15, 0.05, 8, 16, Math.PI), [0, 1.04, 0]), tint: STEEL });
    parts.push({ geometry: placed(new THREE.TorusGeometry(0.12, 0.045, 8, 16), [0, 1.3, 0], [0, Math.PI / 2, 0], [1, 1.45, 1]), tint: STEEL });
    parts.push({ geometry: placed(new THREE.TorusGeometry(0.12, 0.045, 8, 16), [0, 1.58, 0], [0, 0, 0], [1, 1.45, 1]), tint: STEEL });
    return mergeKitParts(parts);
}

const BODY_BUILDERS: Record<SlingableArtKind, () => THREE.BufferGeometry> = {
    rock: buildRockBody,
    chromaRock: buildGeodeBody,
    puffball: buildPuffBody,
    tetherSprite: buildSpriteBody,
    wreckingBall: buildWreckingBody
};

const DETAIL_BUILDERS: Record<SlingableArtKind, () => THREE.BufferGeometry> = {
    rock: buildRockDetails,
    chromaRock: buildGeodeDetails,
    puffball: buildPuffDetails,
    tetherSprite: buildSpriteDetails,
    wreckingBall: buildWreckingDetails
};

export function getSlingableBodyGeometry(kind: SlingableArtKind): THREE.BufferGeometry {
    return sharedGeometry(`slingable_body_${kind}`, BODY_BUILDERS[kind]);
}

export function getSlingableDetailGeometry(kind: SlingableArtKind): THREE.BufferGeometry {
    return sharedGeometry(`slingable_detail_${kind}`, DETAIL_BUILDERS[kind]);
}

/** Unit tether-state shell and grab-hint ring, scaled per instance. */
export function getSlingableShellGeometry(): THREE.BufferGeometry {
    return sharedGeometry('slingable_shell', () => new THREE.IcosahedronGeometry(1.25, 1));
}

export function getSlingableHintRingGeometry(): THREE.BufferGeometry {
    return sharedGeometry('slingable_hint_ring', () => new THREE.TorusGeometry(1.7, 0.05, 8, 32));
}

// ---------------------------------------------------------------------------
// Rig
// ---------------------------------------------------------------------------

export interface SlingableRig {
    kind: SlingableArtKind;
    /** Unit-radius holder scaled by the slingable radius. */
    root: THREE.Group;
    body: THREE.Mesh;
    details: THREE.Mesh;
    face?: THREE.Mesh;
    wings?: [THREE.Mesh, THREE.Mesh];
    /** Visual clock (seconds). */
    t: number;
    /** Eased 0..1 "in grab range" tell. */
    alert: number;
}

/**
 * Build the body for one slingable. `bodyMaterial` is the instance's own
 * material (tether glow / hue cycle); everything else is shared.
 */
export function buildSlingableRig(kind: SlingableArtKind, radius: number, bodyMaterial: THREE.Material): SlingableRig {
    const root = new THREE.Group();
    root.scale.setScalar(radius);

    const body = new THREE.Mesh(getSlingableBodyGeometry(kind), bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    const details = new THREE.Mesh(getSlingableDetailGeometry(kind), getDetailMaterial());
    details.castShadow = true;
    root.add(details, body);

    const rig: SlingableRig = { kind, root, body, details, t: 0, alert: 0 };

    if (kind === 'puffball') {
        rig.face = new THREE.Mesh(sharedGeometry('slingable_puff_face', buildPuffFace), getDetailMaterial());
        root.add(rig.face);
    } else if (kind === 'tetherSprite') {
        const wingGeo = sharedGeometry('slingable_sprite_wing', buildSpriteWing);
        const wingR = new THREE.Mesh(wingGeo, getDetailMaterial());
        wingR.position.set(0.45, 0.05, -0.1);
        const wingL = new THREE.Mesh(wingGeo, getDetailMaterial());
        wingL.position.set(-0.45, 0.05, -0.1);
        wingL.scale.x = -1;
        root.add(wingL, wingR);
        rig.wings = [wingL, wingR];
    }
    return rig;
}

export interface SlingableRigPose {
    /** Player is within grab range (0..1, 1 = right on top of it). */
    near: number;
    tethered: boolean;
    /** 0..1 progress of a puffball's inflate-and-pop. */
    inflate?: number;
    /** Current speed (world units / s). */
    speed?: number;
}

/** Per-frame pose. Visual-only. */
export function updateSlingableRig(rig: SlingableRig, dt: number, pose: SlingableRigPose): void {
    rig.t += dt;
    const target = pose.tethered ? 1 : pose.near;
    rig.alert += (target - rig.alert) * Math.min(1, dt * 6);
    const a = rig.alert;
    const t = rig.t;

    switch (rig.kind) {
        case 'puffball': {
            if (!rig.face) break;
            const inflate = pose.inflate ?? 0;
            // Wide-eyed in range, a gasp (tall, narrow face) while inflating.
            const sx = 1 + a * 0.1 - inflate * 0.12;
            const sy = 1 + a * 0.12 + inflate * 0.35;
            rig.face.scale.set(sx, sy, 1);
            rig.face.position.y = Math.sin(t * 2.2) * 0.02;
            break;
        }
        case 'tetherSprite': {
            if (!rig.wings) break;
            const rate = 7 + a * 11;
            const flap = Math.sin(t * rate) * (0.35 + a * 0.25);
            rig.wings[0].rotation.z = -flap;
            rig.wings[1].rotation.z = flap;
            rig.root.position.y = Math.sin(t * 3) * 0.06;
            break;
        }
        case 'wreckingBall': {
            // Chain stub swings a little with speed (whole details mesh rocks about the centre).
            const swing = Math.min(1, (pose.speed ?? 0) / 12);
            rig.details.rotation.z = Math.sin(t * 3.1) * 0.03 * (1 + swing * 3);
            break;
        }
        case 'rock': {
            // Pet rock "notices" you: a slow squash-bounce in range.
            const s = 1 + Math.max(0, Math.sin(t * 5)) * 0.05 * a;
            rig.root.scale.y = rig.root.scale.x * s;
            break;
        }
        case 'chromaRock':
            rig.body.scale.setScalar(1 + a * 0.06 + Math.sin(t * 6) * 0.02 * a);
            break;
    }
}
