/**
 * Creature Manager - spawn gating, update loop, and cleanup for the
 * bespoke "bestiary" creatures: rare, hand-crafted encounters that make
 * specific levels feel alive.
 *
 * Currently implemented:
 *  - CrystalTarsierGuardian (L1/L2) - perched jeweled tarsier, blesses
 *    calm players with bonus cores, or shatters into chroma shards if shot.
 *  - LivingGeodeTitan (L2/L5) - huge hollow geode; fly through its open
 *    hollow for a bonus, or shoot the rim to shatter it for a bigger reward.
 *
 * Reserved slots for future bestiary additions (see issue #119 follow-up):
 *  - Nebula Butterfly Queen (L1 + L5): giant TSL-winged butterfly that
 *    grants a formation-flying scan/combo bonus, then bursts into a
 *    butterfly swarm + collectibles when it departs. Spawn gate would live
 *    here as `nebulaButterflyQueenRate` on LevelConfig, similar to the rates
 *    below.
 *  - Aqua Moon Siren (L6): eel/jelly hybrid with a lantern-song that opens
 *    a calm-water safe corridor through the waterfall; popping its lantern
 *    is high-risk/high-reward. Spawn gate would be `aquaMoonSirenRate`.
 */

import * as THREE from 'three';
import { CrystalTarsierGuardian } from './crystal_tarsier_guardian';
import { LivingGeodeTitan } from './living_geode_titan';
import { ParticleSystem, DebrisSystem } from './particles';
import { AudioSystem } from './audio_system';
import { CreatureInteractionResult } from './creature_types';
import type { LevelConfig } from './level_config';

interface ProjectileLike {
    mesh: THREE.Object3D;
    active: boolean;
    deactivate(): void;
}

export interface CreatureManagerOptions {
    scene: THREE.Scene;
    particleSystem: ParticleSystem;
    debrisSystem: DebrisSystem;
    audioSystem: AudioSystem;
}

export class CreatureManager {
    private scene: THREE.Scene;
    private particleSystem: ParticleSystem;
    private debrisSystem: DebrisSystem;
    private audioSystem: AudioSystem;

    private tarsierGuardians: CrystalTarsierGuardian[] = [];
    private geodeTitans: LivingGeodeTitan[] = [];

    constructor(options: CreatureManagerOptions) {
        this.scene = options.scene;
        this.particleSystem = options.particleSystem;
        this.debrisSystem = options.debrisSystem;
        this.audioSystem = options.audioSystem;
    }

    /**
     * Advance all active creatures, handle spawn gating, projectile hits
     * and player-collision damage, and clean up far/destroyed creatures.
     * Returns any interaction results (rewards/penalties) for main.ts to
     * apply to cores/HUD/audio.
     */
    update(
        delta: number,
        playerX: number,
        playerY: number,
        levelConfig: LevelConfig | undefined,
        projectiles: ProjectileLike[]
    ): CreatureInteractionResult[] {
        const results: CreatureInteractionResult[] = [];
        const playerPos = new THREE.Vector3(playerX, playerY, 0);

        // --- Spawn gating: Crystal Tarsier Guardian ---
        const tarsierRate = levelConfig?.crystalTarsierRate || 0;
        if (tarsierRate > 0 && this.tarsierGuardians.length === 0 && Math.random() < tarsierRate) {
            const spawnX = playerX + 60;
            const spawnY = (Math.random() - 0.5) * 14;
            this.tarsierGuardians.push(new CrystalTarsierGuardian(this.scene, spawnX, spawnY, -8 - Math.random() * 6));
        }

        // --- Spawn gating: Living Geode Titan ---
        const geodeRate = levelConfig?.geodeTitanRate || 0;
        if (geodeRate > 0 && this.geodeTitans.length === 0 && Math.random() < geodeRate) {
            const spawnX = playerX + 70;
            const spawnY = (Math.random() - 0.5) * 10;
            this.geodeTitans.push(new LivingGeodeTitan(this.scene, spawnX, spawnY, -15 - Math.random() * 10));
        }

        // --- Update + projectile collision: Crystal Tarsier Guardians ---
        for (let i = this.tarsierGuardians.length - 1; i >= 0; i--) {
            const guardian = this.tarsierGuardians[i];

            for (const proj of projectiles) {
                if (!proj.active) continue;
                const dist = proj.mesh.position.distanceTo(guardian.getPosition());
                if (dist < guardian.getRadius()) {
                    guardian.takeDamage(15);
                    proj.deactivate();
                    break;
                }
            }

            const result = guardian.update(delta, playerPos, this.particleSystem, this.debrisSystem, this.audioSystem);
            if (result) results.push(result);

            if (guardian.isDestroyed || guardian.getPosition().x < playerX - 60) {
                guardian.destroy(this.scene);
                this.tarsierGuardians.splice(i, 1);
            }
        }

        // --- Update + projectile collision: Living Geode Titans ---
        for (let i = this.geodeTitans.length - 1; i >= 0; i--) {
            const titan = this.geodeTitans[i];

            for (const proj of projectiles) {
                if (!proj.active) continue;
                const dist = proj.mesh.position.distanceTo(titan.getPosition());
                if (dist < titan.getRadius()) {
                    titan.takeDamage(20);
                    proj.deactivate();
                    break;
                }
            }

            const result = titan.update(delta, playerPos, this.particleSystem, this.debrisSystem, this.audioSystem);
            if (result) results.push(result);

            if (titan.isDestroyed || titan.getPosition().x < playerX - 80) {
                titan.destroy(this.scene);
                this.geodeTitans.splice(i, 1);
            }
        }

        return results;
    }

    /** Remove all active creatures (e.g. on level reset/game restart). */
    clear(): void {
        for (const g of this.tarsierGuardians) g.destroy(this.scene);
        this.tarsierGuardians = [];
        for (const t of this.geodeTitans) t.destroy(this.scene);
        this.geodeTitans = [];
    }
}
