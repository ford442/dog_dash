import * as THREE from 'three';
import { ParticleSystem } from '../particles';
import type { AudioPort } from '../ports';
import { CollectibleOrb } from './orb';
import { OrbType } from './types';

/** Manages all collectible orbs in the game */
export class OrbManager {
    private scene: THREE.Scene;
    private particleSystem: ParticleSystem;
    private readonly audio: AudioPort;
    private orbs: CollectibleOrb[] = [];
    private orbCount: number = 0;
    private powerUpThreshold: number = 5;

    // Score callback
    onScore?: (points: number) => void;
    onHealthRestore?: (amount: number) => void;
    onPowerUpReady?: () => void;

    constructor(scene: THREE.Scene, particleSystem: ParticleSystem, audio: AudioPort, powerUpThreshold: number = 5) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.audio = audio;
        this.powerUpThreshold = powerUpThreshold;
    }

    /** Spawn a new orb at the given position */
    spawnOrb(x: number, y: number, type: OrbType, z: number = 0): CollectibleOrb {
        const orb = new CollectibleOrb(this.scene, x, y, z, type);
        this.orbs.push(orb);
        return orb;
    }

    /** Spawn a StarOrb with random pastel color */
    spawnStarOrb(x: number, y: number, z: number = 0): CollectibleOrb {
        return this.spawnOrb(x, y, OrbType.STAR, z);
    }

    /** Spawn a MagicBone (rare) */
    spawnMagicBone(x: number, y: number, z: number = 0): CollectibleOrb {
        return this.spawnOrb(x, y, OrbType.MAGIC_BONE, z);
    }

    /** Spawn a HeartOrb */
    spawnHeartOrb(x: number, y: number, z: number = 0): CollectibleOrb {
        return this.spawnOrb(x, y, OrbType.HEART, z);
    }

    /** Spawn a random orb type */
    spawnRandomOrb(x: number, y: number, z: number = 0): CollectibleOrb {
        const rand = Math.random();
        let type: OrbType;

        if (rand < 0.05) {
            // 5% chance for Magic Bone
            type = OrbType.MAGIC_BONE;
        } else if (rand < 0.15) {
            // 10% chance for Heart
            type = OrbType.HEART;
        } else {
            // 85% chance for Star
            type = OrbType.STAR;
        }

        return this.spawnOrb(x, y, type, z);
    }

    /** Update all orbs - call every frame */
    update(dt: number, time: number): void {
        for (const orb of this.orbs) {
            if (!orb.collected) {
                orb.update(dt, time);
            }
        }
    }

    /** Check for collection by player */
    checkCollection(playerPosition: THREE.Vector3, collectionRadius: number = 2.0): {
        collected: boolean;
        points: number;
        type?: OrbType;
        healthRestore?: number;
        powerUpReady?: boolean;
    } {
        let totalPoints = 0;
        let collectedType: OrbType | undefined;
        let healthRestored = 0;
        let anyCollected = false;

        for (const orb of this.orbs) {
            if (!orb.collected && orb.checkCollision(playerPosition, collectionRadius)) {
                const result = orb.collect(this.particleSystem, this.audio);

                totalPoints += result.points;
                collectedType = result.type;
                anyCollected = true;

                if (result.healthRestore) {
                    healthRestored += result.healthRestore;
                }

                // Increment orb count for power-up tracking
                this.orbCount++;

                // Notify score callback
                if (this.onScore) {
                    this.onScore(result.points);
                }

                // Notify health callback
                if (result.healthRestore && this.onHealthRestore) {
                    this.onHealthRestore(result.healthRestore);
                }

                // Only collect one per frame to avoid issues
                break;
            }
        }

        // Check if power-up is ready
        const powerUpReady = this.orbCount >= this.powerUpThreshold;
        if (powerUpReady && this.onPowerUpReady) {
            this.onPowerUpReady();
            // Reset count after triggering
            this.orbCount = 0;
        }

        return {
            collected: anyCollected,
            points: totalPoints,
            type: collectedType,
            healthRestore: healthRestored > 0 ? healthRestored : undefined,
            powerUpReady
        };
    }

    /** Get current orb count toward power-up */
    getOrbCount(): number {
        return this.orbCount;
    }

    /** Get progress toward next power-up (0-1) */
    getPowerUpProgress(): number {
        return this.orbCount / this.powerUpThreshold;
    }

    /** Set the power-up threshold */
    setPowerUpThreshold(threshold: number): void {
        this.powerUpThreshold = threshold;
    }

    /**
     * Brighten nearby uncollected orbs (Stellar Seal Pup clap cheer).
     * Returns how many orbs were boosted.
     */
    boostGlowNearby(center: THREE.Vector3, radius: number, multiplier: number, durationSeconds: number, time: number): number {
        let count = 0;
        for (const orb of this.orbs) {
            if (orb.collected) continue;
            if (orb.mesh.position.distanceTo(center) < radius) {
                orb.applyGlowBoost(multiplier, durationSeconds, time);
                count++;
            }
        }
        return count;
    }

    /** Reset orb count (e.g., after power-up activation) */
    resetOrbCount(): void {
        this.orbCount = 0;
    }

    /** Remove all orbs and clean up */
    reset(): void {
        for (const orb of this.orbs) {
            orb.destroy(this.scene);
        }
        this.orbs = [];
        this.orbCount = 0;
    }

    /** Clean up collected orbs that are far behind player */
    cleanupOrbsBehind(playerX: number, buffer: number = 20): void {
        for (let i = this.orbs.length - 1; i >= 0; i--) {
            const orb = this.orbs[i];
            if (orb.mesh.position.x < playerX - buffer) {
                orb.destroy(this.scene);
                this.orbs.splice(i, 1);
            }
        }
    }

    /**
     * Remove orbs parked above a Y threshold. Used to tear down the Dream
     * Portal bonus-room fountain without touching main-run orbs.
     */
    cleanupOrbsAboveY(y: number): void {
        for (let i = this.orbs.length - 1; i >= 0; i--) {
            const orb = this.orbs[i];
            if (orb.mesh.position.y > y) {
                orb.destroy(this.scene);
                this.orbs.splice(i, 1);
            }
        }
    }

    /** Get all active orb positions (for debugging or AI) */
    getOrbPositions(): { position: THREE.Vector3; type: OrbType }[] {
        return this.orbs
            .filter(orb => !orb.collected)
            .map(orb => ({
                position: orb.getPosition(),
                type: orb.type
            }));
    }

    /** Get count of active orbs */
    getActiveOrbCount(): number {
        return this.orbs.filter(orb => !orb.collected).length;
    }

    /** Get all active (uncollected) orbs */
    getActiveOrbs(): CollectibleOrb[] {
        return this.orbs.filter(orb => !orb.collected);
    }
}
