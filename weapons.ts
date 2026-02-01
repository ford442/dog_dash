import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { color, time, sin, float, vec4, mix, uniform, UniformNode } from 'three/tsl';

/**
 * Creates a TSL material for the plasma bolt.
 * Visuals: Glowing core, pulsing intensity.
 */
function createPlasmaBoltMaterial(uColor: UniformNode<THREE.Color>) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const uTime = time;

    // Simple pulse
    const pulse = sin(uTime.mul(20.0)).add(1.0).mul(0.5); // 0..1 fast pulse

    const baseColor = uColor;
    const white = color(0xffffff);

    // Mix white core with colored edge based on pulse?
    // Or just boost intensity.
    const intensity = float(1.0).add(pulse.mul(0.5));

    mat.colorNode = vec4(baseColor.mul(intensity), 1.0);

    return mat;
}

export class Projectile {
    mesh: THREE.Mesh;
    light: THREE.PointLight;
    active: boolean = false;
    velocity: THREE.Vector3 = new THREE.Vector3();
    radius: number = 0.5;

    constructor(scene: THREE.Scene, material: THREE.Material) {
        // Geometry: Capsule for a bolt shape
        const geometry = new THREE.CapsuleGeometry(0.1, 0.6, 4, 8);
        // Rotate so it points forward (along X)
        geometry.rotateZ(Math.PI / 2);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.visible = false;

        // Dynamic Point Light
        this.light = new THREE.PointLight(0x00ffff, 2.0, 60.0); // Cyan, Intensity 2, Range 60
        this.mesh.add(this.light);

        scene.add(this.mesh);
    }

    spawn(position: THREE.Vector3, velocity: THREE.Vector3) {
        this.active = true;
        this.mesh.position.copy(position);
        this.velocity.copy(velocity);
        this.mesh.visible = true;
        // Reset light intensity just in case
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

        // Flicker light
        this.light.intensity = 1.5 + Math.random();
    }

    setColor(hex: number) {
        this.light.color.setHex(hex);
    }
}

export class WeaponSystem {
    scene: THREE.Scene;
    projectiles: Projectile[] = [];
    poolSize: number = 20;

    // Uniform for shared material color
    uProjectileColor: UniformNode<THREE.Color>;

    // Cooldown logic
    lastFireTime: number = 0;
    fireRate: number = 0.15; // Seconds between shots

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Shared uniform
        this.uProjectileColor = uniform(new THREE.Color(0x00ffff)); // Default Cyan

        const mat = createPlasmaBoltMaterial(this.uProjectileColor);

        for (let i = 0; i < this.poolSize; i++) {
            this.projectiles.push(new Projectile(scene, mat));
        }
    }

    setColor(hex: number) {
        // Update the shared uniform (affects all active projectiles material immediately)
        this.uProjectileColor.value.setHex(hex);

        // Update the lights of all projectiles
        this.projectiles.forEach(p => p.setColor(hex));
    }

    fire(position: THREE.Vector3, forwardDirection: THREE.Vector3) {
        const now = Date.now() / 1000;
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

            proj.spawn(spawnPos, velocity);
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
