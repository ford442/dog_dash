import * as THREE from 'three';
import type { LevelConfig } from '../level_config';
import type { SporeCloud } from '../geological';

/** Shared unit geometry — scaled per instance (pooled, not reallocated). */
export const SHARED_ASTEROID_GEOMETRY = new THREE.IcosahedronGeometry(1, 0);
export const SHARED_CANDY_GEOMETRY = new THREE.IcosahedronGeometry(1, 1);

export type GameplayModifiers = {
    shieldActive: boolean;
    shieldBouncesAsteroids: boolean;
};

export type ObstacleSystemOptions = {
    scene: THREE.Scene;
    getPlayer: () => THREE.Group | null;
    getCurrentConfig: () => LevelConfig | undefined;
    playerState: { health: number; invincible: boolean; inSafeHarbor?: boolean; velocity: THREE.Vector3 };
    getWasm: () => { exports: any; memory: Float32Array | null };
    setWasmMemory: (memory: Float32Array | null) => void;
    sporeClouds: SporeCloud[];
    particleSystem: {
        emit: (position: THREE.Vector3, color: number, count: number, speed: number, lifetime: number, size?: number) => void;
    };
    debrisSystem: { emit: (position: THREE.Vector3, count: number, speed: number, radius: number) => void };
    waterfallSystem: { triggerSplash: (position: THREE.Vector3, strength: number) => void };
    getCurrentLevel: () => number;
    updateHealthDisplay: () => void;
    gameOver: () => void;
    onPlayerHit?: () => void;
    getPowerUpModifiers?: () => GameplayModifiers;
    onAsteroidBounce?: (asteroid: THREE.Mesh) => void;
    onGraze?: (asteroid: THREE.Mesh, score: number, combo: number) => void;
    /**
     * "Wrench" memory bonus (cataloging the Grumpy Mine Robot): if this
     * returns true, the next collision is auto-bounced harmlessly instead
     * of damaging the player. Should consume a per-level charge internally.
     */
    tryConsumeWrenchCharge?: () => boolean;
    onWrenchSave?: (asteroid: THREE.Mesh) => void;
    /** Swarm escort butterflies absorb one small asteroid bump. */
    tryConsumeSwarmEscort?: (hitPos: THREE.Vector3, hitRadius: number) => boolean;
    /** Power-up butterfly escort charge (if active). */
    tryConsumeButterflyCharge?: () => boolean;
    onButterflySave?: (hitPos: THREE.Vector3) => void;
    /** Bonus score + juice when a candy/gummy asteroid is destroyed. */
    onCandyAsteroidSplit?: (asteroid: THREE.Mesh, bonusScore: number) => void;
    /** Fired when a Grumpy Mine Robot's eyes go wide at the player (for bestiary cataloging). */
    onMineRobotProximity?: () => void;
};
