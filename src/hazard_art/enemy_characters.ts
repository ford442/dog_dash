/**
 * Chapter enemy characters: the six formation-enemy skins, one per chapter.
 *
 * | ch | id              | read                                            | idle                  | telegraph                          |
 * |----|-----------------|-------------------------------------------------|-----------------------|------------------------------------|
 * | 1  | `burr_pod`      | spiky seed pod, one big eye, petal crown tail   | crown flutter, blink  | spikes bristle, crown flares       |
 * | 2  | `prism_mite`    | crystal lance body, twin eyes, crystal wings    | wings flex, glint     | wings splay, body hums             |
 * | 3  | `scorch_beetle` | heat-shield beetle, mandibles, rocket nozzle    | flame flicker         | shell lifts, flame roars           |
 * | 4  | `rust_drone`    | boxy twin-rotor drone with a camera-lens eye    | rotors spin, blinker  | lens contracts, red strobe, dips   |
 * | 5  | `krill`         | segmented shrimp, stalk eyes, tail fan          | body ripple, fan wag  | tail curls, photophores flare      |
 * | 6  | `jelly_drifter` | scalloped bell, face, trailing tentacles        | bell pulse, sway      | fast pulse, tentacles reach        |
 *
 * Every character faces -X (toward the oncoming player), is built at unit
 * radius (the root mesh is scaled by the spawn size), and reuses shared
 * geometry per character. Per instance there is one body material (the
 * tinted colour, also what the obstacle system's depth fade mutates) and one
 * glow material (the tell); eyes and details use shared materials, so a tint
 * recolours the body without erasing the face.
 *
 * Visual-only: nothing here reads or advances the run RNG.
 */

import * as THREE from 'three';
import { gpuResourceStats, markShared, noteGeometryCreated, noteMaterialCreated } from '../gpu_resources';
import { fibonacciSphere, fbm3, hash3, mergeKitParts, placed, type KitPart } from './kit';

export type EnemyCharacterId =
    | 'burr_pod'
    | 'prism_mite'
    | 'scorch_beetle'
    | 'rust_drone'
    | 'krill'
    | 'jelly_drifter';

export const ENEMY_CHARACTER_IDS: readonly EnemyCharacterId[] = [
    'burr_pod', 'prism_mite', 'scorch_beetle', 'rust_drone', 'krill', 'jelly_drifter'
];

/** Chapter → formation enemy. Levels without an entry use the chapter-1 pod. */
export const CHAPTER_ENEMY: Record<number, EnemyCharacterId> = {
    1: 'burr_pod',
    2: 'prism_mite',
    3: 'scorch_beetle',
    4: 'rust_drone',
    5: 'krill',
    6: 'jelly_drifter'
};

export const ENEMY_CHARACTER_LABELS: Record<EnemyCharacterId, string> = {
    burr_pod: 'Burr Pod (ch1)',
    prism_mite: 'Prism Mite (ch2)',
    scorch_beetle: 'Scorch Beetle (ch3)',
    rust_drone: 'Rust Drone (ch4)',
    krill: 'Krill (ch5)',
    jelly_drifter: 'Jelly Drifter (ch6)'
};

/** Player must be this far ahead (world units, +X) and within ±TELL_HALF_HEIGHT to trigger the telegraph. */
export const ENEMY_TELL_RANGE = 16;
export const ENEMY_TELL_HALF_HEIGHT = 7;

export function enemyCharacterForLevel(level: number): EnemyCharacterId {
    return CHAPTER_ENEMY[level] ?? 'burr_pod';
}

// ---------------------------------------------------------------------------
// Shared materials
// ---------------------------------------------------------------------------

let faceMaterial: THREE.MeshStandardMaterial | null = null;
const detailMaterials = new Map<string, THREE.MeshStandardMaterial>();

/** White sclera + dark pupil are baked into vertex colour: one shared material for every face. */
function getFaceMaterial(): THREE.MeshStandardMaterial {
    if (!faceMaterial) {
        faceMaterial = markShared(new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.25,
            metalness: 0.0,
            emissive: 0x222222
        }));
        noteMaterialCreated();
    }
    return faceMaterial;
}

function getDetailMaterial(key: string, params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    let mat = detailMaterials.get(key);
    if (!mat) {
        mat = markShared(new THREE.MeshStandardMaterial(params));
        noteMaterialCreated();
        detailMaterials.set(key, mat);
    }
    return mat;
}

// ---------------------------------------------------------------------------
// Part helpers
// ---------------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);
const WHITE = new THREE.Color(1, 1, 1);
const INK = new THREE.Color(0.02, 0.02, 0.03);

/** Orient a +Y-aligned geometry along `dir`, centred `dist` out from the origin. */
function alongDir(geo: THREE.BufferGeometry, dir: THREE.Vector3, dist: number): THREE.BufferGeometry {
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    const m = new THREE.Matrix4().compose(dir.clone().normalize().multiplyScalar(dist), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    return geo;
}

/**
 * One cartoon eye looking down -X, centred at `c` relative to the face pivot:
 * sclera, pupil and a catch-light, all in one vertex-coloured part list.
 */
function eyeParts(c: [number, number, number], r: number, pupilScale = 0.55): KitPart[] {
    const [x, y, z] = c;
    return [
        { geometry: placed(new THREE.SphereGeometry(r, 14, 10), [x, y, z]), tint: WHITE },
        { geometry: placed(new THREE.SphereGeometry(r * pupilScale, 12, 8), [x - r * 0.62, y, z]), tint: INK },
        { geometry: placed(new THREE.SphereGeometry(r * 0.16, 6, 4), [x - r * 0.92, y + r * 0.3, z + r * 0.2]), tint: WHITE }
    ];
}

function sharedGeo(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    noteGeometryCreated();
    return markShared(geo);
}

// ---------------------------------------------------------------------------
// Rig
// ---------------------------------------------------------------------------

export interface EnemyRig {
    id: EnemyCharacterId;
    /** Face pivot: scaled for blinks and wide-eyed telegraphs. */
    face: THREE.Object3D;
    /** Per-instance emissive material for the tell. */
    glow: THREE.MeshStandardMaterial;
    glowBase: number;
    /** Character-specific animated parts, by name. */
    parts: Record<string, THREE.Object3D | THREE.Object3D[]>;
    /** Smoothed 0..1 telegraph level. */
    alert: number;
    /** Visual phase offset so a formation doesn't animate in lockstep. */
    phase: number;
    /** Seconds until the next blink. */
    blinkIn: number;
    blinkT: number;
    /** 0..1 hit flash (gallery and future damage feedback). */
    hitFlash: number;
}

interface CharacterTemplate {
    bodyColor: number;
    glowColor: number;
    bodyParams: Partial<THREE.MeshStandardMaterialParameters>;
    glowBase: number;
    bodyGeo: THREE.BufferGeometry;
    faceGeo: THREE.BufferGeometry;
    facePos: [number, number, number];
    /** Add animated children; return the rig parts map. */
    build(root: THREE.Mesh, bodyMat: THREE.MeshStandardMaterial, glowMat: THREE.MeshStandardMaterial): EnemyRig['parts'];
    animate(rig: EnemyRig, root: THREE.Mesh, t: number, a: number, dt: number): void;
}

// ---------------------------------------------------------------------------
// 1. Burr Pod (Neon Garden)
// ---------------------------------------------------------------------------

function burrPodTemplate(): CharacterTemplate {
    const ribTint = (p: THREE.Vector3) => {
        const rib = 0.8 + 0.2 * Math.cos(Math.atan2(p.z, p.y) * 7);
        const back = THREE.MathUtils.clamp(0.9 + p.x * 0.25, 0.7, 1.1);
        return new THREE.Color(rib * back, rib * back, rib * back);
    };
    const bodyGeo = sharedGeo(mergeKitParts([
        { geometry: placed(new THREE.SphereGeometry(0.6, 18, 12), [0, 0, 0], [0, 0, 0], [1.12, 1, 1]), tint: ribTint },
        // Stubby stem at the back, where the crown attaches.
        { geometry: placed(new THREE.CylinderGeometry(0.12, 0.18, 0.2, 8), [0.68, 0, 0], [0, 0, Math.PI / 2]), tint: 0x99aa77 }
    ]));

    const spikeParts: KitPart[] = [];
    for (const dir of fibonacciSphere(30)) {
        if (dir.x < -0.4) continue; // keep the face clear
        spikeParts.push({ geometry: alongDir(new THREE.ConeGeometry(0.07, 0.36, 5), dir, 0.72) });
    }
    const spikeGeo = sharedGeo(mergeKitParts(spikeParts));

    const crownParts: KitPart[] = [];
    for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const petal = placed(new THREE.ConeGeometry(0.17, 0.55, 6), [0, 0.28, 0], [0, 0, 0], [1, 1, 0.35]);
        // Splay outward from the +X axis, then spin around it.
        petal.applyMatrix4(new THREE.Matrix4().makeRotationZ(-0.9));
        petal.applyMatrix4(new THREE.Matrix4().makeRotationX(ang));
        crownParts.push({ geometry: petal });
    }
    const crownGeo = sharedGeo(mergeKitParts(crownParts));

    const faceGeo = sharedGeo(mergeKitParts([
        ...eyeParts([0, 0, 0], 0.3, 0.5),
        // Grumpy brow over the eye.
        { geometry: placed(new THREE.BoxGeometry(0.08, 0.07, 0.46), [-0.12, 0.3, 0], [0.12, 0, -0.35]), tint: INK }
    ]));

    return {
        bodyColor: 0x6fae4a,
        glowColor: 0xff66cc,
        bodyParams: { roughness: 0.6, metalness: 0.05 },
        glowBase: 0.7,
        bodyGeo,
        faceGeo,
        facePos: [-0.6, 0.12, 0],
        build(root, _bodyMat, glowMat) {
            const spikes = new THREE.Mesh(spikeGeo, getDetailMaterial('burr_spike', {
                color: 0xf3e6b0, roughness: 0.5, emissive: 0x332a10, flatShading: true
            }));
            const crown = new THREE.Mesh(crownGeo, glowMat);
            crown.position.set(0.76, 0, 0);
            root.add(spikes, crown);
            return { spikes, crown };
        },
        animate(rig, _root, t, a, dt) {
            const spikes = rig.parts.spikes as THREE.Object3D;
            const crown = rig.parts.crown as THREE.Object3D;
            crown.rotation.x += dt * (0.8 + a * 5);
            const flare = 1 + a * 0.4 + Math.sin(t * 3) * 0.06;
            crown.scale.set(1, flare, flare);
            spikes.scale.setScalar(1 + a * 0.22 + Math.sin(t * 30) * 0.02 * a);
        }
    };
}

// ---------------------------------------------------------------------------
// 2. Prism Mite (Asteroid Belt)
// ---------------------------------------------------------------------------

function prismMiteTemplate(): CharacterTemplate {
    const facetTint = (_p: THREE.Vector3, n: THREE.Vector3) => {
        const k = 0.65 + hash3(n.x * 3.1, n.y * 3.1, n.z * 3.1) * 0.5;
        return new THREE.Color(k, k, k);
    };
    const bodyGeo = sharedGeo(mergeKitParts([
        { geometry: placed(new THREE.OctahedronGeometry(0.5, 0), [0, 0, 0], [0, 0, 0], [2.0, 0.8, 0.8]), tint: facetTint, flat: true },
        { geometry: placed(new THREE.OctahedronGeometry(0.22, 0), [0.62, 0.26, 0.14], [0, 0.3, 0.5], [1.6, 0.6, 0.6]), tint: facetTint, flat: true },
        { geometry: placed(new THREE.OctahedronGeometry(0.18, 0), [0.6, 0.2, -0.16], [0, -0.3, 0.7], [1.6, 0.6, 0.6]), tint: facetTint, flat: true }
    ]));

    const wingGeo = sharedGeo(mergeKitParts([
        { geometry: placed(new THREE.OctahedronGeometry(0.3, 0), [0.15, 0, 0.32], [0, 0.5, 0], [1.9, 0.22, 0.6]), flat: true },
        { geometry: placed(new THREE.OctahedronGeometry(0.22, 0), [0.42, 0, 0.5], [0, 0.8, 0], [1.6, 0.2, 0.55]), flat: true }
    ]));

    const faceGeo = sharedGeo(mergeKitParts([
        ...eyeParts([0, 0, 0.13], 0.12, 0.6),
        ...eyeParts([0, 0, -0.13], 0.12, 0.6)
    ]));

    return {
        bodyColor: 0x5a3fc0,
        glowColor: 0x00ffff,
        bodyParams: { roughness: 0.2, metalness: 0.6, flatShading: true },
        glowBase: 0.8,
        bodyGeo,
        faceGeo,
        facePos: [-0.5, 0.15, 0],
        build(root, _bodyMat, glowMat) {
            const left = new THREE.Mesh(wingGeo, glowMat);
            const right = new THREE.Mesh(wingGeo, glowMat);
            right.scale.z = -1;
            root.add(left, right);
            return { left, right };
        },
        animate(rig, root, t, a) {
            const left = rig.parts.left as THREE.Object3D;
            const right = rig.parts.right as THREE.Object3D;
            const flex = 0.35 + Math.sin(t * 2.2) * 0.15 + a * 0.65;
            left.rotation.x = -flex;
            right.rotation.x = flex;
            left.rotation.y = right.rotation.y = -a * 0.35;
            root.rotation.x = Math.sin(t * 40) * 0.05 * a;
        }
    };
}

// ---------------------------------------------------------------------------
// 3. Scorch Beetle (Orbital Descent)
// ---------------------------------------------------------------------------

function scorchBeetleTemplate(): CharacterTemplate {
    const parts: KitPart[] = [
        { geometry: placed(new THREE.SphereGeometry(0.55, 16, 10), [0.05, -0.12, 0], [0, 0, 0], [1.35, 0.55, 0.95]), tint: 0x9a8f8a },
        { geometry: placed(new THREE.SphereGeometry(0.3, 14, 10), [-0.68, -0.02, 0], [0, 0, 0], [1, 0.85, 1]), tint: 0xffffff },
        { geometry: placed(new THREE.CylinderGeometry(0.15, 0.21, 0.24, 10), [0.82, 0, 0], [0, 0, Math.PI / 2]), tint: 0x888888 }
    ];
    for (const side of [-1, 1]) {
        parts.push({ geometry: placed(new THREE.ConeGeometry(0.07, 0.34, 6), [-1.0, -0.12, side * 0.13], [0, side * 0.35, Math.PI / 2]), tint: 0xeeeeee });
        for (const lx of [-0.35, 0, 0.35]) {
            parts.push({ geometry: placed(new THREE.CylinderGeometry(0.035, 0.025, 0.46, 5), [lx, -0.36, side * 0.42], [side * 0.9, 0, 0]), tint: 0x777777 });
        }
    }
    const bodyGeo = sharedGeo(mergeKitParts(parts));

    const tileTint = (p: THREE.Vector3) => {
        const k = 0.75 + hash3(Math.floor(p.x * 7), Math.floor(p.y * 7), Math.floor(p.z * 7)) * 0.35;
        return new THREE.Color(k, k, k);
    };
    // Quarter-sphere elytra: hinge along the X axis, z ≥ 0 half (the right one is mirrored).
    const shellGeo = sharedGeo(mergeKitParts([
        { geometry: placed(new THREE.SphereGeometry(0.62, 14, 8, 0, Math.PI, 0, Math.PI / 2), [0, 0, 0], [0, 0, 0], [1.35, 0.8, 0.95]), tint: tileTint }
    ]));
    const coreGeo = sharedGeo(placed(new THREE.SphereGeometry(0.5, 14, 8), [0.05, 0.02, 0], [0, 0, 0], [1.25, 0.4, 0.8]));
    const flameGeo = sharedGeo(placed(new THREE.ConeGeometry(0.13, 0.55, 8), [0.275, 0, 0], [0, 0, -Math.PI / 2]));

    const faceGeo = sharedGeo(mergeKitParts([
        ...eyeParts([0, 0, 0.12], 0.11, 0.55),
        ...eyeParts([0, 0, -0.12], 0.11, 0.55)
    ]));

    return {
        bodyColor: 0x3d2a24,
        glowColor: 0xff6a1a,
        bodyParams: { roughness: 0.55, metalness: 0.6 },
        glowBase: 0.9,
        bodyGeo,
        faceGeo,
        facePos: [-0.86, 0.1, 0],
        build(root, bodyMat, glowMat) {
            const shellL = new THREE.Mesh(shellGeo, bodyMat);
            const shellR = new THREE.Mesh(shellGeo, bodyMat);
            shellR.scale.z = -1;
            shellL.position.y = shellR.position.y = 0.02;
            const core = new THREE.Mesh(coreGeo, glowMat);
            const flame = new THREE.Mesh(flameGeo, glowMat);
            flame.position.x = 0.92;
            root.add(shellL, shellR, core, flame);
            return { shellL, shellR, flame };
        },
        animate(rig, _root, t, a) {
            const open = 0.06 + Math.sin(t * 1.5) * 0.03 + a * 0.85;
            (rig.parts.shellL as THREE.Object3D).rotation.x = -open;
            (rig.parts.shellR as THREE.Object3D).rotation.x = open;
            const flame = rig.parts.flame as THREE.Object3D;
            const flicker = 0.75 + Math.sin(t * 27) * 0.15 + Math.sin(t * 41) * 0.1;
            flame.scale.set(flicker * (1 + a * 1.4), 1 + a * 0.4, 1 + a * 0.4);
        }
    };
}

// ---------------------------------------------------------------------------
// 4. Rust Drone (Rusty Gauntlet)
// ---------------------------------------------------------------------------

function rustDroneTemplate(): CharacterTemplate {
    const rust = (p: THREE.Vector3) => {
        const n = fbm3(p.x * 4 + 2, p.y * 4, p.z * 4, 2);
        // Patches go orange-brown; clean metal stays near white so the tint shows.
        return n > 0.55
            ? new THREE.Color(1.0, 0.62, 0.38).multiplyScalar(0.8)
            : new THREE.Color(1, 1, 1).multiplyScalar(0.85 + n * 0.2);
    };
    // Rotor arm runs fore-aft (X) so both rotors show in the side view; a
    // grabber claw hangs underneath. Profile: lens snout, two rotor masts, claw.
    const parts: KitPart[] = [
        { geometry: placed(new THREE.BoxGeometry(0.9, 0.55, 0.7)), tint: rust, flat: true },
        { geometry: placed(new THREE.CylinderGeometry(0.24, 0.3, 0.14, 10), [0.05, 0.33, 0]), tint: rust },
        { geometry: placed(new THREE.CylinderGeometry(0.2, 0.25, 0.32, 14), [-0.58, 0, 0], [0, 0, Math.PI / 2]), tint: 0x444444 },
        { geometry: placed(new THREE.BoxGeometry(1.7, 0.08, 0.12), [0.0, 0.38, 0]), tint: 0x777777, flat: true },
        { geometry: placed(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 4), [0.3, 0.6, 0.18]), tint: 0x555555 },
        // Claw: wrist + two hooked prongs.
        { geometry: placed(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), [0.05, -0.38, 0]), tint: 0x555555 },
        { geometry: placed(new THREE.ConeGeometry(0.05, 0.3, 5), [-0.07, -0.58, 0], [0, 0, -0.5]), tint: 0x666666 },
        { geometry: placed(new THREE.ConeGeometry(0.05, 0.3, 5), [0.17, -0.58, 0], [0, 0, 0.5]), tint: 0x666666 }
    ];
    for (const end of [-1, 1]) {
        // Rotor masts at each end of the arm.
        parts.push({ geometry: placed(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 8), [end * 0.8, 0.5, 0]), tint: 0x555555 });
    }
    const bodyGeo = sharedGeo(mergeKitParts(parts));

    const propGeo = sharedGeo(mergeKitParts([
        { geometry: placed(new THREE.BoxGeometry(0.62, 0.025, 0.08)), flat: true },
        { geometry: placed(new THREE.BoxGeometry(0.08, 0.025, 0.62)), flat: true }
    ]));
    const lensGeo = sharedGeo(new THREE.SphereGeometry(0.17, 14, 10));
    const bulbGeo = sharedGeo(new THREE.SphereGeometry(0.065, 8, 6));

    // Face = lens bezel + iris pupil; the lens glass itself is the glow mesh.
    const faceGeo = sharedGeo(mergeKitParts([
        { geometry: placed(new THREE.TorusGeometry(0.18, 0.035, 6, 18), [0, 0, 0], [0, Math.PI / 2, 0]), tint: 0x222222 },
        { geometry: placed(new THREE.SphereGeometry(0.075, 10, 8), [-0.12, 0, 0]), tint: INK },
        { geometry: placed(new THREE.SphereGeometry(0.025, 6, 4), [-0.17, 0.05, 0.04]), tint: WHITE }
    ]));

    return {
        bodyColor: 0x9a6a3a,
        glowColor: 0xff2200,
        bodyParams: { roughness: 0.7, metalness: 0.75 },
        glowBase: 0.9,
        bodyGeo,
        faceGeo,
        facePos: [-0.78, 0, 0],
        build(root, _bodyMat, glowMat) {
            const propMat = getDetailMaterial('drone_prop', { color: 0x555a60, roughness: 0.4, metalness: 0.8, flatShading: true });
            const propL = new THREE.Mesh(propGeo, propMat);
            const propR = new THREE.Mesh(propGeo, propMat);
            // Slight tilt so the spinning blades read as discs, not lines, from the side.
            propL.position.set(-0.8, 0.63, 0);
            propR.position.set(0.8, 0.63, 0);
            propL.rotation.x = propR.rotation.x = 0.35;
            const lens = new THREE.Mesh(lensGeo, glowMat);
            lens.position.set(-0.72, 0, 0);
            const bulb = new THREE.Mesh(bulbGeo, glowMat);
            bulb.position.set(0.3, 0.82, 0.18);
            root.add(propL, propR, lens, bulb);
            return { propL, propR, bulb };
        },
        animate(rig, root, t, a, dt) {
            // Telegraph: dips its nose toward the player like it is about to dive.
            root.rotation.z += a * 0.25;
            const spin = dt * (22 + a * 25);
            (rig.parts.propL as THREE.Object3D).rotateY(spin);
            (rig.parts.propR as THREE.Object3D).rotateY(-spin);
            (rig.parts.bulb as THREE.Object3D).visible = Math.sin(t * (2.5 + a * 14)) > -0.2;
        }
    };
}

// ---------------------------------------------------------------------------
// 5. Krill (Astral Leviathan)
// ---------------------------------------------------------------------------

const KRILL_SEGMENTS: Array<{ x: number; r: number }> = [
    { x: -0.12, r: 0.32 },
    { x: 0.18, r: 0.28 },
    { x: 0.44, r: 0.23 },
    { x: 0.64, r: 0.18 }
];

function krillTemplate(): CharacterTemplate {
    const band = (p: THREE.Vector3) => {
        const k = p.y > 0.05 ? 1.0 : 0.82;
        return new THREE.Color(k, k * 0.95, k * 0.95);
    };
    const parts: KitPart[] = [
        { geometry: placed(new THREE.SphereGeometry(0.36, 16, 12), [-0.45, 0, 0], [0, 0, 0], [1.25, 0.9, 0.9]), tint: band },
        // Rostrum spike pointing forward.
        { geometry: placed(new THREE.ConeGeometry(0.06, 0.32, 6), [-0.92, 0.08, 0], [0, 0, Math.PI / 2]), tint: 0xffffff }
    ];
    for (const side of [-1, 1]) {
        // Long antennae sweeping forward and up.
        parts.push({ geometry: placed(new THREE.CylinderGeometry(0.012, 0.008, 0.95, 4), [-0.95, 0.42, side * 0.12], [side * 0.15, 0, 0.75]), tint: 0xffffff });
        for (const lx of [-0.55, -0.35, -0.15]) {
            parts.push({ geometry: placed(new THREE.CylinderGeometry(0.02, 0.012, 0.32, 4), [lx, -0.38, side * 0.12], [side * 0.3, 0, -0.25]), tint: 0xdddddd });
        }
    }
    const bodyGeo = sharedGeo(mergeKitParts(parts));
    const segmentGeo = sharedGeo(new THREE.SphereGeometry(1, 14, 10));

    const fanParts: KitPart[] = [];
    for (const ang of [-0.55, 0, 0.55]) {
        const blade = placed(new THREE.ConeGeometry(0.12, 0.42, 6), [0, 0.21, 0], [0, 0, 0], [1, 1, 0.3]);
        blade.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2 + ang));
        fanParts.push({ geometry: blade });
    }
    const fanGeo = sharedGeo(mergeKitParts(fanParts));

    const dotParts: KitPart[] = [];
    for (const side of [-1, 1]) {
        dotParts.push({ geometry: placed(new THREE.SphereGeometry(0.05, 6, 4), [-0.5, -0.14, side * 0.3]) });
        dotParts.push({ geometry: placed(new THREE.SphereGeometry(0.045, 6, 4), [-0.25, -0.16, side * 0.27]) });
    }
    const dotGeo = sharedGeo(mergeKitParts(dotParts));

    const faceGeo = sharedGeo(mergeKitParts([
        { geometry: placed(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 5), [0.04, -0.1, 0.12], [0.3, 0, 0.3]), tint: 0x553344 },
        { geometry: placed(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 5), [0.04, -0.1, -0.12], [-0.3, 0, 0.3]), tint: 0x553344 },
        ...eyeParts([0, 0, 0.15], 0.1, 0.6),
        ...eyeParts([0, 0, -0.15], 0.1, 0.6)
    ]));

    return {
        bodyColor: 0xff8aa8,
        glowColor: 0x66e0ff,
        bodyParams: { roughness: 0.35, metalness: 0.05 },
        glowBase: 0.7,
        bodyGeo,
        faceGeo,
        facePos: [-0.62, 0.3, 0],
        build(root, bodyMat, glowMat) {
            const segments: THREE.Object3D[] = [];
            for (const s of KRILL_SEGMENTS) {
                const seg = new THREE.Mesh(segmentGeo, bodyMat);
                seg.position.set(s.x, 0, 0);
                seg.scale.set(s.r * 1.15, s.r, s.r);
                root.add(seg);
                segments.push(seg);
            }
            const fan = new THREE.Mesh(fanGeo, glowMat);
            fan.position.set(0.8, 0, 0);
            const dots = new THREE.Mesh(dotGeo, glowMat);
            root.add(fan, dots);
            return { segments, fan };
        },
        animate(rig, _root, t, a) {
            const segments = rig.parts.segments as THREE.Object3D[];
            segments.forEach((seg, i) => {
                const wave = Math.sin(t * 4 - i * 0.8) * 0.04 * (1 + i * 0.5);
                seg.position.y = wave + a * (i + 1) * (i + 1) * 0.025;
            });
            const fan = rig.parts.fan as THREE.Object3D;
            fan.position.y = segments[segments.length - 1].position.y + a * 0.15;
            fan.rotation.z = Math.sin(t * (5 + a * 16)) * (0.25 + a * 0.2) + a * 0.9;
        }
    };
}

// ---------------------------------------------------------------------------
// 6. Jelly Drifter (Aqua Expanse)
// ---------------------------------------------------------------------------

const JELLY_TENTACLES = 5;

function jellyDrifterTemplate(): CharacterTemplate {
    // Bell: a cap slightly past the hemisphere with a scalloped rim.
    const bell = new THREE.SphereGeometry(0.7, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const pos = bell.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const rim = THREE.MathUtils.clamp((0.15 - v.y) / 0.25, 0, 1);
        const scallop = 1 + rim * 0.08 * Math.cos(Math.atan2(v.z, v.x) * 8);
        pos.setXYZ(i, v.x * scallop, v.y * 0.85 - rim * 0.04, v.z * scallop);
    }
    const canals = (p: THREE.Vector3) => {
        const k = (0.8 + 0.2 * Math.cos(Math.atan2(p.z, p.x) * 8)) * (0.85 + Math.max(0, p.y) * 0.3);
        return new THREE.Color(k, k, k);
    };
    const bodyGeo = sharedGeo(mergeKitParts([{ geometry: bell, tint: canals }]));

    // Tapered tentacle along a lazy S-curve hanging from the origin.
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.06, -0.4, 0),
        new THREE.Vector3(-0.06, -0.8, 0.03),
        new THREE.Vector3(0.04, -1.25, 0)
    ]);
    const tube = new THREE.TubeGeometry(curve, 16, 0.04, 5, false);
    const tp = tube.attributes.position;
    for (let i = 0; i < tp.count; i++) {
        v.fromBufferAttribute(tp, i);
        const along = THREE.MathUtils.clamp(-v.y / 1.25, 0, 1);
        const c = curve.getPointAt(along);
        const taper = 1 - along * 0.75;
        tp.setXYZ(i, c.x + (v.x - c.x) * taper, v.y, c.z + (v.z - c.z) * taper);
    }
    tube.computeVertexNormals();
    const tentacleGeo = sharedGeo(tube);

    const coreGeo = sharedGeo(new THREE.SphereGeometry(0.3, 12, 10));

    const faceGeo = sharedGeo(mergeKitParts([
        ...eyeParts([0, 0, 0.18], 0.11, 0.6),
        ...eyeParts([0, 0, -0.18], 0.11, 0.6),
        // Small "o" mouth.
        { geometry: placed(new THREE.TorusGeometry(0.045, 0.015, 5, 10), [0.0, -0.17, 0], [0, Math.PI / 2, 0]), tint: INK }
    ]));

    return {
        bodyColor: 0x86d8ff,
        glowColor: 0xb0ffff,
        bodyParams: { roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.88, side: THREE.DoubleSide },
        glowBase: 0.8,
        bodyGeo,
        faceGeo,
        facePos: [-0.6, 0.12, 0],
        build(root, bodyMat, glowMat) {
            const core = new THREE.Mesh(coreGeo, glowMat);
            core.position.y = 0.08;
            const tentacles: THREE.Object3D[] = [];
            for (let i = 0; i < JELLY_TENTACLES; i++) {
                const ang = (i / JELLY_TENTACLES) * Math.PI * 2;
                const tent = new THREE.Mesh(tentacleGeo, bodyMat);
                tent.position.set(Math.cos(ang) * 0.45, -0.08, Math.sin(ang) * 0.45);
                tent.rotation.y = -ang;
                root.add(tent);
                tentacles.push(tent);
            }
            const arm = new THREE.Mesh(tentacleGeo, glowMat);
            arm.position.y = -0.05;
            arm.scale.set(2.2, 0.8, 2.2);
            root.add(core, arm);
            return { tentacles, core };
        },
        animate(rig, root, t, a) {
            const rate = 2.2 + a * 6;
            const pulse = Math.sin(t * rate) * (0.06 + a * 0.05);
            const r = (root.userData.radius as number | undefined) ?? 1;
            root.scale.set(r * (1 + pulse), r * (1 - pulse), r * (1 + pulse));
            const tentacles = rig.parts.tentacles as THREE.Object3D[];
            tentacles.forEach((tent, i) => {
                tent.rotation.x = Math.sin(t * 1.8 + i * 1.3) * 0.22;
                tent.rotation.z = Math.cos(t * 1.5 + i) * 0.18 - a * 0.75;
            });
            (rig.parts.core as THREE.Object3D).scale.setScalar(1 + a * 0.3 + pulse);
        }
    };
}

// ---------------------------------------------------------------------------
// Templates + public API
// ---------------------------------------------------------------------------

const TEMPLATE_FACTORIES: Record<EnemyCharacterId, () => CharacterTemplate> = {
    burr_pod: burrPodTemplate,
    prism_mite: prismMiteTemplate,
    scorch_beetle: scorchBeetleTemplate,
    rust_drone: rustDroneTemplate,
    krill: krillTemplate,
    jelly_drifter: jellyDrifterTemplate
};

const templates = new Map<EnemyCharacterId, CharacterTemplate>();

function getTemplate(id: EnemyCharacterId): CharacterTemplate {
    let tpl = templates.get(id);
    if (!tpl) {
        tpl = TEMPLATE_FACTORIES[id]();
        templates.set(id, tpl);
    }
    return tpl;
}

/** Default body colour of a character (before any chapter tint). */
export function getEnemyBodyColor(id: EnemyCharacterId): number {
    return getTemplate(id).bodyColor;
}

/**
 * Body colour for one spawn: the character's own colour with a small visual
 * hue jitter, pulled toward the chapter tint. The tint recolours; it no
 * longer replaces the character's identity colour.
 */
export function rollEnemyBodyColor(id: EnemyCharacterId, tintHex?: number): number {
    const c = new THREE.Color(getEnemyBodyColor(id));
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(
        (hsl.h + (Math.random() - 0.5) * 0.08 + 1) % 1, // visual-only
        THREE.MathUtils.clamp(hsl.s + (Math.random() - 0.5) * 0.15, 0, 1), // visual-only
        hsl.l
    );
    if (tintHex !== undefined) c.lerp(new THREE.Color(tintHex), 0.3);
    return c.getHex();
}

/**
 * Build one enemy at unit radius. The returned root mesh owns its body and
 * glow materials (freed by `disposeObject`); geometries and face/detail
 * materials are shared. Scale the root by the spawn size.
 */
export function createEnemyCharacter(id: EnemyCharacterId, bodyColorHex?: number): THREE.Mesh {
    const tpl = getTemplate(id);
    const bodyColor = bodyColorHex ?? tpl.bodyColor;
    const bodyMat = new THREE.MeshStandardMaterial({
        color: bodyColor,
        vertexColors: true,
        emissive: new THREE.Color(bodyColor).multiplyScalar(0.12),
        ...tpl.bodyParams
    });
    const glowMat = new THREE.MeshStandardMaterial({
        color: tpl.glowColor,
        emissive: tpl.glowColor,
        emissiveIntensity: tpl.glowBase,
        roughness: 0.3
    });
    noteMaterialCreated();
    noteMaterialCreated();
    // Several child meshes share these two per-instance materials. Mark them
    // shared so `disposeObject`'s traverse skips them, and free each exactly
    // once from the root's onDispose hook (keeps the leak counters honest).
    markShared(bodyMat);
    markShared(glowMat);

    const root = new THREE.Mesh(tpl.bodyGeo, bodyMat);
    root.userData.onDispose = () => {
        for (const mat of [bodyMat, glowMat]) {
            mat.dispose();
            gpuResourceStats.materialsDisposed++;
        }
    };
    root.castShadow = true;

    const face = new THREE.Mesh(tpl.faceGeo, getFaceMaterial());
    face.position.set(...tpl.facePos);
    root.add(face);

    const parts = tpl.build(root, bodyMat, glowMat);
    const rig: EnemyRig = {
        id,
        face,
        glow: glowMat,
        glowBase: tpl.glowBase,
        parts,
        alert: 0,
        phase: Math.random() * 100, // visual-only
        blinkIn: 1 + Math.random() * 3, // visual-only
        blinkT: 0,
        hitFlash: 0
    };
    root.userData.enemyRig = rig;
    root.userData.enemyCharacter = id;
    return root;
}

export function getEnemyRig(mesh: THREE.Object3D): EnemyRig | undefined {
    return mesh.userData.enemyRig as EnemyRig | undefined;
}

/** Start a hit flash on an enemy (visual only). */
export function flashEnemy(mesh: THREE.Object3D): void {
    const rig = getEnemyRig(mesh);
    if (rig) rig.hitFlash = 1;
}

/**
 * 0..1 telegraph target for an enemy at (ex, ey) given the player at (px, py):
 * 1 when the player is ahead of the enemy's face and inside the tell window.
 */
export function enemyTellTarget(ex: number, ey: number, px: number, py: number): number {
    const ahead = ex - px;
    return ahead > -1 && ahead < ENEMY_TELL_RANGE && Math.abs(ey - py) < ENEMY_TELL_HALF_HEIGHT ? 1 : 0;
}

const FLASH_COLOR = new THREE.Color(0xffffff);

/**
 * Advance one enemy's idle + telegraph animation. Visual only: touches the
 * root's rotation (and the jelly's non-uniform scale), children and the glow
 * material, never `userData.radius` or position.
 *
 * @param alertTarget 0..1, usually from {@link enemyTellTarget}
 * @param aimDy player.y - enemy.y, used to aim the face while alert
 */
export function updateEnemyRig(mesh: THREE.Mesh, dt: number, time: number, alertTarget: number, aimDy = 0): void {
    const rig = getEnemyRig(mesh);
    if (!rig) return;
    const tpl = getTemplate(rig.id);

    const rate = alertTarget > rig.alert ? 5 : 2;
    rig.alert += (alertTarget - rig.alert) * Math.min(1, dt * rate);
    const a = rig.alert;
    const t = time + rig.phase;

    // Blink every few seconds; wide-eyed when alert.
    rig.blinkIn -= dt;
    if (rig.blinkIn <= 0) {
        rig.blinkT = 0.14;
        rig.blinkIn = 2 + Math.random() * 3; // visual-only
    }
    let eyeY = 1 + a * 0.25;
    if (rig.blinkT > 0) {
        rig.blinkT -= dt;
        eyeY *= 0.15;
    }
    rig.face.scale.set(1 + a * 0.15, eyeY, 1 + a * 0.15);

    // Aim the face at the player while alert; gentle idle bob otherwise.
    const aim = THREE.MathUtils.clamp(-aimDy * 0.08, -0.4, 0.4) * a;
    mesh.rotation.set(mesh.rotation.x, Math.sin(t * 0.7) * 0.15 * (1 - a), aim + Math.sin(t * 1.3) * 0.08);

    tpl.animate(rig, mesh, t, a, dt);

    // Glow: idle shimmer → bright telegraph → white hit flash.
    rig.hitFlash = Math.max(0, rig.hitFlash - dt * 4);
    rig.glow.emissiveIntensity = rig.glowBase * (0.85 + Math.sin(t * 2.5) * 0.15) + a * 1.6 + rig.hitFlash * 3;
    if (rig.hitFlash > 0) {
        rig.glow.emissive.set(tpl.glowColor).lerp(FLASH_COLOR, rig.hitFlash);
    } else {
        rig.glow.emissive.set(tpl.glowColor);
    }
}
