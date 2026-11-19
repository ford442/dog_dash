/**
 * Zephyr — "the eye of the storm". Visual rig for the chapter-4 boss.
 *
 * Anatomy (group-local, the camera looks down -Z, the player is toward -X):
 * - **Eye** (r ≈ 3.6, centred on the group): the weak point. Matches the
 *   exposed hitbox (r 4). The pupil tracks the player; it glows bright and the
 *   lids open wide only while `weakPointExposed`, so "shoot now" is readable.
 * - **Lids**: two cloud shells over the eye. Nearly shut to an angry slit
 *   during Gale / Shear, thrown open during Eye.
 * - **Cloud wreath**: a ring of puffs around the eye whose outer edge sits at
 *   the shield hitbox (r 8). It squeezes in while shielded and parts in Eye.
 * - **Brows**: two cloud puffs that furrow in Gale and lift in Eye.
 * - **Spiral arms**: three hurricane bands that spin with the pull strength
 *   (fast in Gale, wobbling in Shear, nearly still in Eye).
 * - **Inflow rings**: wind rings drawn toward the eye while it pulls.
 *
 * Phase tells: the iris heats orange and the wreath trembles in the last
 * seconds of Gale (Shear is coming); the lids start to part before Eye; they
 * start closing before Eye ends. Hit = white eye flash. Defeat = the pupil
 * shrinks, lids droop, the clouds dissipate.
 *
 * Visual only: no RNG, no timers outside `update(dt)`.
 */

import * as THREE from 'three';
import type { BossPhase } from './types';
import { markShared, noteGeometryCreated } from '../gpu_resources';

/** Phase lengths (seconds) — shared with `ZephyrBoss` so the tells line up with the real switches. */
export const ZEPHYR_GALE_DURATION = 10;
export const ZEPHYR_SHEAR_DURATION = 8;
export const ZEPHYR_EYE_DURATION = 6;

/** Visible radii that the hitboxes in `ZephyrBoss.collectWasmHitboxes` are kept consistent with. */
export const ZEPHYR_EYE_RADIUS = 3.6;
export const ZEPHYR_SHIELD_RADIUS = 8;

export interface ZephyrPose {
    phase: BossPhase;
    /** Seconds since the current phase began. */
    phaseTime: number;
    weakPointExposed: boolean;
    /** Vertical shear offset (Shear phase). */
    pullForceY: number;
    /** Player position relative to the boss group, if known. */
    target?: { x: number; y: number } | null;
}

const WREATH_PUFFS = 14;
const BACK_PUFFS = 6;

let puffGeometry: THREE.BufferGeometry | null = null;
function getPuffGeometry(): THREE.BufferGeometry {
    if (!puffGeometry) {
        puffGeometry = markShared(new THREE.IcosahedronGeometry(1, 2));
        noteGeometryCreated();
    }
    return puffGeometry;
}

function smoothstep(e0: number, e1: number, x: number): number {
    const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
}

function buildSpiralArms(): THREE.BufferGeometry {
    const arms: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 12; i++) {
            const f = i / 12;
            const ang = k * (Math.PI * 2 / 3) + f * Math.PI * 1.4;
            const r = 6.5 + f * 7;
            pts.push(new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r * 0.8, -1.5 - f));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.TubeGeometry(curve, 36, 0.8, 6, false);
        // Taper toward the tip.
        const pos = tube.attributes.position;
        const v = new THREE.Vector3();
        const segs = 36, radial = 6;
        for (let s = 0; s <= segs; s++) {
            const c = curve.getPointAt(s / segs);
            const taper = 1 - (s / segs) * 0.85;
            for (let r = 0; r <= radial; r++) {
                const idx = s * (radial + 1) + r;
                v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(taper).add(c);
                pos.setXYZ(idx, v.x, v.y, v.z);
            }
        }
        tube.computeVertexNormals();
        arms.push(tube.index ? tube.toNonIndexed() : tube);
        if (tube.index) tube.dispose();
    }
    const positions: number[] = [];
    const normals: number[] = [];
    for (const g of arms) {
        positions.push(...(g.attributes.position.array as Float32Array));
        normals.push(...(g.attributes.normal.array as Float32Array));
        g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return merged;
}

export class ZephyrRig {
    readonly root = new THREE.Group();

    private eye = new THREE.Group();
    private pupilGroup = new THREE.Group();
    private iris: THREE.Mesh;
    private pupil: THREE.Mesh;
    private upperLid: THREE.Mesh;
    private lowerLid: THREE.Mesh;
    private brows: THREE.Mesh[] = [];
    private wreath: Array<{ mesh: THREE.Mesh; angle: number; size: number }> = [];
    private backPuffs: THREE.Mesh[] = [];
    private arms: THREE.Mesh;
    private rings: THREE.Mesh[] = [];

    private scleraMat: THREE.MeshStandardMaterial;
    private irisMat: THREE.MeshStandardMaterial;
    private cloudMat: THREE.MeshStandardMaterial;
    private armMat: THREE.MeshBasicMaterial;
    private ringMats: THREE.MeshBasicMaterial[] = [];

    private t = 0;
    private flash = 0;
    private lidOpen = 0.25;
    private wreathRadius = 5.4;
    private armSpin = 0;
    private dissolve = 0;

    constructor() {
        this.cloudMat = new THREE.MeshStandardMaterial({
            color: 0xe4f8ff,
            emissive: 0x3a7890,
            emissiveIntensity: 0.45,
            roughness: 0.9,
            transparent: true,
            opacity: 1
        });
        this.scleraMat = new THREE.MeshStandardMaterial({
            color: 0xf4ffff,
            emissive: 0x88ddff,
            emissiveIntensity: 0.35,
            roughness: 0.25
        });
        this.irisMat = new THREE.MeshStandardMaterial({
            color: 0x00e5ff,
            emissive: 0x00e5ff,
            emissiveIntensity: 1.2,
            roughness: 0.2
        });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x02060a, roughness: 0.1, metalness: 0.2 });
        const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        // Eye: sclera + iris + pupil + glint, facing the camera (+Z).
        const sclera = new THREE.Mesh(new THREE.SphereGeometry(3.3, 32, 20), this.scleraMat);
        this.eye.add(sclera);
        this.iris = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), this.irisMat);
        this.iris.scale.set(1, 1, 0.3);
        this.iris.position.z = 2.9;
        this.pupil = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 12), pupilMat);
        this.pupil.scale.set(1, 1, 0.35);
        this.pupil.position.z = 3.25;
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), glintMat);
        glint.position.set(-0.55, 0.6, 3.45);
        this.pupilGroup.add(this.iris, this.pupil, glint);
        this.eye.add(this.pupilGroup);
        this.root.add(this.eye);

        // Lids: front-upper and front-lower quarter shells of a slightly larger sphere.
        const lidR = ZEPHYR_EYE_RADIUS;
        this.upperLid = new THREE.Mesh(
            new THREE.SphereGeometry(lidR, 28, 10, 0, Math.PI, 0, Math.PI / 2),
            this.cloudMat
        );
        this.lowerLid = new THREE.Mesh(
            new THREE.SphereGeometry(lidR, 28, 10, 0, Math.PI, Math.PI / 2, Math.PI / 2),
            this.cloudMat
        );
        this.upperLid.material = this.lowerLid.material = this.cloudMat;
        this.cloudMat.side = THREE.DoubleSide;
        this.root.add(this.upperLid, this.lowerLid);

        // Cloud wreath + back layer.
        const puff = getPuffGeometry();
        for (let i = 0; i < WREATH_PUFFS; i++) {
            const angle = (i / WREATH_PUFFS) * Math.PI * 2;
            const size = 1.7 + ((i * 7) % 5) * 0.18;
            const mesh = new THREE.Mesh(puff, this.cloudMat);
            mesh.scale.setScalar(size);
            this.root.add(mesh);
            this.wreath.push({ mesh, angle, size });
        }
        for (let i = 0; i < BACK_PUFFS; i++) {
            const a = (i / BACK_PUFFS) * Math.PI * 2 + 0.4;
            const mesh = new THREE.Mesh(puff, this.cloudMat);
            mesh.position.set(Math.cos(a) * 4, Math.sin(a) * 4, -2.6);
            mesh.scale.setScalar(2.6);
            this.root.add(mesh);
            this.backPuffs.push(mesh);
        }

        // Brows.
        for (const side of [-1, 1]) {
            const brow = new THREE.Mesh(puff, this.cloudMat);
            brow.scale.set(1.9, 0.75, 0.9);
            brow.position.set(side * 1.7, 3.9, 2.2);
            this.root.add(brow);
            this.brows.push(brow);
        }

        // Spiral arms: normal blending (not additive) so they are part of the
        // silhouette — the hurricane spiral is what makes Zephyr read at 64 px.
        this.armMat = new THREE.MeshBasicMaterial({
            color: 0x9ff4ff,
            transparent: true,
            opacity: 0.55,
            depthWrite: false
        });
        this.arms = new THREE.Mesh(buildSpiralArms(), this.armMat);
        this.root.add(this.arms);

        // Inflow wind rings (around the X axis, coming in from the player's side).
        const ringGeo = new THREE.TorusGeometry(5, 0.22, 8, 48);
        for (let i = 0; i < 3; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xc8ffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const ring = new THREE.Mesh(ringGeo, mat);
            ring.rotation.y = Math.PI / 2;
            this.root.add(ring);
            this.rings.push(ring);
            this.ringMats.push(mat);
        }
    }

    /** Trigger the white hit flash. */
    hit(): void {
        this.flash = 1;
    }

    update(dt: number, pose: ZephyrPose): void {
        this.t += dt;
        const t = this.t;
        const pt = pose.phaseTime;
        const exposed = pose.weakPointExposed;

        // --- Targets per phase -------------------------------------------------
        let lidTarget = 0.28;          // radians each lid is open
        let wreathTarget = 5.4;        // puff ring radius
        let spinRate = 1.2;            // arm spin (rad/s)
        let armOpacity = 0.55;
        let ringStrength = 0;
        let tremble = 0;
        let heat = 0;                  // iris orange tint (shear incoming / rage)
        let browLift = -0.5;           // furrowed
        switch (pose.phase) {
            case 'entering':
                lidTarget = 0.5; spinRate = 0.8; armOpacity = 0.4;
                break;
            case 'phase1': { // Gale: hard pull, shielded
                spinRate = 3.2; ringStrength = 1;
                const warn = smoothstep(ZEPHYR_GALE_DURATION - 2.5, ZEPHYR_GALE_DURATION, pt);
                tremble = warn; heat = warn;
                break;
            }
            case 'phase2': { // Shear: vertical drafts, shielded
                spinRate = 1.8 * Math.sign(Math.sin(t * 1.5)) + 0.4; ringStrength = 0.5; heat = 0.35;
                const parting = smoothstep(ZEPHYR_SHEAR_DURATION - 2, ZEPHYR_SHEAR_DURATION, pt);
                lidTarget = 0.28 + parting * 0.4;
                wreathTarget = 5.4 + parting * 0.8;
                break;
            }
            case 'phase3': { // Eye: calm, weak point exposed
                const closing = smoothstep(ZEPHYR_EYE_DURATION - 1.5, ZEPHYR_EYE_DURATION, pt);
                lidTarget = 1.35 - closing * 0.9;
                wreathTarget = 7.0 - closing * 1.3;
                spinRate = 0.3; armOpacity = 0.25; browLift = 0.6 - closing;
                break;
            }
            case 'defeated':
                lidTarget = 0.55; spinRate = 0.15; armOpacity = 0;
                break;
        }
        if (pose.phase === 'defeated') this.dissolve = Math.min(1, this.dissolve + dt * 0.5);

        const k = Math.min(1, dt * 4);
        this.lidOpen += (lidTarget - this.lidOpen) * k;
        this.wreathRadius += (wreathTarget - this.wreathRadius) * k;

        // --- Eye ----------------------------------------------------------------
        this.upperLid.rotation.x = -this.lidOpen;
        this.lowerLid.rotation.x = this.lidOpen;

        let lookX = -0.9, lookY = 0;
        if (pose.target) {
            const len = Math.hypot(pose.target.x, pose.target.y) || 1;
            lookX = pose.target.x / len;
            lookY = pose.target.y / len;
        }
        this.pupilGroup.rotation.set(-lookY * 0.35, lookX * 0.35, 0);
        const pupilSize = pose.phase === 'defeated' ? 0.4 : (exposed ? 0.8 : 1.15);
        this.pupil.scale.set(pupilSize, pupilSize, 0.35);
        if (pose.phase === 'defeated') this.pupilGroup.rotation.z += dt * 4;

        this.flash = Math.max(0, this.flash - dt * 8);
        const irisColor = new THREE.Color(0x00e5ff).lerp(new THREE.Color(0xff8a2a), heat);
        this.irisMat.color.copy(irisColor);
        this.irisMat.emissive.copy(irisColor).lerp(new THREE.Color(0xffffff), this.flash);
        this.irisMat.emissiveIntensity = (exposed ? 2.2 + Math.sin(t * 6) * 0.4 : 1.0) * (1 - this.dissolve * 0.8) + this.flash * 2;
        this.scleraMat.emissiveIntensity = (exposed ? 0.8 : 0.3) + this.flash * 2.5;
        this.scleraMat.emissive.setHex(this.flash > 0 ? 0xffffff : 0x88ddff);

        // --- Clouds -------------------------------------------------------------
        const drift = 1 + this.dissolve * 0.8;
        for (let i = 0; i < this.wreath.length; i++) {
            const p = this.wreath[i];
            const a = p.angle + t * 0.15 + Math.sin(t * 0.8 + i) * 0.04;
            const jitter = tremble * Math.sin(t * 35 + i * 2.1) * 0.25;
            const r = (this.wreathRadius + jitter) * drift;
            p.mesh.position.set(Math.cos(a) * r, Math.sin(a) * r, Math.sin(t + i) * 0.4);
            p.mesh.scale.setScalar(p.size * (1 + Math.sin(t * 1.7 + i * 1.3) * 0.06) * (1 - this.dissolve * 0.7));
        }
        for (const b of this.backPuffs) b.scale.setScalar(2.6 * (1 - this.dissolve * 0.7));
        this.cloudMat.opacity = 1 - this.dissolve * 0.8;
        this.brows.forEach((brow, i) => {
            const side = i === 0 ? -1 : 1;
            brow.position.y = 3.9 + browLift * 0.6;
            brow.rotation.z = side * (browLift < 0 ? 0.45 : -0.2);
        });

        // --- Storm --------------------------------------------------------------
        this.armSpin += dt * spinRate;
        this.arms.rotation.z = this.armSpin;
        this.armMat.opacity += ((armOpacity * (1 - this.dissolve)) - this.armMat.opacity) * k;

        this.rings.forEach((ring, i) => {
            const f = ((t * 0.6 + i / 3) % 1);
            ring.position.set(THREE.MathUtils.lerp(-20, -4, f), pose.phase === 'phase2' ? Math.sin(t * 3 + i) * 2 : 0, 0);
            ring.scale.setScalar(THREE.MathUtils.lerp(1.5, 0.45, f));
            this.ringMats[i].opacity = Math.sin(Math.PI * f) * 0.55 * ringStrength;
            ring.visible = ringStrength > 0.01;
        });

        // Body leans into the shear.
        this.root.rotation.z = THREE.MathUtils.clamp(pose.pullForceY * 0.01, -0.25, 0.25);
    }

    dispose(): void {
        this.root.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            if (mesh.geometry && !mesh.geometry.userData?.sharedResource) mesh.geometry.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) m?.dispose();
        });
    }
}
