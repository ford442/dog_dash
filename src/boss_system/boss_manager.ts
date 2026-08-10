import * as THREE from 'three';
import { StarEaterBoss } from './star_eater_boss';
import type { BossPhase } from './types';

export class BossManager {
    private scene: THREE.Scene;
    private currentBoss: StarEaterBoss | null = null;
    private bossSpawned = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    checkBossSpawn(
        playerX: number,
        level: number,
        levelDistance: number | undefined,
        callbacks: {
            onDefeated: () => void;
            onPlayerHit: () => void;
            onPhaseChange?: (phase: BossPhase) => void;
            getPlayerPosition: () => THREE.Vector3 | null;
            spawnDebris: (pos: THREE.Vector3, homing?: boolean) => void;
            onBossStart: () => void;
        }
    ): boolean {
        // Level 6 capstone: Star-Eater Pitcher near the end of the aqua expanse
        const isLevel6Capstone = level === 6 && !this.bossSpawned && levelDistance
            && playerX > levelDistance - 750;

        if (!isLevel6Capstone) return false;

        this.bossSpawned = true;

        this.currentBoss = new StarEaterBoss(
            this.scene,
            {
                spawnX: playerX,
                arenaWidth: 60,
                health: 300
            },
            callbacks
        );

        this.currentBoss.activate(playerX);
        callbacks.onBossStart();
        return true;
    }

    update(delta: number): {
        bossActive: boolean;
        pullForce: number;
        isSnapping: boolean;
        boss?: StarEaterBoss;
    } {
        if (!this.currentBoss) {
            return { bossActive: false, pullForce: 0, isSnapping: false };
        }

        const result = this.currentBoss.update(delta);

        return {
            bossActive: this.currentBoss.isActive,
            pullForce: result.pullForce,
            isSnapping: result.isSnapping,
            boss: this.currentBoss
        };
    }

    reset(): void {
        if (this.currentBoss) {
            this.currentBoss.destroy();
            this.currentBoss = null;
        }
        this.bossSpawned = false;
    }

    getBoss(): StarEaterBoss | null {
        return this.currentBoss;
    }
}
