import * as THREE from 'three';
import { PASTEL_RAINBOW, STARDUST_COLORS, randomRange, createHeartShape } from './shared';

// =============================================================================
// POOLED PARTICLE BURSTS
//
// Every burst preset draws from a fixed-size pool allocated once at
// construction: one shared geometry per pool plus one long-lived material per
// slot (colour/opacity are written on acquire, never re-created). Nothing here
// allocates geometry, materials or meshes per frame or per spawn.
// =============================================================================

interface PooledParticle {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    velocity: THREE.Vector3;
    rotationAxis: THREE.Vector3;
    rotationSpeed: number;
    life: number;
    maxLife: number;
    gravity: number;
    phase: number;
    active: boolean;
}

/**
 * Fixed pool of meshes sharing one geometry. Slots are recycled; the scene
 * graph only ever sees `capacity` meshes for the lifetime of the pool.
 */
class ParticlePool {
    private readonly scene: THREE.Scene;
    private readonly geometry: THREE.BufferGeometry;
    private readonly particles: PooledParticle[] = [];
    private activeCount = 0;

    constructor(
        scene: THREE.Scene,
        geometry: THREE.BufferGeometry,
        capacity: number,
        materialOptions: THREE.MeshBasicMaterialParameters = {}
    ) {
        this.scene = scene;
        this.geometry = geometry;

        for (let i = 0; i < capacity; i++) {
            const material = new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0,
                ...materialOptions
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            mesh.frustumCulled = false;
            scene.add(mesh);

            this.particles.push({
                mesh,
                material,
                velocity: new THREE.Vector3(),
                rotationAxis: new THREE.Vector3(0, 0, 1),
                rotationSpeed: 0,
                life: 0,
                maxLife: 1,
                gravity: 0,
                phase: 0,
                active: false
            });
        }
    }

    get hasActive(): boolean {
        return this.activeCount > 0;
    }

    /** Grab a free slot, or null when the pool is saturated (hard cap). */
    acquire(): PooledParticle | null {
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.active) {
                p.active = true;
                p.mesh.visible = true;
                p.mesh.rotation.set(0, 0, 0);
                p.mesh.scale.setScalar(1);
                this.activeCount++;
                return p;
            }
        }
        return null;
    }

    release(p: PooledParticle): void {
        if (!p.active) return;
        p.active = false;
        p.mesh.visible = false;
        p.material.opacity = 0;
        this.activeCount--;
    }

    forEachActive(fn: (p: PooledParticle) => void): void {
        for (let i = 0; i < this.particles.length; i++) {
            if (this.particles[i].active) fn(this.particles[i]);
        }
    }

    releaseAll(): void {
        for (let i = 0; i < this.particles.length; i++) {
            this.release(this.particles[i]);
        }
    }

    dispose(): void {
        for (const p of this.particles) {
            this.scene.remove(p.mesh);
            p.material.dispose();
        }
        this.particles.length = 0;
        this.activeCount = 0;
        this.geometry.dispose();
    }
}

function pickColor(palette: readonly number[]): number {
    return palette[Math.floor(Math.random() * palette.length)];
}

// =============================================================================
// CONFETTI BURST
// =============================================================================

const CONFETTI_CAPACITY = 32;

export class ConfettiBurstEffect {
    private pool: ParticlePool;
    private isActive: boolean = false;

    constructor(scene: THREE.Scene) {
        // One shared flake geometry for the whole pool — confetti reads as
        // shape variety through rotation, not through per-particle geometry.
        this.pool = new ParticlePool(
            scene,
            new THREE.PlaneGeometry(0.1, 0.15),
            CONFETTI_CAPACITY,
            { side: THREE.DoubleSide }
        );
    }

    spawn(position: THREE.Vector3, count: number = CONFETTI_CAPACITY): void {
        this.isActive = true;

        const wanted = Math.min(count, CONFETTI_CAPACITY);
        for (let i = 0; i < wanted; i++) {
            const p = this.pool.acquire();
            if (!p) break;

            p.material.color.setHex(pickColor(PASTEL_RAINBOW));
            p.material.opacity = 0.9;

            p.mesh.position.set(
                position.x + randomRange(-0.5, 0.5),
                position.y + randomRange(-0.5, 0.5),
                position.z + randomRange(-0.5, 0.5)
            );

            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 4;
            const elevation = randomRange(-0.5, 1);

            p.velocity.set(
                Math.cos(angle) * speed,
                elevation * speed + 2,
                Math.sin(angle) * speed * 0.5
            );
            p.rotationAxis
                .set(randomRange(-1, 1), randomRange(-1, 1), randomRange(-1, 1))
                .normalize();
            p.rotationSpeed = randomRange(3, 8);
            p.life = 1.5 + Math.random() * 0.5;
            p.maxLife = p.life;
            p.gravity = 2 + Math.random() * 2;
        }
    }

    update(dt: number): boolean {
        if (!this.isActive) return false;

        this.pool.forEachActive((p) => {
            p.life -= dt;
            if (p.life <= 0) {
                this.pool.release(p);
                return;
            }

            p.velocity.y -= p.gravity * dt;
            p.mesh.position.addScaledVector(p.velocity, dt);
            p.mesh.rotateOnAxis(p.rotationAxis, p.rotationSpeed * dt);
            p.material.opacity = Math.min(1, p.life);
        });

        if (!this.pool.hasActive) {
            this.isActive = false;
        }

        return this.isActive;
    }

    destroy(): void {
        this.pool.dispose();
        this.isActive = false;
    }
}

// =============================================================================
// HEART RAIN
// =============================================================================

const HEART_CAPACITY = 24;
const HEART_COLORS = [0xff69b4, 0xff1493, 0xffb6c1, 0xffa0c9];

export class HeartRainEffect {
    private pool: ParticlePool;
    private isActive: boolean = false;
    private spawnTimer: number = 0;
    private duration: number = 5;
    private elapsed: number = 0;

    constructor(scene: THREE.Scene) {
        this.pool = new ParticlePool(
            scene,
            new THREE.ShapeGeometry(createHeartShape(0.15)),
            HEART_CAPACITY,
            { side: THREE.DoubleSide }
        );
    }

    spawn(position: THREE.Vector3, duration: number = 5): void {
        this.isActive = true;
        this.duration = duration;
        this.elapsed = 0;
        this.spawnTimer = 0;
    }

    update(dt: number): boolean {
        if (!this.isActive) return false;

        this.elapsed += dt;

        if (this.elapsed < this.duration) {
            this.spawnTimer += dt;
            if (this.spawnTimer > 0.1) {
                this.spawnHeart();
                this.spawnTimer = 0;
            }
        } else if (!this.pool.hasActive) {
            this.isActive = false;
            return false;
        }

        this.pool.forEachActive((h) => {
            h.life -= dt;
            if (h.life <= 0) {
                this.pool.release(h);
                return;
            }

            h.velocity.y -= h.gravity * dt;
            h.mesh.position.addScaledVector(h.velocity, dt);
            h.mesh.rotation.z += Math.sin(h.life * 3) * 0.02;
            h.material.opacity = Math.min(1, h.life * 2);
        });

        return true;
    }

    private spawnHeart(): void {
        const h = this.pool.acquire();
        if (!h) return;

        h.material.color.setHex(HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)]);
        h.material.opacity = 0.9;

        h.mesh.position.set(randomRange(-8, 8), 10 + randomRange(0, 5), randomRange(-2, 2));
        h.velocity.set(randomRange(-0.5, 0.5), randomRange(-1, -2), 0);
        h.rotationAxis.set(0, 0, 1);
        h.rotationSpeed = randomRange(-1, 1);
        h.life = 3 + Math.random();
        h.maxLife = h.life;
        h.gravity = 0.5;
    }

    destroy(): void {
        this.pool.dispose();
        this.isActive = false;
    }
}

// =============================================================================
// STAR CASCADE
// =============================================================================

const STAR_CAPACITY = 32;

export class StarCascadeEffect {
    private pool: ParticlePool;
    private isActive: boolean = false;
    private spawnTimer: number = 0;
    private duration: number = 5;
    private elapsed: number = 0;

    constructor(scene: THREE.Scene) {
        this.pool = new ParticlePool(
            scene,
            new THREE.OctahedronGeometry(0.1, 0),
            STAR_CAPACITY
        );
    }

    spawn(position: THREE.Vector3, duration: number = 5): void {
        this.isActive = true;
        this.duration = duration;
        this.elapsed = 0;
        this.spawnTimer = 0;
    }

    update(dt: number): boolean {
        if (!this.isActive) return false;

        this.elapsed += dt;

        if (this.elapsed < this.duration) {
            this.spawnTimer += dt;
            // 0.1s cadence against a 32-slot pool keeps the cascade readable
            // without the pool ever saturating.
            if (this.spawnTimer > 0.1) {
                this.spawnStar();
                this.spawnTimer = 0;
            }
        } else if (!this.pool.hasActive) {
            this.isActive = false;
            return false;
        }

        this.pool.forEachActive((s) => {
            s.life -= dt;
            if (s.life <= 0) {
                this.pool.release(s);
                return;
            }

            s.mesh.position.addScaledVector(s.velocity, dt);
            s.velocity.y -= s.gravity * dt;
            s.mesh.rotation.z += s.rotationSpeed * dt;

            const twinkle = 0.5 + Math.sin(s.life * 10) * 0.5;
            s.material.opacity = Math.min(1, s.life * twinkle);
        });

        return true;
    }

    private spawnStar(): void {
        const s = this.pool.acquire();
        if (!s) return;

        s.material.color.setHex(pickColor(STARDUST_COLORS));
        s.material.opacity = 0.9;

        s.mesh.position.set(randomRange(-10, 10), 12, randomRange(-3, 3));
        s.velocity.set(randomRange(-1, 1), randomRange(-3, -5), randomRange(-0.5, 0.5));
        s.rotationAxis.set(0, 0, 1);
        s.rotationSpeed = randomRange(3, 8);
        s.life = 2 + Math.random();
        s.maxLife = s.life;
        s.gravity = 1;
    }

    destroy(): void {
        this.pool.dispose();
        this.isActive = false;
    }
}

// =============================================================================
// SPARKLE FIELD
// =============================================================================

const SPARKLE_CAPACITY = 24;

export class SparkleFieldEffect {
    private pool: ParticlePool;
    private isActive: boolean = false;
    private duration: number = 5;
    private elapsed: number = 0;
    private centerPosition: THREE.Vector3 = new THREE.Vector3();

    constructor(scene: THREE.Scene) {
        this.pool = new ParticlePool(
            scene,
            new THREE.OctahedronGeometry(0.07, 0),
            SPARKLE_CAPACITY
        );
    }

    spawn(position: THREE.Vector3, duration: number = 5): void {
        this.isActive = true;
        this.duration = duration;
        this.elapsed = 0;
        this.centerPosition.copy(position);

        for (let i = 0; i < SPARKLE_CAPACITY; i++) {
            this.createSparkle();
        }
    }

    update(dt: number): boolean {
        if (!this.isActive) return false;

        this.elapsed += dt;

        if (this.elapsed >= this.duration) {
            this.pool.forEachActive((s) => {
                s.material.opacity -= dt;
                if (s.material.opacity <= 0) {
                    this.pool.release(s);
                }
            });

            if (!this.pool.hasActive) {
                this.isActive = false;
                return false;
            }
        } else {
            this.pool.forEachActive((s) => {
                s.mesh.rotation.z += dt * 2;
                s.material.opacity = 0.3 + Math.sin(this.elapsed * 5 + s.phase) * 0.3;
                s.mesh.position.x += Math.sin(this.elapsed + s.phase) * dt * 0.5;
                s.mesh.position.y += Math.cos(this.elapsed + s.phase) * dt * 0.3;
            });
        }

        return true;
    }

    private createSparkle(): void {
        const s = this.pool.acquire();
        if (!s) return;

        s.material.color.setHex(pickColor(STARDUST_COLORS));
        s.material.opacity = 0.5;

        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 5;
        s.mesh.position.set(
            this.centerPosition.x + Math.cos(angle) * radius,
            this.centerPosition.y + Math.sin(angle) * radius * 0.6,
            this.centerPosition.z + randomRange(-2, 2)
        );
        // Size variety without a second geometry.
        s.mesh.scale.setScalar(0.7 + Math.random() * 0.7);
        s.phase = Math.random() * Math.PI * 2;
        s.life = Number.POSITIVE_INFINITY;
        s.maxLife = s.life;
    }

    destroy(): void {
        this.pool.dispose();
        this.isActive = false;
    }
}
