import * as THREE from 'three';
import { getSimTime } from './sim_clock';
import {
    getProjectileBoltGeometry,
    getProjectileBoltMaterial,
    getProjectileTrailGeometry,
    getProjectileTrailMaterial,
    PROJECTILE_COLORS,
    type ProjectileKind
} from './pickup_art/upgrade_art';

export type { ProjectileKind } from './pickup_art/upgrade_art';

const _forward = new THREE.Vector3(1, 0, 0);
const _dir = new THREE.Vector3();

/**
 * One pooled player shot. `mesh` is the bolt (its position is what every
 * collision query reads; the 0.5 hitbox radius is the same for every kind).
 * The bolt shape, trail and light colour follow the loadout it was fired
 * with (see `pickup_art/upgrade_art.ts`), so a cryo shot already in flight
 * stays an ice shard after the upgrade ends.
 */
export class Projectile {
    mesh: THREE.Mesh;
    trail: THREE.Mesh;
    light: THREE.PointLight;
    active: boolean = false;
    velocity: THREE.Vector3 = new THREE.Vector3();
    radius: number = 0.5;
    kind: ProjectileKind = 'plasma';
    /** Seconds since spawn (visual: muzzle pop-in, trail growth, flicker). */
    age: number = 0;

    constructor(scene: THREE.Scene) {
        this.mesh = new THREE.Mesh(getProjectileBoltGeometry('plasma'), getProjectileBoltMaterial('plasma'));
        this.mesh.visible = false;

        this.trail = new THREE.Mesh(getProjectileTrailGeometry('plasma'), getProjectileTrailMaterial('plasma'));
        this.trail.renderOrder = 2;
        this.mesh.add(this.trail);

        // Dynamic Point Light
        this.light = new THREE.PointLight(PROJECTILE_COLORS.plasma, 2.0, 50.0);
        this.mesh.add(this.light);

        scene.add(this.mesh);
    }

    setKind(kind: ProjectileKind) {
        if (kind === this.kind) return;
        this.kind = kind;
        this.mesh.geometry = getProjectileBoltGeometry(kind);
        this.mesh.material = getProjectileBoltMaterial(kind);
        this.trail.geometry = getProjectileTrailGeometry(kind);
        this.trail.material = getProjectileTrailMaterial(kind);
        this.light.color.setHex(PROJECTILE_COLORS[kind]);
    }

    spawn(position: THREE.Vector3, velocity: THREE.Vector3, kind: ProjectileKind = this.kind) {
        this.setKind(kind);
        this.active = true;
        this.age = 0;
        this.mesh.position.copy(position);
        this.velocity.copy(velocity);
        // Point the bolt along its flight (aimed shots are not always +X).
        _dir.copy(velocity);
        if (_dir.lengthSq() > 1e-8) this.mesh.quaternion.setFromUnitVectors(_forward, _dir.normalize());
        this.mesh.scale.setScalar(0.4);
        this.trail.scale.set(0.2, 1, 1);
        this.mesh.visible = true;
        this.light.intensity = 2.0;
    }

    deactivate() {
        this.active = false;
        this.mesh.visible = false;
        this.mesh.position.set(0, -1000, 0); // Move away
    }

    update(delta: number) {
        if (!this.active) return;

        this.mesh.position.addScaledVector(this.velocity, delta);
        this.age += delta;

        // Visual: muzzle pop-in, trail grows out behind the bolt.
        const grow = Math.min(1, this.age / 0.06);
        this.mesh.scale.setScalar(0.4 + 0.6 * grow);
        const trailGrow = Math.min(1, this.age / 0.12);
        if (this.kind === 'pyro') {
            const flicker = 0.85 + Math.random() * 0.3; // visual-only
            this.trail.scale.set(trailGrow * flicker, flicker, flicker);
        } else {
            this.trail.scale.set(trailGrow, 1, 1);
        }
        if (this.kind === 'cryo') this.mesh.rotateX(delta * 14); // shard spins on its long axis

        // Flicker light
        this.light.intensity = 1.5 + Math.random(); // visual-only
    }

    setColor(hex: number) {
        this.light.color.setHex(hex);
    }
}

export class WeaponSystem {
    scene: THREE.Scene;
    projectiles: Projectile[] = [];
    poolSize: number = 20;

    /** Loadout the next shot is fired with (set from the active upgrade). */
    currentKind: ProjectileKind = 'plasma';

    // Cooldown logic
    lastFireTime: number = -Infinity;
    fireRate: number = 0.15; // Seconds between shots

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        for (let i = 0; i < this.poolSize; i++) {
            this.projectiles.push(new Projectile(scene));
        }
    }

    /** Select the bolt shape / trail / colour for shots fired from now on. */
    setKind(kind: ProjectileKind) {
        this.currentKind = kind;
    }

    fire(position: THREE.Vector3, forwardDirection: THREE.Vector3) {
        // Sim time, not Date.now(): the cooldown must gate the same shots in a
        // headless replay and at any display refresh rate.
        const now = getSimTime();
        if (now - this.lastFireTime < this.fireRate) return;
        this.lastFireTime = now;

        // Find inactive projectile
        const proj = this.projectiles.find(p => !p.active);
        if (proj) {
            // Velocity: 60 units/sec (fast)
            const speed = 60.0;
            const velocity = forwardDirection.clone().multiplyScalar(speed);

            // Spawn slightly in front of ship
            const spawnPos = position.clone().add(new THREE.Vector3(1.5, -0.2, 0)); // Offset for gun position

            proj.spawn(spawnPos, velocity, this.currentKind);
        }
    }

    update(delta: number, cameraX: number) {
        const limitBack = cameraX - 20;
        const limitFront = cameraX + 80;

        this.projectiles.forEach(p => {
            if (p.active) {
                p.update(delta);

                // Deactivate if off-screen
                if (p.mesh.position.x > limitFront || p.mesh.position.x < limitBack) {
                    p.deactivate();
                }
            }
        });
    }

    getActiveProjectiles(): Projectile[] {
        return this.projectiles.filter(p => p.active);
    }
}
