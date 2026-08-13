import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { ParticleSystem, DebrisSystem } from '../particles';
import {
    CandyType,
    CandyFlavor,
    CANDY_COLORS,
    CollisionResult,
    GummyRingCollisionResult,
    CandyShard,
    SugarSparkle
} from './shared';
import { CandyAsteroid } from './candy_asteroid';
import { GummyRing } from './gummy_ring';
import { biomeNoise } from '../biome_noise';

// Below this chunk-noise sample, a candidate spawn is skipped — carves organic
// gaps into the belt instead of a flat Poisson scatter (C++ fractalNoise2D
// under VITE_CPP_WASM=true, JS value-noise fallback otherwise).
const CANDY_GAP_THRESHOLD = 0.32;

export class CandyBeltManager {
    private scene: THREE.Scene;
    private audio: AudioSystem;
    private particles: ParticleSystem;
    private debris: DebrisSystem;
    
    private candies: CandyAsteroid[] = [];
    private gummyRings: GummyRing[] = [];
    private shards: CandyShard[] = [];
    private sparkles: SugarSparkle[] = [];
    
    // Instanced meshes for performance
    private shardMesh: THREE.InstancedMesh | null = null;
    private sparkleMesh: THREE.InstancedMesh | null = null;
    
    // Configuration
    private beltLength: number = 0;
    private beltStartX: number = 0;

    constructor(
        scene: THREE.Scene,
        audio: AudioSystem,
        particles: ParticleSystem,
        debris?: DebrisSystem
    ) {
        this.scene = scene;
        this.audio = audio;
        this.particles = particles;
        this.debris = debris || null as any;
        
        this.initShardMesh();
        this.initSparkleMesh();
    }

    private initShardMesh() {
        const geometry = new THREE.TetrahedronGeometry(0.15, 0);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.3,
            emissive: 0xffffff,
            emissiveIntensity: 0.5
        });
        
        this.shardMesh = new THREE.InstancedMesh(geometry, material, 200);
        this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.shardMesh.count = 0;
        this.scene.add(this.shardMesh);
    }

    private initSparkleMesh() {
        const geometry = new THREE.OctahedronGeometry(0.08, 0);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        });
        
        this.sparkleMesh = new THREE.InstancedMesh(geometry, material, 300);
        this.sparkleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.sparkleMesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(300 * 3), 3
        );
        this.sparkleMesh.count = 0;
        this.scene.add(this.sparkleMesh);
    }

    // ========================================================================
    // GENERATION
    // ========================================================================

    generateCandyBelt(
        startX: number,
        length: number,
        density: number,
        zBand: { min: number; max: number } = { min: -7.5, max: 7.5 }
    ): void {
        this.beltLength = length;
        this.beltStartX = startX;

        const count = Math.floor(length * density);
        let spawned = 0;

        for (let i = 0; i < count; i++) {
            const x = startX + Math.random() * length;
            if (biomeNoise.sample(x, 'candy') < CANDY_GAP_THRESHOLD) continue; // organic belt gap

            const y = (Math.random() - 0.5) * 28;
            const z = zBand.min + Math.random() * (zBand.max - zBand.min);

            const type = this.getRandomCandyType();
            const flavor = this.getRandomFlavor();

            this.spawnCandyAsteroid(x, y, z, type, flavor);
            spawned++;
        }

        console.log(`🍭 Generated candy belt with ${spawned}/${count} sweet treats (biome-noise gaps, ${biomeNoise.backend}) along x=${startX.toFixed(0)}..${(startX + length).toFixed(0)}`);
    }

    /**
     * Scatter gummy hoops along the belt — lower density than loose candy asteroids.
     */
    generateGummyRings(
        startX: number,
        length: number,
        density: number,
        zBand: { min: number; max: number } = { min: -5, max: 5 }
    ): void {
        const count = Math.max(1, Math.floor(length * density * 0.12));
        for (let i = 0; i < count; i++) {
            const x = startX + 40 + Math.random() * (length - 60);
            const y = (Math.random() - 0.5) * 22;
            const z = zBand.min + Math.random() * (zBand.max - zBand.min);
            this.spawnGummyRing(x, y, z);
        }
    }

    spawnGummyRing(x: number, y: number, z: number = 0, flavor?: CandyFlavor): GummyRing {
        const ring = new GummyRing(this.scene, x, y, z, flavor || this.getRandomFlavor());
        this.gummyRings.push(ring);
        return ring;
    }

    spawnCandyAsteroid(
        x: number,
        y: number,
        z: number = 0,
        type?: CandyType,
        flavor?: CandyFlavor
    ): CandyAsteroid {
        const candyType = type || this.getRandomCandyType();
        const candyFlavor = flavor || this.getRandomFlavor();
        
        const position = new THREE.Vector3(x, y, z);
        const candy = new CandyAsteroid(candyType, position, candyFlavor, this.scene);
        
        this.scene.add(candy.mesh);
        this.candies.push(candy);
        
        return candy;
    }

    private getRandomCandyType(): CandyType {
        const types = Object.values(CandyType);
        const weights = [0.3, 0.25, 0.3, 0.15]; // Gummy, Lollipop, Jellybean, CottonCandy
        
        const rand = Math.random();
        let cumulative = 0;
        
        for (let i = 0; i < types.length; i++) {
            cumulative += weights[i];
            if (rand < cumulative) {
                return types[i];
            }
        }
        
        return CandyType.GUMMY;
    }

    private getRandomFlavor(): CandyFlavor {
        const flavors = Object.values(CandyFlavor);
        return flavors[Math.floor(Math.random() * flavors.length)];
    }

    getCandyColorScheme(): Record<string, number> {
        return {
            pink: CANDY_COLORS[CandyFlavor.STRAWBERRY].primary,
            mint: CANDY_COLORS[CandyFlavor.LIME].primary,
            lavender: CANDY_COLORS[CandyFlavor.GRAPE].primary,
            peach: CANDY_COLORS[CandyFlavor.ORANGE].primary,
            lemon: CANDY_COLORS[CandyFlavor.LEMON].primary,
            sky: CANDY_COLORS[CandyFlavor.BLUEBERRY].primary
        };
    }

    // ========================================================================
    // COLLISIONS
    // ========================================================================

    checkCollisions(playerPos: THREE.Vector3, radius: number): CollisionResult[] {
        const results: CollisionResult[] = [];
        
        for (const candy of this.candies) {
            if (!candy.active) continue;
            
            const dist = candy.position.distanceTo(playerPos);
            const combinedRadius = candy.radius + radius;
            
            if (dist < combinedRadius) {
                const result = this.handleCollision(candy, playerPos, radius);
                if (result) {
                    results.push(result);
                }
            }
        }
        
        return results;
    }

    /**
     * Gummy ring fly-through, graze, and threading checks (2D YZ torus approx).
     */
    checkGummyRingCollisions(
        playerPos: THREE.Vector3,
        playerRadius: number,
        prevPlayerX: number
    ): GummyRingCollisionResult[] {
        const results: GummyRingCollisionResult[] = [];

        for (const ring of this.gummyRings) {
            if (!ring.active) continue;

            const radial = ring.radialDistTo(playerPos);
            const crossed = prevPlayerX < ring.position.x - 0.3 && playerPos.x >= ring.position.x - 0.3;

            // Thread the needle — flew through the center hole
            if (crossed && !ring.threadAwarded && radial < ring.innerRadius - playerRadius * 0.5) {
                ring.threadAwarded = true;
                ring.triggerSquash(0.7);
                this.audio.play('twinkle', 0.7);
                this.particles.emit(
                    ring.position.clone(),
                    ring.getCandyColor(),
                    14,
                    4.5,
                    0.6,
                    1.2
                );
                this.particles.emit(ring.position.clone(), 0xffffff, 8, 3.0, 0.5, 0.9);
                results.push({ ring, type: 'thread', score: 75 });
                continue;
            }

            // Graze the ring tube — bouncy deformation, no damage
            const grazeBand = radial >= ring.innerRadius - playerRadius * 0.2
                && radial <= ring.outerRadius + playerRadius * 0.35;
            const nearX = Math.abs(playerPos.x - ring.position.x) < ring.outerRadius + 1.5;

            if (nearX && grazeBand) {
                ring.triggerSquash(1);
                this.audio.play('boing', 0.55);
                this.particles.emit(
                    ring.position.clone(),
                    ring.getCandyColor(),
                    6,
                    2.5,
                    0.4,
                    0.7
                );
                const bounceDir = new THREE.Vector3(0, playerPos.y - ring.position.y, 0);
                if (bounceDir.lengthSq() < 0.01) bounceDir.set(0, 1, 0);
                bounceDir.normalize().multiplyScalar(5);
                results.push({ ring, type: 'graze', bounceForce: bounceDir });
            }
        }

        return results;
    }

    /**
     * Projectiles wobble or destroy gummy rings; destroyed rings split into jellybeans.
     */
    checkGummyRingProjectiles(
        projectiles: { mesh: THREE.Object3D; active: boolean; deactivate(): void }[]
    ): GummyRingCollisionResult[] {
        const results: GummyRingCollisionResult[] = [];

        for (const ring of this.gummyRings) {
            if (!ring.active) continue;

            for (const proj of projectiles) {
                if (!proj.active) continue;
                const radial = ring.radialDistTo(proj.mesh.position);
                const nearTube = radial >= ring.innerRadius * 0.85 && radial <= ring.outerRadius + 0.4;
                const nearX = Math.abs(proj.mesh.position.x - ring.position.x) < ring.outerRadius + 0.8;

                if (!nearX || !nearTube) continue;

                proj.deactivate();
                ring.triggerSquash(1.5);
                this.audio.play('boing', 0.8);
                this.particles.emit(
                    ring.position.clone(),
                    ring.getCandyColor(),
                    10,
                    3.5,
                    0.5,
                    1.0
                );

                if (ring.takeDamage()) {
                    this.popRingIntoJellybeans(ring);
                    results.push({ ring, type: 'destroyed', score: 25 });
                }
                break;
            }
        }

        return results;
    }

    private popRingIntoJellybeans(ring: GummyRing): void {
        const color = ring.getCandyColor();
        this.particles.emit(ring.position.clone(), color, 18, 5.0, 0.7, 1.4);
        this.particles.emit(ring.position.clone(), 0xffffff, 10, 3.0, 0.5, 0.9);
        this.audio.play('heart_pop', 0.65);

        const flavors = Object.values(CandyFlavor);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const offset = new THREE.Vector3(
                Math.cos(angle) * 0.6,
                Math.sin(angle) * 0.6,
                (Math.random() - 0.5) * 0.4
            );
            const pos = ring.position.clone().add(offset);
            this.spawnCandyAsteroid(pos.x, pos.y, pos.z, CandyType.JELLYBEAN, flavors[i % flavors.length]);
        }

        ring.destroy();
        const idx = this.gummyRings.indexOf(ring);
        if (idx > -1) this.gummyRings.splice(idx, 1);
    }

    cleanupGummyRingsBehind(playerX: number, buffer: number = 70): void {
        for (let i = this.gummyRings.length - 1; i >= 0; i--) {
            const ring = this.gummyRings[i];
            if (ring.position.x < playerX - buffer) {
                ring.destroy();
                this.gummyRings.splice(i, 1);
            }
        }
    }

    private handleCollision(
        candy: CandyAsteroid,
        playerPos: THREE.Vector3,
        playerRadius: number
    ): CollisionResult | null {
        
        switch (candy.candyType) {
            case CandyType.GUMMY:
            case CandyType.JELLYBEAN:
                // Bouncy collision - no damage, fun wobble!
                candy.wobble();
                
                // Calculate bounce direction
                const bounceDir = new THREE.Vector3()
                    .subVectors(playerPos, candy.position)
                    .normalize();
                bounceDir.y = Math.abs(bounceDir.y) + 0.3; // Always bounce up a bit
                
                // Play boing sound
                this.audio.play('boing', 0.7);
                
                // Emit giggle particles
                this.particles.emit(
                    candy.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
                    candy.getCandyColor(),
                    5,
                    2.0,
                    0.5,
                    0.8
                );
                
                return {
                    candy,
                    type: 'bouncy',
                    response: {
                        bounceForce: bounceDir.multiplyScalar(8),
                        particles: true,
                        sound: 'boing'
                    }
                };

            case CandyType.COTTON_CANDY:
                // Dissolve through - no damage, just delicious!
                if (!candy.isDissolving) {
                    candy.dissolve();
                    
                    // Play gentle dissolve sound
                    this.audio.playMagicSound('collect');
                    
                    // Create sugar sparkles
                    this.createSugarSparkles(candy.position, candy.getCandyColor());
                    
                    return {
                        candy,
                        type: 'collectible',
                        response: {
                            particles: true,
                            sound: 'sparkle'
                        }
                    };
                }
                return null;

            case CandyType.LOLLIPOP:
                // Hard candy - damage!
                this.shatterCandy(candy);
                
                // Play crunch sound
                this.audio.play('hit', 0.8);
                
                return {
                    candy,
                    type: 'damage',
                    response: {
                        particles: true,
                        sound: 'hit'
                    }
                };
        }
        
        return null;
    }

    private shatterCandy(candy: CandyAsteroid): void {
        const velocities = candy.shatter();
        const color = candy.getCandyColor();
        
        // Create candy shards
        velocities.forEach((vel) => {
            this.shards.push({
                position: candy.position.clone().add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * candy.radius,
                        (Math.random() - 0.5) * candy.radius,
                        (Math.random() - 0.5) * candy.radius
                    )
                ),
                velocity: vel,
                rotation: new THREE.Vector3(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                ),
                rotSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    0
                ),
                life: 1.5 + Math.random(),
                maxLife: 2.0,
                size: 0.1 + Math.random() * 0.15,
                color: new THREE.Color(color)
            });
        });
        
        // Emit candy particles
        this.particles.emit(
            candy.position,
            color,
            15,
            4.0,
            0.8,
            1.2
        );
        
        // Remove the candy
        candy.destroy();
        const idx = this.candies.indexOf(candy);
        if (idx > -1) {
            this.candies.splice(idx, 1);
        }
    }

    private createSugarSparkles(position: THREE.Vector3, colorHex: number): void {
        const color = new THREE.Color(colorHex);
        
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            
            this.sparkles.push({
                position: position.clone().add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2
                    )
                ),
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed,
                    Math.abs(Math.sin(angle)) * speed + 1,
                    (Math.random() - 0.5) * speed
                ),
                life: 1.0 + Math.random() * 0.5,
                maxLife: 1.5,
                size: 0.05 + Math.random() * 0.1,
                color: color.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.2)
            });
        }
    }

    // ========================================================================
    // UPDATE
    // ========================================================================

    update(dt: number, playerX?: number): void {
        // Update candies
        for (const candy of this.candies) {
            candy.update(dt);
        }

        for (const ring of this.gummyRings) {
            ring.update(dt);
        }

        if (playerX !== undefined) {
            this.cleanupGummyRingsBehind(playerX);
        }
        
        // Cleanup inactive candies
        for (let i = this.candies.length - 1; i >= 0; i--) {
            if (!this.candies[i].active) {
                this.candies[i].destroy();
                this.candies.splice(i, 1);
            }
        }
        
        // Update shards
        this.updateShards(dt);
        
        // Update sparkles
        this.updateSparkles(dt);
    }

    private updateShards(dt: number): void {
        if (!this.shardMesh) return;
        
        const dummy = new THREE.Object3D();
        const _color = new THREE.Color();
        
        for (let i = this.shards.length - 1; i >= 0; i--) {
            const shard = this.shards[i];
            shard.life -= dt;
            
            if (shard.life <= 0) {
                this.shards.splice(i, 1);
                continue;
            }
            
            // Physics
            shard.position.addScaledVector(shard.velocity, dt);
            shard.velocity.y -= 5.0 * dt; // Gravity
            
            // Rotation
            shard.rotation.x += shard.rotSpeed.x * dt;
            shard.rotation.y += shard.rotSpeed.y * dt;
            
            // Scale based on life
            const lifeRatio = shard.life / shard.maxLife;
            const scale = shard.size * Math.max(0.3, lifeRatio);
            
            dummy.position.copy(shard.position);
            dummy.rotation.set(shard.rotation.x, shard.rotation.y, 0);
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            
            if (i < this.shardMesh.count) {
                this.shardMesh.setMatrixAt(i, dummy.matrix);
                this.shardMesh.setColorAt(i, shard.color);
            }
        }
        
        this.shardMesh.count = this.shards.length;
        this.shardMesh.instanceMatrix.needsUpdate = true;
        if (this.shardMesh.instanceColor) {
            this.shardMesh.instanceColor.needsUpdate = true;
        }
    }

    private updateSparkles(dt: number): void {
        if (!this.sparkleMesh) return;
        
        const dummy = new THREE.Object3D();
        
        for (let i = this.sparkles.length - 1; i >= 0; i--) {
            const sparkle = this.sparkles[i];
            sparkle.life -= dt;
            
            if (sparkle.life <= 0) {
                this.sparkles.splice(i, 1);
                continue;
            }
            
            // Float upward with slight drift
            sparkle.position.addScaledVector(sparkle.velocity, dt);
            sparkle.velocity.x += (Math.random() - 0.5) * dt;
            sparkle.velocity.z += (Math.random() - 0.5) * dt;
            sparkle.velocity.y *= 0.98; // Slow down upward motion
            
            // Twinkle
            const lifeRatio = sparkle.life / sparkle.maxLife;
            const scale = sparkle.size * lifeRatio;
            const twinkle = 0.5 + Math.sin(Date.now() * 0.01 + i) * 0.5;
            
            dummy.position.copy(sparkle.position);
            dummy.rotation.x += dt * 2;
            dummy.rotation.y += dt * 3;
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            
            if (i < this.sparkleMesh.count) {
                this.shardMesh!.setMatrixAt(i, dummy.matrix);
                const brightColor = sparkle.color.clone().multiplyScalar(0.5 + twinkle * 0.5);
                this.sparkleMesh.setColorAt(i, brightColor);
            }
        }
        
        this.sparkleMesh.count = this.sparkles.length;
        this.sparkleMesh.instanceMatrix.needsUpdate = true;
        if (this.sparkleMesh.instanceColor) {
            this.sparkleMesh.instanceColor.needsUpdate = true;
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    getCandyCount(): number {
        return this.candies.length;
    }

    getGummyRingCount(): number {
        return this.gummyRings.length;
    }

    clear(): void {
        // Destroy all candies
        for (const candy of this.candies) {
            candy.destroy();
        }
        this.candies = [];
        for (const ring of this.gummyRings) {
            ring.destroy();
        }
        this.gummyRings = [];
        this.shards = [];
        this.sparkles = [];
        
        // Reset instanced meshes
        if (this.shardMesh) {
            this.shardMesh.count = 0;
        }
        if (this.sparkleMesh) {
            this.sparkleMesh.count = 0;
        }
    }

    destroy(): void {
        this.clear();
        
        if (this.shardMesh) {
            this.scene.remove(this.shardMesh);
            this.shardMesh.geometry.dispose();
            (this.shardMesh.material as THREE.Material).dispose();
        }
        
        if (this.sparkleMesh) {
            this.scene.remove(this.sparkleMesh);
            this.sparkleMesh.geometry.dispose();
            (this.sparkleMesh.material as THREE.Material).dispose();
        }
    }
}

