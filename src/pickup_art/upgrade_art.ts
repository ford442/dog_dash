/**
 * Weapon-upgrade emblems and projectile shapes.
 *
 * One silhouette per upgrade, used for the world pickup *and* the three icons
 * orbiting the player, plus one bolt + trail per loadout so the shots alone
 * say what you are firing:
 *
 * | upgrade  | emblem (pickup / orbit icon)      | bolt                          | trail                     |
 * |----------|-----------------------------------|-------------------------------|---------------------------|
 * | (none)   | –                                 | plasma capsule                | soft cyan taper           |
 * | `cryo`   | six-armed snowflake               | spinning hexagonal ice shard  | frost taper + ice flecks  |
 * | `pyro`   | three-tongued flame               | fireball with trailing tongues| wide flickering flame     |
 * | `rapid`  | fan of three lightning bolts      | short bolt + two pellets      | short stream              |
 * | `pierce` | barbed arrow with fletching       | long needle with guide rings  | long thin streak          |
 *
 * Emblems face +Z (the camera) and fit inside radius ~0.6, so the pickup keeps
 * its old footprint; collection still uses the 1.5u distance check in
 * `PickupManager`. Bolts point +X; the projectile hitbox (0.5 radius query in
 * `loop_combat/weapons.ts`) is unchanged.
 *
 * All geometry is shared (`markShared`) and built once; visual-only.
 */

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { color, float, sin, time, vec4 } from 'three/tsl';
import { markShared, noteMaterialCreated } from '../gpu_resources';
import { mergeKitParts, placed, type KitPart } from '../hazard_art/kit';
import { arrowheadShape, boltShape, extrudeShape, flameShape, sharedGeometry, vaneShape } from './shapes';

export type WeaponUpgradeId = 'cryo' | 'pyro' | 'rapid' | 'pierce';
export type ProjectileKind = 'plasma' | WeaponUpgradeId;

export const WEAPON_UPGRADE_IDS: readonly WeaponUpgradeId[] = ['cryo', 'pyro', 'rapid', 'pierce'];
export const PROJECTILE_KINDS: readonly ProjectileKind[] = ['plasma', 'cryo', 'pyro', 'rapid', 'pierce'];

/** Bolt colour per loadout (matches `UPGRADE_CONFIGS[*].color`; plasma is the default cyan). */
export const PROJECTILE_COLORS: Record<ProjectileKind, number> = {
    plasma: 0x00ffff,
    cryo: 0x66e8ff,
    pyro: 0xff5a10,
    rapid: 0xffe23a,
    pierce: 0xff3cf0
};

const tmp = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);

function lerpHex(a: number, b: number, t: number): THREE.Color {
    return tmp.set(a).lerp(new THREE.Color(b), THREE.MathUtils.clamp(t, 0, 1)).clone();
}

// ---------------------------------------------------------------------------
// Emblems
// ---------------------------------------------------------------------------

function buildSnowflake(): THREE.BufferGeometry {
    const parts: KitPart[] = [];
    const ice = (p: THREE.Vector3) => lerpHex(0x7fe8ff, 0xffffff, Math.hypot(p.x, p.y) / 0.55);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const arm = new THREE.BoxGeometry(0.46, 0.075, 0.09);
        arm.translate(0.25, 0, 0);
        arm.rotateZ(a);
        parts.push({ geometry: arm, tint: ice, flat: true });
        for (const side of [-1, 1]) {
            for (const [r, len] of [[0.2, 0.15], [0.34, 0.11]] as const) {
                const twig = new THREE.BoxGeometry(len, 0.05, 0.07);
                twig.translate(len / 2, 0, 0);
                twig.rotateZ(side * Math.PI / 3.2);
                twig.translate(r, 0, 0);
                twig.rotateZ(a);
                parts.push({ geometry: twig, tint: ice, flat: true });
            }
        }
        const tip = new THREE.OctahedronGeometry(0.065, 0);
        tip.translate(0.5, 0, 0);
        tip.rotateZ(a);
        parts.push({ geometry: tip, tint: WHITE, flat: true });
    }
    const hub = new THREE.CylinderGeometry(0.13, 0.13, 0.13, 6);
    hub.rotateX(Math.PI / 2);
    parts.push({ geometry: hub, tint: new THREE.Color(0xd8fbff), flat: true });
    return mergeKitParts(parts);
}

function buildFlame(): THREE.BufferGeometry {
    const outer = (p: THREE.Vector3) => lerpHex(0xff2a00, 0xffb000, (p.y + 0.5) / 0.95);
    const inner = (p: THREE.Vector3) => lerpHex(0xffd23a, 0xfffbe0, (p.y + 0.3) / 0.6);
    return mergeKitParts([
        { geometry: placed(extrudeShape(flameShape(), 0.14), [0, 0.02, 0], [0, 0, 0], [1.05, 1.1, 1]), tint: outer },
        { geometry: placed(extrudeShape(flameShape(), 0.1), [0, -0.12, 0.08], [0, 0, 0], [0.55, 0.62, 1]), tint: inner },
        { geometry: placed(extrudeShape(flameShape(), 0.1), [0, -0.12, -0.08], [0, 0, 0], [0.55, 0.62, 1]), tint: inner }
    ]);
}

function buildTripleBolt(): THREE.BufferGeometry {
    const parts: KitPart[] = [];
    const bolt = (p: THREE.Vector3) => lerpHex(0xff9a00, 0xfff7a0, (p.y + 0.4) / 0.8);
    const layout: Array<[number, number, number, number]> = [
        // x, y, tilt, scale
        [-0.3, -0.04, 0.3, 0.6],
        [0.0, 0.06, 0.0, 0.72],
        [0.3, -0.04, -0.3, 0.6]
    ];
    for (const [x, y, tilt, s] of layout) {
        parts.push({ geometry: placed(extrudeShape(boltShape(), 0.16), [x, y, 0], [0, 0, tilt], [s, s, 1]), tint: bolt });
    }
    return mergeKitParts(parts);
}

function buildArrow(): THREE.BufferGeometry {
    const shaft = new THREE.CylinderGeometry(0.035, 0.035, 0.78, 8);
    shaft.rotateZ(Math.PI / 2);
    shaft.translate(-0.05, 0, 0);
    const vane = (y: number, flip: number) =>
        placed(extrudeShape(vaneShape(), 0.06, 0.01), [-0.36, y, 0], [0, 0, 0], [0.3, 0.3 * flip, 1]);
    return mergeKitParts([
        { geometry: shaft, tint: new THREE.Color(0xf4e8ff) },
        { geometry: placed(extrudeShape(arrowheadShape(), 0.12), [0.42, 0, 0], [0, 0, 0], [0.32, 0.36, 1]), tint: (p) => lerpHex(0xff2ad8, 0xffc8f6, (p.x - 0.26) / 0.3) },
        { geometry: vane(0.01, 1), tint: new THREE.Color(0xff7ae6), flat: true },
        { geometry: vane(-0.01, -1), tint: new THREE.Color(0xff7ae6), flat: true }
    ]);
}

const EMBLEM_BUILDERS: Record<WeaponUpgradeId, () => THREE.BufferGeometry> = {
    cryo: buildSnowflake,
    pyro: buildFlame,
    rapid: buildTripleBolt,
    pierce: buildArrow
};

/** Shared emblem geometry (faces +Z, radius ~0.55). */
export function getUpgradeEmblemGeometry(id: WeaponUpgradeId): THREE.BufferGeometry {
    return sharedGeometry(`upgrade_emblem_${id}`, EMBLEM_BUILDERS[id]);
}

/** Thin token ring that marks the emblem as a pickup (same language for all four). */
export function getUpgradeRingGeometry(id: WeaponUpgradeId, hex: number): THREE.BufferGeometry {
    return sharedGeometry(`upgrade_ring_${id}`, () => {
        const ring = new THREE.TorusGeometry(0.66, 0.045, 8, 40);
        const notches: KitPart[] = [];
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            notches.push({
                geometry: placed(new THREE.SphereGeometry(0.075, 8, 6), [Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0]),
                tint: WHITE
            });
        }
        return mergeKitParts([{ geometry: ring, tint: new THREE.Color(hex) }, ...notches]);
    });
}

const orbitMaterials = new Map<WeaponUpgradeId, THREE.MeshStandardMaterial>();

/** Emblem material: vertex colours + the upgrade's emissive. `shared` for the orbit icons. */
export function createUpgradeEmblemMaterial(hex: number): THREE.MeshStandardMaterial {
    noteMaterialCreated();
    return new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: hex,
        emissiveIntensity: 0.55,
        roughness: 0.28,
        metalness: 0.15
    });
}

export function getOrbitIconMaterial(id: WeaponUpgradeId, hex: number): THREE.MeshStandardMaterial {
    let mat = orbitMaterials.get(id);
    if (!mat) {
        mat = markShared(createUpgradeEmblemMaterial(hex));
        mat.emissiveIntensity = 0.9;
        orbitMaterials.set(id, mat);
    }
    return mat;
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

/** Brighten toward white where the surface faces the camera (+Z): a hot core. */
function coreTint(hex: number, core = 0.85) {
    const c = new THREE.Color(hex);
    return (_p: THREE.Vector3, n: THREE.Vector3) => tmp.copy(c).lerp(WHITE, Math.pow(Math.abs(n.z), 1.5) * core).clone();
}

function latheAlongX(profile: Array<[number, number]>, segments: number): THREE.BufferGeometry {
    // Lathe revolves around Y; profile is [radius, y]. Rotate so +Y becomes +X.
    const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
    geo.rotateZ(-Math.PI / 2);
    return geo;
}

function buildBolt(kind: ProjectileKind): THREE.BufferGeometry {
    const hex = PROJECTILE_COLORS[kind];
    switch (kind) {
        case 'cryo': {
            const shard = (): THREE.BufferGeometry => latheAlongX([[0, -0.36], [0.1, -0.18], [0.12, 0.12], [0, 0.42]], 6);
            return mergeKitParts([
                { geometry: shard(), tint: coreTint(hex, 0.9), flat: true },
                { geometry: placed(shard(), [-0.12, 0.07, 0], [0, 0, 0.5], [0.45, 0.45, 0.45]), tint: coreTint(hex, 0.6), flat: true },
                { geometry: placed(shard(), [-0.12, -0.07, 0], [0, 0, -0.5], [0.45, 0.45, 0.45]), tint: coreTint(hex, 0.6), flat: true }
            ]);
        }
        case 'pyro': {
            const parts: KitPart[] = [
                { geometry: placed(new THREE.SphereGeometry(0.21, 14, 10), [0.12, 0, 0]), tint: coreTint(0xffc040, 0.9) }
            ];
            const tongues: Array<[number, number, number]> = [[0, 0, 0.5], [0.09, 0.05, 0.34], [-0.09, -0.04, 0.36]];
            for (const [y, z, len] of tongues) {
                const tongue = new THREE.ConeGeometry(0.11, len, 8);
                tongue.rotateZ(Math.PI / 2); // apex toward -X
                tongue.translate(-len / 2 + 0.02, y, z);
                parts.push({ geometry: tongue, tint: (p) => lerpHex(0xffa020, 0xff2200, -p.x / 0.45) });
            }
            return mergeKitParts(parts);
        }
        case 'rapid': {
            const pellet = new THREE.CapsuleGeometry(0.065, 0.2, 3, 8);
            pellet.rotateZ(Math.PI / 2);
            return mergeKitParts([
                { geometry: pellet, tint: coreTint(hex) },
                { geometry: placed(new THREE.SphereGeometry(0.055, 8, 6), [-0.3, 0, 0]), tint: coreTint(hex, 0.5) },
                { geometry: placed(new THREE.SphereGeometry(0.04, 8, 6), [-0.45, 0, 0]), tint: coreTint(hex, 0.3) }
            ]);
        }
        case 'pierce': {
            const ring = (x: number) => {
                const r = new THREE.TorusGeometry(0.085, 0.018, 6, 16);
                r.rotateY(Math.PI / 2);
                r.translate(x, 0, 0);
                return r;
            };
            return mergeKitParts([
                { geometry: latheAlongX([[0, -0.75], [0.035, -0.7], [0.035, 0.25], [0.06, 0.3], [0, 0.75]], 8), tint: coreTint(hex) },
                { geometry: ring(-0.15), tint: WHITE },
                { geometry: ring(-0.42), tint: WHITE }
            ]);
        }
        case 'plasma':
        default: {
            const capsule = new THREE.CapsuleGeometry(0.1, 0.6, 4, 8);
            capsule.rotateZ(Math.PI / 2);
            return mergeKitParts([{ geometry: capsule, tint: coreTint(hex) }]);
        }
    }
}

const TRAILS: Record<ProjectileKind, { length: number; radius: number }> = {
    plasma: { length: 1.2, radius: 0.09 },
    cryo: { length: 1.4, radius: 0.1 },
    pyro: { length: 1.3, radius: 0.24 },
    rapid: { length: 0.6, radius: 0.06 },
    pierce: { length: 2.4, radius: 0.035 }
};

function buildTrail(kind: ProjectileKind): THREE.BufferGeometry {
    const { length, radius } = TRAILS[kind];
    const hex = PROJECTILE_COLORS[kind];
    const fade = (p: THREE.Vector3) => tmp.set(hex).multiplyScalar(Math.pow(1 - THREE.MathUtils.clamp(-p.x / length, 0, 1), 1.6)).clone();
    const cone = new THREE.ConeGeometry(radius, length, 10, 4, true);
    cone.rotateZ(Math.PI / 2); // apex toward -X
    cone.translate(-length / 2, 0, 0);
    const parts: KitPart[] = [{ geometry: cone, tint: fade }];
    if (kind === 'cryo') {
        for (let i = 0; i < 4; i++) {
            const x = -0.3 - i * 0.3;
            const y = (i % 2 === 0 ? 1 : -1) * 0.09;
            parts.push({ geometry: placed(new THREE.OctahedronGeometry(0.045 - i * 0.006, 0), [x, y, 0]), tint: fade, flat: true });
        }
    }
    return mergeKitParts(parts);
}

export function getProjectileBoltGeometry(kind: ProjectileKind): THREE.BufferGeometry {
    return sharedGeometry(`projectile_bolt_${kind}`, () => buildBolt(kind));
}

export function getProjectileTrailGeometry(kind: ProjectileKind): THREE.BufferGeometry {
    return sharedGeometry(`projectile_trail_${kind}`, () => buildTrail(kind));
}

export function projectileTrailLength(kind: ProjectileKind): number {
    return TRAILS[kind].length;
}

const boltMaterials = new Map<ProjectileKind, THREE.Material>();
const trailMaterials = new Map<ProjectileKind, THREE.Material>();

/**
 * Opaque, unlit, pulsing bolt material (opaque so the bolt keeps a
 * silhouette; the trail carries the additive glow). Shared per kind.
 */
export function getProjectileBoltMaterial(kind: ProjectileKind): THREE.Material {
    let mat = boltMaterials.get(kind);
    if (!mat) {
        const m = new MeshBasicNodeMaterial({ vertexColors: true });
        const rate = kind === 'pyro' ? 31 : kind === 'rapid' ? 26 : 20;
        const pulse = sin(time.mul(rate)).add(1.0).mul(0.5);
        m.colorNode = vec4(color(0xffffff).mul(float(1.0).add(pulse.mul(0.35))), 1.0);
        mat = markShared(m);
        noteMaterialCreated();
        boltMaterials.set(kind, mat);
    }
    return mat;
}

export function getProjectileTrailMaterial(kind: ProjectileKind): THREE.Material {
    let mat = trailMaterials.get(kind);
    if (!mat) {
        const m = new MeshBasicNodeMaterial({
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const pulse = sin(time.mul(kind === 'pyro' ? 37 : 14)).add(1.0).mul(0.5);
        m.colorNode = vec4(color(0xffffff).mul(float(0.85).add(pulse.mul(0.3))), 1.0);
        mat = markShared(m);
        noteMaterialCreated();
        trailMaterials.set(kind, mat);
    }
    return mat;
}

/** Map an upgrade (or `'none'`) to the bolt it fires. */
export function projectileKindForUpgrade(upgrade: string): ProjectileKind {
    return (WEAPON_UPGRADE_IDS as readonly string[]).includes(upgrade) ? (upgrade as WeaponUpgradeId) : 'plasma';
}
