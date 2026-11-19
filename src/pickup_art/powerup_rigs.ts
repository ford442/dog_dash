/**
 * Power-up attachments: what each of the 16 `PowerUpType`s puts on the rocket.
 *
 * Rig space is the player group: +X is the rocket's nose, +Y up, +Z toward
 * the camera; the rocket spans about x -1..1 with a ~0.45 body radius.
 *
 * Every rig blinks through its last {@link POWERUP_EXPIRY_BLINK} seconds (the
 * "about to run out" tell). Rig-specific tells are listed per builder:
 * the comet tail shortens as its timer drains, the shield rim flashes on a
 * bounce, one butterfly leaves per blocked hit, the fairy's wand charges up
 * before it grants its gift, and so on.
 *
 * Geometry is shared (`sharedGeometry`, never disposed); materials belong to
 * the rig and are freed with `disposeObject(rig.root)`. Visual-only: the
 * wall-clock-free state comes in through {@link PowerUpRigState}; no RNG.
 */

import * as THREE from 'three';
import { mergeKitParts, placed, type KitPart } from '../hazard_art/kit';
import { POWER_UP_CONFIGS, PowerUpType } from '../powerup_manager/types';
import {
    butterflyWingShape,
    crescentShape,
    extrudeShape,
    heartShape,
    sharedGeometry,
    starShape
} from './shapes';

/** Seconds left when an attachment starts blinking. */
export const POWERUP_EXPIRY_BLINK = 2;

export interface PowerUpRigState {
    dt: number;
    /** Visual time (seconds). */
    t: number;
    timeLeft: number;
    duration: number;
    /** 0..~0.35 shield bounce timer (Bubblegum Shield). */
    bounce: number;
}

export interface PowerUpRig {
    type: PowerUpType;
    root: THREE.Group;
    /** The mesh `PowerUpManager` tracks for this type (shield shell, comet band, crown). */
    primary?: THREE.Object3D;
    /** Butterfly Escort: one per remaining charge. */
    butterflies?: THREE.Group[];
    update(s: PowerUpRigState): void;
}

const WHITE = new THREE.Color(1, 1, 1);
const INK = new THREE.Color(0.04, 0.03, 0.06);
const tmp = new THREE.Color();

function col(hex: number): THREE.Color {
    return new THREE.Color(hex);
}

function lerpHex(a: number, b: number, t: number): THREE.Color {
    return tmp.set(a).lerp(col(b), THREE.MathUtils.clamp(t, 0, 1)).clone();
}

function vcMaterial(params: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1, ...params });
}

function additive(hex: number, opacity: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

/** Blink through the last seconds; faster as the end nears. */
export function applyExpiryBlink(root: THREE.Object3D, s: PowerUpRigState): void {
    if (s.timeLeft >= POWERUP_EXPIRY_BLINK || s.timeLeft <= 0) {
        root.visible = true;
        return;
    }
    const k = 1 - s.timeLeft / POWERUP_EXPIRY_BLINK;
    const rate = 3 + k * 9;
    root.visible = Math.sin(s.t * rate * Math.PI * 2) > -0.35;
}

function latheAlongX(profile: Array<[number, number]>, segments: number): THREE.BufferGeometry {
    const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
    geo.rotateZ(-Math.PI / 2);
    return geo;
}

/** Closed happy eye (an upside-down arc). */
function closedEye(pos: [number, number, number], r: number): KitPart {
    const arc = new THREE.TorusGeometry(r, r * 0.22, 5, 10, Math.PI);
    return { geometry: placed(arc, pos), tint: INK };
}

// ---------------------------------------------------------------------------
// 1. Rainbow Comet Tail — five rainbow streamers; the tail shortens as the timer drains.
// ---------------------------------------------------------------------------

const RAINBOW = [0xff6b6b, 0xfeca57, 0x7bed9f, 0x48dbfb, 0xa29bfe];

function streamerGeometry(): THREE.BufferGeometry {
    return sharedGeometry('pu_comet_streamer', () => {
        const geo = new THREE.PlaneGeometry(1, 1, 14, 1);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const u = pos.getX(i) + 0.5;                // 0 tail … 1 root
            const x = -(1 - u);                          // root at 0, tip at -1
            const y = pos.getY(i) * (0.35 + 0.65 * u);   // taper to the tip
            pos.setXYZ(i, x, y, 0);
        }
        geo.computeVertexNormals();
        return geo;
    });
}

function buildRainbowComet(): PowerUpRig {
    const root = new THREE.Group();
    root.position.set(-0.85, 0, -0.05);
    const tail = new THREE.Group();
    root.add(tail);
    const bands: THREE.Mesh[] = [];
    RAINBOW.forEach((hex, i) => {
        const band = new THREE.Mesh(streamerGeometry(), new THREE.MeshBasicMaterial({
            color: hex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false
        }));
        band.scale.set(4, 0.22, 1);
        band.position.y = (i - 2) * 0.17;
        band.renderOrder = 1;
        tail.add(band);
        bands.push(band);
    });
    const head = new THREE.Mesh(sharedGeometry('pu_star', () => extrudeShape(starShape(5, 0.45), 0.12)), new THREE.MeshStandardMaterial({
        color: 0xfff6c8, emissive: 0xffe066, emissiveIntensity: 1.2
    }));
    head.scale.setScalar(0.42);
    head.position.set(0.05, 0, 0.35);
    root.add(head);

    return {
        type: PowerUpType.RAINBOW_COMET_TAIL,
        root,
        primary: bands[0],
        update: (s) => {
            const gauge = s.duration > 0 ? s.timeLeft / s.duration : 1;
            tail.scale.x = 0.3 + 0.7 * gauge;
            bands.forEach((band, i) => {
                band.rotation.z = Math.sin(s.t * 3 + i * 0.8) * 0.05;
                band.position.y = (i - 2) * 0.17 + Math.sin(s.t * 4 + i) * 0.03;
                band.scale.y = 0.22 * (1 + Math.sin(s.t * 6 + i * 1.3) * 0.12);
            });
            head.rotation.z -= s.dt * 4;
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 2. Flower Crown Boost — a wreath of six five-petal flowers on top of the rocket.
// ---------------------------------------------------------------------------

function flowerParts(center: THREE.Vector3, facing: THREE.Vector3, petalHex: number): KitPart[] {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing.clone().normalize());
    const m = new THREE.Matrix4();
    const parts: KitPart[] = [];
    for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const petal = new THREE.SphereGeometry(0.13, 8, 6);
        petal.scale(0.75, 1.25, 0.35);
        petal.translate(0, 0.13, 0);
        petal.rotateZ(a);
        m.compose(center, q, new THREE.Vector3(1, 1, 1));
        petal.applyMatrix4(m);
        parts.push({ geometry: petal, tint: (p) => lerpHex(petalHex, 0xffffff, 0.3 - (p.distanceTo(center) - 0.1) * 2.5) });
    }
    const heart = new THREE.SphereGeometry(0.08, 8, 6);
    heart.scale(1, 1, 0.6);
    m.compose(center.clone().addScaledVector(facing.clone().normalize(), 0.03), q, new THREE.Vector3(1, 1, 1));
    heart.applyMatrix4(m);
    parts.push({ geometry: heart, tint: col(0xffd84a) });
    return parts;
}

function buildFlowerCrown(): PowerUpRig {
    const cfg = POWER_UP_CONFIGS[PowerUpType.FLOWER_CROWN_BOOST];
    const geo = sharedGeometry('pu_flower_crown', () => {
        const parts: KitPart[] = [];
        const ringR = 0.55;
        const vine = new THREE.TorusGeometry(ringR, 0.03, 6, 40);
        vine.rotateX(Math.PI / 2);
        parts.push({ geometry: vine, tint: col(0x5fbf6a) });
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
            const facing = d.clone().add(new THREE.Vector3(0, 0.55, 0));
            parts.push(...flowerParts(d.clone().multiplyScalar(ringR).setY(0.06), facing, i % 2 === 0 ? cfg.color : cfg.secondaryColor));
            const leafA = a + Math.PI / 6;
            const leaf = new THREE.SphereGeometry(0.08, 6, 4);
            leaf.scale(1.6, 0.35, 0.7);
            leaf.rotateY(-leafA);
            leaf.translate(Math.cos(leafA) * ringR, 0.0, Math.sin(leafA) * ringR);
            parts.push({ geometry: leaf, tint: col(0x7fd67a) });
        }
        return mergeKitParts(parts);
    });
    const crown = new THREE.Mesh(geo, vcMaterial({ emissive: cfg.color, emissiveIntensity: 0.25 }));
    const root = new THREE.Group();
    root.position.set(0.1, 0.62, 0);
    root.add(crown);
    return {
        type: PowerUpType.FLOWER_CROWN_BOOST,
        root,
        primary: root,
        update: (s) => {
            crown.rotation.y += s.dt * 0.8;
            crown.position.y = Math.sin(s.t * 2.4) * 0.05;
            crown.rotation.z = Math.sin(s.t * 1.7) * 0.08;
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 3. Bubblegum Shield — gum bubble with a rim, gloss highlight and a heart knot.
// ---------------------------------------------------------------------------

export const SHIELD_RADIUS = 1.8;

function buildBubblegumShield(): PowerUpRig {
    const cfg = POWER_UP_CONFIGS[PowerUpType.BUBBLEGUM_SHIELD];
    const shellMat = new THREE.MeshPhysicalMaterial({
        color: cfg.color, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.05,
        clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide, depthWrite: false
    });
    const shell = new THREE.Mesh(sharedGeometry('pu_shield_shell', () => new THREE.SphereGeometry(SHIELD_RADIUS, 32, 24)), shellMat);
    shell.scale.set(1, 1, 0.7);
    shell.renderOrder = 2;

    const rimMat = new THREE.MeshStandardMaterial({ color: cfg.secondaryColor, emissive: cfg.secondaryColor, emissiveIntensity: 0.25, roughness: 0.3 });
    const rim = new THREE.Mesh(sharedGeometry('pu_shield_rim', () => new THREE.TorusGeometry(SHIELD_RADIUS, 0.09, 10, 72)), rimMat);
    shell.add(rim);

    const glossMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    const gloss = new THREE.Mesh(sharedGeometry('pu_shield_gloss', () => {
        const arc = new THREE.TorusGeometry(1.42, 0.07, 6, 24, Math.PI * 0.32);
        arc.rotateZ(Math.PI * 0.6);
        return mergeKitParts([
            { geometry: placed(arc, [0, 0, 1.12]) },
            { geometry: placed(new THREE.SphereGeometry(0.12, 10, 8), [-0.42, 1.25, 1.12], [0, 0, 0], [1, 1, 0.4]) }
        ]);
    }), glossMat);
    gloss.renderOrder = 3;
    shell.add(gloss);

    const knot = new THREE.Mesh(sharedGeometry('pu_heart', () => extrudeShape(heartShape(), 0.25)), rimMat);
    knot.scale.setScalar(0.5);
    knot.position.set(SHIELD_RADIUS * 0.72, SHIELD_RADIUS * 0.72, 0);
    knot.rotation.z = -Math.PI / 4 + Math.PI;
    shell.add(knot);

    const root = new THREE.Group();
    root.add(shell);
    const baseRim = new THREE.Color(cfg.secondaryColor);

    return {
        type: PowerUpType.BUBBLEGUM_SHIELD,
        root,
        primary: shell,
        update: (s) => {
            let scale = 1 + Math.sin(s.t * 3) * 0.04;
            shell.rotation.z = Math.sin(s.t * 2.5) * 0.08;
            shell.rotation.x = Math.cos(s.t * 1.8) * 0.05;
            // Tell: a bounce wobbles the bubble and flashes the rim white.
            const b = Math.max(0, s.bounce);
            if (b > 0) scale += Math.sin(b * Math.PI * 8) * 0.25 * b;
            shell.scale.set(scale, scale, scale * 0.7);
            rimMat.color.copy(baseRim).lerp(WHITE, Math.min(1, b * 3));
            rimMat.emissiveIntensity = 0.25 + b * 3;
            knot.rotation.y = Math.sin(s.t * 2) * 0.4;
            // The bubble thins out as it nears the end.
            shellMat.opacity = 0.18 + 0.12 * Math.min(1, s.timeLeft / 4);
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 4. Twinkle Star Magnet — horseshoe magnet with pull waves streaming into its poles.
// ---------------------------------------------------------------------------

function buildStarMagnet(): PowerUpRig {
    const geo = sharedGeometry('pu_magnet', () => {
        const red = col(0xe8344a);
        const silver = col(0xe4e9f2);
        const arc = new THREE.TorusGeometry(0.28, 0.1, 10, 24, Math.PI);
        arc.rotateZ(Math.PI / 2); // opening toward +X
        const leg = (y: number) => {
            const g = new THREE.CylinderGeometry(0.1, 0.1, 0.22, 12);
            g.rotateZ(Math.PI / 2);
            g.translate(0.11, y, 0);
            return g;
        };
        const tip = (y: number) => {
            const g = new THREE.CylinderGeometry(0.105, 0.105, 0.16, 12);
            g.rotateZ(Math.PI / 2);
            g.translate(0.3, y, 0);
            return g;
        };
        return mergeKitParts([
            { geometry: arc, tint: red },
            { geometry: leg(0.28), tint: red },
            { geometry: leg(-0.28), tint: red },
            { geometry: tip(0.28), tint: silver },
            { geometry: tip(-0.28), tint: silver },
            { geometry: placed(extrudeShape(starShape(5, 0.45), 0.1), [-0.36, 0, 0.06], [0, 0, 0], [0.26, 0.26, 1]), tint: col(0xffd700) }
        ]);
    });
    const magnet = new THREE.Mesh(geo, vcMaterial({ metalness: 0.35, roughness: 0.3, emissive: 0x331100, emissiveIntensity: 0.3 }));
    const root = new THREE.Group();
    root.position.set(0.25, 1.3, 0.3);
    root.add(magnet);

    const waveGeo = sharedGeometry('pu_magnet_wave', () => {
        const g = new THREE.TorusGeometry(0.34, 0.025, 4, 18, Math.PI * 0.7);
        g.rotateZ(Math.PI - Math.PI * 0.35); // arc opens toward the magnet (-X)
        return g;
    });
    const waves: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
        const w = new THREE.Mesh(waveGeo, additive(0xffd700, 0.8));
        root.add(w);
        waves.push(w);
    }
    return {
        type: PowerUpType.TWINKLE_STAR_MAGNET,
        root,
        update: (s) => {
            root.position.y = 1.3 + Math.sin(s.t * 2.2) * 0.06;
            magnet.rotation.z = Math.sin(s.t * 1.6) * 0.12;
            waves.forEach((w, i) => {
                const phase = (s.t * 0.9 + i / waves.length) % 1;
                w.position.x = 1.5 - phase * 1.15;
                w.scale.setScalar(1.4 - phase * 0.9);
                (w.material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.85;
            });
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 5. Unicorn Horn Blast — spiral horn on the nose; it glows in pulses (the star beam).
// ---------------------------------------------------------------------------

function buildUnicornHorn(): PowerUpRig {
    const geo = sharedGeometry('pu_unicorn_horn', () => {
        const len = 0.95;
        const radiusAt = (x: number) => 0.17 * (1 - x / len);
        const horn = latheAlongX([[0.17, 0], [0.12, len * 0.4], [0.06, len * 0.75], [0, len]], 14);
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 64; i++) {
            const u = i / 64;
            const x = u * len * 0.92;
            const a = u * Math.PI * 7;
            const r = radiusAt(x) + 0.012;
            pts.push(new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r));
        }
        const spiral = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.022, 5, false);
        const ring = new THREE.TorusGeometry(0.18, 0.04, 8, 20);
        ring.rotateY(Math.PI / 2);
        return mergeKitParts([
            { geometry: horn, tint: (p) => lerpHex(0xfff8ff, 0xffb6e6, p.x / len) },
            { geometry: spiral, tint: col(0xffd36b) },
            { geometry: ring, tint: col(0xffd36b) }
        ]);
    });
    const mat = vcMaterial({ emissive: 0xff9ae0, emissiveIntensity: 0.3, roughness: 0.25 });
    const horn = new THREE.Mesh(geo, mat);
    const root = new THREE.Group();
    root.position.set(0.85, 0.2, 0);
    root.rotation.z = 0.22;
    root.add(horn);
    const sparkle = new THREE.Mesh(sharedGeometry('pu_star', () => extrudeShape(starShape(5, 0.45), 0.12)), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
    sparkle.scale.setScalar(0.16);
    root.add(sparkle);
    return {
        type: PowerUpType.UNICORN_HORN_BLAST,
        root,
        update: (s) => {
            const pulse = Math.pow(Math.max(0, Math.sin(s.t * 3.2)), 4);
            mat.emissiveIntensity = 0.3 + pulse * 1.6;
            const a = s.t * 5;
            sparkle.position.set(0.75 + Math.cos(a) * 0.08, Math.sin(a) * 0.14, 0.12);
            sparkle.rotation.z = -a;
            sparkle.scale.setScalar(0.12 + pulse * 0.1);
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 6. Dream Cloud Carpet — a sleepy cloud with a rainbow hem the rocket rides on.
// ---------------------------------------------------------------------------

function buildDreamCloud(): PowerUpRig {
    const geo = sharedGeometry('pu_dream_cloud', () => {
        const puffs: Array<[number, number, number, number]> = [
            [-1.15, -0.02, 0.0, 0.36], [-0.7, 0.08, 0.05, 0.46], [-0.2, 0.14, -0.02, 0.52],
            [0.32, 0.12, 0.04, 0.5], [0.82, 0.04, 0.0, 0.42], [1.2, -0.04, -0.02, 0.32],
            [-0.45, -0.12, 0.2, 0.34], [0.55, -0.1, 0.22, 0.34]
        ];
        const cloudTint = (p: THREE.Vector3) => lerpHex(0xc9b8ff, 0xffffff, (p.y + 0.35) / 0.75);
        const parts: KitPart[] = puffs.map(([x, y, z, r]) => ({
            geometry: placed(new THREE.SphereGeometry(r, 16, 12), [x, y, z], [0, 0, 0], [1, 0.62, 0.85]),
            tint: cloudTint
        }));
        const stripe = (y: number, hex: number) => ({
            geometry: placed(new THREE.CapsuleGeometry(0.035, 2.1, 3, 8), [0, y, 0.46], [0, 0, Math.PI / 2]),
            tint: col(hex)
        });
        parts.push(stripe(-0.1, 0xff8fa3), stripe(-0.18, 0xffe680), stripe(-0.26, 0x8fd3ff));
        // Sleepy face at the front end.
        parts.push(closedEye([0.78, 0.1, 0.42], 0.06), closedEye([1.0, 0.08, 0.36], 0.05));
        parts.push({ geometry: placed(new THREE.SphereGeometry(0.06, 8, 6), [0.7, -0.01, 0.42], [0, 0, 0], [1.2, 0.7, 0.4]), tint: col(0xffa6c9) });
        return mergeKitParts(parts);
    });
    const cloud = new THREE.Mesh(geo, vcMaterial({ roughness: 0.9, emissive: 0x6650a0, emissiveIntensity: 0.15 }));
    const root = new THREE.Group();
    root.position.set(0, -0.95, 0);
    root.add(cloud);
    return {
        type: PowerUpType.DREAM_CLOUD_CARPET,
        root,
        update: (s) => {
            // Auto-hover: the cloud breathes and bobs under the rocket.
            cloud.position.y = Math.sin(s.t * 1.9) * 0.12;
            const breathe = 1 + Math.sin(s.t * 1.2) * 0.03;
            cloud.scale.set(breathe, 1 / breathe, 1);
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 7. Lullaby Lantern — swinging paper lantern singing music notes.
// ---------------------------------------------------------------------------

function buildLullabyLantern(): PowerUpRig {
    const bodyGeo = sharedGeometry('pu_lantern', () => {
        const profile: Array<[number, number]> = [];
        for (let i = 0; i <= 10; i++) {
            const u = i / 10;
            profile.push([0.1 + Math.sin(u * Math.PI) * 0.17, -0.22 + u * 0.44]);
        }
        const paper = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 16);
        const capTint = col(0xb3261e);
        return mergeKitParts([
            {
                geometry: paper,
                tint: (p) => {
                    const a = Math.atan2(p.z, p.x) / (Math.PI * 2) + 0.5;
                    const rib = Math.abs(((a * 8) % 1) - 0.5) < 0.06;
                    const band = Math.abs(p.y) < 0.025;
                    return (rib || band ? col(0xd9651a) : lerpHex(0xffc35c, 0xffe9a8, 1 - Math.abs(p.y) / 0.22));
                }
            },
            { geometry: placed(new THREE.CylinderGeometry(0.11, 0.12, 0.06, 12), [0, 0.25, 0]), tint: capTint },
            { geometry: placed(new THREE.CylinderGeometry(0.12, 0.11, 0.06, 12), [0, -0.25, 0]), tint: capTint },
            { geometry: placed(new THREE.TorusGeometry(0.1, 0.018, 6, 14, Math.PI), [0, 0.28, 0]), tint: col(0x5a3a1a) },
            { geometry: placed(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), [0, -0.36, 0]), tint: capTint },
            { geometry: placed(new THREE.ConeGeometry(0.05, 0.16, 8), [0, -0.48, 0], [Math.PI, 0, 0]), tint: col(0xff4500) }
        ]);
    });
    const noteGeo = sharedGeometry('pu_music_note', () => mergeKitParts([
        { geometry: placed(new THREE.SphereGeometry(0.06, 10, 8), [0, 0, 0], [0, 0, 0.4], [1.25, 0.85, 0.5]) },
        { geometry: placed(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), [0.06, 0.11, 0]) },
        { geometry: placed(new THREE.BoxGeometry(0.09, 0.03, 0.02), [0.1, 0.19, 0], [0, 0, -0.6]) }
    ]));
    const cfg = POWER_UP_CONFIGS[PowerUpType.LULLABY_LANTERN];
    const root = new THREE.Group();
    root.position.set(0.8, 1.65, 0.4);
    const swing = new THREE.Group();
    root.add(swing);
    const lantern = new THREE.Mesh(bodyGeo, vcMaterial({ emissive: cfg.secondaryColor, emissiveIntensity: 0.45, roughness: 0.8 }));
    lantern.position.y = -0.36;
    swing.add(lantern);
    const glow = new THREE.Mesh(sharedGeometry('pu_lantern_glow', () => new THREE.SphereGeometry(0.34, 12, 8)), additive(cfg.color, 0.3));
    glow.position.y = -0.36;
    swing.add(glow);
    const notes: THREE.Mesh[] = [];
    for (let i = 0; i < 2; i++) {
        const note = new THREE.Mesh(noteGeo, new THREE.MeshBasicMaterial({ color: i === 0 ? 0xfff0a0 : 0xffc0e8, transparent: true, depthWrite: false }));
        root.add(note);
        notes.push(note);
    }
    return {
        type: PowerUpType.LULLABY_LANTERN,
        root,
        update: (s) => {
            swing.rotation.z = Math.sin(s.t * 2) * 0.16;
            const g = 1 + Math.sin(s.t * 5) * 0.15;
            glow.scale.setScalar(g);
            notes.forEach((note, i) => {
                const phase = (s.t * 0.45 + i * 0.5) % 1;
                note.position.set(-0.15 - phase * 0.7 + i * 0.25, -0.2 + phase * 0.8, 0.1);
                note.rotation.z = Math.sin(s.t * 3 + i) * 0.3;
                note.scale.setScalar(0.8 + Math.sin(phase * Math.PI) * 0.4);
                (note.material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI);
            });
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 8. Puppy Hug Hug — ring of golden hearts and a big heart that beats.
// ---------------------------------------------------------------------------

function heartbeat(t: number): number {
    const p = (t * 1.3) % 1;
    return 1 + 0.2 * Math.exp(-(((p - 0.08) / 0.05) ** 2)) + 0.13 * Math.exp(-(((p - 0.27) / 0.05) ** 2));
}

function buildPuppyHug(): PowerUpRig {
    const cfg = POWER_UP_CONFIGS[PowerUpType.PUPPY_HUG_HUG];
    const ringGeo = sharedGeometry('pu_heart_ring', () => {
        const parts: KitPart[] = [];
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            parts.push({
                geometry: placed(extrudeShape(heartShape(), 0.14), [Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0], [0, 0, a - Math.PI / 2], [0.32, 0.32, 1]),
                tint: lerpHex(0xffd700, 0xffb347, (i % 2) * 0.6)
            });
        }
        return mergeKitParts(parts);
    });
    const ring = new THREE.Mesh(ringGeo, vcMaterial({ emissive: cfg.color, emissiveIntensity: 0.35, metalness: 0.4 }));
    const big = new THREE.Mesh(sharedGeometry('pu_heart', () => extrudeShape(heartShape(), 0.25)), new THREE.MeshStandardMaterial({
        color: cfg.secondaryColor, emissive: cfg.secondaryColor, emissiveIntensity: 0.4, roughness: 0.3
    }));
    big.position.set(0, 1.35, 0.35);
    big.scale.setScalar(0.55);
    const root = new THREE.Group();
    root.add(ring, big);
    return {
        type: PowerUpType.PUPPY_HUG_HUG,
        root,
        update: (s) => {
            ring.rotation.z += s.dt * 0.9;
            const beat = heartbeat(s.t);
            big.scale.setScalar(0.55 * beat);
            ring.scale.setScalar(1 + (beat - 1) * 0.25);
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 9. Fairy Dog Wings — reference asset (drawn wing shapes), kept as it was.
// ---------------------------------------------------------------------------

function fairyWingGeometry(): THREE.BufferGeometry {
    return sharedGeometry('pu_fairy_wing', () => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(1.5, 1.5, 1.5, 0.5);
        shape.quadraticCurveTo(2.0, -0.5, 1.0, -1.0);
        shape.quadraticCurveTo(0.2, -1.5, 0, 0);
        return new THREE.ShapeGeometry(shape);
    });
}

function buildFairyWings(): PowerUpRig {
    const cfg = POWER_UP_CONFIGS[PowerUpType.FAIRY_DOG_WINGS];
    const mat = new THREE.MeshBasicMaterial({ color: cfg.color, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false });
    const root = new THREE.Group();
    root.position.set(-0.5, 0.5, 0);
    const left = new THREE.Mesh(fairyWingGeometry(), mat);
    left.position.set(0, 0, 0.5);
    left.rotation.x = Math.PI / 4;
    left.scale.setScalar(0.6);
    const right = new THREE.Mesh(fairyWingGeometry(), mat);
    right.position.set(0, 0, -0.5);
    right.rotation.x = -Math.PI / 4;
    right.scale.setScalar(0.6);
    root.add(left, right);
    return {
        type: PowerUpType.FAIRY_DOG_WINGS,
        root,
        primary: root,
        update: (s) => {
            const flap = Math.sin(s.t * 8) * 0.6;
            left.rotation.x = Math.PI / 4 + flap;
            right.rotation.x = -(Math.PI / 4 + flap);
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 10. Moonbeam Slide — silver slide streaming back to a crescent moon.
// ---------------------------------------------------------------------------

function buildMoonbeamSlide(): PowerUpRig {
    const cfg = POWER_UP_CONFIGS[PowerUpType.MOONBEAM_SLIDE];
    const slideGeo = sharedGeometry('pu_moon_slide', () => {
        const geo = new THREE.PlaneGeometry(3, 0.46, 18, 2);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i) - 1.5;                 // 0 … -3
            const u = -x / 3;
            const y = pos.getY(i) * (1 - u * 0.35) - 0.25 * u * u;
            pos.setXYZ(i, x, y, 0);
        }
        geo.computeVertexNormals();
        return mergeKitParts([{ geometry: geo, tint: (p) => lerpHex(0xb9c2d6, 0xffffff, Math.abs(p.y + 0.25 * (p.x / 3) ** 2) / 0.15) }]);
    });
    const slide = new THREE.Mesh(slideGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    const moonGeo = sharedGeometry('pu_moon', () => mergeKitParts([
        { geometry: extrudeShape(crescentShape(), 0.16), tint: (p) => lerpHex(0xfff2b8, 0xffffff, p.y + 0.5) },
        closedEye([-0.28, 0.05, 0.13], 0.05),
        { geometry: placed(new THREE.SphereGeometry(0.05, 8, 6), [-0.3, -0.1, 0.12], [0, 0, 0], [1.2, 0.7, 0.4]), tint: col(0xffb6c1) }
    ]));
    const moon = new THREE.Mesh(moonGeo, vcMaterial({ emissive: 0xfff2b8, emissiveIntensity: 0.4 }));
    moon.position.set(-3.15, -0.3, 0.05);
    moon.scale.setScalar(1.05);
    const streaks: THREE.Mesh[] = [];
    const streakGeo = sharedGeometry('pu_moon_streak', () => new THREE.BoxGeometry(0.5, 0.025, 0.02));
    for (let i = 0; i < 3; i++) {
        const st = new THREE.Mesh(streakGeo, additive(cfg.secondaryColor, 0.7));
        streaks.push(st);
    }
    const root = new THREE.Group();
    root.position.set(-0.85, -0.2, 0);
    root.add(slide, moon, ...streaks);
    return {
        type: PowerUpType.MOONBEAM_SLIDE,
        root,
        update: (s) => {
            moon.rotation.z = Math.sin(s.t * 1.5) * 0.15;
            // Speed streaks race down the slide: super speed.
            streaks.forEach((st, i) => {
                const phase = (s.t * 1.6 + i / 3) % 1;
                const x = -phase * 3;
                const u = phase;
                st.position.set(x, -0.25 * u * u + (i - 1) * 0.07, 0.03);
                (st.material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.8;
            });
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 11. Fairy Godmother Sparkle — a tiny fairy dog whose wand charges up to grant a gift.
// ---------------------------------------------------------------------------

function buildFairyGodmother(): PowerUpRig {
    const bodyGeo = sharedGeometry('pu_fairy_dog', () => {
        const cream = col(0xfff1dc);
        const brown = col(0xc8915e);
        const ear = (z: number) => {
            const g = new THREE.SphereGeometry(0.07, 8, 6);
            g.scale(0.7, 1.5, 0.35);
            g.rotateX(z > 0 ? -0.35 : 0.35);
            g.translate(-0.06, 0.05, z);
            return g;
        };
        const wand = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5);
        wand.rotateZ(-0.6);
        wand.translate(0.17, -0.12, 0.12);
        return mergeKitParts([
            { geometry: new THREE.SphereGeometry(0.16, 14, 10), tint: cream },
            { geometry: placed(new THREE.SphereGeometry(0.08, 10, 8), [0.13, -0.04, 0], [0, 0, 0], [1.2, 0.9, 0.9]), tint: cream },
            { geometry: placed(new THREE.SphereGeometry(0.035, 8, 6), [0.225, -0.02, 0]), tint: INK },
            { geometry: placed(new THREE.SphereGeometry(0.028, 8, 6), [0.08, 0.05, 0.13]), tint: INK },
            { geometry: placed(new THREE.SphereGeometry(0.028, 8, 6), [0.08, 0.05, -0.13]), tint: INK },
            { geometry: ear(0.15), tint: brown },
            { geometry: ear(-0.15), tint: brown },
            { geometry: placed(new THREE.ConeGeometry(0.13, 0.24, 12), [-0.04, -0.25, 0]), tint: col(0xff9fd0) },
            { geometry: placed(new THREE.TorusGeometry(0.07, 0.015, 6, 16), [-0.02, 0.2, 0], [Math.PI / 2, 0, 0]), tint: col(0xffd700) },
            { geometry: wand, tint: col(0xffd700) }
        ]);
    });
    const dog = new THREE.Mesh(bodyGeo, vcMaterial({ roughness: 0.6 }));
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xe6d6ff, side: THREE.DoubleSide, transparent: true, opacity: 0.75, depthWrite: false });
    const wingL = new THREE.Mesh(fairyWingGeometry(), wingMat);
    const wingR = new THREE.Mesh(fairyWingGeometry(), wingMat);
    for (const w of [wingL, wingR]) {
        w.scale.setScalar(0.17);
        w.position.set(-0.12, 0.02, 0);
    }
    const star = new THREE.Mesh(sharedGeometry('pu_star', () => extrudeShape(starShape(5, 0.45), 0.12)), new THREE.MeshStandardMaterial({
        color: 0xfff3a0, emissive: 0xffd700, emissiveIntensity: 1
    }));
    star.position.set(0.27, 0.01, 0.12);
    star.scale.setScalar(0.15);
    const root = new THREE.Group();
    root.position.set(1.2, 1.5, 0.4);
    root.scale.setScalar(1.7);
    root.add(wingL, wingR, dog, star);
    return {
        type: PowerUpType.FAIRY_GODMOTHER_SPARKLE,
        root,
        update: (s) => {
            root.position.y = 1.5 + Math.sin(s.t * 3) * 0.12;
            const flap = Math.sin(s.t * 22) * 0.5;
            wingL.rotation.set(0.9 + flap, 0, 0.3);
            wingR.rotation.set(-(0.9 + flap), 0, 0.3);
            // Tell: the wand charges as the grant approaches (the last 40% of the timer).
            const charge = s.duration > 0 ? THREE.MathUtils.clamp(1 - s.timeLeft / (s.duration * 0.4), 0, 1) : 0;
            star.rotation.z -= s.dt * (2 + charge * 14);
            star.scale.setScalar(0.15 * (1 + charge * 0.8 + Math.sin(s.t * 10) * 0.08));
            (star.material as THREE.MeshStandardMaterial).emissiveIntensity = 1 + charge * 3;
            dog.rotation.z = Math.sin(s.t * 2) * 0.1;
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 12. Candy Cane Vortex — six striped candy canes whirling around the rocket.
// ---------------------------------------------------------------------------

function candyCaneParts(): KitPart[] {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(0, -0.5 + (i / 8) * 0.8, 0));
    for (let i = 1; i <= 12; i++) {
        const a = Math.PI - (i / 12) * Math.PI;
        pts.push(new THREE.Vector3(0.17 + Math.cos(a) * 0.17, 0.3 + Math.sin(a) * 0.17, 0));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.055, 8, false);
    const red = col(0xe8202a);
    const stripe = (p: THREE.Vector3) => {
        const s = p.y <= 0.3 ? p.y + 0.5 : 0.8 + (Math.PI - Math.atan2(p.y - 0.3, p.x - 0.17)) * 0.17;
        return Math.floor(s * 9 + p.z * 4) % 2 === 0 ? red : WHITE;
    };
    return [{ geometry: tube, tint: stripe }];
}

function buildCandyVortex(): PowerUpRig {
    const geo = sharedGeometry('pu_candy_vortex', () => {
        const parts: KitPart[] = [];
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const m = new THREE.Matrix4().compose(
                new THREE.Vector3(Math.cos(a) * 1.25, Math.sin(a) * 1.25, (i % 2 === 0 ? 0.15 : -0.15)),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0, a + 0.5)),
                new THREE.Vector3(1.4, 1.4, 1.4)
            );
            for (const part of candyCaneParts()) {
                part.geometry.applyMatrix4(m);
                parts.push(part);
            }
        }
        return mergeKitParts(parts);
    });
    const vortex = new THREE.Mesh(geo, vcMaterial({ roughness: 0.2, metalness: 0.0, emissive: 0x330000, emissiveIntensity: 0.3 }));
    const root = new THREE.Group();
    root.add(vortex);
    return {
        type: PowerUpType.CANDY_CANE_VORTEX,
        root,
        update: (s) => {
            vortex.rotation.z += s.dt * 3.6;
            vortex.scale.setScalar(1 + Math.sin(s.t * 4) * 0.05);
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 13. Starlight Tiara — gold band with five stars and twinkling gems (invincible).
// ---------------------------------------------------------------------------

function buildStarlightTiara(): PowerUpRig {
    const cfg = POWER_UP_CONFIGS[PowerUpType.STARLIGHT_TIARA];
    const slots: Array<[number, number, number]> = [[-1, 0.2, 0.2], [-0.5, 0.3, 0.26], [0, 0.42, 0.36], [0.5, 0.3, 0.26], [1, 0.2, 0.2]];
    const bandR = 0.46;
    const tiaraGeo = sharedGeometry('pu_tiara', () => {
        const band = new THREE.TorusGeometry(bandR, 0.045, 6, 40);
        band.rotateX(Math.PI / 2);
        const parts: KitPart[] = [{ geometry: band, tint: col(0xffc93c) }];
        for (const [k, h, size] of slots) {
            const a = k * 0.9;
            parts.push({
                geometry: placed(extrudeShape(starShape(5, 0.45), 0.08), [Math.sin(a) * bandR, h, Math.cos(a) * bandR], [0, a, 0], [size, size, 1]),
                tint: (p) => lerpHex(0xffb300, 0xfff3b0, (p.y - h + size * 0.5) / size)
            });
        }
        return mergeKitParts(parts);
    });
    const gemGeo = sharedGeometry('pu_tiara_gems', () => mergeKitParts(slots.map(([k, h, size]) => {
        const a = k * 0.9;
        const r = bandR + 0.05;
        return { geometry: placed(new THREE.OctahedronGeometry(size * 0.2, 0), [Math.sin(a) * r, h, Math.cos(a) * r]), tint: WHITE, flat: true };
    })));
    const tiara = new THREE.Mesh(tiaraGeo, vcMaterial({ metalness: 0.6, roughness: 0.25, emissive: cfg.color, emissiveIntensity: 0.3 }));
    const gemMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: cfg.secondaryColor, emissive: cfg.secondaryColor, emissiveIntensity: 0.8 });
    const gems = new THREE.Mesh(gemGeo, gemMat);
    const root = new THREE.Group();
    root.position.set(0.1, 0.58, 0);
    root.add(tiara, gems);
    return {
        type: PowerUpType.STARLIGHT_TIARA,
        root,
        update: (s) => {
            const pulse = 1 + Math.sin(s.t * 6) * 0.06;
            root.scale.setScalar(pulse);
            root.rotation.y = Math.sin(s.t * 2) * 0.15;
            gemMat.emissiveIntensity = 0.8 + Math.pow(Math.max(0, Math.sin(s.t * 7)), 6) * 2.5;
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 14. Butterfly Escort — three butterflies, one per blocked hit.
// ---------------------------------------------------------------------------

export const BUTTERFLY_ESCORT_COUNT = 3;

function buildButterflyEscort(): PowerUpRig {
    const cfg = POWER_UP_CONFIGS[PowerUpType.BUTTERFLY_ESCORT];
    const wingGeo = sharedGeometry('pu_butterfly_wing', () => {
        const geo = extrudeShape(butterflyWingShape(), 0.03, 0.01, 8);
        geo.rotateZ(-Math.PI / 2); // wing spreads toward -Y, upper lobe forward (+X)
        return mergeKitParts([{
            geometry: geo,
            flat: true,
            tint: (p) => {
                const d = Math.hypot(p.x, p.y);
                if (d > 0.88) return col(0x3a2450);                      // dark rim
                const spot = Math.hypot(p.x - 0.45, p.y + 0.7) < 0.12 || Math.hypot(p.x + 0.3, p.y + 0.45) < 0.08;
                return spot ? WHITE : tmp.setScalar(0.65 + d * 0.35).clone();
            }
        }]);
    });
    const bodyGeo = sharedGeometry('pu_butterfly_body', () => {
        const body = new THREE.CapsuleGeometry(0.06, 0.32, 4, 8);
        body.rotateZ(Math.PI / 2);
        const antenna = (z: number) => {
            const g = new THREE.CylinderGeometry(0.008, 0.008, 0.26, 4);
            g.translate(0, 0.13, 0);
            g.rotateZ(-0.6);
            g.rotateX(z);
            g.translate(0.2, 0.02, 0);
            return g;
        };
        return mergeKitParts([
            { geometry: body, tint: col(0x3a2450) },
            { geometry: antenna(0.3), tint: col(0x3a2450) },
            { geometry: antenna(-0.3), tint: col(0x3a2450) },
            { geometry: placed(new THREE.SphereGeometry(0.025, 6, 4), [0.38, 0.22, 0.07]), tint: col(0xffd700) },
            { geometry: placed(new THREE.SphereGeometry(0.025, 6, 4), [0.38, 0.22, -0.07]), tint: col(0xffd700) }
        ]);
    });
    const wingMats = [cfg.color, cfg.secondaryColor].map((hex) => new THREE.MeshStandardMaterial({
        vertexColors: true, color: hex, emissive: hex, emissiveIntensity: 0.2, side: THREE.DoubleSide, roughness: 0.6
    }));
    const bodyMat = vcMaterial({ roughness: 0.5 });
    const root = new THREE.Group();
    const butterflies: THREE.Group[] = [];
    for (let i = 0; i < BUTTERFLY_ESCORT_COUNT; i++) {
        const b = new THREE.Group();
        const mat = wingMats[i % 2];
        const wingA = new THREE.Mesh(wingGeo, mat);
        const wingB = new THREE.Mesh(wingGeo, mat);
        wingB.scale.y = -1;
        b.add(wingA, wingB, new THREE.Mesh(bodyGeo, bodyMat));
        b.scale.setScalar(0.62);
        b.userData = {
            orbitAngle: (i / BUTTERFLY_ESCORT_COUNT) * Math.PI * 2,
            orbitRadius: 2 + (i % 2) * 0.35,
            orbitSpeed: 1 + i * 0.18,
            wingSpeed: 11 + i * 2
        };
        root.add(b);
        butterflies.push(b);
    }
    return {
        type: PowerUpType.BUTTERFLY_ESCORT,
        root,
        butterflies,
        update: (s) => {
            for (const b of butterflies) {
                const d = b.userData;
                d.orbitAngle += d.orbitSpeed * s.dt * 1.2;
                b.position.set(Math.cos(d.orbitAngle) * d.orbitRadius, Math.sin(d.orbitAngle) * d.orbitRadius, Math.sin(d.orbitAngle * 2) * 0.5);
                // Fly along the orbit tangent.
                b.rotation.z = d.orbitAngle + Math.PI / 2;
                const flap = Math.sin(s.t * d.wingSpeed) * 0.9;
                b.children[0].rotation.x = flap;
                b.children[1].rotation.x = -flap;
            }
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 15. Magic Paintbrush — wooden brush with a rainbow-cycling, dripping tip.
// ---------------------------------------------------------------------------

function buildMagicPaintbrush(): PowerUpRig {
    const brushGeo = sharedGeometry('pu_paintbrush', () => mergeKitParts([
        { geometry: new THREE.LatheGeometry([[0.0, -0.32], [0.035, -0.3], [0.045, 0.0], [0.035, 0.14]].map(([r, y]) => new THREE.Vector2(r, y)), 10), tint: (p) => lerpHex(0x7a3e16, 0xc07a3c, (p.y + 0.32) / 0.46) },
        { geometry: placed(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 12), [0, 0.18, 0]), tint: col(0xd8dde6) },
        { geometry: new THREE.LatheGeometry([[0.045, 0.22], [0.07, 0.3], [0.05, 0.38], [0, 0.44]].map(([r, y]) => new THREE.Vector2(r, y)), 12), tint: col(0xf5e6c8) }
    ]));
    const tipGeo = sharedGeometry('pu_paint_tip', () => new THREE.LatheGeometry([[0.052, 0.34], [0.05, 0.38], [0.03, 0.43], [0, 0.46]].map(([r, y]) => new THREE.Vector2(r, y)), 12));
    const dropGeo = sharedGeometry('pu_paint_drop', () => new THREE.SphereGeometry(0.03, 8, 6));
    const brush = new THREE.Mesh(brushGeo, vcMaterial({ roughness: 0.6 }));
    const paintMat = new THREE.MeshStandardMaterial({ color: 0xff69b4, emissive: 0xff69b4, emissiveIntensity: 0.6, roughness: 0.2 });
    const tip = new THREE.Mesh(tipGeo, paintMat);
    const drop = new THREE.Mesh(dropGeo, paintMat);
    const holder = new THREE.Group();
    holder.rotation.z = -Math.PI / 4;
    holder.add(brush, tip, drop);
    const root = new THREE.Group();
    root.position.set(0.6, 0.35, 0.8);
    root.scale.setScalar(1.3);
    root.add(holder);
    return {
        type: PowerUpType.MAGIC_PAINTBRUSH,
        root,
        update: (s) => {
            holder.rotation.z = -Math.PI / 4 + Math.sin(s.t * 6) * 0.2;
            paintMat.color.setHSL((s.t * 0.25) % 1, 0.85, 0.6);
            paintMat.emissive.copy(paintMat.color);
            const phase = (s.t * 0.8) % 1;
            drop.position.set(0, 0.48 + phase * 0.1, 0);
            drop.scale.setScalar(phase < 0.85 ? 0.6 + phase * 0.6 : 0.001);
            applyExpiryBlink(root, s);
        }
    };
}

// ---------------------------------------------------------------------------
// 16. Best Friend Forever Aura — two friend stars chasing around a sparkling aura.
// ---------------------------------------------------------------------------

function buildBffAura(): PowerUpRig {
    const cfg = POWER_UP_CONFIGS[PowerUpType.BEST_FRIEND_FOREVER_AURA];
    const ringGeo = (r: number, tube: number) => sharedGeometry(`pu_bff_ring_${r}`, () => new THREE.TorusGeometry(r, tube, 8, 40));
    const inner = new THREE.Mesh(ringGeo(1.4, 0.06), additive(cfg.color, 0.5));
    const outer = new THREE.Mesh(ringGeo(1.9, 0.04), additive(cfg.secondaryColor, 0.35));
    const friendGeo = sharedGeometry('pu_friend_star', () => mergeKitParts([
        { geometry: extrudeShape(starShape(5, 0.5), 0.14), tint: WHITE },
        { geometry: placed(new THREE.SphereGeometry(0.045, 8, 6), [-0.08, 0.04, 0.12], [0, 0, 0], [1, 1.3, 0.5]), tint: INK },
        { geometry: placed(new THREE.SphereGeometry(0.045, 8, 6), [0.08, 0.04, 0.12], [0, 0, 0], [1, 1.3, 0.5]), tint: INK },
        { geometry: placed(new THREE.TorusGeometry(0.06, 0.014, 5, 10, Math.PI), [0, -0.06, 0.12], [0, 0, Math.PI]), tint: INK }
    ]));
    const friends = [cfg.color, cfg.secondaryColor].map((hex) => {
        const m = new THREE.Mesh(friendGeo, new THREE.MeshStandardMaterial({ vertexColors: true, color: hex, emissive: hex, emissiveIntensity: 0.45 }));
        m.scale.setScalar(0.55);
        return m;
    });
    const root = new THREE.Group();
    root.add(inner, outer, ...friends);
    return {
        type: PowerUpType.BEST_FRIEND_FOREVER_AURA,
        root,
        update: (s) => {
            const pulse = 1 + Math.sin(s.t * 4) * 0.08;
            inner.scale.setScalar(pulse);
            outer.scale.setScalar(2 - pulse);
            inner.rotation.z += s.dt * 0.9;
            friends.forEach((f, i) => {
                // "Time slows": they chase slowly, bouncing, never quite catching up.
                const a = s.t * 0.9 + i * Math.PI * 0.85;
                const r = 1.65 + Math.sin(s.t * 3 + i) * 0.08;
                f.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.25);
                f.rotation.z = Math.sin(s.t * 2 + i) * 0.3;
                f.scale.setScalar(0.55 * (1 + Math.abs(Math.sin(s.t * 5 + i)) * 0.1));
            });
            applyExpiryBlink(root, s);
        }
    };
}

const BUILDERS: Record<PowerUpType, () => PowerUpRig> = {
    [PowerUpType.RAINBOW_COMET_TAIL]: buildRainbowComet,
    [PowerUpType.FLOWER_CROWN_BOOST]: buildFlowerCrown,
    [PowerUpType.BUBBLEGUM_SHIELD]: buildBubblegumShield,
    [PowerUpType.TWINKLE_STAR_MAGNET]: buildStarMagnet,
    [PowerUpType.UNICORN_HORN_BLAST]: buildUnicornHorn,
    [PowerUpType.DREAM_CLOUD_CARPET]: buildDreamCloud,
    [PowerUpType.LULLABY_LANTERN]: buildLullabyLantern,
    [PowerUpType.PUPPY_HUG_HUG]: buildPuppyHug,
    [PowerUpType.FAIRY_DOG_WINGS]: buildFairyWings,
    [PowerUpType.MOONBEAM_SLIDE]: buildMoonbeamSlide,
    [PowerUpType.FAIRY_GODMOTHER_SPARKLE]: buildFairyGodmother,
    [PowerUpType.CANDY_CANE_VORTEX]: buildCandyVortex,
    [PowerUpType.STARLIGHT_TIARA]: buildStarlightTiara,
    [PowerUpType.BUTTERFLY_ESCORT]: buildButterflyEscort,
    [PowerUpType.MAGIC_PAINTBRUSH]: buildMagicPaintbrush,
    [PowerUpType.BEST_FRIEND_FOREVER_AURA]: buildBffAura
};

/** Build the attachment for `type` (rig space = the player group). */
export function buildPowerUpRig(type: PowerUpType): PowerUpRig {
    const rig = BUILDERS[type]();
    rig.root.name = `powerup_${type}`;
    rig.root.userData.powerUpRig = rig;
    return rig;
}
