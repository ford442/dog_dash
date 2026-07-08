import { ShakeType } from './juice_effects';
import { lightningBoltSystem, particleSystem, juiceManager } from './game_systems';
import * as THREE from 'three';
import { CloudSystem } from './clouds';
import { AtmosphereSystem } from './sky';
import { LEVEL_CONFIG, LEVEL_DISTANCE_BOUNDARIES, type LevelConfig, type LevelEnvironments } from './level_config';
import { IndustrialGeometryManager } from './industrial_geometry';
import {
    createSubwooferLotus,
    createShrub,
    createVine,
    createPuffballFlower,
    createGlowingFlower,
    createStarDustFern,
    createNebulaRose,
    createFloweringTree,
    createFloatingOrb
} from './foliage';
import { DEPTH_LAYERS, getLevelSpan, randomZInLayer, randomZInRange } from './depth_layers';
import { playerState } from './game_config';
import { moonPlants } from './visuals';
import { disposeObject } from './utils';
import {
    blackHoleSystem,
    waterfallSystem,
    industrialSystem,
    chromaShiftSystem,
    stormGeodeSystem,
    biologicalSystem,
    nebulaSystem,
    cosmicDustSystem,
    meteorShowerSystem,
    asteroidFieldSystem,
    planetaryHorizonSystem,
    reEntrySystem,
    crystalChimeManager
} from './game_systems';
import { GodRaySystem } from './godrays';
import { AuroraSystem } from './aurora';
import { GhostDebrisSystem } from './ghost_debris';
import { VoidJellyfishSystem } from './void_jellyfish';
import { DebugSystem } from './debug_system';
import { FriendsManager } from './space_friends';
import { ButterflySwarmSystem } from './butterfly_swarm';
import { WeaponLightManager } from './lighting';
import type { ConstellationManager } from './flower_constellations';
import type { PinwheelFloraManager } from './pinwheel_flora';
import type { WindChimeManager } from './wind_chimes';
import type { SolarSailFernManager } from './solar_sail_ferns';
import type { CastleBackgroundManager } from './cloud_castles';
import type { CandyBeltManager } from './candy_obstacles';
import {
    applyLevelDecorationBudgets,
    decorationBudget
} from './decoration_budget';

// =============================================================================
// LEVEL MANAGER
// =============================================================================
const DEFAULT_FOG_FAR = 80;
const DEFAULT_FOG_NEAR = 20;
const FOG_FAR_DENSITY_FACTOR = 5;
const FOG_NEAR_DENSITY_FACTOR = 3;

const STREAM_AHEAD_START = 80;
const STREAM_AHEAD_END = 550;

type EnvironmentPlugin<K extends keyof LevelEnvironments = keyof LevelEnvironments> = {
    flag: K;
    activate: (value: NonNullable<LevelEnvironments[K]>) => void;
    deactivate: () => void;
};

function isEnvironmentEnabled(value: LevelEnvironments[keyof LevelEnvironments] | undefined): boolean {
    if (!value) return false;
    if (typeof value === 'boolean') return value;
    if ('enabled' in value) return value.enabled;
    // For configs like asteroidField or ghostDebris that might not have an enabled flag but have a value
    return true;
}

export type GeologicalSpawners = {
    createSporeCloudAtPosition: (x: number, y: number, z: number) => unknown;
    createVoidRootBallAtPosition: (x: number, y: number, z: number) => unknown;
    createVacuumKelpAtPosition: (x: number, y: number, z: number) => unknown;
    createIceNeedleClusterAtPosition: (x: number, y: number, z: number) => unknown;
    createLiquidMetalBlobAtPosition: (x: number, y: number, z: number) => unknown;
    createMagmaHeartAtPosition: (x: number, y: number, z: number) => unknown;
    createGravityAnchorAtPosition: (x: number, y: number, z: number, biome?: number) => unknown;
    createGeodeAtPosition: (x: number, y: number, z: number) => unknown;
};

export type GeologicalCounts = {
    sporeClouds: () => number;
    voidRootBalls: () => number;
    vacuumKelps: () => number;
    iceNeedleClusters: () => number;
    magmaHearts: () => number;
    gravityAnchors: () => number;
    geodes: () => number;
};

export type LevelManagerOptions = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    weaponLightManager: WeaponLightManager;
    godRaySystem: GodRaySystem;
    auroraSystem: AuroraSystem;
    ghostDebrisSystem: GhostDebrisSystem;
    voidJellyfishSystem: VoidJellyfishSystem;
    debugSystem?: DebugSystem;
    friendsManager?: FriendsManager;
    industrialGeometryManager: IndustrialGeometryManager;
    butterflySwarmSystem: ButterflySwarmSystem;
    flowerManager: ConstellationManager;
    pinwheelManager: PinwheelFloraManager;
    windChimeManager: WindChimeManager;
    solarSailFernManager: SolarSailFernManager;
    castleManager: CastleBackgroundManager;
    candyManager: CandyBeltManager;
    getPlayer: () => THREE.Group | null;
    spawners: GeologicalSpawners;
    geologicalCounts: GeologicalCounts;
    onLevelStart?: (cfg: LevelConfig) => void;
    onUpdateLevelDisplay?: (levelIndex: number, name: string) => void;
};

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
    voidJellyfishSystem: VoidJellyfishSystem;
    debugSystem?: DebugSystem;
    friendsManager?: FriendsManager;
    industrialGeometryManager: IndustrialGeometryManager;
    objectDensityMultiplier: number;
    private readonly scene: THREE.Scene;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly butterflySwarmSystem: ButterflySwarmSystem;
    private readonly flowerManager: ConstellationManager;
    private readonly pinwheelManager: PinwheelFloraManager;
    private readonly windChimeManager: WindChimeManager;
    private readonly solarSailFernManager: SolarSailFernManager;
    private readonly castleManager: CastleBackgroundManager;
    private readonly candyManager: CandyBeltManager;
    private readonly getPlayer: () => THREE.Group | null;
    private readonly spawners: GeologicalSpawners;
    private readonly geologicalCounts: GeologicalCounts;
    private readonly onLevelStart?: (cfg: LevelConfig) => void;
    private readonly onUpdateLevelDisplay?: (levelIndex: number, name: string) => void;
    private baseAsteroidDensity = 0;
    /** True once this level's objective has been completed and the "fast lane"
     *  (reduced hazard density, bonus orbs) toward the level exit is active. */
    fastLaneActive = false;
    private fastLaneDensityFactor = 1.0;

    private readonly GEOLOGICAL_SPAWN_CAPS = {
        cloud: 8,
        voidRootBall: 8,
        vacuumKelp: 6,
        iceNeedle: 6,
        liquidMetal: 6,
        magmaHeart: 6,
        gravityAnchor: 6,
        geode: 4
    } as const;

    constructor(options: LevelManagerOptions) {
        this.scene = options.scene;
        this.camera = options.camera;
        this.butterflySwarmSystem = options.butterflySwarmSystem;
        this.flowerManager = options.flowerManager;
        this.pinwheelManager = options.pinwheelManager;
        this.windChimeManager = options.windChimeManager;
        this.solarSailFernManager = options.solarSailFernManager;
        this.castleManager = options.castleManager;
        this.candyManager = options.candyManager;
        this.getPlayer = options.getPlayer;
        this.spawners = options.spawners;
        this.geologicalCounts = options.geologicalCounts;
        this.onLevelStart = options.onLevelStart;
        this.onUpdateLevelDisplay = options.onUpdateLevelDisplay;

        this.cloudSystem = new CloudSystem(this.scene, options.weaponLightManager);
        this.atmosphereSystem = new AtmosphereSystem(this.scene);

        lightningBoltSystem.onBoltStrike = (pos, color) => {
            this.cloudSystem.triggerLightningAt(pos, color);
            this.godRaySystem.triggerLightningFlash(0.5 + Math.random() * 1.5, color);

            // Add impact effects: subtle screen shake and spark particles
            juiceManager.shakeScreen(ShakeType.LIGHT, 0.2);
            particleSystem.emit(pos, color.getHex(), 10, 5.0, 1.0, 0.5);
        };
        this.godRaySystem = options.godRaySystem;
        this.auroraSystem = options.auroraSystem;
        this.ghostDebrisSystem = options.ghostDebrisSystem;
        this.voidJellyfishSystem = options.voidJellyfishSystem;
        this.debugSystem = options.debugSystem;
        this.friendsManager = options.friendsManager;
        this.industrialGeometryManager = options.industrialGeometryManager;
        this.currentLevel = 1;
        this.config = LEVEL_CONFIG;

        this.levelObjects = [];
        this.lastPopulatedEndX = -Infinity;
        this.objectDensityMultiplier = 1.0;
    }

    setObjectDensityMultiplier(multiplier: number) {
        this.objectDensityMultiplier = Math.min(1.0, Math.max(0.25, multiplier));
        if (this.baseAsteroidDensity > 0) {
            asteroidFieldSystem.setDensity(this.baseAsteroidDensity * this.objectDensityMultiplier * this.fastLaneDensityFactor);
        }
        const cfg = this.config[this.currentLevel];
        if (cfg) applyLevelDecorationBudgets(cfg, this.objectDensityMultiplier);
    }

    enterFastLane() {
        if (this.fastLaneActive) return;
        this.fastLaneActive = true;
        this.fastLaneDensityFactor = 0.35;
        if (this.baseAsteroidDensity > 0) {
            asteroidFieldSystem.setDensity(this.baseAsteroidDensity * this.objectDensityMultiplier * this.fastLaneDensityFactor);
        }
    }

    setMagicActive(active: boolean) {
        nebulaSystem.setMagicActive(active);
    }

    startLevel(levelIndex: number) {
        this.currentLevel = levelIndex;
        const cfg = this.config[levelIndex];
        if (!cfg) return;

        this.fastLaneActive = false;
        this.fastLaneDensityFactor = 1.0;
        this.lastPopulatedEndX = -Infinity;

        console.log(`Starting Level ${levelIndex}: ${cfg.name}`);

        const player = this.getPlayer();
        const playerX = player ? player.position.x : 0;
        const { startX: levelStartX, endX: levelEndX, length: levelLength } = getLevelSpan(levelIndex);

        playerState.autoScrollSpeed = cfg.speed;
        playerState.distanceToMoon = cfg.distance;

        let transitionDuration = 2.0;
        if (levelIndex === 3) {
            transitionDuration = 100.0;
        }

        this.atmosphereSystem.transitionTo(cfg.skyColors.top, cfg.skyColors.bottom, transitionDuration);
        nebulaSystem.setSkyColors(cfg.skyColors.top, cfg.skyColors.bottom);

        if (this.scene.fog) {
            if (this.scene.fog instanceof THREE.Fog) {
                if (cfg.fogDensity) {
                    this.scene.fog.far = DEFAULT_FOG_FAR * (1 - cfg.fogDensity * FOG_FAR_DENSITY_FACTOR);
                    this.scene.fog.near = DEFAULT_FOG_NEAR * (1 - cfg.fogDensity * FOG_NEAR_DENSITY_FACTOR);
                } else {
                    this.scene.fog.far = DEFAULT_FOG_FAR;
                    this.scene.fog.near = DEFAULT_FOG_NEAR;
                }
            }
        }

        const levelDiv = document.getElementById('level-display');
        if (levelDiv) levelDiv.innerHTML = `Level ${levelIndex}: ${cfg.name}`;
        this.onUpdateLevelDisplay?.(levelIndex, cfg.name);
        this.onLevelStart?.(cfg);
        applyLevelDecorationBudgets(cfg, this.objectDensityMultiplier);

        this.populateZone(playerX + STREAM_AHEAD_START, playerX + STREAM_AHEAD_END, cfg);

        this.cloudSystem.setLevel(cfg);

        chromaShiftSystem.clearRocks();
        if (cfg.chromaShiftDensity && cfg.chromaShiftDensity > 0) {
            chromaShiftSystem.activate();
        } else {
            chromaShiftSystem.deactivate();
        }

        if (cfg.stormGeodeDensity && cfg.stormGeodeDensity > 0 && stormGeodeSystem) {
            stormGeodeSystem.activate(cfg.stormGeodeDensity);
        } else if (stormGeodeSystem) {
            stormGeodeSystem.deactivate();
        }

        const environments = cfg.environments || {};

        const environmentPlugins: EnvironmentPlugin[] = [
            {
                flag: 'butterflySwarm',
                activate: () => this.butterflySwarmSystem.activate(),
                deactivate: () => this.butterflySwarmSystem.deactivate()
            },
            {
                flag: 'blackHole',
                activate: (blackHoleConfig: any) => blackHoleSystem.activate(blackHoleConfig),
                deactivate: () => blackHoleSystem.deactivate()
            },
            {
                flag: 'industrial',
                activate: () => industrialSystem.activate(),
                deactivate: () => industrialSystem.deactivate()
            },
            {
                flag: 'waterfall',
                activate: () => waterfallSystem.activate(),
                deactivate: () => waterfallSystem.deactivate()
            },
            {
                flag: 'planetaryHorizon',
                activate: () => {
                    planetaryHorizonSystem.levelDistance = levelLength;
                    planetaryHorizonSystem.activate();
                },
                deactivate: () => planetaryHorizonSystem.deactivate()
            },
            {
                flag: 'reEntry',
                activate: () => {
                    reEntrySystem.levelDistance = levelLength;
                    reEntrySystem.activate();
                },
                deactivate: () => reEntrySystem.deactivate()
            },
            {
                flag: 'biological',
                activate: () => {
                    biologicalSystem.activate();
                    this.cloudSystem.layers.forEach(l => l.mesh.visible = false);
                },
                deactivate: () => {
                    biologicalSystem.deactivate();
                    const cloudsVisible = (cfg.foliageDensity.cloud ?? 20) > 0;
                    this.cloudSystem.layers.forEach(l => l.mesh.visible = cloudsVisible);
                }
            },
            {
                flag: 'nebula',
                activate: () => {
                    nebulaSystem.activate();
                    nebulaSystem.activateRibbons();
                },
                deactivate: () => nebulaSystem.deactivate()
            },
            {
                flag: 'nebulaRibbons',
                activate: () => nebulaSystem.activateRibbons(),
                deactivate: () => nebulaSystem.deactivateRibbons()
            },
            {
                flag: 'cosmicDust',
                activate: () => {
                    cosmicDustSystem.activate();
                    nebulaSystem.activateRibbons();
                },
                deactivate: () => {
                    cosmicDustSystem.deactivate();
                    nebulaSystem.deactivateRibbons();
                }
            }
,
            {
                flag: 'godRays',
                activate: (config: GodRaysEnvironmentConfig) => this.godRaySystem.activate(config),
                deactivate: () => this.godRaySystem.deactivate()
            },
            {
                flag: 'aurora',
                activate: (config: AuroraEnvironmentConfig) => this.auroraSystem.activate(config),
                deactivate: () => this.auroraSystem.deactivate()
            },
            {
                flag: 'lightning',
                activate: (config: LightningEnvironmentConfig) => lightningBoltSystem.activate(config),
                deactivate: () => lightningBoltSystem.deactivate()
            },
            {
                flag: 'asteroidField',
                activate: (config: AsteroidFieldEnvironmentConfig) => {
                    asteroidFieldSystem.activate();
                    this.baseAsteroidDensity = config.rate * 0.5;
                    asteroidFieldSystem.setDensity(this.baseAsteroidDensity * this.objectDensityMultiplier);
                    asteroidFieldSystem.setCandyChance(cfg.candyAsteroidChance ?? 0);
                    asteroidFieldSystem.resetPositions(this.camera.position.x);
                },
                deactivate: () => {
                    this.baseAsteroidDensity = 0;
                    asteroidFieldSystem.deactivate();
                }
            },
            {
                flag: 'ghostDebris',
                activate: () => this.ghostDebrisSystem.activate(),
                deactivate: () => this.ghostDebrisSystem.deactivate()
            },
            {
                flag: 'voidJellyfish',
                activate: (config) => this.voidJellyfishSystem.activate(config),
                deactivate: () => this.voidJellyfishSystem.deactivate()
            },
            {
                flag: 'meteorShower',
                activate: () => meteorShowerSystem.activate(),
                deactivate: () => meteorShowerSystem.deactivate()
            }        ];

        for (const plugin of environmentPlugins) {
            const value = environments[plugin.flag];
            if (isEnvironmentEnabled(value)) {
                plugin.activate(value as never);
            } else {
                plugin.deactivate();
            }
        }

        // Level 3 rescue objective friends spawn (kept with level guard for exact prior behavior;
        // objective-driven but historically only on level 3).
        if (levelIndex === 3) {
            if (this.friendsManager && cfg.objective?.type === 'rescue') {
                this.friendsManager.spawnTrappedFriendsAlong(
                    playerX + 100,
                    levelLength - 200,
                    cfg.objective.target
                );
            }
        }

        // Dreamy side-scroller layers — span the actual level segment, not cfg.distance
        const dreamyPadding = 80;
        const dreamyStart = levelStartX + dreamyPadding;
        const dreamyEnd = levelEndX - dreamyPadding;

        if (levelIndex <= 3 || levelIndex >= 6) {
            this.flowerManager.cleanup();
            this.flowerManager.generateConstellation(
                15,
                dreamyStart,
                dreamyEnd,
                DEPTH_LAYERS.BACKGROUND.min,
                DEPTH_LAYERS.BACKGROUND.max
            );

            this.castleManager.clear();
            this.castleManager.generateCastleField(8, dreamyStart + 50, dreamyEnd - 50);
        }

        if (levelIndex !== 4 && levelIndex !== 5) {
            this.candyManager.clear();
            this.candyManager.generateCandyBelt(
                dreamyStart,
                levelLength * 0.85,
                0.22,
                DEPTH_LAYERS.NEAR
            );
        }

        this.pinwheelManager.clear();
        this.windChimeManager.clear();
        this.solarSailFernManager.clear();
        crystalChimeManager.clear();
        if (cfg.pinwheelDensity && cfg.pinwheelDensity > 0) {
            this.pinwheelManager.spawnField(
                dreamyStart,
                levelLength,
                cfg.pinwheelDensity,
                [-18, 18],
                [DEPTH_LAYERS.BACKGROUND.min, DEPTH_LAYERS.NEAR.max]
            );
        }
        if (cfg.windChimeDensity && cfg.windChimeDensity > 0) {
            this.windChimeManager.spawnField(
                dreamyStart,
                levelLength,
                cfg.windChimeDensity,
                [6, 24]
            );
        }
    }

    cleanupBehind(cameraX: number) {
        const cutoff = cameraX - 100;
        for (let i = this.levelObjects.length - 1; i >= 0; i--) {
            const obj = this.levelObjects[i];
            if (obj.position.x < cutoff) {
                this.scene.remove(obj);
                const mpIdx = moonPlants.indexOf(obj);
                if (mpIdx !== -1) moonPlants.splice(mpIdx, 1);
                disposeObject(obj);
                this.levelObjects.splice(i, 1);
                decorationBudget.reportDestroy('foliage_scatter');
            }
        }
    }

    /** Stream decorative foliage ahead as the player progresses. */
    private maybeStreamFoliage(cameraX: number) {
        const cfg = this.config[this.currentLevel];
        if (!cfg) return;

        const targetEnd = cameraX + STREAM_AHEAD_END;
        if (targetEnd <= this.lastPopulatedEndX) return;

        const startX = Math.max(this.lastPopulatedEndX, cameraX + STREAM_AHEAD_START);
        this.populateZone(startX, targetEnd, cfg);
    }

    update(delta: number, cameraX: number, speed: number, isFiring: boolean = false, fireDir?: THREE.Vector3) {
        this.maybeStreamFoliage(cameraX);
        this.cleanupBehind(cameraX);
        this.atmosphereSystem.update(delta, new THREE.Vector3(cameraX, 0, 0));
        nebulaSystem.setSkyColors(
            this.atmosphereSystem.getTopColor().getHex(),
            this.atmosphereSystem.getBottomColor().getHex()
        );
        this.cloudSystem.update(delta, cameraX, speed, this.getPlayer()?.position);
        lightningBoltSystem.update(delta, cameraX, speed, this.getPlayer()?.position);

        const dbg = this.debugSystem;
        const enabled = (name: string) => !dbg || dbg.isEnabled(name);
        const playerPos = this.getPlayer()?.position;

        if (enabled('waterfall')) waterfallSystem.update(cameraX, delta, playerPos);
        if (enabled('industrial')) industrialSystem.update(cameraX, delta, playerPos);
        if (enabled('biological')) biologicalSystem.update(delta, cameraX);
        if (enabled('nebula') || enabled('nebulaRibbons') || enabled('cosmicDust')) {
            nebulaSystem.update(delta, cameraX, playerPos, speed);
        }
        if (enabled('meteorShower')) meteorShowerSystem.update(delta, cameraX);
        if (enabled('cosmicDust')) cosmicDustSystem.update(delta, cameraX, playerPos);
        if (enabled('asteroidField') && asteroidFieldSystem) asteroidFieldSystem.update(delta, cameraX);
        if (enabled('planetaryHorizon') && planetaryHorizonSystem) planetaryHorizonSystem.update(cameraX, delta);
        if (enabled('ghostDebris') && this.ghostDebrisSystem) this.ghostDebrisSystem.update(delta, cameraX);
        if (enabled('voidJellyfish') && this.voidJellyfishSystem) this.voidJellyfishSystem.update(delta, cameraX, playerPos);
        if (blackHoleSystem) blackHoleSystem.update(delta, cameraX, playerPos);
        if (enabled('chromaShift')) chromaShiftSystem.update(delta, playerPos);
        if (enabled('stormGeodes') && stormGeodeSystem) stormGeodeSystem.update(delta, cameraX, playerPos);
        if (enabled('godRays') && this.godRaySystem) this.godRaySystem.update(delta, cameraX, speed, playerPos, isFiring, fireDir);
        if (enabled('reEntry') && reEntrySystem) reEntrySystem.update(delta, cameraX, this.camera.position.y, this.getPlayer() ?? undefined);

        if (enabled('aurora') && this.auroraSystem) this.auroraSystem.update(delta, cameraX, speed, playerPos);
    }

    populateZone(startX: number, endX: number, config: LevelConfig) {
        if (endX <= this.lastPopulatedEndX) return;
        this.lastPopulatedEndX = endX;

        const width = endX - startX;
        if (width <= 0) return;

        const density = config.foliageDensity;
        const levelType = config.levelType || 'open';

        const streamPinwheels = (yRange: [number, number]) => {
            if (config.pinwheelDensity && config.pinwheelDensity > 0) {
                this.pinwheelManager.streamChunk(startX, width, config.pinwheelDensity, yRange);
            }
        };

        const streamWindChimes = () => {
            if (config.windChimeDensity && config.windChimeDensity > 0) {
                this.windChimeManager.streamChunk(startX, width, config.windChimeDensity, [6, 24]);
            }
        };

        if (levelType === 'tunnel') {
            const interval = config.obstacleInterval || 20;
            const sectionCount = Math.floor(width / interval);

            for (let i = 0; i < sectionCount; i++) {
                const xPos = startX + i * interval;
                this.industrialGeometryManager.createIndustrialSection(xPos);
            }

            const tunnelHeight = config.tunnelHeight || 15;
            const yRange: [number, number] = [-tunnelHeight / 2 + 2, tunnelHeight / 2 - 2];
            this.spawnOpenFoliage(startX, width, density, config, yRange);
            streamPinwheels(yRange);
            streamWindChimes();
            return;
        }

        if (levelType === 'organic_tunnel') {
            const interval = config.obstacleInterval || 25;
            const sectionCount = Math.floor(width / interval);

            for (let i = 0; i < sectionCount; i++) {
                const xPos = startX + i * interval;
                this.industrialGeometryManager.createWhaleRibSection(xPos);
            }

            const tunnelHeight = config.tunnelHeight || 20;
            const yRange: [number, number] = [-tunnelHeight / 2 + 3, tunnelHeight / 2 - 3];
            this.spawnOpenFoliage(startX, width, density, config, yRange);
            streamPinwheels(yRange);
            streamWindChimes();
            return;
        }

        this.spawnOpenFoliage(startX, width, density, config);
        streamPinwheels([-18, 18]);
        streamWindChimes();
    }

    spawnOpenFoliage(
        startX: number,
        width: number,
        density: LevelConfig['foliageDensity'],
        levelConfig: LevelConfig,
        yRange: [number, number] = [-20, 20]
    ) {
        const scaledCount = (count: number) => Math.max(0, Math.floor(count * this.objectDensityMultiplier));
        const foliageZ: [number, number] = [DEPTH_LAYERS.MIDGROUND.min, DEPTH_LAYERS.MIDGROUND.max];
        const geoZ: [number, number] = [DEPTH_LAYERS.BACKGROUND.min + 5, DEPTH_LAYERS.MIDGROUND.max];

        const vignettes = levelConfig.vignettes || {};
        const vignetteCount = (base: number | undefined) =>
            base ? Math.max(0, Math.floor(scaledCount(base * (width / 100)))) : 0;

        // Geode clearings: plan centers first so base fern scatter thins near safe harbors
        type ClearingCenter = { x: number; y: number; radius: number };
        const geodeClearings: ClearingCenter[] = [];
        if ((vignettes.geodeClearings || 0) > 0) {
            const nClearings = vignetteCount(vignettes.geodeClearings);
            const geodeCap = Math.max(
                0,
                this.GEOLOGICAL_SPAWN_CAPS.geode - this.geologicalCounts.geodes()
            );
            for (let c = 0; c < Math.min(nClearings, geodeCap); c++) {
                geodeClearings.push({
                    x: startX + Math.random() * width,
                    y: yRange[0] + Math.random() * (yRange[1] - yRange[0]),
                    radius: 12 + Math.random() * 5
                });
            }
        }

        const isInClearing = (x: number, y: number) =>
            geodeClearings.some((c) => {
                const dx = x - c.x;
                const dy = y - c.y;
                return dx * dx + dy * dy < c.radius * c.radius;
            });

        const trackFoliageSpawn = (obj: THREE.Object3D): boolean => {
            if (!decorationBudget.canSpawn('foliage_scatter')) return false;
            if (!decorationBudget.reportSpawn('foliage_scatter')) return false;
            this.scene.add(obj);
            this.levelObjects.push(obj);
            moonPlants.push(obj);
            return true;
        };

        const spawn = (
            count: number,
            creatorFn: () => THREE.Object3D,
            customYRange = yRange,
            zRange: [number, number] = foliageZ,
            speciesId?: string,
            rejectPosition?: (x: number, y: number) => boolean
        ) => {
            for (let i = 0; i < scaledCount(count); i++) {
                let x = 0;
                let y = 0;
                let placed = false;
                for (let attempt = 0; attempt < 5; attempt++) {
                    x = startX + Math.random() * width;
                    y = customYRange[0] + Math.random() * (customYRange[1] - customYRange[0]);
                    if (!rejectPosition || !rejectPosition(x, y)) {
                        placed = true;
                        break;
                    }
                }
                if (!placed || (rejectPosition && rejectPosition(x, y))) continue;

                const z = randomZInRange(zRange);

                const obj = creatorFn();
                obj.position.set(x, y, z);

                const s = 0.8 + Math.random() * 0.5;
                obj.scale.set(s, s, s);

                if (speciesId) obj.userData.speciesId = speciesId;

                if (!trackFoliageSpawn(obj)) continue;
            }
        };

        if (density.fern) {
            spawn(
                density.fern,
                () => createStarDustFern({ color: 0x8A2BE2 }),
                yRange,
                foliageZ,
                'fern',
                isInClearing
            );
        }
        if (density.rose) spawn(density.rose, () => createNebulaRose({ color: 0xFF1493 }), yRange, foliageZ, 'rose');
        if (density.lotus) spawn(density.lotus, () => createSubwooferLotus({ color: 0x00ff88 }), yRange, foliageZ, 'lotus');
        if (density.glowingFlower) spawn(density.glowingFlower, () => createGlowingFlower({ color: 0x00ffff, intensity: 2.0 }), yRange, foliageZ, 'glowingFlower');

        const bandHeight = yRange[1] - yRange[0];
        // Open levels: trees sit in the lower sky band. Tunnels: use lower third of flyable height.
        const treeYRange: [number, number] = bandHeight < 16
            ? [yRange[0] + bandHeight * 0.12, yRange[0] + bandHeight * 0.42]
            : [Math.max(yRange[0], -20), Math.min(yRange[1], -5)];
        if (density.tree) spawn(density.tree, () => createFloweringTree({ color: 0x44ffaa }), treeYRange, foliageZ, 'tree');
        if (density.floweringTree) spawn(density.floweringTree, () => createFloweringTree({ color: 0xffaa44 }), treeYRange, foliageZ, 'floweringTree');

        if (density.shrub) spawn(density.shrub, () => createShrub({ color: 0x32CD32 }), yRange, foliageZ, 'shrub');
        if (density.vine) spawn(density.vine, () => createVine({ color: 0x228B22 }), yRange, foliageZ, 'vine');
        if (density.mushroom) spawn(density.mushroom, () => createPuffballFlower({ color: 0xFF4500 }), yRange, foliageZ, 'mushroom');
        if (density.orb) spawn(density.orb, () => createFloatingOrb({ color: 0x88ccff }), yRange, foliageZ, 'orb');

        if (density.solarSail && density.solarSail > 0) {
            this.solarSailFernManager.streamChunk(startX, width, density.solarSail, yRange);
        }

        if (levelConfig.chimeDensity && levelConfig.chimeDensity > 0) {
            crystalChimeManager.streamChunk(startX, width, levelConfig.chimeDensity, yRange);
        }

        this.spawnFoliageVignettes(startX, width, density, yRange, treeYRange, foliageZ, geoZ, vignettes, vignetteCount, geodeClearings);

        if (density.cloud) {
            const targetCount = Math.min(
                scaledCount(density.cloud),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.cloud - this.geologicalCounts.sporeClouds())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInLayer('BACKGROUND');
                this.spawners.createSporeCloudAtPosition(x, y, z);
            }
        }

        if (density.voidRootBall) {
            const targetCount = Math.min(
                scaledCount(density.voidRootBall),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.voidRootBall - this.geologicalCounts.voidRootBalls())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInRange(geoZ);
                this.spawners.createVoidRootBallAtPosition(x, y, z);
            }
        }

        if (density.vacuumKelp) {
            const targetCount = Math.min(
                scaledCount(density.vacuumKelp),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.vacuumKelp - this.geologicalCounts.vacuumKelps())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * 15;
                const z = randomZInRange(geoZ);
                this.spawners.createVacuumKelpAtPosition(x, y, z);
            }
        }

        if (density.iceNeedle) {
            const targetCount = Math.min(
                scaledCount(density.iceNeedle),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.iceNeedle - this.geologicalCounts.iceNeedleClusters())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInRange(geoZ);
                this.spawners.createIceNeedleClusterAtPosition(x, y, z);
            }
        }

        if (levelConfig.chromaShiftDensity && levelConfig.chromaShiftDensity > 0) {
            const count = Math.min(scaledCount(levelConfig.chromaShiftDensity), 200);
            for (let i = 0; i < count; i++) {
                const x = startX + Math.random() * width;
                const y = Math.random() * (yRange[1] - yRange[0]) + yRange[0];
                const z = randomZInLayer('NEAR');

                chromaShiftSystem.addRock(new THREE.Vector3(x, y, z), 2 + Math.random() * 2);
            }
        }

        if (density.liquidMetal) {
            const targetCount = Math.min(scaledCount(density.liquidMetal), this.GEOLOGICAL_SPAWN_CAPS.liquidMetal);
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInRange(geoZ);
                this.spawners.createLiquidMetalBlobAtPosition(x, y, z);
            }
        }

        if (density.magmaHeart) {
            const targetCount = Math.min(
                scaledCount(density.magmaHeart),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.magmaHeart - this.geologicalCounts.magmaHearts())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInRange(geoZ);
                this.spawners.createMagmaHeartAtPosition(x, y, z);
            }
        }

        if (density.gravityAnchor) {
            const targetCount = Math.min(
                scaledCount(density.gravityAnchor),
                Math.max(0, this.GEOLOGICAL_SPAWN_CAPS.gravityAnchor - this.geologicalCounts.gravityAnchors())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInRange(geoZ);
                this.spawners.createGravityAnchorAtPosition(x, y, z, this.currentLevel);
            }
        }
    }

    /** Composed cluster passes after uniform scatter — reuses existing foliage factories. */
    private spawnFoliageVignettes(
        startX: number,
        width: number,
        density: LevelConfig['foliageDensity'],
        yRange: [number, number],
        treeYRange: [number, number],
        foliageZ: [number, number],
        geoZ: [number, number],
        vignettes: NonNullable<LevelConfig['vignettes']>,
        vignetteCount: (base: number | undefined) => number,
        geodeClearings: { x: number; y: number; radius: number }[]
    ) {
        // Tree groves: 3–6 trees in ~14 unit X cluster, shared tight Y band
        if ((vignettes.treeGroves || 0) > 0 && (density.tree || density.floweringTree)) {
            const nGroves = vignetteCount(vignettes.treeGroves);
            for (let g = 0; g < nGroves; g++) {
                const gx = startX + Math.random() * width;
                const gY = treeYRange[0] + Math.random() * (treeYRange[1] - treeYRange[0]);
                const gSize = 3 + Math.floor(Math.random() * 4);
                const gZ = randomZInRange(foliageZ);
                const isFlowering = density.floweringTree && (Math.random() < 0.5 || !density.tree);
                for (let t = 0; t < gSize; t++) {
                    const tx = gx + (Math.random() - 0.5) * 14;
                    const ty = gY + (Math.random() - 0.5) * 2.5;
                    const tz = gZ + (Math.random() - 0.5) * 2;
                    const creator = isFlowering
                        ? () => createFloweringTree({ color: 0xffaa44 })
                        : () => createFloweringTree({ color: 0x44ffaa });
                    const obj = creator();
                    obj.position.set(tx, ty, tz);
                    const s = 0.75 + Math.random() * 0.35;
                    obj.scale.set(s, s, s);
                    obj.userData.speciesId = isFlowering ? 'floweringTree' : 'tree';
                    trackFoliageSpawn(obj);
                }
            }
        }

        // Rose arches: pairs offset in X/Z framing a vertical gap (encourages diving)
        if ((vignettes.roseArches || 0) > 0 && density.rose) {
            const nArches = vignetteCount(vignettes.roseArches);
            for (let a = 0; a < nArches; a++) {
                const ax = startX + Math.random() * width;
                const az = randomZInRange(foliageZ);
                const gapY = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const sep = 5.5 + Math.random() * 3.5;
                const obj1 = createNebulaRose({ color: 0xFF1493 });
                obj1.position.set(ax - 1.5, gapY - sep * 0.5, az - 0.8);
                let s = 0.65 + Math.random() * 0.25;
                obj1.scale.set(s, s, s);
                obj1.userData.speciesId = 'rose';
                trackFoliageSpawn(obj1);

                const obj2 = createNebulaRose({ color: 0xFF1493 });
                obj2.position.set(ax + 1.5, gapY + sep * 0.5, az + 0.8);
                s = 0.65 + Math.random() * 0.25;
                obj2.scale.set(s, s, s);
                obj2.userData.speciesId = 'rose';
                trackFoliageSpawn(obj2);
            }
        }

        // Geode clearings: spawn FracturedGeode safe harbors at pre-planned centers
        for (const clearing of geodeClearings) {
            const z = randomZInRange(geoZ);
            this.spawners.createGeodeAtPosition(clearing.x, clearing.y, z);
        }
    }

    checkProgress(playerX: number) {
        const nextBoundary = LEVEL_DISTANCE_BOUNDARIES[this.currentLevel];
        if (this.currentLevel < 6 && nextBoundary !== undefined && playerX > nextBoundary) {
            this.startLevel(this.currentLevel + 1);
        }
    }

    getJourneyProgress(playerX: number): { percent: number; level: number } {
        const total = LEVEL_DISTANCE_BOUNDARIES[LEVEL_DISTANCE_BOUNDARIES.length - 1];
        const percent = Math.min(100, Math.max(0, (playerX / total) * 100));
        return { percent, level: this.currentLevel };
    }
}
