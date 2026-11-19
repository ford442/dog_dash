import * as THREE from 'three';
import { decorationBudget } from '../decoration_budget';
import { gameplayRandom } from '../run_seed';
import { markShared, noteGeometryCreated } from '../gpu_resources';
import { mergeKitParts, placed, type KitPart } from '../hazard_art/kit';

/**
 * Pitcher minion — a little flying pitcher plant that orbits the Star-Eater.
 *
 * Anatomy (local, built along Z: the mouth points -Z, away from the boss,
 * because `update` turns +Z toward the boss centre):
 * - **Urn**: ribbed pitcher body with a flared, toothed lip.
 * - **Nectar**: glowing core visible in the mouth. This is what you shoot; the
 *   whole minion fits inside the r 2.5 hitbox.
 * - **Lid**: hinged over the mouth, chomps open/closed (faster when the boss
 *   is raging).
 * - **Leaf wings**: flap to keep it aloft.
 * - **Eyes**: two eyes under the lip, facing outward.
 * Hit = white nectar flash + recoil wobble. Rage = nectar turns red and the
 * chomp speeds up.
 */

export const PITCHER_MINION_HITBOX_RADIUS = 2.5;

interface MinionGeometries {
    urn: THREE.BufferGeometry;
    lid: THREE.BufferGeometry;
    leaf: THREE.BufferGeometry;
    nectar: THREE.BufferGeometry;
    face: THREE.BufferGeometry;
}

let sharedGeos: MinionGeometries | null = null;

function shared(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    noteGeometryCreated();
    return markShared(geo);
}

/** How far the urn is pushed back along +Z from the lathe origin. */
const BODY_SHIFT = 0.4;
/** Max lid swing (radians); with BODY_SHIFT this keeps the open lid inside the hitbox. */
const LID_MAX_OPEN = 0.7;

/** Rotate a Y-up geometry so +Y points down -Z (the mouth direction). */
const Y_TO_NEG_Z = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

function getMinionGeometries(): MinionGeometries {
    if (sharedGeos) return sharedGeos;

    // Urn profile (radius, height) along +Y, mouth at the top.
    const profile = [
        [0.05, -1.55], [0.45, -1.5], [0.95, -1.15], [1.3, -0.6], [1.32, -0.1],
        [1.05, 0.55], [0.8, 0.95], [0.95, 1.2], [1.18, 1.38], [1.05, 1.42],
        [0.78, 1.2], [0.7, 0.6]
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const urn = new THREE.LatheGeometry(profile, 20);
    const rib = (p: THREE.Vector3) => {
        const k = (0.78 + 0.22 * Math.cos(Math.atan2(p.x, p.z) * 10)) * (p.y > 1.0 ? 1.25 : 1);
        return new THREE.Color(k, k * 0.9, k);
    };
    const urnParts: KitPart[] = [{ geometry: urn, tint: rib }];
    // Teeth around the lip, leaning outward.
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const tooth = placed(new THREE.ConeGeometry(0.1, 0.42, 5), [0, 0.2, 0]);
        tooth.applyMatrix4(new THREE.Matrix4().makeRotationX(0.5));
        tooth.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 1.38, 1.05));
        tooth.applyMatrix4(new THREE.Matrix4().makeRotationY(a));
        urnParts.push({ geometry: tooth, tint: 0xfff0e0 });
    }
    // Shift +Z so the body is centred between mouth and base: the swinging lid stays inside the hitbox.
    const urnGeo = mergeKitParts(urnParts).applyMatrix4(Y_TO_NEG_Z).translate(0, 0, BODY_SHIFT);

    // Lid: a flap over the mouth (XY plane), hinged along its +X edge (the pivot).
    const lid = placed(new THREE.SphereGeometry(1, 16, 8), [-1.02, 0, 0], [0, 0, 0], [1.02, 1.05, 0.14]);
    const lidGeo = mergeKitParts([{ geometry: lid, tint: (p) => new THREE.Color(1, 1, 1).multiplyScalar(p.z < 0 ? 1 : 0.6) }]);

    // Leaf wing: flattened, pointed blade extending along +X from the origin.
    const leaf = placed(new THREE.SphereGeometry(1, 12, 6), [1.0, 0, 0], [0, 0, 0], [1.0, 0.08, 0.42]);
    const lpos = leaf.attributes.position;
    for (let i = 0; i < lpos.count; i++) {
        const x = lpos.getX(i);
        lpos.setY(i, lpos.getY(i) + (x * x) * 0.08); // curl the tip up
    }
    const leafGeo = mergeKitParts([{ geometry: leaf, tint: (p) => new THREE.Color(1, 1, 1).multiplyScalar(Math.abs(p.z) < 0.05 ? 0.6 : 1) }]);

    const nectarGeo = new THREE.SphereGeometry(0.68, 14, 10);

    // Two eyes on the camera-facing (+Y) side of the neck, looking out and up.
    const eyes: KitPart[] = [];
    for (const side of [-1, 1]) {
        eyes.push({ geometry: placed(new THREE.SphereGeometry(0.26, 12, 8), [side * 0.42, 0, 0]), tint: 0xffffff });
        eyes.push({ geometry: placed(new THREE.SphereGeometry(0.14, 10, 6), [side * 0.42, 0.15, -0.1]), tint: 0x050505 });
        eyes.push({ geometry: placed(new THREE.SphereGeometry(0.05, 6, 4), [side * 0.42 + 0.05, 0.27, -0.08]), tint: 0xffffff });
    }
    const faceGeo = mergeKitParts(eyes);

    sharedGeos = {
        urn: shared(urnGeo),
        lid: shared(lidGeo),
        leaf: shared(leafGeo),
        nectar: shared(nectarGeo),
        face: shared(faceGeo)
    };
    return sharedGeos;
}

const NECTAR_CALM = new THREE.Color(0xffd23a);
const NECTAR_RAGE = new THREE.Color(0xff2a3a);
const FLASH = new THREE.Color(0xffffff);

/** Build the minion's visual rig (also used by the `?gallery` review page). */
export function buildPitcherMinionVisual(): {
    group: THREE.Group;
    lid: THREE.Object3D;
    leaves: THREE.Object3D[];
    nectarMat: THREE.MeshStandardMaterial;
} {
    const geos = getMinionGeometries();
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x8a2a6a,
        vertexColors: true,
        emissive: 0x2a0820,
        roughness: 0.6
    });
    const leafMat = new THREE.MeshStandardMaterial({
        color: 0x3fae5a,
        vertexColors: true,
        emissive: 0x0a2010,
        roughness: 0.7,
        side: THREE.DoubleSide
    });
    const nectarMat = new THREE.MeshStandardMaterial({
        color: NECTAR_CALM,
        emissive: NECTAR_CALM,
        emissiveIntensity: 1.6,
        roughness: 0.2
    });
    const faceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25 });

    group.add(new THREE.Mesh(geos.urn, bodyMat));

    const nectar = new THREE.Mesh(geos.nectar, nectarMat);
    nectar.position.z = -0.75 + BODY_SHIFT;
    group.add(nectar);

    const lidPivot = new THREE.Group();
    lidPivot.position.set(1.08, 0, -1.48 + BODY_SHIFT);
    lidPivot.add(new THREE.Mesh(geos.lid, bodyMat));
    group.add(lidPivot);

    const leaves: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
        const leaf = new THREE.Mesh(geos.leaf, leafMat);
        leaf.position.set(side * 1.0, 0, 0.25 + BODY_SHIFT);
        // 0.65 keeps the flapping wing tips inside the r 2.5 hitbox.
        leaf.scale.set(side * 0.65, 0.65, 0.65);
        group.add(leaf);
        leaves.push(leaf);
    }

    const face = new THREE.Mesh(geos.face, faceMat);
    face.position.set(0, 0.78, -0.75 + BODY_SHIFT);
    group.add(face);

    return { group, lid: lidPivot, leaves, nectarMat };
}

/**
 * Pose the minion visuals. `chomp` is the lid phase (radians), `flash` 0..1,
 * `rage` 0..1. Visual only.
 */
export function posePitcherMinion(
    v: ReturnType<typeof buildPitcherMinionVisual>,
    time: number,
    flash: number,
    rage: number
): void {
    const chompRate = 2.2 + rage * 3.5;
    const open = Math.max(0, Math.sin(time * chompRate)) * LID_MAX_OPEN;
    v.lid.rotation.y = -open;
    // Wings sweep in the screen plane (local XZ) with a little lift.
    const flap = Math.sin(time * (7 + rage * 4));
    v.leaves[0].rotation.set(0, -flap * 0.45, flap * 0.15);
    v.leaves[1].rotation.set(0, flap * 0.45, -flap * 0.15);
    v.nectarMat.color.copy(NECTAR_CALM).lerp(NECTAR_RAGE, rage);
    v.nectarMat.emissive.copy(v.nectarMat.color).lerp(FLASH, flash);
    v.nectarMat.emissiveIntensity = 1.4 + Math.sin(time * 4) * 0.3 + open * 0.8 + flash * 3;
}

/** Smaller orbiting pitcher minion — destroying one shaves 10% off the main boss. */
export class PitcherMinion {
    group: THREE.Group;
    orbitAngle: number;
    orbitRadius: number;
    orbitSpeed: number;
    health = 30;
    alive = true;

    private visual: ReturnType<typeof buildPitcherMinionVisual>;
    private flash = 0;
    private rage = 0;
    private phaseOffset: number;
    /** World-space hitbox centre, updated in `update` (the group itself is boss-local). */
    private hitX = 0;
    private hitY = 0;
    private static readonly _x = new THREE.Vector3();
    private static readonly _y = new THREE.Vector3();
    private static readonly _z = new THREE.Vector3();
    private static readonly _basis = new THREE.Matrix4();

    constructor(parent: THREE.Group, index: number, total: number) {
        this.orbitAngle = (index / total) * Math.PI * 2;
        this.orbitRadius = 28 + gameplayRandom('boss') * 12;
        this.orbitSpeed = 0.25 + gameplayRandom('boss') * 0.15;
        this.phaseOffset = index * 1.7;

        this.visual = buildPitcherMinionVisual();
        this.group = this.visual.group;

        parent.add(this.group);
        decorationBudget.reportSpawn('star_eater_minions');
    }

    /**
     * @param center the boss group's world position (the minion's parent)
     * @param raging whether the boss is in its post-minion-kill rage
     */
    update(delta: number, center: THREE.Vector3, time: number, raging = false): void {
        if (!this.alive) return;
        this.orbitAngle += delta * this.orbitSpeed;
        const ox = Math.cos(this.orbitAngle) * this.orbitRadius;
        const oy = Math.sin(this.orbitAngle) * this.orbitRadius * 0.55;
        const oz = Math.sin(time * 0.7 + this.orbitAngle) * 4;

        // Gameplay hitbox: world-space orbit around the boss centre.
        this.hitX = center.x + ox;
        this.hitY = center.y + oy;

        // Visual: the group is a child of the boss group, so it is placed by
        // the offset alone (adding `center` again would double the boss
        // position and float the minion away from its hitbox).
        this.group.position.set(ox, oy, oz);
        // Local basis: +Z toward the boss (mouth points away), +Y toward the
        // camera (world +Z) so the lid and wings swing in the screen plane.
        const z = PitcherMinion._z.set(-ox, -oy, -oz).normalize();
        const y = PitcherMinion._y.set(0, 0, 1).addScaledVector(z, -z.z).normalize();
        const x = PitcherMinion._x.crossVectors(y, z);
        this.group.quaternion.setFromRotationMatrix(PitcherMinion._basis.makeBasis(x, y, z));

        this.flash = Math.max(0, this.flash - delta * 5);
        this.rage += ((raging ? 1 : 0) - this.rage) * Math.min(1, delta * 3);
        posePitcherMinion(this.visual, time + this.phaseOffset, this.flash, this.rage);
        // Recoil wobble on hit.
        this.group.rotateZ(Math.sin(time * 40) * this.flash * 0.3);
    }

    takeDamage(amount: number): boolean {
        if (!this.alive) return false;
        this.health -= amount;
        this.flash = 1;
        if (this.health <= 0) {
            this.alive = false;
            this.group.visible = false;
            decorationBudget.reportDestroy('star_eater_minions');
            return true;
        }
        return false;
    }

    getHitbox(): { x: number; y: number; radius: number } {
        return {
            x: this.hitX,
            y: this.hitY,
            radius: PITCHER_MINION_HITBOX_RADIUS
        };
    }

    destroy(): void {
        if (this.alive) {
            decorationBudget.reportDestroy('star_eater_minions');
            this.alive = false;
        }
    }
}
