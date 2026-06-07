import { lightningBoltSystem } from './game_systems';
import * as THREE from 'three';
import { CloudSystem } from './clouds';
import { AtmosphereSystem } from './sky';
import { LEVEL_CONFIG, type LevelConfig } from './level_config';
import { IndustrialGeometryManager } from './industrial_geometry';
import {
    createSubwooferLotus,
    createShrub,
    createVine,
    createPuffballFlower,
    createFiberOpticWillow,
    createGlowingFlower,
    createStarDustFern,
    createNebulaRose,
    createFloweringTree,
    createFloatingOrb
} from './foliage';
import {
    createSporeCloudAtPosition,
    createVoidRootBallAtPosition,
    createVacuumKelpAtPosition,
    createIceNeedleClusterAtPosition,
    createLiquidMetalBlobAtPosition,
    createMagmaHeartAtPosition,
    createGravityAnchorAtPosition,
    sporeClouds,
    voidRootBalls,
    vacuumKelps,
    iceNeedleClusters,
    magmaHearts,
    gravityAnchors
} from './environment';
import { scene, camera, butterflySwarmSystem } from './scene_setup';
import { playerState } from './game_config';
import { player } from './player_loader';
import { moonPlants, disposeObject } from './environment';
import {
    waterfallSystem,
    industrialSystem,
    chromaShiftSystem,
    biologicalSystem,
    nebulaSystem,
    cosmicDustSystem,
    meteorShowerSystem,
    asteroidFieldSystem,
    planetaryHorizonSystem,
    reEntrySystem,
    flowerManager,
    castleManager,
    candyManager
} from './game_systems';
import { GodRaySystem } from './godrays';
import { AuroraSystem } from './aurora';
import { GhostDebrisSystem } from './ghost_debris';
import { DebugSystem } from './debug_system';

// =============================================================================
// LEVEL MANAGER
// =============================================================================
const DEFAULT_FOG_FAR = 80;
const DEFAULT_FOG_NEAR = 20;
const FOG_FAR_DENSITY_FACTOR = 5;
const FOG_NEAR_DENSITY_FACTOR = 3;

export class LevelManager {
    currentLevel: number;
    config: { [key: number]: LevelConfig };
    levelObjects: THREE.Object3D[];
    cloudSystem: CloudSystem;
    atmosphereSystem: AtmosphereSystem;
    lastPopulatedEndX: number;
    godRaySystem: GodRaySystem;
    auroraSystem: AuroraSystem;
    ghostDebrisSystem: GhostDebrisSystem;
    debugSystem?: DebugSystem;
    objectDensityMultiplier: number;
    private baseAsteroidDensity = 0;

    private readonly GEOLOGICAL_SPAWN_CAPS = {
        cloud: 8,
        voidRootBall: 8,
        vacuumKelp: 6,
        iceNeedle: 6,
        liquidMetal: 6,
        magmaHeart: 6,
        gravityAnchor: 6
    } as const;

    constructor(options: any) {
        this.cloudSystem = new CloudSystem(scene, options.weaponLightManager);
        this.atmosphereSystem = new AtmosphereSystem(scene);

        // Link LightningBoltSystem to CloudSystem for synchronized volumetric lighting
        lightningBoltSystem.onBoltStrike = (pos, color) => {
            this.cloudSystem.triggerLightningAt(pos, color);
        };
        this.godRaySystem = options.godRaySystem;
        this.auroraSystem = options.auroraSystem;
        this.ghostDebrisSystem = options.ghostDebrisSystem;
        this.debugSystem = options.debugSystem;
        this.currentLevel = 1;
        this.config = LEVEL_CONFIG;

        // Track planted objects to cleanup
        this.levelObjects = [];
        this.lastPopulatedEndX = -Infinity;
        this.objectDensityMultiplier = 1.0;
    }

    setObjectDensityMultiplier(multiplier: number) {
        this.objectDensityMultiplier = Math.min(1.0, Math.max(0.25, multiplier));
        if (this.baseAsteroidDensity > 0) {
            asteroidFieldSystem.setDensity(this.baseAsteroidDensity * this.objectDensityMultiplier);
        }
    }

    startLevel(levelIndex: number) {
        this.currentLevel = levelIndex;
        const cfg = this.config[levelIndex];
        if (!cfg) return;

        console.log(`Starting Level ${levelIndex}: ${cfg.name}`);

        // Update Game State
        playerState.autoScrollSpeed = cfg.speed;
        playerState.distanceToMoon = cfg.distance;

        if (cfg.godRays && cfg.godRays.enabled) {
            this.godRaySystem.activate(cfg.godRays);
        } else {
            this.godRaySystem.deactivate();
        }

        if (cfg.aurora && cfg.aurora.enabled) {
            this.auroraSystem.activate(cfg.aurora);
        } else {
            this.auroraSystem.deactivate();
        }

        // --- ATMOSPHERE UPDATE ---
        let transitionDuration = 2.0;
        if (levelIndex === 3) {
            // Level 3 "Orbital Descent" should take ~100s to fully transition to blue
            // 1000m / 10m/s = 100s
            transitionDuration = 100.0;
        }

        this.atmosphereSystem.transitionTo(cfg.skyColors.top, cfg.skyColors.bottom, transitionDuration);
        // Note: AtmosphereSystem handles fog color now.

        if (scene.fog) {
            // scene.fog.color is updated by AtmosphereSystem
            // Apply custom fog density for Memory Fog effect (Level 5)
            if (scene.fog instanceof THREE.Fog) {
                if (cfg.fogDensity) {
                    // Adjust fog near/far based on density (higher density = closer fog)
                    scene.fog.far = DEFAULT_FOG_FAR * (1 - cfg.fogDensity * FOG_FAR_DENSITY_FACTOR);
                    scene.fog.near = DEFAULT_FOG_NEAR * (1 - cfg.fogDensity * FOG_NEAR_DENSITY_FACTOR);
                } else {
                    // Reset to default fog
                    scene.fog.far = DEFAULT_FOG_FAR;
                    scene.fog.near = DEFAULT_FOG_NEAR;
                }
            }
        }

        // Update UI
        const levelDiv = document.getElementById('level-display');
        if (levelDiv) levelDiv.innerHTML = `Level ${levelIndex}: ${cfg.name}`;

        // Populate new zone ahead of player
        this.populateZone(player!.position.x + 50, player!.position.x + 600, cfg);

        // Configure clouds based on level type/name
        // Update cloud layers based on density and color

        this.cloudSystem.setLevel(cfg);

        // Reset and activate systems based on level configuration
        chromaShiftSystem.clearRocks();
        if (cfg.chromaShiftDensity && cfg.chromaShiftDensity > 0) {
            chromaShiftSystem.activate();
        } else {
            chromaShiftSystem.deactivate();
        }
        if (levelIndex === 1 || levelIndex === 2 || levelIndex === 3) {
            if (levelIndex === 3) {
                lightningBoltSystem.activate({ color: 0xaa44ff });
            } else {
                lightningBoltSystem.activate();
            }
        } else {
            lightningBoltSystem.deactivate();
        }


        // Special Effects per Level
        if (levelIndex === 1) {
            butterflySwarmSystem.activate();
        } else {
            butterflySwarmSystem.deactivate();
        }

        if (levelIndex === 3) {
            // Activate Planetary Horizon in Level 3
            planetaryHorizonSystem.levelDistance = cfg.distance;
            planetaryHorizonSystem.activate();
            // Activate Re-Entry Heat in Level 3 "Orbital Descent"
            reEntrySystem.levelDistance = cfg.distance;
            reEntrySystem.activate();
        } else {
            planetaryHorizonSystem.deactivate();
            // Only deactivate reentry if not in level 3 (handled below generally, but explicit here for clarity)
            if (levelIndex !== 3) reEntrySystem.deactivate();
        }

        if (cfg.meteorShower) {
            meteorShowerSystem.activate();
        } else {
            meteorShowerSystem.deactivate();
        }

        if (levelIndex === 4) {
            // Industrial Tunnel
            industrialSystem.activate();
        } else {
            industrialSystem.deactivate();
        }

        if (levelIndex === 6) {
            waterfallSystem.activate();
        } else {
            waterfallSystem.deactivate();
        }

        // Activate Asteroid Fields dynamically based on density
        if (cfg.asteroidRate && cfg.asteroidRate > 0) {
            asteroidFieldSystem.activate();
            // Scale density relative to default levels
            this.baseAsteroidDensity = cfg.asteroidRate * 0.5;
            asteroidFieldSystem.setDensity(this.baseAsteroidDensity * this.objectDensityMultiplier);
            asteroidFieldSystem.resetPositions(camera.position.x);
        } else {
            this.baseAsteroidDensity = 0;
            asteroidFieldSystem.deactivate();
        }

        if (cfg.ghostDebrisDensity && cfg.ghostDebrisDensity > 0) {
            this.ghostDebrisSystem.activate();
        } else {
            this.ghostDebrisSystem.deactivate();
        }

        if (levelIndex === 5) {
            // Activate Biological System for Space Whale Interior
            biologicalSystem.activate();

            // Level 5: Nebula Activation (fixed)
            // Correct behavior - was previously deactivate() in old main.ts
            nebulaSystem.activate();

            cosmicDustSystem.activate();
            this.cloudSystem.layers.forEach(l => l.mesh.visible = false);
        } else {
            biologicalSystem.deactivate();
            nebulaSystem.deactivate();
            cosmicDustSystem.deactivate();
            if (levelIndex !== 4) {
                this.cloudSystem.layers.forEach(l => l.mesh.visible = true);
            }
        }

        // SWARM #3: Generate Magical Dreamy Environments (for levels 1-3 and 6-7)
        const currentX = player ? player.position.x : 0;
        if (levelIndex <= 3 || levelIndex >= 6) {
            // Flower Constellations - giant glowing space flowers
            flowerManager.generateConstellation(15, currentX + 100, currentX + cfg.distance - 100, -40, 40);
            
            // Cloud Castles - dreamy floating castles in background
            castleManager.generateCastleField(8, currentX + 200, currentX + cfg.distance - 200);
        }
        
        // Candy Belt - sweet treat obstacles (all levels except serious ones)
        if (levelIndex !== 4 && levelIndex !== 5) {
            candyManager.generateCandyBelt(cfg.distance * 0.8, 0.25);
        }
    }

    // Phase 1 FPS Fixes - Quick Wins: object cleanup with geometry disposal
    cleanupBehind(cameraX: number) {
        const cutoff = cameraX - 100;
        for (let i = this.levelObjects.length - 1; i >= 0; i--) {
            const obj = this.levelObjects[i];
            if (obj.position.x < cutoff) {
                scene.remove(obj);
                const mpIdx = moonPlants.indexOf(obj);
                if (mpIdx !== -1) moonPlants.splice(mpIdx, 1);
                disposeObject(obj);
                this.levelObjects.splice(i, 1);
            }
        }
    }

    update(delta: number, cameraX: number, speed: number, isFiring: boolean = false, fireDir?: THREE.Vector3) {
        this.cleanupBehind(cameraX);
        this.atmosphereSystem.update(delta, new THREE.Vector3(cameraX, 0, 0)); // Only X matters for now
        this.cloudSystem.update(delta, cameraX, speed, player ? player.position : undefined);
        lightningBoltSystem.update(delta, cameraX);

        const dbg = this.debugSystem;
        const enabled = (name: string) => !dbg || dbg.isEnabled(name);

        if (enabled('waterfall')) waterfallSystem.update(cameraX, delta);
        if (enabled('industrialBg')) industrialSystem.update(cameraX, delta, player ? player.position : undefined);
        if (enabled('biological')) biologicalSystem.update(delta, cameraX);
        // Pass player position to NebulaSystem for interactive lighting
        if (enabled('nebula')) nebulaSystem.update(delta, cameraX, player ? player.position : undefined);
        if (enabled('meteorShower')) meteorShowerSystem.update(delta, cameraX);
        if (enabled('cosmicDust')) cosmicDustSystem.update(delta, cameraX, player ? player.position : undefined);
        if (this.currentLevel === 5) {
            // nebulaSystem.updateLights(weaponSystem.getActiveProjectiles());
        }
        if (enabled('asteroidField') && asteroidFieldSystem) asteroidFieldSystem.update(delta, cameraX);
        if (enabled('planetaryHorizon') && planetaryHorizonSystem) planetaryHorizonSystem.update(cameraX, delta);
        if (enabled('ghostDebris') && this.ghostDebrisSystem) this.ghostDebrisSystem.update(delta, cameraX);
        if (enabled('chromaShift')) chromaShiftSystem.update(delta, player ? player.position : undefined);
        if (enabled('godRays') && this.godRaySystem) this.godRaySystem.update(delta, cameraX, speed, player ? player.position : undefined, isFiring, fireDir);
        if (enabled('reEntry') && reEntrySystem) reEntrySystem.update(delta, cameraX, camera.position.y, player ? player : undefined);

        if (enabled('aurora') && this.auroraSystem) this.auroraSystem.update(delta, cameraX, speed);
    }

    populateZone(startX: number, endX: number, config: LevelConfig) {
        // Guard against re-populating the same zone
        if (endX <= this.lastPopulatedEndX) return;
        this.lastPopulatedEndX = endX;

        const width = endX - startX;
        const density = config.foliageDensity;
        const levelType = config.levelType || 'open';

        // For tunnel levels, spawn structural sections at fixed intervals
        if (levelType === 'tunnel') {
            const interval = config.obstacleInterval || 20;
            const sectionCount = Math.floor(width / interval);
            
            for (let i = 0; i < sectionCount; i++) {
                const xPos = startX + i * interval;
                industrialGeometryManager.createIndustrialSection(xPos);
            }
            
            // Spawn minimal foliage inside tunnel bounds (constrained Y range)
            const tunnelHeight = config.tunnelHeight || 15;
            const yRange: [number, number] = [-tunnelHeight / 2 + 2, tunnelHeight / 2 - 2];
            
            this.spawnOpenFoliage(startX, width, density, yRange);
            return;
        }
        
        if (levelType === 'organic_tunnel') {
            const interval = config.obstacleInterval || 25;
            const sectionCount = Math.floor(width / interval);
            
            for (let i = 0; i < sectionCount; i++) {
                const xPos = startX + i * interval;
                industrialGeometryManager.createWhaleRibSection(xPos);
            }
            
            // Spawn organic foliage inside whale bounds
            const tunnelHeight = config.tunnelHeight || 20;
            const yRange: [number, number] = [-tunnelHeight / 2 + 3, tunnelHeight / 2 - 3];
            
            this.spawnOpenFoliage(startX, width, density, yRange);
            return;
        }

        // Default 'open' level type - use existing random scatter logic
        this.spawnOpenFoliage(startX, width, density);
    }

    // Helper method to spawn foliage with open scatter logic
    spawnOpenFoliage(startX: number, width: number, density: LevelConfig['foliageDensity'], yRange: [number, number] = [-20, 20]) {
        const scaledCount = (count: number) => Math.max(0, Math.floor(count * this.objectDensityMultiplier));

        // Helper to spawn
        const spawn = (count: number, creatorFn: () => THREE.Object3D, customYRange = yRange, zRange: [number, number] = [-30, 0]) => {
            for (let i = 0; i < scaledCount(count); i++) {
                const x = startX + Math.random() * width;
                const y = customYRange[0] + Math.random() * (customYRange[1] - customYRange[0]);
                const z = zRange[0] + Math.random() * (zRange[1] - zRange[0]);

                const obj = creatorFn();
                obj.position.set(x, y, z);

                // Random scale
                const s = 0.8 + Math.random() * 0.5;
                obj.scale.set(s, s, s);

                scene.add(obj);
                this.levelObjects.push(obj);

                // Add to moonPlants for animation update loop
                moonPlants.push(obj);
            }
        };

        // Spawn all types
        if (density.fern) spawn(density.fern, () => createStarDustFern({ color: 0x8A2BE2 }));
        if (density.rose) spawn(density.rose, () => createNebulaRose({ color: 0xFF1493 }));
        if (density.lotus) spawn(density.lotus, () => createSubwooferLotus({ color: 0x00ff88 }));
        if (density.glowingFlower) spawn(density.glowingFlower, () => createGlowingFlower({ color: 0x00ffff, intensity: 2.0 }));

        // Standard foliage (trees at lower positions)
        const treeYRange: [number, number] = [Math.max(yRange[0], -20), Math.min(yRange[1], -5)];
        if (density.tree) spawn(density.tree, () => createFloweringTree({ color: 0x44ffaa }), treeYRange);
        if (density.floweringTree) spawn(density.floweringTree, () => createFloweringTree({ color: 0xffaa44 }), treeYRange);

        if (density.shrub) spawn(density.shrub, () => createShrub({ color: 0x32CD32 }), yRange);
        if (density.vine) spawn(density.vine, () => createVine({ color: 0x228B22 }), yRange);
        if (density.mushroom) spawn(density.mushroom, () => createPuffballFlower({ color: 0xFF4500 }), yRange);

        // Floating items
        if (density.orb) spawn(density.orb, () => createFloatingOrb({ color: 0x88ccff }), yRange);

        // Add clouds manually because they need the specific class wrapper
        if (density.cloud) {
            const targetCount = Math.min(
                scaledCount(density.cloud),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.cloud - sporeClouds.length)
            );
            for(let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -40 + Math.random() * 30;
                createSporeCloudAtPosition(x, y, z);
            }
        }

        // Geological objects from plan.md
        if (density.voidRootBall) {
            const targetCount = Math.min(
                scaledCount(density.voidRootBall),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.voidRootBall - voidRootBalls.length)
            );
            for(let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createVoidRootBallAtPosition(x, y, z);
            }
        }

        if (density.vacuumKelp) {
            const targetCount = Math.min(
                scaledCount(density.vacuumKelp),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.vacuumKelp - vacuumKelps.length)
            );
            for(let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * 15;
                const z = -35 + Math.random() * 25;
                createVacuumKelpAtPosition(x, y, z);
            }
        }

        if (density.iceNeedle) {
            const targetCount = Math.min(
                scaledCount(density.iceNeedle),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.iceNeedle - iceNeedleClusters.length)
            );
            for(let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createIceNeedleClusterAtPosition(x, y, z);
            }
        }

        if (config.chromaShiftDensity && config.chromaShiftDensity > 0) {
            const count = Math.min(scaledCount(config.chromaShiftDensity), this.GEOLOGICAL_SPAWN_CAPS.chromaShift || 200);
            for (let i = 0; i < count; i++) {
                const x = startX + Math.random() * width;
                const y = Math.random() * (yRange[1] - yRange[0]) + yRange[0];
                const z = -20 + Math.random() * 40; // Bring them closer so they react to the player (distance < 20)

                chromaShiftSystem.addRock(new THREE.Vector3(x, y, z), 2 + Math.random() * 2);
            }
        }
        if (density.liquidMetal) {
            const targetCount = Math.min(scaledCount(density.liquidMetal), this.GEOLOGICAL_SPAWN_CAPS.liquidMetal);
            for(let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createLiquidMetalBlobAtPosition(x, y, z);
            }
        }

        if (density.magmaHeart) {
            const targetCount = Math.min(
                scaledCount(density.magmaHeart),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.magmaHeart - magmaHearts.length)
            );
            for(let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createMagmaHeartAtPosition(x, y, z);
            }
        }

        if (density.gravityAnchor) {
            const targetCount = Math.min(
                scaledCount(density.gravityAnchor),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.gravityAnchor - gravityAnchors.length)
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createGravityAnchorAtPosition(x, y, z, this.currentLevel);
            }
        }
    }

    checkProgress(playerX: number) {
        // Transition logic
        if (this.currentLevel === 1 && playerX > 500) {
            this.startLevel(2);
        } else if (this.currentLevel === 2 && playerX > 1200) {
            this.startLevel(3);
        } else if (this.currentLevel === 3 && playerX > 2200) {
            this.startLevel(4);
        } else if (this.currentLevel === 4 && playerX > 3200) {
            this.startLevel(5);
        } else if (this.currentLevel === 5 && playerX > 4200) {
            this.startLevel(6);
        }
    }
}

export const industrialGeometryManager = new IndustrialGeometryManager(scene);
// levelManager is now instantiated in main.ts
