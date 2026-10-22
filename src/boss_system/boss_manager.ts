import * as THREE from 'three';
import type { BossEncounterConfig } from '../level_config';
import { StarEaterBoss } from './star_eater_boss';
import { ZephyrBoss } from './zephyr_boss';
import type { BossPhase } from './types';

export class BossManager {
    private scene: THREE.Scene;
    private currentBoss: StarEaterBoss | ZephyrBoss | null = null;
    private bossSpawned = false;
    /** triggerX of the last scripted encounter fought (each gate fires once). */
    private lastEncounterX: number | null = null;

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
        },
        encounter?: BossEncounterConfig
    ): boolean {
        if (encounter) return this.checkEncounterSpawn(playerX, encounter, callbacks);

        // Level 4 capstone: Zephyr Boss
        const isLevel4Capstone = level === 4 && !this.bossSpawned && levelDistance
            && playerX > levelDistance - 500;

        // Level 6 capstone: Star-Eater Pitcher near the end of the aqua expanse
        const isLevel6Capstone = level === 6 && !this.bossSpawned && levelDistance
            && playerX > levelDistance - 750;

        if (!isLevel4Capstone && !isLevel6Capstone) return false;

        this.bossSpawned = true;

        if (isLevel4Capstone) {
            this.currentBoss = new ZephyrBoss(
                this.scene,
                {
                    spawnX: playerX,
                    arenaWidth: 60,
                    health: 200
                },
                callbacks
            );
        } else if (isLevel6Capstone) {
            this.currentBoss = new StarEaterBoss(
                this.scene,
                {
                    spawnX: playerX,
                    arenaWidth: 60,
                    health: 300
                },
                callbacks
            );
        }

        if (this.currentBoss) {
            this.currentBoss.activate(playerX);
            callbacks.onBossStart();
        }
        return true;
    }

    /**
     * Endless Dash boss gate: spawn the encounter's boss once the player passes
     * `triggerX`. Kraken gates are spawned by the obstacle system instead.
     */
    private checkEncounterSpawn(
        playerX: number,
        encounter: BossEncounterConfig,
        callbacks: Parameters<BossManager['checkBossSpawn']>[3]
    ): boolean {
        if (encounter.kind === 'kraken') return false;
        if (this.lastEncounterX === encounter.triggerX || playerX <= encounter.triggerX) return false;
        const boss = this.currentBoss;
        if (boss && boss.isActive && boss.phase !== 'defeated') return false;

        // A defeated Zephyr keeps falling with isActive set; clear it before the next gate.
        if (boss?.isActive) boss.destroy();
        this.lastEncounterX = encounter.triggerX;
        const options = { spawnX: playerX, arenaWidth: 60, health: encounter.kind === 'zephyr' ? 200 : 300 };
        this.currentBoss = encounter.kind === 'zephyr'
            ? new ZephyrBoss(this.scene, options, callbacks)
            : new StarEaterBoss(this.scene, options, callbacks);
        this.currentBoss.activate(playerX);
        callbacks.onBossStart();
        return true;
    }

    update(delta: number): {
        bossActive: boolean;
        pullForce: number;
        pullForceY: number;
        isSnapping: boolean;
        boss?: StarEaterBoss | ZephyrBoss;
    } {
        if (!this.currentBoss) {
            return { bossActive: false, pullForce: 0, pullForceY: 0, isSnapping: false };
        }

        const result = this.currentBoss.update(delta);

        let pullForceY = 0;
        if (this.currentBoss instanceof ZephyrBoss) {
            pullForceY = this.currentBoss.pullForceY;
        }

        return {
            bossActive: this.currentBoss.isActive,
            pullForce: result.pullForce,
            pullForceY: pullForceY,
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
        this.lastEncounterX = null;
    }

    getBoss(): StarEaterBoss | ZephyrBoss | null {
        return this.currentBoss;
    }
}
