import * as THREE from 'three';
import { FlowerConstellation } from './constellation';
import { GoldenSparkleSystem } from './sparkle';

export class ConstellationManager {
    private scene: THREE.Scene;
    private audio: AudioSystem | null;
    private particles: ParticleSystem | null;
    private flowers: FlowerConstellation[] = [];
    private heartPollen: HeartPollenSystem;
    private goldenSparkles: GoldenSparkleSystem;
    private playerPosition: THREE.Vector3 = new THREE.Vector3();
    
    // Audio cooldown to prevent spam
    private lastBloomSound: number = 0;
    private bloomSoundCooldown: number = 0.5;

    constructor(
        scene: THREE.Scene,
        audio: AudioSystem | null = null,
        particles: ParticleSystem | null = null
    ) {
        this.scene = scene;
        this.audio = audio;
        this.particles = particles;
        this.heartPollen = new HeartPollenSystem(scene);
        this.goldenSparkles = new GoldenSparkleSystem(scene);
    }

    /** Generate a constellation of flowers in the given area */
    generateConstellation(
        count: number,
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number
    ): void {
        for (let i = 0; i < count; i++) {
            // Random position
            const x = xMin + Math.random() * (xMax - xMin);
            const y = yMin + Math.random() * (yMax - yMin);
            const z = -5 - Math.random() * 15; // Background depth

            // Random flower type
            const type = Math.floor(Math.random() * 4) as FlowerType;

            const position = new THREE.Vector3(x, y, z);
            const flower = new FlowerConstellation(type, position, this.scene);
            this.flowers.push(flower);
        }

        console.log(`🌸 Generated ${count} magical flower constellations!`);
    }

    /** Add a single flower at specific position */
    addFlower(type: FlowerType, position: THREE.Vector3): FlowerConstellation {
        const flower = new FlowerConstellation(type, position, this.scene);
        this.flowers.push(flower);
        return flower;
    }

    /** Update all flowers and particle systems */
    update(dt: number, playerPos: THREE.Vector3): void {
        this.playerPosition.copy(playerPos);

        // Update flowers
        for (const flower of this.flowers) {
            flower.setPlayerPosition(playerPos);
            flower.update(dt);

            // Sunflowers emit golden sparkles occasionally
            if (flower.type === FlowerType.SUNFLOWER && Math.random() < 0.02) {
                this.goldenSparkles.emit(flower.getPosition(), 2);
            }
        }

        // Update particle systems
        this.heartPollen.update(dt);
        this.goldenSparkles.update(dt);

        // Check proximity
        this.checkPlayerProximity(playerPos);
    }

    /** Check if player is near any flowers and trigger effects */
    checkPlayerProximity(playerPos: THREE.Vector3): void {
        const now = performance.now() / 1000;

        for (const flower of this.flowers) {
            const distance = flower.getPosition().distanceTo(playerPos);

            if (distance < 30) {
                flower.onPlayerNear(distance, this.heartPollen);

                // Play sound on bloom (with cooldown)
                if (distance < 25 && now - this.lastBloomSound > this.bloomSoundCooldown) {
                    if (this.audio) {
                        // Different sounds for different flower types
                        switch (flower.type) {
                            case FlowerType.DAISY:
                                this.audio.play('twinkle', 0.6);
                                break;
                            case FlowerType.TULIP:
                                this.audio.play('magic_cast', 0.5);
                                break;
                            case FlowerType.LOTUS:
                                this.audio.play('sparkle', 0.7);
                                break;
                            case FlowerType.SUNFLOWER:
                                this.audio.play('heart_pop', 0.5);
                                break;
                        }
                    }
                    this.lastBloomSound = now;
                }
            }
        }
    }

    /** Remove flowers that are far behind the player */
    cleanupFarFlowers(playerX: number): void {
        const cleanupDistance = 100;
        
        for (let i = this.flowers.length - 1; i >= 0; i--) {
            const flower = this.flowers[i];
            if (flower.getPosition().x < playerX - cleanupDistance) {
                flower.destroy();
                this.flowers.splice(i, 1);
            }
        }
    }

    /** Get flower count */
    getFlowerCount(): number {
        return this.flowers.length;
    }

    /** Cleanup all resources */
    cleanup(): void {
        this.flowers.forEach(flower => flower.destroy());
        this.flowers = [];
        this.heartPollen.cleanup();
        this.goldenSparkles.cleanup();
    }
}
