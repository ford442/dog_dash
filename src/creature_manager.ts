/**
 * Creature Manager - spawn gating, update loop, and cleanup for the
 * bespoke "bestiary" creatures: rare, hand-crafted encounters that make
 * specific levels feel alive.
 *
 * Currently implemented (via unified registry for spawn modes):
 *  - CrystalTarsierGuardian (L1/L2) - ...
 *  - LivingGeodeTitan (L2/L5) - ...
 *  - MoonJelly (demo new, L5/L6) - streaming clustered background jellies, proof of registry pattern.
 *  - AuroraRay (L6) - level-batch school, proof of one-shot batch pattern.
 *  - NebulaPuffer (L3-L6) - slow drifter with inflate/deflate + bubble rewards.
 *
 * The AmbientCreatureDef registry centralizes:
 *   spawnMode, depthLayer via depth_layers, levelRates or rateKey, clusterSize,
 *   spawn-ahead/interval/batch placement, tint from enemyTintColor, cleanup,
 *   and debug toggles per family.
 * Existing wrapped via legacy:true to keep old arrays/loops/behavior 100% unchanged.
 *
 * Reserved slots... (same)
 */

import * as THREE from 'three';
import { CrystalTarsierGuardian } from './crystal_tarsier_guardian';
import { LivingGeodeTitan } from './living_geode_titan';
import { ParticleSystem, DebrisSystem } from './particles';
import { AudioSystem } from './audio_system';
import { CreatureInteractionResult } from './creature_types';
import type { LevelConfig } from './level_config';
import { randomZInLayer, type DepthLayer } from './depth_layers';
import type { BestiaryEntryId } from './bestiary';
import type { DebugSystem } from './debug_system';
import { PuffPuffer } from './puff_puffer';

interface ProjectileLike {
    mesh: THREE.Object3D;
    active: boolean;
    deactivate(): void;
}

export interface AmbientCreatureDef {
  id: string;
  spawnMode: 'probabilistic' | 'streaming' | 'level_batch';
  depthLayer?: DepthLayer;
  rateKey?: string;
  levelRates?: Partial<Record<number, number>>;
  maxActive?: number;
  spawnAhead?: number;
  streamInterval?: number;
  spawnYRange?: [number, number];
  clusterSize?: number;
  batchCount?: number;
  catalogId?: BestiaryEntryId;
  legacy?: boolean; // for wrapping existing without behavior change
  factory: (...args: any[]) => any;
}

export interface AmbientCreatureInstance {
  update?(delta: number, playerPos: THREE.Vector3, particleSystem?: ParticleSystem, debrisSystem?: DebrisSystem, audioSystem?: AudioSystem): CreatureInteractionResult | null | undefined;
  getPosition?(): THREE.Vector3;
  position?: THREE.Vector3;
  isDestroyed?: boolean;
  destroy?(scene: THREE.Scene): void;
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

    private registeredCreatures: AmbientCreatureDef[] = [];
    private genericActive: Map<string, any[]> = new Map();
    private lastStreamingSpawnX: Map<string, number> = new Map();
    private spawnedLevelBatches = new Set<string>();
    private debugSystem?: DebugSystem;

    constructor(options: CreatureManagerOptions) {
        this.scene = options.scene;
        this.particleSystem = options.particleSystem;
        this.debrisSystem = options.debrisSystem;
        this.audioSystem = options.audioSystem;

        this.registeredCreatures = [];
        this.genericActive = new Map();

        // Register existing for unified spawn (wrapping to preserve exact behavior)
        this.registerAmbientCreature({
            id: 'tarsier_guardian',
            spawnMode: 'probabilistic',
            rateKey: 'crystalTarsierRate',
            maxActive: 1,
            legacy: true,
            factory: (scene: THREE.Scene, baseX: number) => {
                const sy = (Math.random() - 0.5) * 14;
                const sz = -8 - Math.random() * 6;
                const g = new CrystalTarsierGuardian(scene, baseX, sy, sz);
                this.tarsierGuardians.push(g);
                return g;
            }
        });

        this.registerAmbientCreature({
            id: 'geode_titan',
            spawnMode: 'probabilistic',
            rateKey: 'geodeTitanRate',
            maxActive: 1,
            legacy: true,
            factory: (scene: THREE.Scene, baseX: number) => {
                const sy = (Math.random() - 0.5) * 10;
                const sz = -15 - Math.random() * 10;
                const t = new LivingGeodeTitan(scene, baseX, sy, sz);
                this.geodeTitans.push(t);
                return t;
            }
        });

        // Proof-of-pattern new creature using the registry (streaming + clusters + tint + depth)
        this.registerAmbientCreature({
            id: 'moon_jelly',
            spawnMode: 'streaming',
            depthLayer: 'BACKGROUND',
            levelRates: { 5: 0.5, 6: 0.55 },
            maxActive: 9,
            spawnAhead: 65,
            streamInterval: 140,
            spawnYRange: [-15, 15],
            clusterSize: 3,
            factory: (scene: THREE.Scene, x: number, y: number, z: number, tint?: number) => {
                return new MoonJelly(scene, x, y, z, tint);
            }
        });

        this.registerAmbientCreature({
            id: 'aurora_ray',
            spawnMode: 'level_batch',
            depthLayer: 'BACKGROUND',
            levelRates: { 6: 1 },
            maxActive: 4,
            spawnAhead: 120,
            spawnYRange: [-12, 12],
            clusterSize: 2,
            batchCount: 2,
            factory: (scene: THREE.Scene, x: number, y: number, z: number, tint?: number) => {
                return new AuroraRay(scene, x, y, z, tint);
            }
        });

        this.registerAmbientCreature({
            id: 'nebula_puffer',
            spawnMode: 'streaming',
            depthLayer: 'MIDGROUND',
            catalogId: 'nebula_puffer',
            levelRates: { 3: 0.32, 4: 0.38, 5: 0.42, 6: 0.4 },
            maxActive: 4,
            spawnAhead: 72,
            streamInterval: 175,
            spawnYRange: [-12, 14],
            clusterSize: 1,
            factory: (scene: THREE.Scene, x: number, y: number, z: number, tint?: number) => {
                return new PuffPuffer(scene, x, y, z, tint);
            }
        });
    }

    setDebugSystem(ds: DebugSystem) {
        this.debugSystem = ds;
    }

    registerAmbientCreature(def: AmbientCreatureDef) {
        this.registeredCreatures.push(def);
        if (!def.legacy && !this.genericActive.has(def.id)) {
            this.genericActive.set(def.id, []);
        }
        if (def.spawnMode === 'streaming' && !this.lastStreamingSpawnX.has(def.id)) {
            this.lastStreamingSpawnX.set(def.id, -Infinity);
        }
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
        projectiles: ProjectileLike[],
        levelIndex: number = 1
    ): CreatureInteractionResult[] {
        const results: CreatureInteractionResult[] = [];
        const playerPos = new THREE.Vector3(playerX, playerY, 0);

        // Spawn from registry (unified; wraps legacy tarsier/geode exactly + new creatures)
        this.spawnFromRegistry(levelConfig, playerX, levelIndex);

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

        // Generic update for registry creatures (new pattern + any non-legacy)
        for (const [id, list] of this.genericActive.entries()) {
            for (let i = list.length - 1; i >= 0; i--) {
                const c: any = list[i];
                if (typeof c.update === 'function') {
                    const result = c.update(delta, playerPos, this.particleSystem, this.debrisSystem, this.audioSystem);
                    if (result) results.push(result);
                }
                const pos = typeof c.getPosition === 'function' ? c.getPosition() : (c.position || { x: 0 });
                const px = pos.x || 0;
                if (c.isDestroyed || px < playerX - 80) {
                    if (typeof c.destroy === 'function') c.destroy(this.scene);
                    list.splice(i, 1);
                }
            }
        }

        return results;
    }

    private spawnFromRegistry(levelConfig: LevelConfig | undefined, playerX: number, levelIndex: number) {
        for (const def of this.registeredCreatures) {
            if (!this.isCreatureDebugEnabled(def)) continue;

            const rate = this.getSpawnRate(def, levelConfig, levelIndex);
            if (rate <= 0) continue;

            if (def.spawnMode === 'probabilistic') {
                if (this.getActiveCount(def) >= (def.maxActive || 1)) continue;
                if (Math.random() < rate) {
                    this.spawnCreatureCluster(def, playerX + (def.spawnAhead || 60), levelConfig);
                }
            } else if (def.spawnMode === 'streaming') {
                const lastX = this.lastStreamingSpawnX.get(def.id) ?? -Infinity;
                const interval = def.streamInterval ?? 120;
                if (playerX - lastX < interval) continue;
                if (this.getActiveCount(def) >= (def.maxActive || 1)) continue;
                if (Math.random() < rate) {
                    this.lastStreamingSpawnX.set(def.id, playerX);
                    this.spawnCreatureCluster(def, playerX + (def.spawnAhead || 60), levelConfig);
                }
            } else if (def.spawnMode === 'level_batch') {
                const batchKey = `${def.id}:${levelIndex}`;
                if (this.spawnedLevelBatches.has(batchKey)) continue;
                this.spawnedLevelBatches.add(batchKey);
                const count = Math.max(1, def.batchCount ?? def.clusterSize ?? 1);
                for (let i = 0; i < count; i++) {
                    this.spawnCreatureCluster(def, playerX + (def.spawnAhead || 60) + i * 18, levelConfig);
                }
            }
        }
    }

    private getSpawnRate(def: AmbientCreatureDef, levelConfig: LevelConfig | undefined, levelIndex: number): number {
        if (def.rateKey && levelConfig) {
            return (levelConfig as any)[def.rateKey] || 0;
        }
        return def.levelRates?.[levelIndex] || 0;
    }

    private isCreatureDebugEnabled(def: AmbientCreatureDef): boolean {
        // Legacy wrappers keep original spawn behavior; debug toggles apply to new registry creatures only.
        if (def.legacy) return true;
        return !this.debugSystem || this.debugSystem.isEnabled(`creature_${def.id}`);
    }

    private getActiveCount(def: AmbientCreatureDef): number {
        if (!def.legacy) {
            return this.genericActive.get(def.id)?.length ?? 0;
        }
        if (def.id === 'tarsier_guardian') return this.tarsierGuardians.length;
        if (def.id === 'geode_titan') return this.geodeTitans.length;
        return 0;
    }

    private spawnCreatureCluster(def: AmbientCreatureDef, spawnX: number, levelConfig: LevelConfig | undefined): void {
        const actives = def.legacy ? undefined : this.genericActive.get(def.id);
        const remainingCapacity = Math.max(0, (def.maxActive || Infinity) - this.getActiveCount(def));
        const clusterCount = Math.min(def.clusterSize || 1, remainingCapacity);
        if (clusterCount <= 0) return;

        const spawnY = this.randomSpawnY(def);
        const spawnZ = this.randomSpawnZ(def);
        const tint = levelConfig?.enemyTintColor;

        for (let k = 0; k < clusterCount; k++) {
            const cx = spawnX + (k === 0 ? 0 : (Math.random() - 0.5) * 10);
            const cy = spawnY + (k === 0 ? 0 : (Math.random() - 0.5) * 4);
            const cz = spawnZ + (k === 0 ? 0 : (Math.random() - 0.5) * 2);
            const creature = def.factory(this.scene, cx, cy, cz, tint);
            if (!def.legacy && actives) {
                actives.push(creature);
            }
        }
    }

    private randomSpawnY(def: AmbientCreatureDef): number {
        if (def.spawnYRange) {
            const [lo, hi] = def.spawnYRange;
            return lo + Math.random() * (hi - lo);
        }
        return (Math.random() - 0.5) * 14;
    }

    private randomSpawnZ(def: AmbientCreatureDef): number {
        if (def.depthLayer) {
            return randomZInLayer(def.depthLayer);
        }
        return -10 - Math.random() * 6;
    }

    /** Remove all active creatures (e.g. on level reset/game restart). */
    clear(): void {
        for (const g of this.tarsierGuardians) g.destroy(this.scene);
        this.tarsierGuardians = [];
        for (const t of this.geodeTitans) t.destroy(this.scene);
        this.geodeTitans = [];
        for (const list of this.genericActive.values()) {
            for (const c of list) {
                if (typeof c.destroy === 'function') c.destroy(this.scene);
            }
            list.length = 0;
        }
        this.lastStreamingSpawnX.clear();
        this.spawnedLevelBatches.clear();
        for (const def of this.registeredCreatures) {
            if (def.spawnMode === 'streaming') {
                this.lastStreamingSpawnX.set(def.id, -Infinity);
            }
        }
    }

    getScannables(): THREE.Object3D[] {
        const genericScannables: THREE.Object3D[] = [];
        for (const list of this.genericActive.values()) {
            for (const creature of list) {
                if (creature.group instanceof THREE.Object3D) {
                    genericScannables.push(creature.group);
                }
            }
        }

        return [
            ...this.tarsierGuardians.map(creature => creature.group),
            ...this.geodeTitans.map(creature => creature.group),
            ...genericScannables
        ];
    }
}

/**
 * Proof-of-pattern creature using the registry: a simple translucent moon jelly.
 * Supports clusters, depth layer, biome tint from enemyTintColor, gentle animation.
 * Purely visual/cosmetic (no rewards) for the demo.
 */
class MoonJelly {
    group: THREE.Group;
    position: THREE.Vector3;
    isDestroyed = false;
    private time = 0;

    constructor(scene: THREE.Scene, x: number, y: number, z: number, tintColor?: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'moonJelly';

        const color = tintColor ?? 0x88ffdd;
        const mat = new THREE.MeshPhysicalMaterial({
            color,
            transparent: true,
            opacity: 0.45,
            emissive: color,
            emissiveIntensity: 0.7,
            roughness: 0.25,
            metalness: 0.05
        });

        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), mat);
        this.group.add(bell);

        // tendrils for jelly look + cluster demo
        for (let i = 0; i < 4; i++) {
            const tend = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.6, 4), mat);
            tend.position.y = -0.85;
            tend.rotation.z = (i - 1.5) * 0.5;
            this.group.add(tend);
        }

        scene.add(this.group);
    }

    update(delta: number) {
        this.time += delta;
        const s = 1.0 + Math.sin(this.time * 2.5) * 0.07;
        this.group.scale.set(s, s * 0.85, s);
        this.group.position.y = this.position.y + Math.sin(this.time * 1.1) * 0.35;
    }

    getPosition() {
        return this.position;
    }

    destroy(scene: THREE.Scene) {
        scene.remove(this.group);
        this.isDestroyed = true;
    }
}

/**
 * Registry-only Level 6 batch creature: a calm manta-like ray that glides in
 * the Aqua Expanse background. It is non-hazardous and exists to prove the
 * level_batch path without changing obstacle behavior.
 */
class AuroraRay {
    group: THREE.Group;
    position: THREE.Vector3;
    isDestroyed = false;
    private time = 0;
    private baseY: number;

    constructor(scene: THREE.Scene, x: number, y: number, z: number, tintColor?: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.baseY = y;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'auroraRay';

        const color = tintColor ?? 0x66ffee;
        const bodyMat = new THREE.MeshPhysicalMaterial({
            color,
            transparent: true,
            opacity: 0.5,
            emissive: color,
            emissiveIntensity: 0.6,
            roughness: 0.25,
            metalness: 0.05,
            side: THREE.DoubleSide
        });

        const wing = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32, 0, Math.PI), bodyMat);
        wing.scale.set(1.8, 0.7, 1);
        wing.rotation.x = Math.PI / 2;
        this.group.add(wing);

        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 3.2, 6), bodyMat);
        tail.position.set(-2.1, -0.1, 0);
        tail.rotation.z = Math.PI / 2;
        this.group.add(tail);

        scene.add(this.group);
    }

    update(delta: number) {
        this.time += delta;
        this.position.x -= delta * 2.5;
        this.group.position.x = this.position.x;
        this.group.position.y = this.baseY + Math.sin(this.time * 1.4) * 0.8;
        this.group.rotation.z = Math.sin(this.time * 1.1) * 0.08;
        const flap = 1 + Math.sin(this.time * 3.0) * 0.08;
        this.group.scale.set(1, flap, 1);
    }

    getPosition() {
        return this.group.position;
    }

    destroy(scene: THREE.Scene) {
        scene.remove(this.group);
        this.isDestroyed = true;
    }
}
