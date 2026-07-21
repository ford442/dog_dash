import * as THREE from 'three';
import {
    particleSystem, debrisSystem, weaponSystem, weaponLightManager,
    reEntrySystem, waterfallSystem, asteroidFieldSystem, planetaryHorizonSystem,
    meteorShowerSystem, industrialSystem, godRaySystem, auroraSystem, nebulaSystem, pastelNebulaSystem,
    cosmicDustSystem, biologicalSystem, liquidMetalSystem, bossManager, audioSystem,
    upgradeSystem, pickupManager, heatSystem, starfield, orbManager, powerUpManager,
    dogController, hudManager, juiceManager, boostSystem, rollSystem,
    effectManager, victorySystem, tutorialSystem, saveManager,
    lightningBoltSystem, chromaShiftSystem, stormGeodeSystem, crystalChimeManager,
    blackHoleSystem
} from '../game_systems';
import { createGameManagers } from '../game_managers';
import { generateEnvironment } from '../environment';
import {
    scene, camera, rendererBackend, requestedRendererBackend, rendererFallbackReason,
    initializeSceneAndRenderer, attachLightsAndEnv
} from '../scene_context';
import { player, onPlayerLoaded } from '../player_loader';
import { playerState, showError } from '../game_config';
import { LevelManager } from '../level_manager';
import { CreatureManager } from '../creature_manager';
import { DiscoveryManager, CreatureCatalogManager } from '../discovery_system';
import { SlingObjectiveManager } from '../sling_objective';
import { SlingComboManager } from '../sling_combo';
import { TetherSystem } from '../tether_system';
import { spawnGravLensCorridorsForLevel } from './grav_lens_update';
import { spawnArtifactsForLevel } from './artifact_update';
import { DebugSystem } from '../debug_system';
import { decorationBudget, registerDefaultDecorationBudgets } from '../decoration_budget';
import { createGalaxy, createMoon } from '../visuals';
import { shouldShowTutorial } from '../tutorial_system';
import { ShakeType } from '../juice_effects';
import { hasDebugUrlFlag } from '../renderer_mode';
import { loadWasm as loadWasmModule } from '../wasm_loader';
import { game } from '../game_runtime';
import {
    createGhostDebrisSystemStub,
    createVoidJellyfishSystemStub,
    createIndustrialGeometryManagerStub,
    createAquaticLifeManagerStub,
    createStarlightKoiManagerStub,
    createBubbleCoralManagerStub,
    createSlingableObjectSystemStub,
    createToyRocketSpawnManagerStub
} from '../deferred_system_stubs';
import type { IndustrialGeometryManager } from '../industrial_geometry';

async function loadWasm(): Promise<void> {
    const handle = await loadWasmModule();
    if (handle) {
        game.wasmExports = handle.exports;
        game.wasmMemory = handle.memory;
    }
}

function registerDebugSystem(): void {
    const debugSystem = new DebugSystem();
    registerDefaultDecorationBudgets();
    decorationBudget.attachToDebugSystem(debugSystem);
    debugSystem.setRendererInfo(rendererBackend, requestedRendererBackend, rendererFallbackReason);
    game.creatureManager.setDebugSystem(debugSystem);

    const flags: Array<[string, string, boolean]> = [
        ['creature_tarsier_guardian', 'Crystal Tarsier', true],
        ['creature_geode_titan', 'Geode Titan', true],
        ['creature_moon_jelly', 'Moon Jelly', true],
        ['creature_aurora_ray', 'Aurora Ray', true],
        ['creature_nebula_puffer', 'Nebula Puffer', true],
        ['creature_moon_snail', 'Moon Snail', true],
        ['particles', 'Particles', true],
        ['debris', 'Debris', true],
        ['weaponLights', 'Weapon Lights', true],
        ['reEntry', 'Re-Entry Effects', true],
        ['butterflySwarm', 'Butterfly Swarm', true],
        ['starfield', 'Starfield', true],
        ['magicalEffects', 'Magical Effects', true],
        ['spaceFriends', 'Space Friends', true],
        ['geologicalObjects', 'Geological Objects', true],
        ['industrialGeo', 'Industrial Geometry', true],
        ['moonEffects', 'Moon / Galaxy Effects', true],
        ['pilotAnim', 'Pilot Animation', true],
        ['flowerConstellations', 'Flower Constellations', true],
        ['pinwheelFlora', 'Pinwheel Flowers', true],
        ['solarSailFerns', 'Solar Sail Ferns', true],
        ['crystalChimes', 'Crystal Chimes', true],
        ['windChimes', 'Wind Chime Mobiles', true],
        ['candyBelt', 'Candy Belt', true],
        ['cloudCastles', 'Cloud Castles', true],
        ['shadows', 'Shadows', true],
        ['nebula', 'Nebula', true],
        ['nebulaRibbons', 'Nebula Ribbons', true],
        ['cosmicDust', 'Cosmic Dust', true],
        ['biological', 'Biological Background', true],
        ['industrialBg', 'Industrial Background', true],
        ['waterfall', 'Waterfall', true],
        ['asteroidField', 'Asteroid Field', true],
        ['planetaryHorizon', 'Planetary Horizon', true],
        ['ghostDebris', 'Ghost Debris', true],
        ['voidJellyfish', 'Void Jellyfish', rendererBackend !== 'webgl'],
        ['starlightKoi', 'Starlight Koi', true],
        ['bubbleCoral', 'Rainbow Bubble Coral', true],
        ['chromaShift', 'Chroma Rocks', true],
        ['godRays', 'God Rays', true],
        ['aurora', 'Aurora Borealis', true],
        ['wireframe', 'Wireframe', hasDebugUrlFlag('wireframe')],
        ['collisionDebug', 'Collision Debug', hasDebugUrlFlag('collisionDebug') || hasDebugUrlFlag('collision-debug')]
    ];
    for (const [id, label, enabled] of flags) {
        debugSystem.register(id, label, enabled);
    }
    game.debugSystem = debugSystem;
}

import {
    sporeClouds, voidRootBalls, vacuumKelps, iceNeedleClusters,
    magmaHearts, gravityAnchors, geodes,
    createSporeCloudAtPosition, createVoidRootBallAtPosition,
    createVacuumKelpAtPosition, createIceNeedleClusterAtPosition,
    createLiquidMetalBlobAtPosition, createMagmaHeartAtPosition,
    createGravityAnchorAtPosition, createGeodeAtPosition
} from '../environment';
import {
    createGravityAnchorWithTarsiers,
    createGeodeAtPositionWithLemur,
    createIceNeedleClusterAtPositionWithLemur,
    createSlingableObjectAtPosition
} from './spawn_helpers';
import { wireStartupCallbacks } from './startup_callbacks';
import { createObstacleSystem, handleGameOver } from './obstacle_setup';
import { ensureGameplayReady } from '../level_systems_loader';

/** Prototype sling/geological content — deferred until first gameplay click. */
export async function spawnDeferredPrototypeContent(): Promise<void> {
    await ensureGameplayReady();

    createGravityAnchorWithTarsiers(80, 5, -25, 1);
    createGravityAnchorWithTarsiers(180, -6, -20, 1);
    createGravityAnchorWithTarsiers(280, 8, -22, 1);

    createSlingableObjectAtPosition(96, 3, -14, {
        radius: 1.1, mass: 1.6,
        velocity: new THREE.Vector3(-1.6, 0.8, 0.25),
        color: 0x8dffda, emissive: 0x66ffee
    });
    createSlingableObjectAtPosition(154, -5, -16, {
        radius: 1.35, mass: 2.2,
        velocity: new THREE.Vector3(-1.2, -0.55, -0.2),
        color: 0xffb27d, emissive: 0xff8f66
    });
    createSlingableObjectAtPosition(236, 7, -18, {
        radius: 1.2, mass: 1.9,
        velocity: new THREE.Vector3(-1.45, 0.35, 0.3),
        color: 0x8eb7ff, emissive: 0x78d6ff
    });
    createSlingableObjectAtPosition(400, -2, -15, {
        radius: 1.3, mass: 1.2,
        velocity: new THREE.Vector3(-1.0, 0, 0.15), kind: 'puffball'
    });
    createSlingableObjectAtPosition(460, 6, -17, {
        radius: 1.15, mass: 1.7,
        velocity: new THREE.Vector3(-1.3, -0.4, 0.2), kind: 'chromaRock'
    });
    createSlingableObjectAtPosition(520, 0, -14, {
        radius: 0.85, mass: 0.6,
        velocity: new THREE.Vector3(-1.1, 0.5, 0.1), kind: 'tetherSprite'
    });
    createSlingableObjectAtPosition(2350, 3, -16, {
        radius: 1.6, mass: 4.0,
        velocity: new THREE.Vector3(-0.8, 0, 0), kind: 'wreckingBall'
    });
    createSlingableObjectAtPosition(3350, -4, -16, {
        radius: 1.8, mass: 4.5,
        velocity: new THREE.Vector3(-0.9, 0.2, 0), kind: 'wreckingBall'
    });
}

export async function spawnDeferredVideoStars(): Promise<void> {
    const { VideoTumblingStar } = await import('../video_tumbling_star');
    game.videoTumblingStars = [
        new VideoTumblingStar(scene, 360, 12, -45),
        new VideoTumblingStar(scene, 980, -6, -40),
        new VideoTumblingStar(scene, 1620, 8, -48)
    ];
}

function createLevelManager(industrialGeometryManager: IndustrialGeometryManager): LevelManager {
    return new LevelManager({
        weaponLightManager,
        scene,
        camera,
        getPlayer: () => player,
        friendsManager: game.friendsManager,
        industrialGeometryManager,
        ghostDebrisSystem: game.ghostDebrisSystem,
        voidJellyfishSystem: game.voidJellyfishSystem,
        godRaySystem,
        auroraSystem,
        butterflySwarmSystem: game.butterflySwarmSystem,
        flowerManager: game.flowerManager,
        pinwheelManager: game.pinwheelManager,
        windChimeManager: game.windChimeManager,
        solarSailFernManager: game.solarSailFernManager,
        castleManager: game.castleManager,
        candyManager: game.candyManager,
        debugSystem: game.debugSystem,
        spawners: {
            createSporeCloudAtPosition,
            createVoidRootBallAtPosition,
            createVacuumKelpAtPosition,
            createIceNeedleClusterAtPosition: createIceNeedleClusterAtPositionWithLemur,
            createLiquidMetalBlobAtPosition,
            createMagmaHeartAtPosition,
            createGravityAnchorAtPosition: createGravityAnchorWithTarsiers,
            createGeodeAtPosition: createGeodeAtPositionWithLemur
        },
        geologicalCounts: {
            sporeClouds: () => sporeClouds.length,
            voidRootBalls: () => voidRootBalls.length,
            vacuumKelps: () => vacuumKelps.length,
            iceNeedleClusters: () => iceNeedleClusters.length,
            magmaHearts: () => magmaHearts.length,
            gravityAnchors: () => gravityAnchors.length,
            geodes: () => geodes.length
        },
        onLevelStart: (cfg) => {
            playerState.autoScrollSpeed = cfg.speed;
            playerState.distanceToMoon = cfg.distance;
            game.creatureManager.clear();
            game.discoveryManager.reset();
            game.friendsManager.resetLevelLemurCap();
            game.toyRocketSpawnManager.spawnForLevel(game.levelManager.currentLevel, cfg);
            spawnGravLensCorridorsForLevel(game.levelManager.currentLevel, cfg);
            spawnArtifactsForLevel(cfg, player?.position.x ?? 0);
            game.wrenchChargeAvailable = saveManager.hasMemory('mine_robot');
            game.slingObjectiveManager.reset(cfg.objective?.type === 'sling' ? cfg.objective.target : 0);
            if (cfg.objective?.type === 'scan') {
                hudManager.setObjectiveLabel('🔍 Catalog');
                hudManager.updateObjectiveProgress(0, cfg.objective.target);
            } else if (cfg.objective?.type === 'sling') {
                hudManager.setObjectiveLabel('🎯 Slings');
                hudManager.updateObjectiveProgress(0, cfg.objective.target);
            } else if (cfg.objective?.type === 'rescue') {
                hudManager.setObjectiveLabel('🚀 Rescue');
                hudManager.updateObjectiveProgress(game.friendsManager.getRescuedCount(), cfg.objective.target);
            } else if (cfg.objective) {
                const OBJECTIVE_ICONS: Record<string, string> = { survive: '🛡️', combo: '⚡', boss: '👑' };
                const icon = OBJECTIVE_ICONS[cfg.objective.type] ?? '🎯';
                hudManager.setObjectiveLabel(`${icon} ${cfg.objective.description}`);
                hudManager.updateObjectiveProgress(0, 0);
            } else {
                hudManager.updateObjectiveProgress(0, 0);
            }
            if (cfg.objective?.type === 'rescue' && game.levelManager.currentLevel === 3) {
                const px = player?.position.x ?? 0;
                game.friendsManager.spawnTrappedLemurIsland(px + 240, 5 + Math.random() * 4, -16 - Math.random() * 8);
            }
        },
        onUpdateLevelDisplay: (levelIndex, name) => {
            const levelDiv = document.getElementById('level-display');
            if (levelDiv) levelDiv.innerHTML = `Level ${levelIndex}: ${name}`;
        }
    });
}

/** Scene init, WASM, manager wiring, level manager, moon/galaxy, prototype spawns. */
export function initializeStartup(): void {
    try {
        initializeSceneAndRenderer({ basePixelRatio: 0.60 });
        attachLightsAndEnv(generateEnvironment());
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error occurred during startup.';
        showError('Initialization Error', message);
        throw err;
    }

    void loadWasm();

    // Shared systems from game_systems.ts (single canonical instances)
    Object.assign(game, {
        particleSystem, debrisSystem, weaponSystem, weaponLightManager,
        reEntrySystem, waterfallSystem, asteroidFieldSystem, planetaryHorizonSystem,
        meteorShowerSystem, industrialSystem, godRaySystem, auroraSystem, nebulaSystem,
        cosmicDustSystem, biologicalSystem, liquidMetalSystem, bossManager, audioSystem,
        upgradeSystem, pickupManager, heatSystem, starfield, orbManager, powerUpManager,
        dogController, hudManager, juiceManager, boostSystem, rollSystem,
        effectManager, victorySystem, tutorialSystem, saveManager,
        lightningBoltSystem, chromaShiftSystem, stormGeodeSystem, crystalChimeManager,
        blackHoleSystem,
        playerState,
        lastPlayerDamageTime: -999,
        aquaticLifeSpawnedLevel: null as number | null,
        koiSpawnedLevel: null as number | null,
        coralSpawnedLevel: null as number | null,
        level6BossDefeated: false,
        whaleSongTimer: 30,
        moonGateSequenceActive: false,
        moonGateSequenceTimer: 0,
        krakenMemoryRewarded: new WeakSet<object>(),
        wrenchChargeAvailable: false,
        scoreMultiplierUntil: 0,
        scoreMultiplierValue: 1,
        tetherSpriteSweep: 0,
        tetherSpritePrevAngle: null as number | null,
        bestiaryUI: null as HTMLDivElement | null,
        fpsFrameCount: 0,
        fpsElapsedTime: 0,
        fpsLowDuration: 0,
        fpsHighDuration: 0,
        objectDensityMultiplier: 1.0,
        shadowCullingFrame: 0,
        shadowCullingWarningIssued: false,
        renderDebugWarningIssued: false,
        geologicalUpdateFrame: 0,
        wantsBoost: false,
        wasTouchBoosting: false,
        wantsRoll: false,
        wasTouchRolling: false,
        wantsTether: false,
        wantsReleaseTether: false
    });

    playerState.maxHealth = saveManager.applyToHealth(3);
    playerState.health = playerState.maxHealth + saveManager.getStartingHealthBonus();
    playerState.autoScrollSpeed = saveManager.applyToSpeed(8);

    const managers = createGameManagers(scene, audioSystem, particleSystem);
    Object.assign(game, managers);
    game.butterflySwarmSystem.bindEffects(particleSystem, juiceManager, audioSystem);

    game.slingableObjectSystem = createSlingableObjectSystemStub();
    game.toyRocketSpawnManager = createToyRocketSpawnManagerStub();
    game.ghostDebrisSystem = createGhostDebrisSystemStub();
    game.voidJellyfishSystem = createVoidJellyfishSystemStub();
    game.aquaticLifeManager = createAquaticLifeManagerStub();
    game.starlightKoiManager = createStarlightKoiManagerStub();
    game.bubbleCoralManager = createBubbleCoralManagerStub();
    game.creatureManager = new CreatureManager({ scene, particleSystem, debrisSystem, audioSystem });
    game.discoveryManager = new DiscoveryManager(saveManager);
    game.creatureCatalogManager = new CreatureCatalogManager(saveManager);
    game.slingObjectiveManager = new SlingObjectiveManager();
    game.slingComboManager = new SlingComboManager({
        juiceManager, hudManager, dogController, audioSystem, particleSystem,
        onScoreBonus: (points) => hudManager.addScore(points),
        onSlingAssist: (duration) => { playerState.slingAssistTimer = duration; },
        slingAssistDuration: saveManager.hasMemory('tarsier') ? 6.0 : 4.0,
        comboTimeout: saveManager.hasMemory('astro_bunny') ? 5.5 : 4.0
    });
    game.tetherSystem = new TetherSystem(scene, {
        maxRange: 60, pullStrength: 18, cooldown: 3, slingImpulse: 22,
        onLatch: () => { audioSystem.playTetherLatch(); juiceManager.shakeScreen(ShakeType.MEDIUM, 0.2); },
        onRelease: () => { audioSystem.playTetherRelease(); juiceManager.shakeScreen(ShakeType.MEDIUM, 0.3); },
        onCooldownEnd: () => {}
    });

    onPlayerLoaded((loadedPlayer: THREE.Group, rocketModelOrGroup: unknown) => {
        effectManager.setTarget(loadedPlayer);
        const dogTarget = (rocketModelOrGroup as THREE.Object3D) || loadedPlayer;
        try { dogController.initialize(dogTarget); } catch { dogController.initialize(loadedPlayer); }
        console.log('🚀 Rocket loaded via player_loader onto canonical scene');
    });

    if (shouldShowTutorial(saveManager)) {
        tutorialSystem.onComplete(() => console.log('Tutorial complete! Starting game...'));
    }

    registerDebugSystem();

    game.galaxy1 = createGalaxy(200, 30, -100, 0x8844ff);
    scene.add(game.galaxy1);
    game.galaxy2 = createGalaxy(-150, -20, -120, 0x4488ff);
    scene.add(game.galaxy2);
    game.galaxy3 = createGalaxy(300, 10, -90, 0xff4488);
    scene.add(game.galaxy3);

    game.moon = createMoon();
    game.moon.position.set(500, 5, -50);
    scene.add(game.moon);

    game.videoTumblingStars = [];

    const industrialGeometryManager = createIndustrialGeometryManagerStub() as IndustrialGeometryManager;
    game.industrialGeometryManager = industrialGeometryManager;
    game.levelManager = createLevelManager(industrialGeometryManager);
    game.levelManager.cloudSystem.setCamera(camera);

    wireStartupCallbacks();
    game.obstacleSystem = createObstacleSystem();
    game.handleGameOver = handleGameOver;
}
