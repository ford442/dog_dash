import * as THREE from 'three';
import { GhostDebrisSystem } from './ghost_debris';
import { VoidJellyfishSystem } from './void_jellyfish';
import { godRaySystem, auroraSystem, blackHoleSystem, industrialSystem, crystalChimeManager } from './game_systems';
import { createGameManagers } from './game_managers';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createStars, uStarOpacity } from './stars';
import { 
    createSubwooferLotus, 
    createFiberOpticWillow, 
    createGlowingFlower, 
    createStarDustFern,
    createNebulaRose,
    createFloweringTree,
    createShrub,
    createFloatingOrb,
    createVine,
    animateFoliage,
    createSolarSail,
    updateSolarSail
} from './foliage';
import { ParticleSystem, DebrisSystem } from './particles';
import { CloudSystem } from './clouds';
import {
    SporeCloud,
    createFracturedGeode, damageGeode,
    updateGeode,
    createNebulaJellyMoss,
    updateNebulaJellyMoss,
    destroyNebulaJellyMoss,
    createVoidRootBall,
    updateVoidRootBall,
    createVacuumKelp,
    updateVacuumKelp,
    createIceNeedleCluster,
    updateIceNeedleCluster,
    createMagmaHeart,
    updateMagmaHeart,
    LiquidMetalSystem,
    updateGravityAnchor,
    GA_SLING_BONUS
} from './geological';
import { ReEntrySystem } from './reentry';
import { WaterfallSystem } from './waterfall';
import { AsteroidFieldSystem } from './asteroid_field';
import { PlanetaryHorizonSystem } from './planetary_horizon';
import { IndustrialBackgroundSystem } from './industrial_background';

import { CosmicDustSystem } from './cosmic_dust';
import { BiologicalBackgroundSystem } from './biological_background';
import { AtmosphereSystem } from './sky';
import { WeaponSystem } from './weapons';
import { WeaponLightManager } from './lighting';
import {
  generateEnvironment,
  // Canonical geological helpers + cleanup (single copy; adds to shared scene)
  sporeClouds,
  jellyMosses,
  solarSails,
  geodes,
  voidRootBalls,
  vacuumKelps,
  iceNeedleClusters,
  magmaHearts,
  gravityAnchors,
  liquidMetalBlobs,
  createSporeCloudAtPosition,
  createGeodeAtPosition,
  createVoidRootBallAtPosition,
  createVacuumKelpAtPosition,
  createIceNeedleClusterAtPosition,
  createMagmaHeartAtPosition,
  createLiquidMetalBlobAtPosition,
  createGravityAnchorAtPosition,
  cleanupGeologicalObjects,

} from './environment';
import {
  scene,
  camera,
  canvas,
  mainLight,
  rimLight,
  accentLight1,
  accentLight2,
  ambientLight,
  renderer,
  rendererBackend,
  requestedRendererBackend,
  rendererFallbackReason,
  touchControls,
  touchSettingsBtn,
  initializeSceneAndRenderer,
  attachLightsAndEnv,
} from './scene_context';
import { player, onPlayerLoaded } from './player_loader';
import { IndustrialGeometryManager } from './industrial_geometry';
import { LEVEL_CONFIG, LEVEL_DISTANCE_BOUNDARIES, type LevelConfig } from './level_config';
import { ObstacleSystem } from './obstacle_system';
import { createUI, gameOver, gameWin, keys, setupKeyboardControls, updateDistanceDisplay, updateHealthDisplay } from './ui_controls';
import { checkPlatformCollision } from './physics_utils';
import { BossManager, StarEaterBoss } from './boss_system';
import { CreatureManager } from './creature_manager';
import { getAudioSystem, initAudioOnInteraction } from './audio_system';
import { UpgradeSystem, PickupManager, HeatSystem, UPGRADE_CONFIGS } from './upgrade_system';
import { getSaveManager, createShopUI } from './save_manager';
import { DiscoveryManager, CreatureCatalogManager } from './discovery_system';
import { createBestiaryUI } from './bestiary';
import { SlingObjectiveManager } from './sling_objective';
import { StarfieldSystem } from './stars';
import { OrbManager, OrbType } from './collectibles';
import { PowerUpManager, PowerUpType } from './powerup_manager';
import { FlotillaMember } from './space_friends';
import { AquaticLifeManager } from './aquatic_life';
import { StarlightKoiManager, shouldSpawnStarlightKoi } from './starlight_koi';
import {
    RainbowBubbleCoralManager,
    shouldSpawnBubbleCoral,
    getBubbleCoralPlacement,
    resolveBubbleCoralClusterCount
} from './bubble_coral';
import { getLevelSpan } from './depth_layers';
import { getCandySlingComboBonus, CANDY_FLAVOR_COLORS, updateCandyMaterialGlobals } from './candy_materials';
import type { CandyAsteroidVariant, CandyFlavor } from './candy_materials';
import { DogCockpitController, DogAnimationState, DogAccessory } from './dog_cockpit';
import { HUDManager } from './hud_system';
import { JuiceManager, ShakeType, BurstType } from './juice_effects';
import { EffectManager, MagicalEffectType } from './magical_effects';
import { 
    TouchControlsManager, 
    TouchInput
} from './touch_controls';
import { VictorySystem, VictoryState } from './victory_system';
import { TutorialSystem, TutorialStep, shouldShowTutorial } from './tutorial_system';
import type { NebulaKraken } from './space_robot_squid';
import { BOSS_DISPLAY_NAME } from './space_robot_squid';
import { BoostSystem } from './boost_system';
import { RollSystem } from './roll_system';
import { TetherSystem } from './tether_system';
import { LevelManager } from './level_manager';
import { DebugSystem } from './debug_system';
import {
    decorationBudget,
    registerDefaultDecorationBudgets
} from './decoration_budget';
import { createGalaxy, createMoon, moonPlants } from './visuals';
import { disposeObject } from './utils';
import { VideoTumblingStar } from './video_tumbling_star';
import { SlingableObjectSystem, type SlingableObjectConfig } from './slingable_objects';
import { ToyRocketSpawnManager } from './toy_rockets';
import { SlingComboManager } from './sling_combo';
import {
    hasDebugUrlFlag,
    type GameRenderer,
    type RendererBackend
} from './renderer_mode';
import {
    CollisionDebugOverlay,
    WebGLMaterialFallbackRenderer,
    WireframeDebugHelper,
    type CollisionDebugTarget
} from './render_debug_helpers';

// --- Configuration ---
const CONFIG = {
    // Visual style (dark, atmospheric like Inside/Little Nightmares)
    colors: {
        background: 0x1a1a2e,
        ground: 0x2d2d44,
        platform: 0x3d3d5c,
        player: 0xe94560,    // Dog - warm red/orange
        accent: 0x0f3460
    },
    // Camera
    cameraDistance: 15,
    cameraHeight: 3,
    // Player physics - Gravity + Momentum flight model
    player: {
        maxSpeedY: 18,        // Maximum climbing speed
        maxDescentSpeed: 22,  // Allow faster falling than climbing
        acceleration: 40,     // Thrust power
        deceleration: 15,     // Air resistance when gliding
        gravity: 8,           // Natural downward pull
        responsiveness: 12,   // Smoothing factor for movement
    },
    // World
    groundLevel: -50 // effectively no ground collision near 0
};

// --- Error Handling ---
function showError(title: string, message: string) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'absolute';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.height = '100%';
    errorDiv.style.backgroundColor = 'rgba(50, 0, 0, 0.9)';
    errorDiv.style.color = 'white';
    errorDiv.style.display = 'flex';
    errorDiv.style.flexDirection = 'column';
    errorDiv.style.justifyContent = 'center';
    errorDiv.style.alignItems = 'center';
    errorDiv.style.zIndex = '10000'; // Very high z-index to be on top of instructions
    errorDiv.style.padding = '20px';
    errorDiv.style.textAlign = 'center';

    const h1 = document.createElement('h1');
    h1.textContent = title;
    h1.style.color = '#ff4444';
    h1.style.marginBottom = '20px';
    errorDiv.appendChild(h1);

    const p = document.createElement('p');
    p.textContent = message;
    p.style.fontSize = '18px';
    p.style.maxWidth = '600px';
    errorDiv.appendChild(p);

    document.body.appendChild(errorDiv);
    console.error(`ERROR: ${title} - ${message}`);
}

// --- Scene / Renderer / Touch (single source via scene_context) ---
// All creation of scene/camera/lights happens in scene_context.
// Main orchestrates init + attachments (no parallel objects created here).
// (Old local consts for scene/camera/lights/renderer removed.)
try {
    // Camera + renderer + touch init (delegated, uses shared canvas/scene/camera)
    // PERFORMANCE: Start at 60% resolution...
    const basePixelRatio = 0.60;
    initializeSceneAndRenderer({ basePixelRatio });

    // Environment Map (for metallic reflections) — uses shared scene
    const envMap = generateEnvironment();
    attachLightsAndEnv(envMap);

} catch (err: any) {
    showError('Initialization Error', err.message || 'Unknown error occurred during startup.');
    throw err; // Re-throw to stop further execution if critical
}

// --- Materials ---
const materials = {
    ground: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.ground,
        roughness: 0.9,
        metalness: 0.1
    }),
    platform: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.platform,
        roughness: 0.7,
        metalness: 0.2
    }),
    player: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.player,
        roughness: 0.4,
        metalness: 0.1,
        emissive: CONFIG.colors.player,
        emissiveIntensity: 0.1
    }),
    background: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.accent,
        roughness: 1.0,
        metalness: 0.0
    })
};

// --- WASM Setup ---
import { loadWasm as loadWasmModule } from './wasm_loader';

let wasmExports: any = null;
let wasmMemory: Float32Array | null = null;

async function loadWasm() {
    const handle = await loadWasmModule();
    if (handle) {
        wasmExports = handle.exports;
        wasmMemory  = handle.memory;
    }
}

// Start loading immediately
loadWasm();

// =============================================================================
// PLAYER (Rocket Character) — now loaded by player_loader.ts (single canonical copy)
// =============================================================================
// player_loader imports the shared scene from scene_context and does scene.add(player).
// We removed the 100+ line duplication that used to live here (and in player_loader.ts).
// Post-load hooks registered after effectManager/dogController init (see below).

// `player` (imported from player_loader) is a live binding; code below uses the name directly.
// (local `let player` + gltfLoader + load() body deleted to eliminate duplication + dual loads)

// Player state - Smooth direct control system
const playerState = {
    velocity: new THREE.Vector3(0, 0, 0),
    targetY: 5,          // Target Y position for smooth following
    currentSpeedY: 0,    // Current vertical speed for momentum feel
    isGrounded: false,
    facingRight: true,
    isRunning: false,
    autoScrollSpeed: 8, // Constant forward movement
    health: 3, // Ship can survive 3 collisions
    maxHealth: 3,
    invincible: false, // Invincibility frames after hit
    distanceToMoon: 500, // Distance to reach the moon
    hasWon: false, // Track if player has won
    level: 1, // Current level
    bossActive: false, // Boss fight in progress
    cores: 0, // Cores collected this run
    slingCombo: 0, // Current sling chain counter
    slingAssistTimer: 0, // Seconds remaining on Sling Assist boost
    penguinSlideAssistTimer: 0 // Seconds remaining on Astro Penguin slide assist
};

// =============================================================================
// LEVEL MANAGER
// =============================================================================
/* LevelManager moved to ./level_manager */



let obstacleSystem: ObstacleSystem;

// =============================================================================
// LEVEL GEOMETRY & BACKGROUND
// =============================================================================

// =============================================================================
// SPACE ENVIRONMENT (Stars, Galaxies, Moon)
// =============================================================================


// Create distant galaxies/nebulae
// createGalaxy moved to ./visuals

// Create a few distant galaxies
const galaxy1 = createGalaxy(200, 30, -100, 0x8844ff);
scene.add(galaxy1);

const galaxy2 = createGalaxy(-150, -20, -120, 0x4488ff);
scene.add(galaxy2);

const galaxy3 = createGalaxy(300, 10, -90, 0xff4488);
scene.add(galaxy3);

// PARTICLE SYSTEM (engine trails & explosions)
const particleSystem = new ParticleSystem(scene);
const debrisSystem = new DebrisSystem(scene);
const slingableObjectSystem = new SlingableObjectSystem(scene, particleSystem, debrisSystem);
const toyRocketSpawnManager = new ToyRocketSpawnManager(slingableObjectSystem);

// WEAPON SYSTEM (Dynamic Lighting Projectiles)
const weaponSystem = new WeaponSystem(scene);
const weaponLightManager = new WeaponLightManager();

// Enhanced fire function with heat and audio
const originalFire = weaponSystem.fire.bind(weaponSystem);
weaponSystem.fire = function(position: THREE.Vector3, direction: THREE.Vector3) {
    // Check heat
    if (!heatSystem.canFire()) return;
    
    // Apply heat
    const heatGen = upgradeSystem.getModifiedHeatGeneration(8);
    if (!heatSystem.addHeat(heatGen)) return;
    
    // Play sound with variation
    audioSystem.playShoot(Math.random());
    
    // Set projectile color based on upgrade
    const upgradeColor = upgradeSystem.getProjectileColor();
    if (upgradeColor) {
        this.setColor(upgradeColor);
    } else {
        this.setColor(0x00ffff); // Default cyan
    }
    
    // Call original
    originalFire(position, direction);
};

// RE-ENTRY SYSTEM (Atmospheric Heat Effects)
const reEntrySystem = new ReEntrySystem(scene, camera);

// WATERFALL SYSTEM (Vertical Water Effects)
const waterfallSystem = new WaterfallSystem(scene, camera, weaponLightManager);

// ASTEROID FIELD SYSTEM (Parallax Asteroids)
const asteroidFieldSystem = new AsteroidFieldSystem(scene, weaponLightManager);

// PLANETARY HORIZON SYSTEM (Massive scrolling planet)
const planetaryHorizonSystem = new PlanetaryHorizonSystem(scene, camera);

// INDUSTRIAL BACKGROUND SYSTEM (Megastructures)

// NEBULA SYSTEM (Volumetric Clouds & Particles)

const cosmicDustSystem = new CosmicDustSystem(scene);


// === GHOST DEBRIS (new Cosmic Architect feature) ===
const ghostDebrisSystem = new GhostDebrisSystem(scene);
const voidJellyfishSystem = new VoidJellyfishSystem(scene);

// BIOLOGICAL BACKGROUND SYSTEM (Space Whale Interior)
const biologicalSystem = new BiologicalBackgroundSystem(scene);

// LIQUID METAL SYSTEM (Advanced Reflection & Physics)
const liquidMetalSystem = new LiquidMetalSystem(scene);

// BOSS SYSTEM
const bossManager = new BossManager(scene);

// AUDIO SYSTEM
const audioSystem = getAudioSystem();
initAudioOnInteraction();

// UPGRADE SYSTEMS
const upgradeSystem = new UpgradeSystem(scene, {
    onUpgradeStart: (type) => {
        console.log(`⚡ Upgrade started: ${UPGRADE_CONFIGS[type].name}`);
        audioSystem.play('powerup');
    },
    onUpgradeEnd: (type) => {
        console.log(`⚡ Upgrade ended: ${UPGRADE_CONFIGS[type].name}`);
    }
});

const pickupManager = new PickupManager(scene);
const heatSystem = new HeatSystem();

// MAGICAL SYSTEMS (from swarm)
const starfield = new StarfieldSystem(scene);
const orbManager = new OrbManager(scene, particleSystem, 4);
const powerUpManager = new PowerUpManager({
    scene: scene,
    particleSystem: particleSystem,
    audioSystem: audioSystem,
    rocket: undefined, // Set later when player loads
    onPowerUpStart: (type, config) => {
        console.log(`Power-up started: ${config.name}`);
        // Activate corresponding magical effect
        switch(type) {
            case PowerUpType.RAINBOW_COMET_TAIL:
                effectManager.activateEffect(MagicalEffectType.RAINBOW_TRAIL, config.duration);
                audioSystem.playCometActivate();
                dogController.triggerAnimation(DogAnimationState.POWER_UP, 2.0);
                juiceManager.flashRainbow(0.8);
                break;
            case PowerUpType.FLOWER_CROWN_BOOST:
                effectManager.activateEffect(MagicalEffectType.STARDUST_FIELD, config.duration);
                audioSystem.playBoost();
                break;
            case PowerUpType.TWINKLE_STAR_MAGNET:
                effectManager.activateEffect(MagicalEffectType.STARDUST_FIELD, config.duration);
                audioSystem.playCollect();
                break;
            case PowerUpType.BUBBLEGUM_SHIELD:
                effectManager.activateEffect(MagicalEffectType.HEART_BUBBLE, config.duration);
                audioSystem.playShieldActivate();
                break;
            case PowerUpType.BUTTERFLY_ESCORT:
                effectManager.activateEffect(MagicalEffectType.BUTTERFLY_SWARM, config.duration);
                audioSystem.playCollect();
                break;
            case PowerUpType.UNICORN_HORN_BLAST:
                effectManager.activateEffect(MagicalEffectType.GLITTER_BEAM, config.duration);
                audioSystem.playBoost();
                break;
        }
    },
    onPowerUpEnd: (type, config) => {
        console.log(`Power-up ended: ${config.name}`);
        if (type === PowerUpType.BUBBLEGUM_SHIELD && player) {
            audioSystem.playShieldBreak();
            juiceManager.showFloatingText("Pop!", player.position, '#ff69b4', 24);
            juiceManager.burstMagic(player.position.clone());
        }
    }
});

// SPACE FRIENDS + dreamy env managers + butterfly (created once, correct scene)
const {
  friendsManager,
  flowerManager,
  pinwheelManager,
  windChimeManager,
  solarSailFernManager,
  candyManager,
  castleManager,
  butterflySwarmSystem,
} = createGameManagers(scene, audioSystem, particleSystem);

butterflySwarmSystem.bindEffects(particleSystem, juiceManager, audioSystem);

let lastPlayerDamageTime = -999;

// Aquatic environments: jellyfish, kelp forests, plankton, bubble reefs
const aquaticLifeManager = new AquaticLifeManager(scene);
let aquaticLifeSpawnedLevel: number | null = null;
const starlightKoiManager = new StarlightKoiManager(scene, particleSystem);
let koiSpawnedLevel: number | null = null;
const bubbleCoralManager = new RainbowBubbleCoralManager(scene, particleSystem);
let coralSpawnedLevel: number | null = null;
let level6BossDefeated = false;
let whaleSongTimer = 30;
let moonGateSequenceActive = false;
let moonGateSequenceTimer = 0;

// BESTIARY CREATURES (Crystal Tarsier Guardian, Living Geode Titan, ...)
const creatureManager = new CreatureManager({
    scene,
    particleSystem,
    debrisSystem,
    audioSystem
});

// Connect orb collection to power-ups
orbManager.onPowerUpReady = () => {
    const triggered = powerUpManager.collectOrb();
    if (triggered && player) {
        dogController.triggerAnimation(DogAnimationState.POWER_UP, 2.0);
        juiceManager.flashRainbow(0.5);
        juiceManager.burstMagic(player.position.clone());
        
        // SWARM #3: Activate corresponding magical effect
        const activeEffects = powerUpManager.getActiveEffects();
        activeEffects.forEach(effect => {
            switch(effect.type) {
                case PowerUpType.RAINBOW_COMET_TAIL:
                    effectManager.activateEffect(MagicalEffectType.RAINBOW_TRAIL, effect.duration);
                    break;
                case PowerUpType.FLOWER_CROWN_BOOST:
                    effectManager.activateEffect(MagicalEffectType.STARDUST_FIELD, effect.duration);
                    break;
                case PowerUpType.BUBBLEGUM_SHIELD:
                    effectManager.activateEffect(MagicalEffectType.HEART_BUBBLE, effect.duration);
                    break;
                case PowerUpType.TWINKLE_STAR_MAGNET:
                    effectManager.activateEffect(MagicalEffectType.STARDUST_FIELD, effect.duration);
                    break;
                case PowerUpType.BUTTERFLY_ESCORT:
                    effectManager.activateEffect(MagicalEffectType.BUTTERFLY_SWARM, effect.duration);
                    break;
                case PowerUpType.UNICORN_HORN_BLAST:
                    effectManager.activateEffect(MagicalEffectType.GLITTER_BEAM, effect.duration);
                    break;
            }
        });
    }
};

orbManager.onScore = (points) => {
    hudManager.addScore(points);
};

orbManager.onHealthRestore = (amount) => {
    playerState.health = Math.min(playerState.health + amount, playerState.maxHealth);
    hudManager.updateHealth(playerState.health, playerState.maxHealth);
    updateHealthDisplay(playerState);
    audioSystem.playCollect();
};

// SAVE SYSTEM
const saveManager = getSaveManager();

// Apply save data to player state
playerState.maxHealth = saveManager.applyToHealth(3);
playerState.health = playerState.maxHealth + saveManager.getStartingHealthBonus();
playerState.autoScrollSpeed = saveManager.applyToSpeed(8);

// NEW MANAGERS (Swarm #2)
const dogController = new DogCockpitController();
const hudManager = new HUDManager(saveManager);
powerUpManager.setDogController(dogController);

// "Good Dog!" score multiplier (granted by rescuing a Moon Pup)
let scoreMultiplierUntil = 0;
let scoreMultiplierValue = 1;
const originalAddScore = hudManager.addScore.bind(hudManager);
hudManager.addScore = (points: number) => {
    const mult = performance.now() < scoreMultiplierUntil ? scoreMultiplierValue : 1;
    originalAddScore(Math.round(points * mult));
};
const discoveryManager = new DiscoveryManager(saveManager);
discoveryManager.onSpeciesDiscovered = (speciesId, name, totalThisRun, isNewEver) => {
    if (player) {
        juiceManager.showFloatingText(`Scanned: ${name}!`, player.position.clone(), '#00ffcc', 22);
        juiceManager.burstMagic(player.position.clone());
    }
    dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
    audioSystem.playMagicSequence('star_collect');

    const objective = levelManager.config[levelManager.currentLevel]?.objective;
    if (objective?.type === 'scan') {
        hudManager.updateObjectiveProgress(totalThisRun, objective.target);
    }
};

// "Weird Life Log" bestiary — non-lethal creature cataloging meta-layer
const creatureCatalogManager = new CreatureCatalogManager(saveManager);
creatureCatalogManager.onCreatureCataloged = (id, name, isNewEver) => {
    if (player) {
        const label = isNewEver ? `New! Cataloged: ${name}` : `Cataloged: ${name}`;
        juiceManager.showFloatingText(label, player.position.clone(), '#aaffee', isNewEver ? 26 : 20);
        if (isNewEver) juiceManager.burstMagic(player.position.clone());
    }
    dogController.triggerAnimation(DogAnimationState.CURIOUS, 1.0);
    audioSystem.playMagicSequence('star_collect');
};
// Tracks which Nebula Krakens already paid out their "kraken" memory bonus this run
const krakenMemoryRewarded = new WeakSet<object>();
// Mine Robot memory: one free "wrench" auto-bounce charge per level
let wrenchChargeAvailable = false;

const slingObjectiveManager = new SlingObjectiveManager();
slingObjectiveManager.onProgress = (current, target) => {
    hudManager.updateObjectiveProgress(current, target);
    if (player) {
        juiceManager.showFloatingText(`Clean Sling! ${current}/${target}`, player.position.clone(), '#44aaff', 22);
    }
    audioSystem.playMagicSequence('star_collect');
};
slingObjectiveManager.onObjectiveComplete = () => {
    if (player) {
        juiceManager.showFloatingText('Slingshot Master!', player.position.clone(), '#ffcc00', 28);
        juiceManager.burstMagic(player.position.clone());
    }
    dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.5);
    audioSystem.playMagicSequence('power_up');
};

// Level 3 "Rescue" objective: trapped friends join a growing flotilla behind the rocket
friendsManager.onFriendRescued = (count, position, kind) => {
    const objective = levelManager.config[levelManager.currentLevel]?.objective;

    dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
    juiceManager.burstMagic(position.clone());
    saveManager.addCores(15);

    // Moon Pup is a rare "good dog" find - big bark + temporary score multiplier
    if (kind === 'moonpup') {
        dogController.triggerAnimation(DogAnimationState.VICTORY, 1.8);
        const moonPupMemory = saveManager.hasMemory('moon_pup');
        scoreMultiplierValue = 2;
        scoreMultiplierUntil = performance.now() + (moonPupMemory ? 16000 : 10000);
        if (player) {
            juiceManager.showFloatingText('Good Dog! Score x2!', player.position.clone(), '#ffe4b5', 26);
        }
        audioSystem.playMagicSequence('power_up');
        creatureCatalogManager.catalog('moon_pup');
    }

    if (kind === 'sealpup') {
        creatureCatalogManager.catalog('stellar_seal_pup');
    }

    if (kind === 'astrobunny') {
        creatureCatalogManager.catalog('astro_bunny');
    }

    if (objective?.type === 'rescue') {
        hudManager.updateObjectiveProgress(count, objective.target);
        if (player) {
            juiceManager.showFloatingText(`Rescued! ${count}/${objective.target}`, player.position.clone(), '#ffaa44', 22);
        }

        if (count >= objective.target) {
            if (player) {
                juiceManager.showFloatingText('Flotilla Assembled!', player.position.clone(), '#ffcc00', 28);
                juiceManager.burstMagic(player.position.clone());
            }
            audioSystem.playMagicSequence('power_up');
        }
    }
};

// Cosmic Otter flyby: gentle orb gift + Weird Life Log catalog entry
friendsManager.onOtterGift = (position, cores) => {
    const otterMemory = saveManager.hasMemory('cosmic_otter');
    const totalCores = cores + (otterMemory && Math.random() < 0.35 ? 1 : 0);
    playerState.cores += totalCores;
    saveManager.addCores(totalCores);
    creatureCatalogManager.catalog('cosmic_otter');
    if (player) {
        juiceManager.showFloatingText(`+${totalCores} Core${totalCores > 1 ? 's' : ''}!`, position.clone(), '#66ccff', 24);
        juiceManager.burstMagic(position.clone());
    }
    dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
};

// Astro Penguin belly slide: slide assist + Weird Life Log catalog entry
friendsManager.onPenguinSlide = (position, cores, slideAssistDuration) => {
    const penguinMemory = saveManager.hasMemory('astro_penguin');
    const assistDuration = slideAssistDuration + (penguinMemory ? 1.5 : 0);
    playerState.cores += cores;
    saveManager.addCores(cores);
    playerState.penguinSlideAssistTimer = Math.max(playerState.penguinSlideAssistTimer, assistDuration);
    creatureCatalogManager.catalog('astro_penguin');
    if (player) {
        juiceManager.showFloatingText('Slide Assist!', position.clone(), '#aaddff', 24);
        juiceManager.burstMagic(position.clone());
    }
    dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.0);
};

// Stellar Seal Pup clap cheer: brighten nearby orbs + tiny heal + Weird Life Log
friendsManager.onSealClap = (position, healthRestore) => {
    const sealMemory = saveManager.hasMemory('stellar_seal_pup');
    const glowDuration = sealMemory ? 5.5 : 3.5;
    const glowMultiplier = sealMemory ? 2.2 : 1.7;
    const boosted = orbManager.boostGlowNearby(
        position,
        14,
        glowMultiplier,
        glowDuration,
        clock.getElapsedTime()
    );

    creatureCatalogManager.catalog('stellar_seal_pup');

    if (healthRestore && healthRestore > 0) {
        playerState.health = Math.min(playerState.health + healthRestore, playerState.maxHealth);
    }

    if (player) {
        if (boosted > 0) {
            juiceManager.showFloatingText(
                boosted > 1 ? `${boosted} stars cheering!` : 'Star cheer!',
                position.clone(),
                '#aaddff',
                20
            );
        } else if (healthRestore) {
            juiceManager.showFloatingText('Happy clap!', position.clone(), '#ffccdd', 18);
        }
        juiceManager.burstMagic(position.clone());
    }
    dogController.triggerAnimation(DogAnimationState.DELIGHTED, 0.8);
};

// Astro Bunny lucky hop: star bonus + combo grace + Weird Life Log
friendsManager.onAstroBunnyLucky = (position, bonus) => {
    const bunnyMemory = saveManager.hasMemory('astro_bunny');
    const totalBonus = bonus + (bunnyMemory ? 4 : 0);
    hudManager.addScore(totalBonus);
    creatureCatalogManager.catalog('astro_bunny');
    slingComboManager.refreshComboTimer();
    if (player) {
        juiceManager.showFloatingText('Lucky Star!', position.clone(), '#ffd700', 22);
        juiceManager.burstMagic(position.clone());
    }
    dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.0);
};

const juiceManager = new JuiceManager(camera, scene, particleSystem);

// Level 5 "Arc Surge" objective: report the sling combo chain as progress
// toward the combo threshold (e.g. 7x).
function reportComboObjectiveProgress() {
    const objective = levelManager.config[levelManager.currentLevel]?.objective;
    if (objective?.type === 'combo') {
        hudManager.updateObjectiveProgress(slingComboManager.getCombo(), objective.target);
    }
}

// The moment a level's chapter objective is fully met: a big celebratory
// beat, then open the "fast lane" (thinned hazards + bonus orbs) toward
// the level exit so finishing the mission feels like the actual goal.
hudManager.onObjectiveComplete = () => {
    if (!player) return;

    dogController.triggerAnimation(DogAnimationState.DELIGHTED, 2.5);
    juiceManager.showFloatingText('Chapter Complete!', player.position.clone(), '#ffcc00', 32);
    juiceManager.flashRainbow(1.0);
    juiceManager.shakeScreen(ShakeType.MEDIUM, 0.5);
    juiceManager.burstMagic(player.position.clone());
    audioSystem.playMagicSequence('power_up');

    levelManager.enterFastLane();
    friendsManager.triggerVictoryFlyby(3.0);

    // Sprinkle bonus orbs along the path ahead as a reward for the home stretch
    for (let i = 0; i < 5; i++) {
        const ox = player.position.x + 20 + i * 15 + Math.random() * 8;
        const oy = (Math.random() - 0.5) * 10;
        orbManager.spawnRandomOrb(ox, oy, 0);
    }
};

// BOOST SYSTEM
const boostSystem = new BoostSystem({
    maxCharges: 3,
    rechargeTime: 8,
    duration: 1.8,
    cooldown: 4,
    onActivate: () => {
        audioSystem.playBoost();
        dogController.triggerAnimation(DogAnimationState.POWER_UP, 1.8);
        juiceManager.shakeScreen(ShakeType.MEDIUM, 0.4);
        updateBoostDisplay();
    },
    onDeactivate: () => {
        updateBoostDisplay();
    },
    onRecharge: (charges) => {
        updateBoostDisplay();
    }
});

// ROLL SYSTEM
const rollSystem = new RollSystem({
    duration: 0.5,
    cooldown: 2.6,
    onActivate: () => {
        audioSystem.playRoll();
        dogController.triggerAnimation(DogAnimationState.THRUST, 0.45);
        juiceManager.shakeScreen(ShakeType.HEAVY, 0.25);
        playerState.invincible = true;
        showRollPopup();
        updateRollDisplay();
    },
    onDeactivate: () => {
        playerState.invincible = false;
        updateRollDisplay();
    }
});

// TETHER SYSTEM
const tetherSystem = new TetherSystem(scene, {
    maxRange: 60,
    pullStrength: 18,
    cooldown: 3,
    slingImpulse: 22,
    onLatch: (_anchorPos) => {
        audioSystem.playTetherLatch();
        juiceManager.shakeScreen(ShakeType.MEDIUM, 0.2);
        updateTetherDisplay();
    },
    onRelease: (_impulse) => {
        audioSystem.playTetherRelease();
        juiceManager.shakeScreen(ShakeType.MEDIUM, 0.3);
        updateTetherDisplay();
    },
    onCooldownEnd: () => {
        updateTetherDisplay();
    }
});

// Tether Sprite "full loop" tracking — swing a tether sprite all the way
// around for a big bonus + a free heart.
let tetherSpriteSweep = 0;
let tetherSpritePrevAngle: number | null = null;

// SLING COMBO MANAGER — Arc Surge Scoring & Feel Amplification
const slingComboManager = new SlingComboManager({
    juiceManager,
    hudManager,
    dogController,
    audioSystem,
    particleSystem,
    onScoreBonus: (points) => {
        hudManager.addScore(points);
    },
    onSlingAssist: (duration) => {
        playerState.slingAssistTimer = duration;
    },
    // Tarsier memory: longer Sling Assist window on Arc Surge
    slingAssistDuration: saveManager.hasMemory('tarsier') ? 6.0 : 4.0,
    // Astro Bunny memory: wider combo grace between sling arcs
    comboTimeout: saveManager.hasMemory('astro_bunny') ? 5.5 : 4.0
});

// Slingable personality payoffs: puffball lift-offs & chroma slipstreams
slingableObjectSystem.onSpecialEffect = (effect) => {
    if (effect.type === 'puffballPop') {
        if (player) {
            playerState.currentSpeedY = THREE.MathUtils.clamp(
                playerState.currentSpeedY + effect.liftAmount,
                -CONFIG.player.maxDescentSpeed * 1.5,
                CONFIG.player.maxSpeedY * 2.0
            );
            juiceManager.showFloatingText('Spore Pop!', player.position.clone(), '#99ffaa', 22);
            dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.0);
            audioSystem.playMagicSequence('power_up');

            slingComboManager.recordSlingAction('perfect', effect.position.clone());
            slingObjectiveManager.recordSling('perfect');
            reportComboObjectiveProgress();
            friendsManager.cheerFlotilla(effect.position.clone());
        }
    } else if (effect.type === 'chromaSlipstream') {
        if (player) {
            juiceManager.showFloatingText('Rainbow Slipstream!', effect.position.clone(), '#ff66cc', 20);
        }
    } else if (effect.type === 'toyRocketResolved') {
        const isNewLore = saveManager.discoverSpecies('toyRocketWreck_lore');
        if (isNewLore) {
            juiceManager.showFloatingText(
                "Someone else's adventure...",
                effect.position.clone(),
                '#ffb6c1',
                22
            );
            juiceManager.burstMagic(effect.position.clone());
            audioSystem.playMagicSequence('star_collect');
        }
        creatureCatalogManager.catalog('toy_wreck');
        if (effect.viaSling && player) {
            hudManager.addScore(140);
            juiceManager.showFloatingText('Wreck Rally!', effect.position.clone(), '#ff8fab', 24);
            dogController.triggerAnimation(DogAnimationState.CURIOUS, 1.0);
            friendsManager.cheerFlotilla(effect.position.clone());
        }
    }
};

// SWARM #3 - DREAMY ENVIRONMENTS
// (provided by createGameManagers call above — no duplicate instantiation)

// Effect manager - will set target when player loads
const tempTarget = new THREE.Group();
const effectManager = new EffectManager(scene, audioSystem, tempTarget);

// Register post-load hooks now that effectManager and dogController exist.
onPlayerLoaded((loadedPlayer: THREE.Group, rocketModelOrGroup: any) => {
    effectManager.setTarget(loadedPlayer);
    const dogTarget = rocketModelOrGroup || loadedPlayer;
    try {
        dogController.initialize(dogTarget);
    } catch {
        dogController.initialize(loadedPlayer);
    }
    console.log('🚀 Rocket loaded via player_loader onto canonical scene');
});

// SWARM #4: Victory and Tutorial Systems
const victorySystem = new VictorySystem(scene, camera, audioSystem, hudManager, juiceManager);
const tutorialSystem = new TutorialSystem(scene, hudManager, audioSystem, dogController);

// Check if we should show tutorial (first time players)
if (shouldShowTutorial(saveManager)) {
    tutorialSystem.onComplete(() => {
        console.log('Tutorial complete! Starting game...');
        // Tutorial completion callback - game starts automatically
    });
}

// DEBUG SYSTEM
const debugSystem = new DebugSystem();
registerDefaultDecorationBudgets();
decorationBudget.attachToDebugSystem(debugSystem);
debugSystem.setRendererInfo(rendererBackend, requestedRendererBackend, rendererFallbackReason);
creatureManager.setDebugSystem(debugSystem);
debugSystem.register('creature_tarsier_guardian', 'Crystal Tarsier', true);
debugSystem.register('creature_geode_titan', 'Geode Titan', true);
debugSystem.register('creature_moon_jelly', 'Moon Jelly', true);
debugSystem.register('creature_aurora_ray', 'Aurora Ray', true);
debugSystem.register('creature_nebula_puffer', 'Nebula Puffer', true);
debugSystem.register('creature_moon_snail', 'Moon Snail', true);
debugSystem.register('particles', 'Particles', true);
debugSystem.register('debris', 'Debris', true);
debugSystem.register('weaponLights', 'Weapon Lights', true);
debugSystem.register('reEntry', 'Re-Entry Effects', true);
debugSystem.register('butterflySwarm', 'Butterfly Swarm', true);
debugSystem.register('starfield', 'Starfield', true);
debugSystem.register('magicalEffects', 'Magical Effects', true);
debugSystem.register('spaceFriends', 'Space Friends', true);
debugSystem.register('geologicalObjects', 'Geological Objects', true);
debugSystem.register('industrialGeo', 'Industrial Geometry', true);
debugSystem.register('moonEffects', 'Moon / Galaxy Effects', true);
debugSystem.register('pilotAnim', 'Pilot Animation', true);
debugSystem.register('flowerConstellations', 'Flower Constellations', true);
debugSystem.register('pinwheelFlora', 'Pinwheel Flowers', true);
debugSystem.register('solarSailFerns', 'Solar Sail Ferns', true);
debugSystem.register('crystalChimes', 'Crystal Chimes', true);
debugSystem.register('windChimes', 'Wind Chime Mobiles', true);
debugSystem.register('candyBelt', 'Candy Belt', true);
debugSystem.register('cloudCastles', 'Cloud Castles', true);
debugSystem.register('shadows', 'Shadows', true);
debugSystem.register('nebula', 'Nebula', true);
debugSystem.register('nebulaRibbons', 'Nebula Ribbons', true);
debugSystem.register('cosmicDust', 'Cosmic Dust', true);
debugSystem.register('biological', 'Biological Background', true);
debugSystem.register('industrialBg', 'Industrial Background', true);
debugSystem.register('waterfall', 'Waterfall', true);
debugSystem.register('asteroidField', 'Asteroid Field', true);
debugSystem.register('planetaryHorizon', 'Planetary Horizon', true);
debugSystem.register('ghostDebris', 'Ghost Debris', true);
debugSystem.register('voidJellyfish', 'Void Jellyfish', rendererBackend !== 'webgl');
debugSystem.register('starlightKoi', 'Starlight Koi', true);
debugSystem.register('bubbleCoral', 'Rainbow Bubble Coral', true);
debugSystem.register('chromaShift', 'Chroma Rocks', true);
debugSystem.register('godRays', 'God Rays', true);
debugSystem.register('aurora', 'Aurora Borealis', true);
debugSystem.register('wireframe', 'Wireframe', hasDebugUrlFlag('wireframe'));
debugSystem.register('collisionDebug', 'Collision Debug', hasDebugUrlFlag('collisionDebug') || hasDebugUrlFlag('collision-debug'));

let isGamePaused = false;
let bestiaryUI: HTMLDivElement | null = null;

// =============================================================================
// GEOLOGICAL OBJECTS & ANOMALIES
// (single copy imported from ./environment using the scene from scene_context)
// =============================================================================



// (geodes/jelly/solar spawners removed — imported from environment)

// (void root spawner removed — imported)

// (vacuum kelp spawner removed)

// (ice needles removed)

// (liquid + magma removed)

function spawnTarsiersForGravityAnchor(anchor: THREE.Group) {
    // Spawn 2–4 Astro Tarsiers that cling and orbit this anchor
    if (debugSystem.isEnabled('spaceFriends')) {
        const count = 2 + Math.floor(Math.random() * 3);
        friendsManager.spawnTarsiersNearAnchor(anchor.position, count);
    }
}

function createGravityAnchorWithTarsiers(x: number, y: number, z: number, biome: number = 0) {
    const anchor = createGravityAnchorAtPosition(x, y, z, biome);
    spawnTarsiersForGravityAnchor(anchor);
    return anchor;
}

function createSlingableObjectAtPosition(
    x: number,
    y: number,
    z: number,
    options: SlingableObjectConfig = {}
) {
    return slingableObjectSystem.createObject(new THREE.Vector3(x, y, z), options);
}

// Store plants that live on the moon to animate them later
/* moonPlants moved to ./visuals */

// disposeObject moved to ./utils
// cleanupGeologicalObjects now imported from ./environment (single copy)

// createMoon moved to ./visuals

const moon = createMoon();
moon.position.set(500, 5, -50); // Position far ahead
scene.add(moon);

// --- Phase 1 test constellation: 3 Gravity Anchors in Level 1 (Neon Garden) ---
// Intentionally placed at different heights to encourage curved sling arcs.
createGravityAnchorWithTarsiers(80,  5, -25, 1);
createGravityAnchorWithTarsiers(180, -6, -20, 1);
createGravityAnchorWithTarsiers(280,  8, -22, 1);

// --- Slingable debris prototype cluster (Phase 1 MVP test zone) ---
createSlingableObjectAtPosition(96, 3, -14, {
    radius: 1.1,
    mass: 1.6,
    velocity: new THREE.Vector3(-1.6, 0.8, 0.25),
    color: 0x8dffda,
    emissive: 0x66ffee
});
createSlingableObjectAtPosition(154, -5, -16, {
    radius: 1.35,
    mass: 2.2,
    velocity: new THREE.Vector3(-1.2, -0.55, -0.2),
    color: 0xffb27d,
    emissive: 0xff8f66
});
createSlingableObjectAtPosition(236, 7, -18, {
    radius: 1.2,
    mass: 1.9,
    velocity: new THREE.Vector3(-1.45, 0.35, 0.3),
    color: 0x8eb7ff,
    emissive: 0x78d6ff
});

// --- "Dance with the world" puzzlelet: a puffball, a chroma rock, and a
// tether sprite clustered together, each with their own sling payoff. ---
createSlingableObjectAtPosition(400, -2, -15, {
    radius: 1.3,
    mass: 1.2,
    velocity: new THREE.Vector3(-1.0, 0, 0.15),
    kind: 'puffball'
});
createSlingableObjectAtPosition(460, 6, -17, {
    radius: 1.15,
    mass: 1.7,
    velocity: new THREE.Vector3(-1.3, -0.4, 0.2),
    kind: 'chromaRock'
});
createSlingableObjectAtPosition(520, 0, -14, {
    radius: 0.85,
    mass: 0.6,
    velocity: new THREE.Vector3(-1.1, 0.5, 0.1),
    kind: 'tetherSprite'
});

// --- L4/L5 wrecking balls: salvage debris heavy enough to plow through
// smaller obstacles when slung — a risk/reward path-clearing tool. ---
createSlingableObjectAtPosition(2350, 3, -16, {
    radius: 1.6,
    mass: 4.0,
    velocity: new THREE.Vector3(-0.8, 0, 0),
    kind: 'wreckingBall'
});
createSlingableObjectAtPosition(3350, -4, -16, {
    radius: 1.8,
    mass: 4.5,
    velocity: new THREE.Vector3(-0.9, 0.2, 0),
    kind: 'wreckingBall'
});

const videoTumblingStars = [
    new VideoTumblingStar(scene, 360, 12, -45),
    new VideoTumblingStar(scene, 980, -6, -40),
    new VideoTumblingStar(scene, 1620, 8, -48)
];

const industrialGeometryManager = new IndustrialGeometryManager(scene);
const levelManager = new LevelManager({
    weaponLightManager,
    scene,
    camera,
    getPlayer: () => player,
    friendsManager,
    industrialGeometryManager,
    ghostDebrisSystem,
    voidJellyfishSystem,
    godRaySystem,
    auroraSystem,
    butterflySwarmSystem,
    flowerManager,
    pinwheelManager,
    windChimeManager,
    solarSailFernManager,
    castleManager,
    candyManager,
    debugSystem,
    spawners: {
        createSporeCloudAtPosition,
        createVoidRootBallAtPosition,
        createVacuumKelpAtPosition,
        createIceNeedleClusterAtPosition,
        createLiquidMetalBlobAtPosition,
        createMagmaHeartAtPosition,
        createGravityAnchorAtPosition: createGravityAnchorWithTarsiers,
        createGeodeAtPosition
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
        creatureManager.clear();
        discoveryManager.reset();
        toyRocketSpawnManager.spawnForLevel(levelManager.currentLevel, cfg);
        // Mine Robot memory: recharge the wrench auto-bounce for the new level
        wrenchChargeAvailable = saveManager.hasMemory('mine_robot');
        slingObjectiveManager.reset(cfg.objective?.type === 'sling' ? cfg.objective.target : 0);
        if (cfg.objective?.type === 'scan') {
            hudManager.setObjectiveLabel('🔍 Catalog');
            hudManager.updateObjectiveProgress(0, cfg.objective.target);
        } else if (cfg.objective?.type === 'sling') {
            hudManager.setObjectiveLabel('🎯 Slings');
            hudManager.updateObjectiveProgress(0, cfg.objective.target);
        } else if (cfg.objective?.type === 'rescue') {
            hudManager.setObjectiveLabel('🚀 Rescue');
            hudManager.updateObjectiveProgress(friendsManager.getRescuedCount(), cfg.objective.target);
        } else if (cfg.objective) {
            // 'survive' / 'combo' / 'boss' - no running counter, show the description as the label
            const OBJECTIVE_ICONS: Record<string, string> = { survive: '🛡️', combo: '⚡', boss: '👑' };
            const icon = OBJECTIVE_ICONS[cfg.objective.type] ?? '🎯';
            hudManager.setObjectiveLabel(`${icon} ${cfg.objective.description}`);
            hudManager.updateObjectiveProgress(0, 0);
        } else {
            hudManager.updateObjectiveProgress(0, 0);
        }
    },
    onUpdateLevelDisplay: (levelIndex, name) => {
        const levelDiv = document.getElementById('level-display');
        if (levelDiv) levelDiv.innerHTML = `Level ${levelIndex}: ${name}`;
    }
});
levelManager.cloudSystem.setCamera(camera);

function handleGameOver() {
    if (player) {
        dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
        juiceManager.burstDamage(player.position.clone());
    }
    hudManager.updateHealth(0, playerState.maxHealth);
    hudManager.showGameOverScreen({
        score: hudManager.getScore(),
        distance: player ? Math.floor(player.position.x) : 0,
        orbsCollected: playerState.cores,
        powerUpsUsed: 0
    }, () => location.reload());
}

obstacleSystem = new ObstacleSystem({
    scene,
    getPlayer: () => player,
    getCurrentConfig: () => {
        const cfg = levelManager.config[levelManager.currentLevel];
        if (!cfg) return cfg;
        if (!levelManager.fastLaneActive) return cfg;
        // Fast lane: thin out asteroids/hazards on the run to the level exit
        const overrideRate = (cfg.environments?.asteroidField?.rate ?? 0) * 2.5;
        return {
            ...cfg,
            environments: {
                ...cfg.environments,
                asteroidField: overrideRate > 0 ? { rate: overrideRate } : undefined
            },
            mineRobotRate: 0,
            barnaclePodRate: 0
        };
    },
    playerState,
    getWasm: () => ({ exports: wasmExports, memory: wasmMemory }),
    setWasmMemory: (memory) => {
        wasmMemory = memory;
    },
    sporeClouds,
    particleSystem,
    debrisSystem,
    waterfallSystem,
    getCurrentLevel: () => levelManager.currentLevel,
    updateHealthDisplay: () => updateHealthDisplay(playerState),
    gameOver: handleGameOver,
    onPlayerHit: () => {
        lastPlayerDamageTime = performance.now() * 0.001;
        if (player) {
            dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
            juiceManager.shakeScreen(ShakeType.HEAVY);
            juiceManager.burstDamage(player.position.clone());
        }
        hudManager.updateHealth(playerState.health, playerState.maxHealth);
        audioSystem.playImpact(playerState.currentSpeedY);
        // Break the sling chain on damage
        slingComboManager.resetCombo();
    },
    getPowerUpModifiers: () => powerUpManager.getCombinedModifiers(),
    onAsteroidBounce: (asteroid) => {
        audioSystem.playBoing();
        powerUpManager.triggerShieldBounce();
        juiceManager.showFloatingText("Boing!", asteroid.position, '#ff69b4', 28);
        juiceManager.shakeScreen(ShakeType.LIGHT, 0.15);
    },
    onGraze: (asteroid, score, combo) => {
        audioSystem.playGraze(combo);
        hudManager.addScore(score);
        juiceManager.showScoreText(score, asteroid.position.clone());
        hudManager.showGrazeCombo(combo);
        if (combo === 1 && player) {
            juiceManager.showFloatingText("Near Miss!", player.position, '#00ffff', 20);
            friendsManager.cheerFlotilla(player.position.clone());
        }
    },
    tryConsumeWrenchCharge: () => {
        if (wrenchChargeAvailable) {
            wrenchChargeAvailable = false;
            return true;
        }
        return false;
    },
    tryConsumeButterflyCharge: () => powerUpManager.consumeButterflyCharge(),
    onButterflySave: (hitPos) => {
        juiceManager.showFloatingText('Butterfly shield!', hitPos.clone(), '#ffb6e6', 22);
        juiceManager.spawnSparkles(hitPos.clone(), new THREE.Color(0xffb6c1), 8);
        audioSystem.play('twinkle', 0.5);
    },
    tryConsumeSwarmEscort: (hitPos, hitRadius) =>
        butterflySwarmSystem.tryAbsorbHit(hitPos, hitRadius),
    onWrenchSave: (asteroid) => {
        juiceManager.showFloatingText("Wrench Save!", asteroid.position.clone(), '#ffaa66', 24);
        audioSystem.playBoing();
    },
    onMineRobotProximity: () => {
        creatureCatalogManager.catalog('mine_robot');
    },
    onCandyAsteroidSplit: (asteroid, bonusScore) => {
        hudManager.addScore(bonusScore);
        const flavor = asteroid.userData.candyFlavor as CandyFlavor;
        const variant = asteroid.userData.candyVariant as CandyAsteroidVariant;
        const label = variant === 'comet' ? 'Candy Comet!' : 'Gummy Pop!';
        const colorHex = CANDY_FLAVOR_COLORS[flavor]?.base ?? 0xff69b4;
        juiceManager.showFloatingText(`${label} +${bonusScore}`, asteroid.position.clone(), `#${colorHex.toString(16).padStart(6, '0')}`, 24);
        audioSystem.playCollect();
    }
});

const instructions = document.getElementById('instructions');
setupKeyboardControls({
    getPlayer: () => player,
    weaponSystem,
    reEntrySystem
});
if (instructions) {
    instructions.addEventListener('click', () => {
        instructions.style.display = 'none';
        createUI({
            getPlayer: () => player,
            playerState,
            startLevel: () => levelManager.startLevel(1)
        });
        createHeatBar();
        createCoresDisplay();
        createBoostDisplay();
        createRollDisplay();
        createTetherDisplay();

        // Add roll popup keyframes
        const rollStyle = document.createElement('style');
        rollStyle.textContent = `
            @keyframes rollPopup {
                0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                30% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1.0); opacity: 0; }
            }
        `;
        document.head.appendChild(rollStyle);
    }, { once: true });
}

// Pause key listener
window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
        e.preventDefault();
        if (isGamePaused) {
            hudManager.hidePauseMenu();
            isGamePaused = false;
        } else {
            isGamePaused = true;
            hudManager.showPauseMenu(
                () => { isGamePaused = false; },
                () => { location.reload(); }
            );
        }
    }
    // Mute toggle
    if (e.code === 'KeyM') {
        const muted = audioSystem.toggleMute();
        console.log(muted ? '🔇 Audio muted' : '🔊 Audio unmuted');
    }
    // "Weird Life Log" bestiary — press L any time in-game
    if (e.code === 'KeyL') {
        if (bestiaryUI) {
            bestiaryUI.remove();
            bestiaryUI = null;
            isGamePaused = false;
        } else {
            isGamePaused = true;
            bestiaryUI = createBestiaryUI(saveManager, () => {
                bestiaryUI = null;
                isGamePaused = false;
            });
            document.body.appendChild(bestiaryUI);
        }
    }
    // Resolution cycle hotkey — press R any time in-game
    if (e.code === 'KeyR') {
        currentRatioIndex = (currentRatioIndex + 1) % RESOLUTION_RATIOS.length;
        const next = RESOLUTION_RATIOS[currentRatioIndex];
        currentPixelRatio = Math.min(2, window.devicePixelRatio * next);
        renderer.setPixelRatio(currentPixelRatio);
        console.log(`🔧 Resolution set to ${Math.round(next * 100)}% (pixel ratio ${currentPixelRatio.toFixed(2)})`);
    }
});

// Double-tap Space for boost
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        const now = performance.now();
        if (now - lastSpaceTapTime < DOUBLE_TAP_THRESHOLD) {
            wantsBoost = true;
        }
        lastSpaceTapTime = now;
    }
});

// Double-tap A / Left Arrow or D / Right Arrow for barrel roll
window.addEventListener('keydown', (e) => {
    const now = performance.now();
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        if (now - lastLeftTapTime < DOUBLE_TAP_THRESHOLD) {
            wantsRoll = true;
        }
        lastLeftTapTime = now;
    }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        if (now - lastRightTapTime < DOUBLE_TAP_THRESHOLD) {
            wantsRoll = true;
        }
        lastRightTapTime = now;
    }
});

// Heat Bar UI
function createHeatBar() {
    const heatDiv = document.createElement('div');
    heatDiv.id = 'heat-display';
    heatDiv.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 20px;
        width: 200px;
        height: 20px;
        background: rgba(0,0,0,0.5);
        border: 2px solid #666;
        border-radius: 10px;
        overflow: hidden;
        z-index: 100;
    `;
    
    const heatFill = document.createElement('div');
    heatFill.id = 'heat-fill';
    heatFill.style.cssText = `
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #ff8800, #ff0000);
        transition: width 0.1s, background 0.3s;
    `;
    
    heatDiv.appendChild(heatFill);
    document.body.appendChild(heatDiv);
    
    const heatText = document.createElement('div');
    heatText.id = 'heat-text';
    heatText.style.cssText = `
        position: absolute;
        bottom: 42px;
        left: 20px;
        color: #ff8800;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: bold;
        text-shadow: 0 0 5px rgba(255,136,0,0.5);
        z-index: 100;
    `;
    heatText.textContent = 'HEAT';
    document.body.appendChild(heatText);
}

function updateHeatBar() {
    const fill = document.getElementById('heat-fill');
    const text = document.getElementById('heat-text');
    if (!fill || !text) return;
    
    const percent = heatSystem.getHeatPercent() * 100;
    fill.style.width = `${percent}%`;
    
    if (heatSystem.overheated) {
        fill.style.background = '#ff0000';
        text.textContent = 'OVERHEATED!';
        text.style.color = '#ff0000';
        text.style.animation = 'pulse 0.5s infinite';
    } else if (percent > 80) {
        fill.style.background = 'linear-gradient(90deg, #ff4400, #ff0000)';
        text.textContent = 'HEAT (CRITICAL)';
        text.style.color = '#ff4400';
    } else {
        fill.style.background = 'linear-gradient(90deg, #ff8800, #ff0000)';
        text.textContent = 'HEAT';
        text.style.color = '#ff8800';
        text.style.animation = 'none';
    }
}

// Boost Charges Display UI
function createBoostDisplay() {
    const boostDiv = document.createElement('div');
    boostDiv.id = 'boost-display';
    boostDiv.style.cssText = `
        position: absolute;
        bottom: 70px;
        right: 20px;
        display: flex;
        gap: 6px;
        align-items: center;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: bold;
        color: #ffaa44;
        text-shadow: 0 0 8px rgba(255,170,68,0.6);
    `;
    
    const label = document.createElement('span');
    label.textContent = 'BOOST';
    label.style.marginRight = '4px';
    boostDiv.appendChild(label);
    
    for (let i = 0; i < 3; i++) {
        const icon = document.createElement('span');
        icon.id = `boost-charge-${i}`;
        icon.textContent = '🔥';
        icon.style.cssText = `
            font-size: 18px;
            opacity: 0.3;
            transition: opacity 0.3s, transform 0.3s;
            filter: grayscale(0.8);
        `;
        boostDiv.appendChild(icon);
    }
    
    document.body.appendChild(boostDiv);
}

function updateBoostDisplay() {
    const maxCharges = boostSystem.getMaxCharges();
    const charges = boostSystem.getCharges();
    const isCooldown = boostSystem.getCooldownRatio() > 0;
    
    for (let i = 0; i < maxCharges; i++) {
        const icon = document.getElementById(`boost-charge-${i}`);
        if (!icon) continue;
        
        if (i < charges) {
            icon.style.opacity = '1';
            icon.style.transform = 'scale(1.2)';
            icon.style.filter = 'grayscale(0) drop-shadow(0 0 6px #ff6600)';
        } else if (i === charges && isCooldown) {
            // Recharging: pulse
            icon.style.opacity = String(0.3 + boostSystem.getCooldownRatio() * 0.5);
            icon.style.transform = 'scale(1.0)';
            icon.style.filter = 'grayscale(0.5)';
        } else {
            icon.style.opacity = '0.3';
            icon.style.transform = 'scale(1.0)';
            icon.style.filter = 'grayscale(0.8)';
        }
    }
}

// Roll Display UI
function createRollDisplay() {
    const rollDiv = document.createElement('div');
    rollDiv.id = 'roll-display';
    rollDiv.style.cssText = `
        position: absolute;
        bottom: 70px;
        right: 120px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: bold;
        color: #00ccff;
        text-shadow: 0 0 8px rgba(0,204,255,0.6);
    `;

    const label = document.createElement('span');
    label.textContent = 'ROLL';
    rollDiv.appendChild(label);

    // Circular cooldown indicator
    const circle = document.createElement('div');
    circle.id = 'roll-cooldown';
    circle.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid rgba(0,204,255,0.4);
        background: conic-gradient(#00ccff 0%, #00ccff 0%, transparent 0%);
        transition: transform 0.1s;
    `;
    rollDiv.appendChild(circle);

    // Ready indicator dot
    const dot = document.createElement('div');
    dot.id = 'roll-ready';
    dot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #00ccff;
        box-shadow: 0 0 6px #00ccff;
        opacity: 1;
        transition: opacity 0.3s;
    `;
    rollDiv.appendChild(dot);

    document.body.appendChild(rollDiv);
}

function updateRollDisplay() {
    const circle = document.getElementById('roll-cooldown');
    const dot = document.getElementById('roll-ready');
    if (!circle || !dot) return;

    const cooldownRatio = rollSystem.getCooldownRatio();
    const canRoll = rollSystem.canRoll();
    const isRolling = rollSystem.isRolling();

    if (isRolling) {
        circle.style.background = 'conic-gradient(#00ccff 100%, transparent 100%)';
        circle.style.transform = 'scale(1.3)';
        dot.style.opacity = '0';
    } else if (canRoll) {
        circle.style.background = 'conic-gradient(#00ccff 100%, transparent 100%)';
        circle.style.transform = 'scale(1.0)';
        dot.style.opacity = '1';
    } else {
        const percent = Math.floor(cooldownRatio * 100);
        circle.style.background = `conic-gradient(#00ccff ${percent}%, transparent ${percent}%)`;
        circle.style.transform = 'scale(1.0)';
        dot.style.opacity = '0.3';
    }
}

function showRollPopup() {
    const popup = document.createElement('div');
    popup.textContent = 'ROLL!';
    popup.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'Segoe UI', sans-serif;
        font-size: 48px;
        font-weight: bold;
        color: #00ccff;
        text-shadow: 0 0 20px rgba(0,204,255,0.8);
        z-index: 200;
        pointer-events: none;
        animation: rollPopup 0.6s ease-out forwards;
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 600);
}

function createTetherDisplay() {
    const tetherDiv = document.createElement('div');
    tetherDiv.id = 'tether-display';
    tetherDiv.style.cssText = `
        position: absolute;
        bottom: 70px;
        right: 220px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 100;
        font-family: 'Segoe UI', sans-serif;
        font-size: 14px;
        font-weight: bold;
        color: #00ffcc;
        text-shadow: 0 0 8px rgba(0,255,204,0.6);
    `;

    const label = document.createElement('span');
    label.textContent = 'TETHER [T]';
    tetherDiv.appendChild(label);

    const circle = document.createElement('div');
    circle.id = 'tether-cooldown';
    circle.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid rgba(0,255,204,0.4);
        background: conic-gradient(#00ffcc 100%, transparent 100%);
        transition: transform 0.1s;
    `;
    tetherDiv.appendChild(circle);

    const dot = document.createElement('div');
    dot.id = 'tether-ready';
    dot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #00ffcc;
        box-shadow: 0 0 6px #00ffcc;
        opacity: 1;
        transition: opacity 0.3s;
    `;
    tetherDiv.appendChild(dot);

    document.body.appendChild(tetherDiv);
}

function updateTetherDisplay() {
    const circle = document.getElementById('tether-cooldown');
    const dot = document.getElementById('tether-ready');
    if (!circle || !dot) return;

    const cooldownRatio = tetherSystem.getCooldownRatio();
    const isLatched = tetherSystem.isLatched();
    const canTether = tetherSystem.canTether();

    if (isLatched) {
        circle.style.background = 'conic-gradient(#00ffcc 100%, transparent 100%)';
        circle.style.transform = 'scale(1.3)';
        circle.style.borderColor = '#00ffcc';
        dot.style.opacity = '0';
    } else if (canTether) {
        circle.style.background = 'conic-gradient(#00ffcc 100%, transparent 100%)';
        circle.style.transform = 'scale(1.0)';
        circle.style.borderColor = 'rgba(0,255,204,0.4)';
        dot.style.opacity = '1';
    } else {
        const percent = Math.floor(cooldownRatio * 100);
        circle.style.background = `conic-gradient(#00ffcc ${percent}%, transparent ${percent}%)`;
        circle.style.transform = 'scale(1.0)';
        circle.style.borderColor = 'rgba(0,255,204,0.4)';
        dot.style.opacity = '0.3';
    }
}

// Cores Display UI
function createCoresDisplay() {
    const coresDiv = document.createElement('div');
    coresDiv.id = 'cores-display';
    coresDiv.style.cssText = `
        position: absolute;
        top: 100px;
        left: 20px;
        color: #00ffff;
        font-family: 'Segoe UI', sans-serif;
        font-size: 18px;
        font-weight: bold;
        text-shadow: 0 0 10px rgba(0,255,255,0.5);
        z-index: 100;
    `;
    coresDiv.innerHTML = `🔷 Cores: <span id="cores-count">0</span> | Total: <span id="cores-total">${saveManager.getCores()}</span>`;
    document.body.appendChild(coresDiv);
}

function updateCoresDisplay() {
    const count = document.getElementById('cores-count');
    if (count) count.textContent = playerState.cores.toString();
}

// =============================================================================
// INTERACTION SYSTEM - Click to trigger spore cloud chain reactions
// =============================================================================
let gameStarted = false;

// --- Boost System ---
let lastSpaceTapTime = 0;
const DOUBLE_TAP_THRESHOLD = 300; // ms
let wantsBoost = false;
let wasTouchBoosting = false;

// --- Roll System ---
let lastLeftTapTime = 0;
let lastRightTapTime = 0;
let wantsRoll = false;
let wasTouchRolling = false;

// --- Tether System ---
let wantsTether = false;
let wantsReleaseTether = false;
let tetherKeyHeld = false;
let tetherMouseHeld = false;

canvas.addEventListener('click', (event) => {
    if (!gameStarted) return;

    // Get mouse position in normalized device coordinates
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Create raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Check intersection with spore clouds
    sporeClouds.forEach(cloud => {
        if (!cloud.active) return;

        // Check each spore in the cloud
        // Note: For InstancedMesh, intersectObjects returns the mesh with instanceId
        const intersects = raycaster.intersectObjects(cloud.spores, false);
        if (intersects.length > 0) {
            const hitPoint = intersects[0].point;

            // InstancedMesh hit?
            if (intersects[0].instanceId !== undefined) {
                 // Pass the hit point to trigger local reaction
                 const triggered = cloud.triggerChainReaction(hitPoint);
                 if (triggered > 0) {
                    particleSystem.emit(hitPoint, 0x88ff88, 20, 8.0, 1.0, 2.0);
                 }
            } else {
                 // Fallback for non-instanced (if any remain)
                 const triggered = cloud.triggerChainReaction(hitPoint);
                 if (triggered > 0) {
                    particleSystem.emit(hitPoint, 0x88ff88, 20, 8.0, 1.0, 2.0);
                 }
            }
        }
    });
    
    // Check intersection with wish lanterns (click to pop)
    friendsManager.lanterns.forEach(lantern => {
        if (lantern.isPopped) return;
        
        const intersects = raycaster.intersectObject(lantern.group, true);
        if (intersects.length > 0) {
            friendsManager.popLantern(lantern);
            // Bonus for manual pop
            playerState.cores += 5;
        }
    });
});

// Track when game starts
if (instructions) {
    instructions.addEventListener('click', () => {
        gameStarted = true;
    }, { once: true });
}

// --- Tether input: T key (hold to latch, release to sling) ---
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && !e.repeat && gameStarted) {
        tetherKeyHeld = true;
        wantsTether = true;
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyT') {
        tetherKeyHeld = false;
        if (tetherSystem.isLatched()) wantsReleaseTether = true;
    }
});

// --- Tether input: Right-click (hold to latch, release to sling) ---
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2 && gameStarted) {
        tetherMouseHeld = true;
        wantsTether = true;
    }
});
canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        tetherMouseHeld = false;
        if (tetherSystem.isLatched()) wantsReleaseTether = true;
    }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// =============================================================================
// PHYSICS & COLLISION - Smooth Direct Control (No Thrust/Gravity Bobbing)
// =============================================================================
function updatePlayer(delta: number) {
    // Don't update if player hasn't loaded yet
    if (!player) return;
    
    // Auto-scroll (constant forward movement)
    player.position.x += playerState.autoScrollSpeed * delta;

    // --- UPGRADED: Gravity and Momentum Flight ---
    let targetSpeed = 0;
    let isMovingUp = keys.jump || keys.right;  // Space or Up arrow or D
    let isMovingDown = keys.left;              // A or Left arrow
    
    // Get touch input and update touch controls
    if (touchControls) {
        const touchInput = touchControls.getInput();
        touchControls.update();
        
        // Combine keyboard and touch input
        if (touchInput.vertical > 0.1) isMovingUp = true;
        if (touchInput.vertical < -0.1) isMovingDown = true;
        
        // Handle boost from touch (double-tap or boost button)
        if (touchInput.boost) {
            playerState.autoScrollSpeed = Math.min(
                playerState.autoScrollSpeed * 1.02,
                25  // Max boost speed
            );
            // Play boost sound occasionally to avoid spam
            if (Math.random() < 0.05) {
                audioSystem.playBoost();
            }
        }
        
        // Handle fire from touch
        if (touchInput.fire && player && weaponSystem) {
            const fireDirection = new THREE.Vector3(1, 0, 0);
            weaponSystem.fire(player.position, fireDirection);
        }
    }
    
    if (isMovingUp) {
        targetSpeed = CONFIG.player.maxSpeedY;
    } else if (isMovingDown) {
        targetSpeed = -CONFIG.player.maxDescentSpeed;
    } else {
        targetSpeed = -CONFIG.player.gravity;
        if (playerState.penguinSlideAssistTimer > 0) {
            targetSpeed *= 0.45;
        }
    }
    
    const accel = (targetSpeed !== -CONFIG.player.gravity && targetSpeed !== 0)
        ? CONFIG.player.acceleration
        : CONFIG.player.deceleration;

    // Sling Assist: temporary 30% gravity-control boost awarded by Arc Surge (7×+)
    if (playerState.slingAssistTimer > 0) {
        playerState.slingAssistTimer = Math.max(0, playerState.slingAssistTimer - delta);
        playerState.currentSpeedY += (targetSpeed - playerState.currentSpeedY) * accel * 0.3 * delta;
    }

    // Astro Penguin slide assist: lighter gravity + gentle forward nudge
    if (playerState.penguinSlideAssistTimer > 0) {
        playerState.penguinSlideAssistTimer = Math.max(0, playerState.penguinSlideAssistTimer - delta);
        playerState.autoScrollSpeed = Math.min(playerState.autoScrollSpeed + 2.2 * delta, 20);
    }
    
    playerState.currentSpeedY += (targetSpeed - playerState.currentSpeedY) * accel * delta;
    player.position.y += playerState.currentSpeedY * delta;
    
    // Soft boundaries - keep player on screen (Y: -10 to +15)
    if (player.position.y > 15) {
        player.position.y = 15;
        playerState.currentSpeedY = Math.min(0, playerState.currentSpeedY);
    } else if (player.position.y < -10) {
        player.position.y = -10;
        playerState.currentSpeedY = Math.max(0, playerState.currentSpeedY);
    }
    
    // Store for animation
    playerState.velocity.y = playerState.currentSpeedY;

    // --- UPGRADED: Visual Flight Angles (Pitch & Roll) ---
    const rocket = player.children[0];
    if (rocket) {
        const speedRatio = playerState.currentSpeedY / CONFIG.player.maxDescentSpeed;
        const targetPitch = -Math.sign(speedRatio) * Math.pow(Math.abs(speedRatio), 1.2) * 0.6;
        const targetRoll = playerState.currentSpeedY * 0.015;

        player.rotation.z += (targetPitch - player.rotation.z) * 0.12; // Pitch
        player.rotation.x += (targetRoll - player.rotation.x) * 0.08;  // Roll

        // Gentle hover bob (always present, subtle)
        const hoverY = Math.sin(Date.now() * 0.004) * 0.03;
        rocket.position.y = hoverY;

        // Engine VFX based on thrust vs glide vs dive
        if (rocket.userData.flame) {
            if (isMovingUp) {
                // Thrusting up → bright, large, flickering flame
                const flicker = 0.9 + Math.random() * 0.3;
                rocket.userData.flame.scale.set(flicker * 1.5, flicker * 3.0, flicker * 1.5);
                
                // Emit engine trail
                const exhaustPos = player.position.clone();
                exhaustPos.x -= 0.5;
                exhaustPos.y -= 0.5;
                particleSystem.emit(exhaustPos, 0x00ff00, 2, 5.0, 0.8, 0.2); // Green for boost/thrust
            } else if (isMovingDown) {
                // Diving → very small, dim flame + extra downward particle streaks
                const flicker = 0.4 + Math.random() * 0.2;
                rocket.userData.flame.scale.set(flicker, flicker, flicker);
                
                // Extra downward streaks
                const streakPos = player.position.clone();
                streakPos.x -= 0.5;
                streakPos.y -= 0.3;
                particleSystem.emit(streakPos, 0xff0000, 1, 3.0, 0.5, 0.3); // Red for dive
            } else {
                // Gliding / idle → smaller, softer flame
                const flicker = 0.5 + Math.random() * 0.2;
                rocket.userData.flame.scale.set(flicker, flicker * 1.5, flicker);

                // Blue trail for glide
                const glidePos = player.position.clone();
                glidePos.x -= 0.5;
                glidePos.y -= 0.1;
                if (Math.random() < 0.3) {
                    particleSystem.emit(glidePos, 0x00aaff, 1, 3.0, 0.6, 0.2);
                }
            }
        }
    }

    // --- BOOST SYSTEM ---
    boostSystem.update(delta);

    // Check for boost activation
    const canActivateBoost = boostSystem.canBoost();
    const isBoosting = boostSystem.isBoosting();

    // Keyboard: Shift hold or double-tap Space
    if (canActivateBoost) {
        if (keys.run) {
            boostSystem.activate();
        } else if (wantsBoost) {
            wantsBoost = false;
            boostSystem.activate();
        }
    }

    // Touch boost activation (dedicated button or double-tap)
    if (touchControls && canActivateBoost) {
        const touchInput = touchControls.getInput();
        if (touchInput.boost && !wasTouchBoosting) {
            boostSystem.activate();
        }
        wasTouchBoosting = touchInput.boost;
    }

    // Apply boost physics and effects
    if (isBoosting) {
        // Strong upward velocity
        playerState.currentSpeedY = Math.max(playerState.currentSpeedY, 25);
        
        // Temporarily increase horizontal scroll speed
        const baseSpeed = saveManager.applyToSpeed(8);
        const boostedSpeed = Math.min(baseSpeed * 1.6, 30);
        playerState.autoScrollSpeed += (boostedSpeed - playerState.autoScrollSpeed) * 0.1;

        // Enhanced flame: much larger, brighter
        if (rocket && rocket.userData.flame) {
            const flicker = 0.9 + Math.random() * 0.4;
            rocket.userData.flame.scale.set(flicker * 2.2, flicker * 5.0, flicker * 2.2);
            (rocket.userData.flame.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5 + Math.random() * 1.0;
        }

        // Rainbow afterburner trail particles
        const exhaustPos = player.position.clone();
        exhaustPos.x -= 0.8;
        const colors = [0xff8800, 0xffaa00, 0xffdd44, 0xffffff];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particleSystem.emit(exhaustPos, color, 2, 6.0 + Math.random() * 2, 0.8, 0.25);

        // Additional downward streak for contrast
        const streakPos = player.position.clone();
        streakPos.x -= 0.6;
        streakPos.y -= 0.2;
        particleSystem.emit(streakPos, 0xff4400, 1, 4.0, 0.5, 0.3);
    } else {
        // Restore normal scroll speed when not boosting
        const baseSpeed = saveManager.applyToSpeed(8);
        playerState.autoScrollSpeed += (baseSpeed - playerState.autoScrollSpeed) * 0.02;
    }

    // --- ROLL SYSTEM ---
    rollSystem.update(delta);

    // Check for roll activation
    const canRoll = rollSystem.canRoll();
    const isRolling = rollSystem.isRolling();

    if (canRoll) {
        if (wantsRoll) {
            wantsRoll = false;
            rollSystem.activate();
        }
    }

    // Touch roll activation (downward swipe)
    if (touchControls) {
        const touchInput = touchControls.getInput();
        if (touchInput.roll && !wasTouchRolling) {
            if (canRoll) {
                rollSystem.activate();
            }
        }
        wasTouchRolling = touchInput.roll;
    }

    // Apply roll physics and effects
    if (isRolling) {
        // 360° barrel roll on Z axis
        const rollAngle = rollSystem.getRollAngle();
        if (rocket) {
            rocket.rotation.z = -Math.PI / 2 + rollAngle;
        }

        // Slight transparency during roll
        if (rocket) {
            rocket.traverse((child: any) => {
                if (child.isMesh && child.material) {
                    if (child.userData.originalOpacity === undefined) {
                        child.userData.originalOpacity = child.material.opacity;
                        child.userData.originalTransparent = child.material.transparent;
                    }
                    child.material.transparent = true;
                    child.material.opacity = 0.55;
                }
            });
        }

        // Afterimage trail particles
        const ghostPos = player.position.clone();
        ghostPos.x -= 0.3;
        particleSystem.emit(ghostPos, 0x00ffff, 1, 3.0, 0.4, 0.2);
        particleSystem.emit(ghostPos, 0xffffff, 1, 2.5, 0.3, 0.15);

        // Bright white + cyan burst ring effect
        if (Math.random() < 0.3) {
            const ringPos = player.position.clone();
            ringPos.x -= 0.2;
            particleSystem.emit(ringPos, 0x88ffff, 2, 5.0, 0.6, 0.2);
        }

        // Destroy small asteroids on contact
        const obstacles = obstacleSystem.getObstacles();
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            const radius = obs.userData.radius || 1.0;
            if (radius < 1.2 && player.position.distanceTo(obs.position) < radius + 1.5) {
                obstacleSystem.splitAsteroid(obs);
                particleSystem.emit(obs.position.clone(), 0xffaa44, 8, 6.0, 0.8, 1.0);
                audioSystem.play('explode', 0.5, 4);
            }
        }
    } else {
        // Restore opacity after roll
        if (rocket) {
            rocket.traverse((child: any) => {
                if (child.isMesh && child.material) {
                    if (child.userData.originalOpacity !== undefined) {
                        child.material.opacity = child.userData.originalOpacity;
                        child.material.transparent = child.userData.originalTransparent;
                    } else {
                        child.material.opacity = 1.0;
                        child.material.transparent = false;
                    }
                }
            });
        }
    }

    // --- TETHER SYSTEM ---
    const tetherForce = tetherSystem.update(delta, player.position);
    slingableObjectSystem.setLatchedTarget(tetherSystem.getLatchedTarget());

    // Apply spring force while latched
    if (tetherSystem.isLatched()) {
        playerState.currentSpeedY += tetherForce.y;
        playerState.currentSpeedY = THREE.MathUtils.clamp(
            playerState.currentSpeedY,
            -CONFIG.player.maxDescentSpeed * 1.5,
            CONFIG.player.maxSpeedY * 1.5
        );

        // Emit particles along the tether beam
        const anchorPos = tetherSystem.getAnchorPosition();
        if (anchorPos && Math.random() < 0.3) {
            const t = Math.random();
            const beamPoint = player.position.clone().lerp(anchorPos, t);
            particleSystem.emit(beamPoint, 0x00ffcc, 1, 2.5, 0.4, 0.15);
        }

        // Track full loops around a Tether Sprite for the "Crane Loop" bonus
        const latchedTarget = tetherSystem.getLatchedTarget();
        if (anchorPos && latchedTarget?.userData.kind === 'tetherSprite') {
            const angle = Math.atan2(player.position.y - anchorPos.y, player.position.x - anchorPos.x);
            if (tetherSpritePrevAngle !== null) {
                let dAngle = angle - tetherSpritePrevAngle;
                if (dAngle > Math.PI) dAngle -= Math.PI * 2;
                if (dAngle < -Math.PI) dAngle += Math.PI * 2;
                tetherSpriteSweep += dAngle;
            }
            tetherSpritePrevAngle = angle;
        } else {
            tetherSpriteSweep = 0;
            tetherSpritePrevAngle = null;
        }
    }

    // Activate tether: T or right-click pressed
    if (wantsTether) {
        wantsTether = false;
        if (tetherSystem.canTether() && !rollSystem.isRolling()) {
            tetherSystem.activate(
                gravityAnchors.concat(slingableObjectSystem.getTetherTargets()),
                player.position
            );
        }
    }

    // Release tether: T or right-click released
    if (wantsReleaseTether) {
        wantsReleaseTether = false;
        if (tetherSystem.isLatched()) {
            const latchedTarget = tetherSystem.getLatchedTarget();
            const impulse = tetherSystem.release(player.position);
            const threwSlingable = latchedTarget
                ? slingableObjectSystem.applyTetherImpulse(latchedTarget, impulse)
                : false;

            // Crane Loop bonus: a full 360° swing around a Tether Sprite
            if (latchedTarget?.userData.kind === 'tetherSprite' && Math.abs(tetherSpriteSweep) >= Math.PI * 1.85) {
                hudManager.addScore(500);
                juiceManager.showFloatingText('Crane Loop! +500', player.position.clone(), '#ffaaee', 28);
                juiceManager.burstMagic(player.position.clone());
                dogController.triggerAnimation(DogAnimationState.VICTORY, 1.5);
                if (playerState.health < playerState.maxHealth) {
                    playerState.health++;
                    hudManager.updateHealth(playerState.health, playerState.maxHealth);
                    updateHealthDisplay(playerState);
                    juiceManager.showFloatingText('+1 Heart!', player.position.clone().add(new THREE.Vector3(0, 1.5, 0)), '#ff6699', 24);
                }
            }
            tetherSpriteSweep = 0;
            tetherSpritePrevAngle = null;

            if (threwSlingable) {
                playerState.currentSpeedY = THREE.MathUtils.clamp(
                    playerState.currentSpeedY + impulse.y * 0.35,
                    -CONFIG.player.maxDescentSpeed * 1.5,
                    CONFIG.player.maxSpeedY * 1.75
                );
                playerState.autoScrollSpeed = Math.min(
                    playerState.autoScrollSpeed + Math.abs(impulse.x) * 0.12,
                    30
                );
                particleSystem.emit(player.position.clone(), 0x8dffda, 10, 4.5, 0.7, 0.35);
                const tossLabel = latchedTarget?.userData.kind === 'toyRocket' ? 'Wreck Toss!' : 'Comet Toss!';
                juiceManager.showFloatingText(tossLabel, player.position.clone(), '#8dffda', 20);
            } else {
                // Apply sling impulse to vertical speed
                playerState.currentSpeedY = THREE.MathUtils.clamp(
                    playerState.currentSpeedY + impulse.y,
                    -CONFIG.player.maxDescentSpeed * 1.5,
                    CONFIG.player.maxSpeedY * 2.0
                );
                // Minor forward speed boost from X component
                const xBoost = Math.abs(impulse.x) * 0.25;
                playerState.autoScrollSpeed = Math.min(
                    playerState.autoScrollSpeed + xBoost,
                    30
                );
                // Burst particles at player position
                particleSystem.emit(player.position.clone(), 0x00ffcc, 16, 6.0, 0.9, 0.3);
            }

            slingableObjectSystem.setLatchedTarget(null);
            dogController.triggerAnimation(DogAnimationState.POWER_UP, 0.6);

            // ── Sling Combo: classify quality by impulse magnitude ──────────
            const impulseMag = impulse.length();
            const slungKind = latchedTarget?.userData.kind as string | undefined;
            const slingQuality = slungKind === 'toyRocket' && impulseMag >= 8
                ? 'perfect'
                : impulseMag >= 26 ? 'perfect' : impulseMag >= 14 ? 'good' : 'messy';
            const slipstreamBonus = slingableObjectSystem.isInSlipstream(player.position) ? 2 : 1;
            const toyRocketBonus = slungKind === 'toyRocket' ? 2.2 : 1;
            slingComboManager.recordSlingAction(slingQuality, player.position.clone(), slipstreamBonus * toyRocketBonus);
            slingObjectiveManager.recordSling(slingQuality);
            reportComboObjectiveProgress();
            if (slingQuality === 'perfect') {
                friendsManager.cheerFlotilla(player.position.clone());
            }
        }
    }

    // --- AUDIO SYSTEM ---
    audioSystem.updateEngineState(playerState.currentSpeedY, isMovingUp, isMovingDown, isBoosting);

    // Level Checking
    levelManager.checkProgress(player.position.x);

    // "Survive" objectives (e.g. L4 Rusty Gauntlet) don't have a running
    // counter - treat reaching 80% of the level's span as "survived" and
    // open the fast lane for the home stretch.
    {
        const currentCfg = levelManager.config[levelManager.currentLevel];
        if (currentCfg?.objective?.type === 'survive') {
            const levelStart = LEVEL_DISTANCE_BOUNDARIES[levelManager.currentLevel - 1] ?? 0;
            const levelEnd = LEVEL_DISTANCE_BOUNDARIES[levelManager.currentLevel] ?? (levelStart + currentCfg.distance);
            const span = levelEnd - levelStart;
            if (span > 0 && player.position.x - levelStart >= span * 0.8) {
                hudManager.updateObjectiveProgress(1, 1);
            }
        }
    }

    // Journey map: overall progress from Earth to the Moon across all 6 levels
    const journey = levelManager.getJourneyProgress(player.position.x);
    hudManager.updateJourneyProgress(journey.percent, journey.level);
}

// =============================================================================
// CAMERA FOLLOW - Dynamic with screen shake and movement response
// =============================================================================
let cameraShake = 0;
let cameraOffset = new THREE.Vector3();

export function triggerScreenShake(intensity: number, duration: number) {
    cameraShake = intensity;
    setTimeout(() => { cameraShake = 0; }, duration * 1000);
}

function updateCamera(delta?: number) {
    // Don't update if player hasn't loaded yet
    if (!player) return;
    
    const d = delta || 0.016;
    
    // Dynamic camera positioning based on player movement
    const speedFactor = Math.abs(playerState.currentSpeedY) / CONFIG.player.maxSpeedY;
    const lookAheadX = 15 + speedFactor * 5; // Look further ahead when moving fast
    const lookAheadY = playerState.currentSpeedY * 0.3; // Lead vertical movement
    
    const targetX = player.position.x + lookAheadX;
    const targetY = Math.max(player.position.y + 2 + lookAheadY, CONFIG.cameraHeight);
    
    const isFallingFast = playerState.currentSpeedY < -5;
    const isBoosting = boostSystem.isBoosting();
    let targetDistance = CONFIG.cameraDistance;
    if (isFallingFast) targetDistance += 3;
    if (isBoosting) targetDistance += 4;

    // Smooth follow with different speeds for X, Y, and Z
    camera.position.x += (targetX - camera.position.x) * 0.06;
    camera.position.y += (targetY - camera.position.y) * 0.04;
    camera.position.z += (targetDistance - camera.position.z) * 0.03;

    // Subtle camera roll during barrel roll for extra immersion
    const isRolling = rollSystem.isRolling();
    if (isRolling) {
        const rollAngle = rollSystem.getRollAngle();
        camera.rotation.z += ((-rollAngle * 0.15) - camera.rotation.z) * 0.2;
    } else {
        camera.rotation.z += (0 - camera.rotation.z) * 0.05;
    }

    // Screen shake effect
    if (cameraShake > 0) {
        cameraOffset.x = (Math.random() - 0.5) * cameraShake;
        cameraOffset.y = (Math.random() - 0.5) * cameraShake;
        cameraOffset.z = (Math.random() - 0.5) * cameraShake * 0.5;
        camera.position.add(cameraOffset);
        cameraShake *= 0.9; // Decay
    }

    // Look ahead with slight tilt based on vertical speed
    const tiltAmount = -playerState.currentSpeedY * 0.02;
    camera.lookAt(
        player.position.x + 20,
        player.position.y + tiltAmount,
        0
    );
}

// =============================================================================
// BOSS HEALTH BAR UI
// =============================================================================
let bossHealthBar: HTMLDivElement | null = null;
let bossHealthFill: HTMLDivElement | null = null;
let bossHealthLabel: HTMLDivElement | null = null;

function updateBossHealthBar(squids: NebulaKraken[]): void {
    const activeSquid = squids.find(s => !s.isDestroyed);

    if (!activeSquid) {
        // No active boss: hide the bar
        if (bossHealthBar) {
            bossHealthBar.style.display = 'none';
        }
        return;
    }

    // Create UI elements if they don't exist yet
    if (!bossHealthBar) {
        bossHealthBar = document.createElement('div');
        bossHealthBar.id = 'boss-health-bar';
        bossHealthBar.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            width: 320px; height: 18px; background: #111; border: 2px solid #9900ff;
            border-radius: 9px; overflow: hidden; z-index: 100;
            box-shadow: 0 0 15px #9900ff55, inset 0 0 6px #000;
        `;

        bossHealthFill = document.createElement('div');
        bossHealthFill.style.cssText = `
            width: 100%; height: 100%; background: linear-gradient(90deg, #8A2BE2, #ff00ff, #9400D3);
            transition: width 0.3s ease; border-radius: 7px;
        `;
        bossHealthBar.appendChild(bossHealthFill);

        bossHealthLabel = document.createElement('div');
        bossHealthLabel.style.cssText = `
            position: fixed; top: 4px; left: 50%; transform: translateX(-50%);
            color: #cc88ff; font-family: monospace; font-size: 11px;
            text-transform: uppercase; letter-spacing: 2px; z-index: 101;
            text-shadow: 0 0 8px #9900ff;
        `;
        bossHealthLabel.textContent = `⚠ ${BOSS_DISPLAY_NAME} ⚠`;
        document.body.appendChild(bossHealthLabel);
        document.body.appendChild(bossHealthBar);
    }

    bossHealthBar.style.display = 'block';
    if (bossHealthLabel) bossHealthLabel.style.display = 'block';

    const ratio = activeSquid.getHealthRatio();
    if (bossHealthFill) {
        bossHealthFill.style.width = `${Math.max(0, ratio * 100)}%`;
    }

    // Change label per phase
    if (bossHealthLabel) {
        const phase = activeSquid.getPhase();
        const personality = activeSquid.getPersonality();
        const phaseNames = ['', 'VOID SWEEP', 'INK PROTOCOL', 'FRENZY'];
        bossHealthLabel.textContent = `⚠ ${BOSS_DISPLAY_NAME} — ${phaseNames[phase]} [${personality.toUpperCase()}] ⚠`;
    }
}

// =============================================================================
// ANIMATION LOOP
// =============================================================================
const clock = new THREE.Clock();

// Phase 1 FPS Fixes - Quick Wins: dynamic pixel ratio & shadow quality
let fpsFrameCount = 0;
let fpsElapsedTime = 0;
let fpsLowDuration = 0;
let fpsHighDuration = 0;
const RESOLUTION_RATIOS = [0.50, 0.60, 0.75, 1.0, 1.5, 2.0];
let currentRatioIndex = 1; // start at 0.60
let currentPixelRatio = Math.min(2, window.devicePixelRatio * RESOLUTION_RATIOS[currentRatioIndex]);
renderer.setPixelRatio(currentPixelRatio);

let shadowCullingFrame = 0;
let shadowCullingWarningIssued = false;
let renderDebugWarningIssued = false;
let geologicalUpdateFrame = 0;
let objectDensityMultiplier = 1.0;
const wireframeDebugHelper = new WireframeDebugHelper();
const collisionDebugOverlay = new CollisionDebugOverlay(scene);
const webglMaterialFallbackRenderer = new WebGLMaterialFallbackRenderer(rendererBackend);

function renderGameFrame(): void {
    webglMaterialFallbackRenderer.render(renderer, scene, camera);
}

function getCollisionDebugTargets(): CollisionDebugTarget[] {
    const targets: CollisionDebugTarget[] = [];
    const addTarget = (position: THREE.Vector3 | null | undefined, radius: number, color: number) => {
        if (!position) return;
        targets.push({ position, radius, color });
    };

    if (player) {
        addTarget(player.position, 0.5, 0x55ff88);
    }

    if (obstacleSystem) {
        obstacleSystem.getObstacles().slice(0, 120).forEach((obs) => {
            if (!obs?.position) return;
            addTarget(
                obs.position,
                obs.userData.radius || 1.0,
                Math.abs(obs.position.z) < 2.0 ? 0xffaa33 : 0x6655ff
            );
        });

        obstacleSystem.getSquids().forEach((squid) => {
            if (!squid.isDestroyed) {
                addTarget(squid.getPosition(), squid.getRadius(), 0xff44cc);
            }
        });
    }

    slingableObjectSystem.objects.forEach((obj) => {
        if (obj?.active) {
            addTarget(obj.group?.position, obj.radius, 0x44ddff);
        }
    });

    sporeClouds.forEach((cloud) => {
        if (cloud.active) {
            addTarget(cloud.position, 5, 0x88ff88);
        }
    });

    jellyMosses.forEach((jellyMoss) => {
        if (jellyMoss.visible && jellyMoss.userData.radius) {
            addTarget(jellyMoss.position, jellyMoss.userData.radius, 0x88ffaa);
        }
    });

    gravityAnchors.forEach((anchor) => {
        addTarget(anchor.position, (anchor.userData.fieldRadius as number) || 40, 0x6699ff);
    });

    return targets;
}

function updateShadowQuality() {
    const targetSize = playerState.bossActive ? 2048 : 1024;
    if (mainLight.shadow.mapSize.width !== targetSize) {
        mainLight.shadow.mapSize.width = targetSize;
        mainLight.shadow.mapSize.height = targetSize;
        if (mainLight.shadow.map) {
            mainLight.shadow.map.setSize(targetSize, targetSize);
        }
        console.log(`Shadow map resized to ${targetSize}x${targetSize} (${playerState.bossActive ? 'boss' : 'normal'})`);
    }
}

function updateShadowCulling() {
    if (!player) return;
    shadowCullingFrame++;
    if (shadowCullingFrame % 15 !== 0) return;

    const playerX = player.position.x;
    const updateObj = (obj: THREE.Object3D | null | undefined) => {
        if (!obj || !obj.position || typeof obj.traverse !== 'function') return;
        const inRange = Math.abs(obj.position.x - playerX) < 40;
        obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).castShadow = inRange;
                (child as THREE.Mesh).receiveShadow = inRange;
            }
        });
    };

    levelManager.levelObjects.forEach(updateObj);
    geodes.forEach(updateObj);
    voidRootBalls.forEach(updateObj);
    vacuumKelps.forEach(updateObj);
    iceNeedleClusters.forEach(updateObj);
    magmaHearts.forEach(updateObj);
    gravityAnchors.forEach(updateObj);
    slingableObjectSystem.objects.forEach(obj => updateObj(obj?.group));
}

function animate() {
    const rawDelta = Math.min(clock.getDelta(), 0.1); // Cap delta
    const delta = juiceManager.update(rawDelta);
    const time = clock.getElapsedTime(); // For foliage animation and time-based motion

    // --- Sling Combo Manager ---
    slingComboManager.update(delta);

    // --- Debug System ---
    debugSystem.update(rawDelta);
    try {
        wireframeDebugHelper.update(scene, debugSystem.isEnabled('wireframe'));
        collisionDebugOverlay.update(
            debugSystem.isEnabled('collisionDebug'),
            getCollisionDebugTargets()
        );
    } catch (error) {
        if (!renderDebugWarningIssued) {
            renderDebugWarningIssued = true;
            console.warn('Renderer debug helpers skipped because a tracked object was malformed.', error);
        }
    }

    // --- FPS Tracking & Dynamic Pixel Ratio ---
    fpsFrameCount++;
    fpsElapsedTime += rawDelta;
    if (fpsElapsedTime >= 1.0) {
        const fps = fpsFrameCount / fpsElapsedTime;
        fpsFrameCount = 0;
        fpsElapsedTime = 0;

        if (fps < 45) {
            fpsLowDuration += 1.0;
            fpsHighDuration = 0;
            if (fpsLowDuration >= 3.0 && currentRatioIndex > 0) {
                currentRatioIndex--;
                currentPixelRatio = Math.min(2, window.devicePixelRatio * RESOLUTION_RATIOS[currentRatioIndex]);
                renderer.setPixelRatio(currentPixelRatio);
                console.log(`Performance low — dropping resolution to ${Math.round(RESOLUTION_RATIOS[currentRatioIndex] * 100)}%`);
            }
        } else if (fps > 55) {
            fpsHighDuration += 1.0;
            fpsLowDuration = 0;
            if (fpsHighDuration >= 5.0 && currentRatioIndex < RESOLUTION_RATIOS.length - 1) {
                currentRatioIndex++;
                currentPixelRatio = Math.min(2, window.devicePixelRatio * RESOLUTION_RATIOS[currentRatioIndex]);
                renderer.setPixelRatio(currentPixelRatio);
                console.log(`Performance recovered — restoring resolution to ${Math.round(RESOLUTION_RATIOS[currentRatioIndex] * 100)}%`);
            }
        } else {
            fpsLowDuration = 0;
            fpsHighDuration = 0;
        }

        if (fps < 45 && objectDensityMultiplier > 0.25) {
            objectDensityMultiplier = Math.max(0.25, objectDensityMultiplier - 0.25);
            levelManager.setObjectDensityMultiplier(objectDensityMultiplier);
            console.log(`Performance low — reducing object density to ${Math.round(objectDensityMultiplier * 100)}%`);
        } else if (fps > 55 && objectDensityMultiplier < 1.0) {
            objectDensityMultiplier = Math.min(1.0, objectDensityMultiplier + 0.25);
            levelManager.setObjectDensityMultiplier(objectDensityMultiplier);
            console.log(`Performance recovered — restoring object density to ${Math.round(objectDensityMultiplier * 100)}%`);
        }
    }

    // --- Debug Shadow Toggle ---
    const shadowsOn = debugSystem.isEnabled('shadows');
    if (mainLight.castShadow !== shadowsOn) {
        mainLight.castShadow = shadowsOn;
        renderer.shadowMap.enabled = shadowsOn;
    }
    
    if (isGamePaused) {
        renderGameFrame();
        return;
    }

    // Update rocket position for touch controls (follow finger mode)
    if (touchControls && player) {
        // Convert player position to screen space for follow finger mode
        const vector = player.position.clone();
        vector.project(camera);
        const screenX = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-vector.y * 0.5 + 0.5) * window.innerHeight;
        
        touchControls.setRocketPosition(
            player.position,
            new THREE.Vector2(screenX, screenY)
        );
    }

    updatePlayer(delta);
    obstacleSystem.update(delta);

    // Bestiary creatures: Crystal Tarsier Guardian, Living Geode Titan, etc.
    if (player) {
        const creatureResults = creatureManager.update(
            delta,
            player.position.x,
            player.position.y,
            levelManager.config[levelManager.currentLevel],
            weaponSystem.getActiveProjectiles(),
            levelManager.currentLevel
        );
        for (const result of creatureResults) {
            let cores = result.cores ?? 0;
            // Memory bonuses: cataloging a creature once grants small lasting perks
            if (result.type === 'geode_titan_flythrough' && cores > 0 && saveManager.hasMemory('geode_titan')) {
                cores = Math.round(cores * 1.5);
            }
            if (result.type === 'moon_snail_blessing' && cores > 0 && saveManager.hasMemory('moon_snail')) {
                cores += 8;
            }
            if (cores) {
                saveManager.addCores(cores);
            }
            if (result.label) {
                juiceManager.showFloatingText(result.label, result.position.clone(), '#aaffee', 24);
            }
            // Non-lethal, calm interactions catalog the creature for the bestiary
            if (result.type === 'tarsier_guardian_blessing') {
                creatureCatalogManager.catalog('tarsier');
            } else if (result.type === 'geode_titan_flythrough') {
                creatureCatalogManager.catalog('geode_titan');
            } else if (result.type === 'moon_snail_blessing') {
                creatureCatalogManager.catalog('moon_snail');
                if (result.blessingPowerUp) {
                    powerUpManager.activatePowerUp(result.blessingPowerUp);
                }
            } else if (result.type === 'puff_puffer_catalog') {
                creatureCatalogManager.catalog('nebula_puffer');
                const pufferMemory = saveManager.hasMemory('nebula_puffer');
                const grazeDuration = (result.grazeWindowDuration ?? 8) + (pufferMemory ? 4 : 0);
                const grazeBonus = (result.grazeWindowBonus ?? 0.55) + (pufferMemory ? 0.25 : 0);
                obstacleSystem.applyGrazeWindowBonus(grazeDuration, grazeBonus);
            }
            if (result.score) {
                hudManager.addScore(result.score);
                if (result.label && result.type === 'puff_puffer_bubble_pop') {
                    juiceManager.showFloatingText(result.label, result.position.clone(), '#aaddff', 18);
                }
            }
            if (result.type === 'tarsier_guardian_blessing' || result.type === 'geode_titan_flythrough' || result.type === 'puff_puffer_catalog' || result.type === 'moon_snail_blessing') {
                juiceManager.burstMagic(result.position.clone());
                dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
            } else if (result.type === 'moon_snail_bump') {
                if (result.playerNudge) {
                    playerState.currentSpeedY += result.playerNudge.y ?? 0;
                    playerState.autoScrollSpeed = Math.max(6, playerState.autoScrollSpeed + (result.playerNudge.x ?? 0) * 0.15);
                }
                juiceManager.shakeScreen(ShakeType.LIGHT, 0.06);
            } else if (result.type === 'puff_puffer_bubble_pop') {
                juiceManager.shakeScreen(ShakeType.LIGHT, 0.08);
            } else {
                juiceManager.shakeScreen(ShakeType.LIGHT, 0.15);
            }
        }
    }

    slingableObjectSystem.update(delta, camera.position.x, player?.position);
    slingableObjectSystem.handleAsteroidCollisions(
        obstacleSystem.getObstacles(),
        (asteroid) => {
            if (asteroid.userData.isCandyAsteroid) {
                obstacleSystem.triggerCandySquash(asteroid, 1.5);
                const variant = asteroid.userData.candyVariant as CandyAsteroidVariant;
                slingComboManager.recordSlingAction(
                    'good',
                    asteroid.position.clone(),
                    getCandySlingComboBonus(variant)
                );
            }
            audioSystem.play('explode');
            pickupManager.trySpawn(asteroid.position.clone());
            obstacleSystem.splitAsteroid(asteroid);
        },
        (position, heavyHit) => {
            if (heavyHit) {
                juiceManager.shakeScreen(ShakeType.MEDIUM, 0.18);
            }
            particleSystem.emit(position.clone(), 0xffffff, 4, 3.5, 0.5, 0.6);
        }
    );

    // Update graze combo HUD visibility
    if (obstacleSystem.getGrazeCombo() === 0) {
        hudManager.hideGrazeCombo();
    }
    
    // --- BOSS SYSTEM ---
    if (player) {
        // Check for boss spawn
        if (!playerState.bossActive) {
            const bossSpawned = bossManager.checkBossSpawn(
                player.position.x,
                playerState.level,
                {
                    onDefeated: () => {
                        // Boss defeated - give rewards and continue
                        playerState.cores += 50;
                        saveManager.addCores(50);
                        // Star-Eater memory: a few extra cores for veterans who've cataloged it
                        if (saveManager.hasMemory('star_eater')) {
                            playerState.cores += 10;
                            saveManager.addCores(10);
                        }
                        saveManager.recordBossDefeated();
                        audioSystem.play('boss_defeat');
                        playerState.bossActive = false;
                        
                        // Resume auto-scroll
                        playerState.autoScrollSpeed = saveManager.applyToSpeed(8);

                        // 'boss' objective (L6): defeating the boss completes the chapter
                        const objective = levelManager.config[levelManager.currentLevel]?.objective;
                        if (objective?.type === 'boss') {
                            hudManager.updateObjectiveProgress(objective.target, objective.target);
                        }

                        // Show victory message briefly
                        console.log('🎉 BOSS DEFEATED! +50 Cores');
                    },
                    onPlayerHit: () => {
                        // Boss hit player
                        lastPlayerDamageTime = performance.now() * 0.001;
                        if (!playerState.invincible && !playerState.inSafeHarbor) {
                            playerState.health--;
                            audioSystem.play('hit');
                            updateHealthDisplay(playerState);
                            dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
                            juiceManager.shakeScreen(ShakeType.HEAVY);
                            if (player) juiceManager.burstDamage(player.position.clone());
                            hudManager.updateHealth(playerState.health, playerState.maxHealth);
                            if (playerState.health <= 0) {
                                handleGameOver();
                            }
                        }
                    },
                    getPlayerPosition: () => player ? player.position : null,
                    spawnDebris: (pos) => {
                        // Spawn debris from boss mouth
                        obstacleSystem.createAsteroid(pos.x, pos.y, pos.z, 1.0, 
                            new THREE.Vector3(-5 - Math.random() * 5, (Math.random() - 0.5) * 5, 0));
                    },
                    onBossStart: () => {
                        playerState.bossActive = true;
                        // Slow down during boss fight
                        playerState.autoScrollSpeed = 2;
                        audioSystem.play('boss_roar');
                        audioSystem.updateDroneIntensity(2.0);
                        // Surviving the first roar catalogs the Star-Eater
                        creatureCatalogManager.catalog('star_eater');
                    }
                }
            );
            
            if (bossSpawned) {
                console.log('👹 Boss fight started!');
            }
        }
        
        // Update boss
        const bossResult = bossManager.update(delta);
        if (bossResult.bossActive && player) {
            // Apply pull force from boss
            const playerPos = player.position;
            const boss = bossResult.boss;
            const bossPos = boss?.group.position;
            
            if (boss && bossPos) {
                // Pull toward boss Y position
                const pullDir = bossPos.y - playerPos.y;
                playerState.currentSpeedY += pullDir * bossResult.pullForce * delta * 0.1;
                
                // Check mouth snap death
                if (bossResult.isSnapping) {
                    const distToMouth = Math.abs(playerPos.x - (bossPos.x + 8));
                    if (distToMouth < 3 && Math.abs(playerPos.y - bossPos.y) < 3) {
                        // Inside mouth when it snaps - instant death
                        playerState.health = 0;
                        updateHealthDisplay(playerState);
                        dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
                        juiceManager.shakeScreen(ShakeType.EARTHQUAKE);
                        juiceManager.burstDamage(player.position.clone());
                        hudManager.updateHealth(0, playerState.maxHealth);
                        handleGameOver();
                        return;
                    }
                }
                
                // Check projectile hits on boss
                const projectiles = weaponSystem.getActiveProjectiles();
                for (const proj of projectiles) {
                    if (!proj.active) continue;
                    const hitbox = boss.getHitbox();
                    const dist = proj.mesh.position.distanceTo(hitbox.center);
                    if (dist < hitbox.radius) {
                        if (boss.takeDamage(10)) {
                            // Hit registered
                            audioSystem.play('hit');
                            proj.deactivate();
                        }
                    }
                }
            }
        }
        
        // --- PICKUP SYSTEM ---
        const collected = pickupManager.update(delta, time, player.position);
        if (collected) {
            upgradeSystem.setPlayerGroup(player);
            upgradeSystem.activateUpgrade(collected);
        }
        
        // --- UPGRADE SYSTEM ---
        upgradeSystem.update(delta, time);
        
        // --- AUDIO SYSTEM ---
        // Engine state is now updated inside updatePlayer with thrust/glide/dive info
        
        // --- HEAT SYSTEM ---
        heatSystem.update(delta);
        
        // --- MAGICAL SYSTEMS (from swarm) ---
        // Update starfield with speed multiplier
        const speedMultiplier = 1 + Math.abs(playerState.currentSpeedY) / 20;
        starfield.update(delta, speedMultiplier);
        
        // Update orb manager and check collection
        orbManager.update(delta, time);
        const collectionResult = orbManager.checkCollection(player.position, friendsManager.hasFullFlotilla() ? 4.0 : 2.0);
        if (collectionResult.collected && player) {
            dogController.triggerAnimation(DogAnimationState.COLLECT, 0.5);
            juiceManager.burstCollect(player.position.clone());
            juiceManager.showScoreText(collectionResult.points || 10, player.position.clone());
            if (collectionResult.healthRestore) {
                playerState.health = Math.min(playerState.health + collectionResult.healthRestore, playerState.maxHealth);
                hudManager.updateHealth(playerState.health, playerState.maxHealth);
                updateHealthDisplay(playerState);
            }
            // Collecting any orb gives +1 boost charge
            boostSystem.addCharge(1);
        }
        
        // Update power-up manager
        powerUpManager.update(delta);

        // --- RAINBOW COMET TAIL GAMEPLAY EFFECTS ---
        const hasRainbowComet = powerUpManager.hasPowerUp(PowerUpType.RAINBOW_COMET_TAIL);
        const rainbowEffect = powerUpManager.activeEffects.get(PowerUpType.RAINBOW_COMET_TAIL);
        const rainbowTimeRemaining = rainbowEffect ? rainbowEffect.timeRemaining : 0;

        if (hasRainbowComet && player) {
            // Auto-collect nearby orbs within ~45 units
            const orbCollectibles = orbManager.getActiveOrbs();
            for (const orb of orbCollectibles) {
                if (orb.collected) continue;
                const dist = player.position.distanceTo(orb.position);
                if (dist < 45) {
                    // Gently pull orb toward player
                    const pullDir = player.position.clone().sub(orb.position).normalize();
                    orb.position.addScaledVector(pullDir, dist * 0.05);
                    orb.mesh.position.copy(orb.position);
                    if (dist < 2) {
                        // Collect it!
                        orb.collected = true;
                        orb.mesh.visible = false;
                        boostSystem.addCharge(1);
                        audioSystem.playCollect();
                        juiceManager.burstCollect(orb.position.clone());
                        hudManager.addScore(Math.floor(orb.points * 1.15));
                    }
                }
            }

            // Transform small asteroids within ~25 units into floating candy
            const obstacles = obstacleSystem.getObstacles();
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const obs = obstacles[i];
                const radius = obs.userData.radius || 1.0;
                if (radius < 1.2 && player.position.distanceTo(obs.position) < 25) {
                    // Transform to candy: pastel color + heart particles
                    const pastelColors = [0xffb6c1, 0xffc0cb, 0xe6e6fa, 0xb0e0e6, 0x98fb98];
                    const candyColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
                    (obs.material as THREE.MeshStandardMaterial).color.setHex(candyColor);
                    (obs.material as THREE.MeshStandardMaterial).emissive.setHex(candyColor);
                    (obs.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
                    obs.userData.isCandy = true;

                    // Heart particle burst
                    particleSystem.emit(obs.position.clone(), candyColor, 5, 3.0, 0.4, 0.6);
                    particleSystem.emit(obs.position.clone(), 0xffffff, 3, 2.0, 0.3, 0.4);

                    // Small chance to destroy tiny asteroids entirely
                    if (radius < 0.6 && Math.random() < 0.05) {
                        particleSystem.emit(obs.position.clone(), candyColor, 10, 4.0, 0.6, 1.0);
                        obstacleSystem.splitAsteroid(obs);
                        audioSystem.playMagicSound('happy');
                    }
                }
            }

            // Score multiplier (+15%)
            // Applied via hudManager if it supports score multipliers, otherwise accumulate
        }

        // Fade-out handling: when rainbow comet is ending (< 1s left), reduce trail intensity
        if (hasRainbowComet && rainbowTimeRemaining < 1.0 && rainbowTimeRemaining > 0) {
            const fadeRatio = rainbowTimeRemaining; // 1.0 → 0
            if (player) {
                const rocket = player.children[0];
                if (rocket) {
                    rocket.traverse((child: any) => {
                        if (child.isMesh && child.material && child.material.emissiveIntensity !== undefined) {
                            child.material.emissiveIntensity *= fadeRatio;
                        }
                    });
                }
            }
        }

        // SWARM #3: Update magical effects (rainbow trails, butterflies, etc.)
        if (debugSystem.isEnabled('magicalEffects')) {
            effectManager.update(delta);
        }
        
        // Pass magic state to Nebula
        const isMagicActive = effectManager.hasEffect(MagicalEffectType.RAINBOW_TRAIL) ||
                              effectManager.hasEffect(MagicalEffectType.HEART_BUBBLE);
        levelManager.setMagicActive(isMagicActive);

        // SWARM #4: Update victory and tutorial systems
        victorySystem.update(delta);
        tutorialSystem.update(delta);
        
        // Randomly spawn orbs as player progresses
        if (Math.random() < 0.02) {
            const spawnX = player.position.x + 40 + Math.random() * 20;
            const spawnY = (Math.random() - 0.5) * 12;
            orbManager.spawnRandomOrb(spawnX, spawnY);
        }
        
        // Update space friends and spawn new ones
        if (debugSystem.isEnabled('spaceFriends')) {
            friendsManager.update(delta, player.position, weaponSystem.getActiveProjectiles());
            friendsManager.maybeSpawnFriends(
                player.position.x,
                levelManager.config[levelManager.currentLevel]
            );
            friendsManager.cleanupFarFriends(player.position.x);
        }

        // --- Aquatic environments (enabled per level via environments.aquaticLife) ---
        const currentLevelCfg = levelManager.config[levelManager.currentLevel];
        const isAquaEnv = !!currentLevelCfg?.environments?.aquaticLife;
        if (isAquaEnv) {
            if (aquaticLifeSpawnedLevel !== levelManager.currentLevel) {
                aquaticLifeManager.clear();
                aquaticLifeSpawnedLevel = levelManager.currentLevel;
                whaleSongTimer = 30;
                const cfgA = currentLevelCfg;
                aquaticLifeManager.spawnForLevel(player.position.x + 80, cfgA.distance - 200);

                // Bubble-reef rescue friends feeding the final flotilla parade.
                const reefFriends = friendsManager.spawnTrappedFriendsAlong(
                    player.position.x + 150,
                    cfgA.distance - 400,
                    3
                );
                for (const reefFriend of reefFriends) {
                    aquaticLifeManager.spawnBubbleReef(reefFriend.position);
                }

                // Scatter seal pups through the aqua expanse
                for (let s = 0; s < 5; s++) {
                    const sx = player.position.x + 100 + Math.random() * (cfgA.distance - 300);
                    const sy = (Math.random() - 0.5) * 16;
                    friendsManager.spawnSealPup(sx, sy);
                }
            }

            const aquaEvents = aquaticLifeManager.update(delta, player.position);
            for (const ev of aquaEvents) {
                if (ev.type === 'jellyfish') {
                    hudManager.addScore(15);
                    juiceManager.showFloatingText('Jellyfish Drift! +15', ev.position.clone(), '#aaffee', 20);
                    particleSystem.emit(ev.position.clone(), 0x66ffee, 10, 2.0, 1.0, 1.0);
                    audioSystem.playGraze(1);
                } else if (ev.type === 'kelp') {
                    hudManager.addScore(10);
                    juiceManager.showFloatingText('Swimming!', ev.position.clone(), '#88ffaa', 18);
                    particleSystem.emit(ev.position.clone(), 0x44cc88, 8, 3.0, 0.8, 0.8);
                } else if (ev.type === 'plankton') {
                    juiceManager.burstMagic(ev.position.clone());
                    particleSystem.emit(ev.position.clone(), 0x99ffee, 14, 2.5, 1.2, 0.8);
                }
            }
            aquaticLifeManager.cleanupFarBehind(player.position.x);

            // "Whale song" ambience - a slow procedural moan from the deep
            whaleSongTimer -= delta;
            if (whaleSongTimer <= 0) {
                whaleSongTimer = 25 + Math.random() * 15;
                audioSystem.playWhaleSong();
            }
        } else if (aquaticLifeSpawnedLevel !== null) {
            aquaticLifeManager.clear();
            aquaticLifeSpawnedLevel = null;
        }

        // --- Starlight koi schools (biological / aquatic / nebula biomes) ---
        const koiCfg = levelManager.config[levelManager.currentLevel];
        if (shouldSpawnStarlightKoi(koiCfg?.environments, koiCfg?.koiSchoolDensity)) {
            if (koiSpawnedLevel !== levelManager.currentLevel) {
                koiSpawnedLevel = levelManager.currentLevel;
                starlightKoiManager.activate();
                const koiSpan = getLevelSpan(levelManager.currentLevel);
                starlightKoiManager.spawnForLevel(
                    koiSpan.startX + 60,
                    koiSpan.length - 120,
                    koiCfg!.koiSchoolDensity!
                );
            }
            if (debugSystem.isEnabled('starlightKoi')) {
                starlightKoiManager.update(delta, camera.position.x, player.position);
                starlightKoiManager.cleanupFarBehind(player.position.x);
            }
        } else if (koiSpawnedLevel !== null) {
            starlightKoiManager.deactivate();
            koiSpawnedLevel = null;
        }

        // --- Rainbow bubble coral (waterfall / aquatic / biological reefs) ---
        const coralCfg = levelManager.config[levelManager.currentLevel];
        if (shouldSpawnBubbleCoral(coralCfg?.environments, coralCfg?.bubbleCoralDensity)) {
            if (coralSpawnedLevel !== levelManager.currentLevel) {
                coralSpawnedLevel = levelManager.currentLevel;
                bubbleCoralManager.activate();
                const coralSpan = getLevelSpan(levelManager.currentLevel);
                const clusterCount = resolveBubbleCoralClusterCount(
                    coralCfg!.bubbleCoralDensity!,
                    coralCfg!.environments?.bubbleCoral
                );
                bubbleCoralManager.spawnForLevel(
                    coralSpan.startX + 50,
                    coralSpan.length - 100,
                    clusterCount,
                    getBubbleCoralPlacement(coralCfg!.environments, coralCfg!.levelType)
                );
            }
            if (debugSystem.isEnabled('bubbleCoral')) {
                bubbleCoralManager.update(delta, camera.position.x);
                bubbleCoralManager.cleanupFarBehind(player.position.x);
            }
        } else if (coralSpawnedLevel !== null) {
            bubbleCoralManager.deactivate();
            coralSpawnedLevel = null;
        }

        // Update dog cockpit animation
        dogController.update(delta, playerState);
    }

    // "Path to the Moon" gate animates independently of the planet horizon
    planetaryHorizonSystem.updateMoonGate(delta);

    // Once the Moon Gate has opened, gently pull the camera back for a
    // celebratory view before handing off to the victory approach sequence.
    if (moonGateSequenceActive) {
        moonGateSequenceTimer += delta;
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, camera.position.z - 0.5, Math.min(1, delta * 0.5));
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, camera.position.y + 0.3, Math.min(1, delta * 0.5));
        if (moonGateSequenceTimer > 3.0 && player && victorySystem.getState() === VictoryState.NONE) {
            moonGateSequenceActive = false;
            victorySystem.startApproach(moon.position);
        }
    }
    
    // Update HUD system
    hudManager.update(delta);

    // --- NEW: Update Particles (engine trails & explosions)
    if (debugSystem.isEnabled('particles')) {
        particleSystem.update(delta);
    }
    if (debugSystem.isEnabled('debris')) {
        debrisSystem.update(delta);
    }

    // Update Weapon System
    if (player) {
        weaponSystem.update(delta, camera.position.x);
        weaponLightManager.update(weaponSystem.getActiveProjectiles());
        updateCandyMaterialGlobals({ weaponLights: weaponLightManager.storageNode });

        // Projectile Collisions
        const projectiles = weaponSystem.getActiveProjectiles();
        if (projectiles.length > 0) {
            const obstacles = obstacleSystem.getObstacles();
            // Check against obstacles (asteroids)
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const obs = obstacles[i];
                const obsRadius = obs.userData.radius || 1.0;

                for (const proj of projectiles) {
                    if (!proj.active) continue;

                    const dist = proj.mesh.position.distanceTo(obs.position);
                    if (dist < obsRadius + 0.5) { // Projectile radius approx 0.5
                        // Hit!

                        // 1. Visuals
                        if (obs.userData.isCandyAsteroid) {
                            const flavor = obs.userData.candyFlavor as CandyFlavor;
                            const sparkle = CANDY_FLAVOR_COLORS[flavor]?.sparkle ?? 0xffffff;
                            particleSystem.emit(obs.position, sparkle, 14, 5.5, 0.9, 1.2);
                            obstacleSystem.triggerCandySquash(obs as THREE.Mesh, 1.2);
                        } else {
                            particleSystem.emit(obs.position, 0x00ffff, 10, 5.0, 1.0, 2.0); // Cyan splash
                        }

                        // 2. Destroy Asteroid
                        audioSystem.play('explode');

                        // Barnacle pods (L5): cracking one open can reveal a
                        // memory fragment (bonus cores) and/or a tiny whale
                        // lice critter that joins the flotilla.
                        if (obs.userData.type === 'barnacle') {
                            if (obs.userData.hasMemoryFragment) {
                                saveManager.addCores(25);
                                juiceManager.showFloatingText('Memory Fragment! +25', obs.position.clone(), '#aaffee', 24);
                            }
                            if (obs.userData.hasWhaleLice) {
                                const member = new FlotillaMember(scene, 0x88ffaa, friendsManager.flotilla.length);
                                friendsManager.flotilla.push(member);
                                juiceManager.showFloatingText('Whale Lice joined!', obs.position.clone(), '#88ffaa', 22);
                                dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.5);
                            }
                        }

                        // Try spawn pickup
                        pickupManager.trySpawn(obs.position.clone());

                        obstacleSystem.splitAsteroid(obs as THREE.Mesh);

                        // 3. Destroy Projectile
                        proj.deactivate();
                        break;
                    }
                }
            }

            // --- CHECK BACKGROUND ASTEROIDS ---
            for (const proj of projectiles) {
                if (!proj.active) continue;
                // We pass the global camera position to calculate perspective projection
                const shotDir = new THREE.Vector3(1, 0, 0);
                if ((proj as any).velocity) {
                    shotDir.copy((proj as any).velocity).normalize();
                }
                const hit = asteroidFieldSystem.hitAsteroid(proj.mesh.position, particleSystem, camera.position, shotDir);
                if (hit) {
                    audioSystem.play('explode');
                    // We DO NOT deactivate the projectile here so it doesn't get blocked by background visual elements
                }
            }

            // Check projectiles against Nebula Kraken (boss squids)
            const squids = obstacleSystem.getSquids();
            for (const squid of squids) {
                if (squid.isDestroyed) continue;

                // Cataloging: get close to a living Kraken without destroying it
                if (player && squid.getPosition().distanceTo(player.position) < squid.getRadius() + 6) {
                    creatureCatalogManager.catalog('kraken');
                }

                for (const proj of projectiles) {
                    if (!proj.active) continue;
                    const dist = proj.mesh.position.distanceTo(squid.getPosition());
                    if (dist < squid.getRadius() + 0.5) {
                        // Hit the boss!
                        particleSystem.emit(proj.mesh.position.clone(), 0x9900ff, 15, 6.0, 1.0, 1.5);
                        squid.takeDamage(30);
                        proj.deactivate();

                        // Kraken memory: bonus cores the first time this Kraken is defeated
                        if (squid.isDestroyed && saveManager.hasMemory('kraken') && !krakenMemoryRewarded.has(squid)) {
                            krakenMemoryRewarded.add(squid);
                            saveManager.addCores(20);
                            if (player) {
                                juiceManager.showFloatingText('Kraken Memory +20', squid.getPosition().clone(), '#cc88ff', 22);
                            }
                        }

                        // Aquatic capstone: an ink + bubble burst marks the
                        // wounded Kraken's defeat - the L6 "boss" objective.
                        if (squid.isDestroyed) {
                            particleSystem.emit(squid.getPosition().clone(), 0xeeffff, 25, 5.0, 1.2, 1.4);
                            particleSystem.emit(squid.getPosition().clone(), 0x440088, 20, 4.0, 1.4, 1.6);
                            waterfallSystem.triggerSplash(squid.getPosition().clone(), 35);
                            audioSystem.playWhaleSong();

                            const objective6 = levelManager.config[levelManager.currentLevel]?.objective;
                            if (levelManager.currentLevel === 6 && objective6?.type === 'boss' && !level6BossDefeated) {
                                level6BossDefeated = true;
                                saveManager.addCores(50);
                                hudManager.updateObjectiveProgress(objective6.target, objective6.target);
                                hudManager.onObjectiveComplete?.();

                                if (player) {
                                    juiceManager.showFloatingText('The Path to the Moon Opens!', player.position.clone(), '#aaffff', 30);
                                    juiceManager.burstMagic(player.position.clone());
                                }
                                dogController.triggerAnimation(DogAnimationState.VICTORY, 2.0);

                                // Open the Moon Gate ahead and begin the celebratory pull-back
                                planetaryHorizonSystem.activateMoonGate(
                                    new THREE.Vector3(squid.getPosition().x + 120, 0, -30)
                                );
                                friendsManager.triggerVictoryFlyby(4.0);
                                moonGateSequenceActive = true;
                                moonGateSequenceTimer = 0;
                            }
                        }
                        break;
                    }
                }
            }

            // Update boss health bar UI
            updateBossHealthBar(squids);

            // Tarsiers panic when a projectile passes near a gravity anchor
            if (debugSystem.isEnabled('spaceFriends') && gravityAnchors.length > 0) {
                for (const proj of projectiles) {
                    if (!proj.active) continue;
                    for (const anchor of gravityAnchors) {
                        if (proj.mesh.position.distanceTo(anchor.position) < 22) {
                            friendsManager.panicTarsiersNear(anchor.position);
                            // Dog notices the commotion
                            if (dogController.getCurrentState() === DogAnimationState.IDLE) {
                                dogController.triggerAnimation(DogAnimationState.CURIOUS, 1.2);
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    // Update Re-Entry System
    if (player && debugSystem.isEnabled('reEntry')) {
        reEntrySystem.update(delta, camera.position.x, camera.position.y, player);
    }

    // BLACK HOLE SYSTEM (Level 2 environmental hazard)
    if (player && blackHoleSystem.active) {
        // Update is now handled inside levelManager.update

        // Gentle player gravity pull (very light bias on desired velocity)
        const yPull = blackHoleSystem.getPlayerPullForce(player.position);
        if (yPull !== 0 && (playerState as any).desiredVelocityY !== undefined) {
            (playerState as any).desiredVelocityY += yPull;
        } else if (yPull !== 0 && !(playerState as any).inSafeHarbor && !(playerState as any).invincible) {
            // Apply yPull directly to targetY to gently drift the player if not using custom movement system
            playerState.targetY += yPull;
        }

        // Projectile accretion-disk feedback (capped internally)
        const projectiles = weaponSystem.getActiveProjectiles();
        if (projectiles.length > 0) {
            blackHoleSystem.handleProjectileInteractions(projectiles, particleSystem, () => {
                if (juiceManager) juiceManager.shakeScreen(ShakeType.LIGHT, 0.6); // 0.5 is ShakeType.LIGHT
            });
        }
    }

    // Update Level Manager (and Clouds)
    if (player) {
        const isFiringProxy = weaponSystem.getActiveProjectiles().length > 0;
        levelManager.update(delta, camera.position.x, playerState.autoScrollSpeed, isFiringProxy, new THREE.Vector3(1, 0, 0));
        const geoScannables = [
            ...sporeClouds.map(cloud => cloud.spores),
            ...vacuumKelps,
            ...voidRootBalls,
            ...magmaHearts,
            ...iceNeedleClusters,
            ...gravityAnchors,
            ...liquidMetalBlobs,
        ];
        discoveryManager.update(player.position, [
            ...levelManager.levelObjects,
            ...geoScannables,
            ...friendsManager.getScannables(),
            ...creatureManager.getScannables(),
            ...slingableObjectSystem.getScannables()
        ]);
        if (debugSystem.isEnabled('butterflySwarm')) {
            const nowSec = performance.now() * 0.001;
            butterflySwarmSystem.update(delta, camera.position.x, player.position, {
                grazeCombo: obstacleSystem.getGrazeCombo(),
                slingCombo: slingComboManager.getCombo(),
                cleanFlightTime: nowSec - lastPlayerDamageTime
            });
        }
        videoTumblingStars.forEach(star => star.update(delta, camera));
    }

    // Phase 1 FPS Fixes - Quick Wins: shadow & object cleanup
    updateShadowQuality();
    try {
        updateShadowCulling();
    } catch (error) {
        if (!shadowCullingWarningIssued) {
            shadowCullingWarningIssued = true;
            console.warn('Shadow culling skipped because a tracked object was malformed.', error);
        }
    }
    cleanupGeologicalObjects(camera.position.x);

    // Keep directional light following player so shadows work throughout the level
    if (player) {
        mainLight.position.x = player.position.x - 5;
        mainLight.target.position.set(player.position.x, 0, 0);
        mainLight.target.updateMatrixWorld();
    }

    updateCamera(delta);
    
    // Update juice camera base position
    juiceManager.updateCameraBasePosition(camera.position);
    
    // --- NEW: Update Geological Objects ---
    if (debugSystem.isEnabled('geologicalObjects')) {
        geologicalUpdateFrame++;
        const farUpdateFrame = geologicalUpdateFrame % 3 === 0;
        // Update spore clouds (brownian motion)
        sporeClouds.forEach(cloud => {
            const isFar = camera.position.distanceTo(cloud.position) > 80;
            if (!isFar || farUpdateFrame) {
                cloud.update(delta);
            }
        });



        // Update geodes and check for projectile hits & safe harbor
        playerState.inSafeHarbor = false;

        geodes.forEach(geode => {
            updateGeode(geode, delta, time);

            // Check safe harbor distance
            if (player && !geode.userData.isDischarged && geode.userData.fieldRadius) {
                const distToPlayer = player.position.distanceTo(geode.position);
                if (distToPlayer < geode.userData.fieldRadius) {
                    playerState.inSafeHarbor = true;
                }
            }

            // Check projectile hits
            if (!geode.userData.isDischarged) {
                const projectiles = weaponSystem.getActiveProjectiles();
                for (const proj of projectiles) {
                    if (!proj.active) continue;

                    const distToProj = proj.mesh.position.distanceTo(geode.position);
                    // Hit the core
                    if (distToProj < (geode.userData.fieldRadius * 0.4)) {
                        // Deactivate projectile
                        proj.deactivate();

                        // Spawn sparks
                        particleSystem.emit(proj.mesh.position.clone(), 0x8844ff, 10, 3.0, 0.5, 0.8);

                        // Apply damage
                        const justDepleted = damageGeode(geode, 20); // 5 hits to deplete
                        if (justDepleted) {
                            audioSystem.playCollect(); // Or a breaking sound
                            // Release gems (Void Gems) based on quality
                            const gemCount = Math.floor(3 + Math.random() * 3 * geode.userData.quality);
                            for (let i = 0; i < gemCount; i++) {
                                // Add small offset
                                const offset = new THREE.Vector3(
                                    (Math.random() - 0.5) * 2,
                                    (Math.random() - 0.5) * 2,
                                    (Math.random() - 0.5) * 2
                                );
                                const orbPos = geode.position.clone().add(offset);
                                // Spawn a valuable floating orb
                                orbManager.spawnRandomOrb(orbPos.x, orbPos.y, orbPos.z);
                            }
                        }
                        break; // Only hit once per frame per projectile
                    }
                }
            }
        });

        // Update nebula jelly-moss (pulsing and drifting)
        // Use reverse loop so we can remove items safely
        for (let i = jellyMosses.length - 1; i >= 0; i--) {
            const jellyMoss = jellyMosses[i];
            const isFar = camera.position.distanceTo(jellyMoss.position) > 80;
            if (!isFar || farUpdateFrame) {
                updateNebulaJellyMoss(jellyMoss, delta, time);
            }

            // --- NEW: Jelly Moss Interaction (Stealth, Shield & Overload) ---
            if (player && jellyMoss.visible && jellyMoss.userData.radius) {
                const dist = player.position.distanceTo(jellyMoss.position);
                const radius = jellyMoss.userData.radius;

                // Player inside membrane?
                if (dist < radius) {
                    // 1. Viscosity
                    playerState.velocity.multiplyScalar(Math.pow(0.05, delta));

                    // 2. Stealth Effect
                    if (!jellyMoss.userData.isHiding) {
                        jellyMoss.userData.isHiding = true;
                        const rocket = player.children[0];
                        if (rocket) {
                             rocket.traverse((child: any) => {
                                 if (child.isMesh && child.material) {
                                     if (child.userData.originalOpacity === undefined) {
                                         child.userData.originalOpacity = child.material.opacity;
                                         child.userData.originalTransparent = child.material.transparent;
                                     }
                                     child.material.transparent = true;
                                     child.material.opacity = 0.4;
                                 }
                             });
                        }
                    }

                    // 3. Shield Leech & Overload
                    const normDist = dist / radius;
                    const leechIntensity = THREE.MathUtils.lerp(1.0, 0.0, normDist);

                    // Build Overload! (Destruction Mechanic)
                    // Rate: 0.5 per second (takes ~2 seconds to explode)
                    jellyMoss.userData.overloadValue = (jellyMoss.userData.overloadValue || 0) + delta * 0.5;

                    // Update Shader Uniform
                    const mat = jellyMoss.material as any;
                    if (mat.userData && mat.userData.uOverload) {
                        mat.userData.uOverload.value = Math.min(1.0, jellyMoss.userData.overloadValue);
                    }

                    // Check for Explosion
                    if (jellyMoss.userData.overloadValue >= 1.0) {
                        // BOOM
                        destroyNebulaJellyMoss(jellyMoss, scene, particleSystem);

                        // Remove from list
                        jellyMosses.splice(i, 1);

                        // Restore player state immediately (exit stealth)
                        const rocket = player.children[0];
                        if (rocket) {
                             rocket.traverse((child: any) => {
                                 if (child.isMesh && child.material) {
                                     if (child.userData.originalOpacity !== undefined) {
                                         child.material.opacity = child.userData.originalOpacity;
                                         child.material.transparent = child.userData.originalTransparent;
                                     } else {
                                         child.material.opacity = 1.0;
                                         child.material.transparent = false;
                                     }
                                 }
                             });
                        }
                        continue; // Skip next logic
                    }

                    // Visual damage effect (red tint pulse)
                    if (Math.random() < 0.05 * leechIntensity) {
                        const rocket = player.children[0];
                        if (rocket) {
                            rocket.traverse((child: any) => {
                                if (child.isMesh && child.material) {
                                    const childMat = child.material as any;
                                    if (childMat.emissive) {
                                        const oldEmissive = childMat.emissive.getHex();
                                        childMat.emissive.setHex(0xff0000);
                                        setTimeout(() => {
                                            if(childMat) childMat.emissive.setHex(oldEmissive);
                                        }, 100);
                                    }
                                }
                            });
                        }
                    }

                } else {
                    // Exit Stealth / Decay Overload
                    if (jellyMoss.userData.isHiding) {
                        jellyMoss.userData.isHiding = false;
                        const rocket = player.children[0];
                        if (rocket) {
                             rocket.traverse((child: any) => {
                                 if (child.isMesh && child.material) {
                                     if (child.userData.originalOpacity !== undefined) {
                                         child.material.opacity = child.userData.originalOpacity;
                                         child.material.transparent = child.userData.originalTransparent;
                                     } else {
                                         child.material.opacity = 1.0;
                                         child.material.transparent = false;
                                     }
                                 }
                             });
                        }
                    }

                    // Decay overload if player leaves
                    if (jellyMoss.userData.overloadValue > 0) {
                        jellyMoss.userData.overloadValue = Math.max(0, jellyMoss.userData.overloadValue - delta * 0.5);
                        const mat = jellyMoss.material as any;
                        if (mat.userData && mat.userData.uOverload) {
                            mat.userData.uOverload.value = jellyMoss.userData.overloadValue;
                        }
                    }
                }
            }
        }

        // Update solar sails (iridescent rippling, unfold near player)
        if (player) {
            solarSails.forEach(solarSail => updateSolarSail(solarSail, delta, time, player.position));

            // Update new geological objects from plan.md
            voidRootBalls.forEach(rootBall => {
                const interaction = updateVoidRootBall(rootBall, delta, time, player);
                if (interaction.isLatched) {
                    playerState.velocity.add(interaction.force);
                    // Visual feedback
                    if (interaction.hitPoint && Math.random() < 0.2) {
                        particleSystem.emit(interaction.hitPoint, 0x8800ff, 2, 2.0, 0.5);
                    }
                }
            });
        }
        vacuumKelps.forEach(kelp => updateVacuumKelp(kelp, delta, time));
        iceNeedleClusters.forEach(cluster => updateIceNeedleCluster(cluster, delta, time));

        // Update Liquid Metal System (Physics & Collisions)
        liquidMetalSystem.update(delta);
        if (player && weaponSystem) {
            liquidMetalSystem.checkCollisions(weaponSystem.getActiveProjectiles());
        }

        magmaHearts.forEach(heart => updateMagmaHeart(heart, delta, time));

        // Update Gravity Anchors — apply inverse-square field forces to player Y velocity
        let nearestGravDist = Infinity;
        let nearestGravAngularSpeed = 0;
        let anyInfluencing = false;

        if (player) gravityAnchors.forEach(anchor => {
            if (!anchor) return;
            const interaction = updateGravityAnchor(anchor, delta, time, player.position);
            if (interaction.isInfluencing) {
                anyInfluencing = true;

                // Track the closest anchor for audio hum
                if (interaction.distance < nearestGravDist) {
                    nearestGravDist = interaction.distance;
                    nearestGravAngularSpeed = interaction.angularSpeed;
                }

                // Apply Y component of radial force to vertical speed
                playerState.currentSpeedY += interaction.force.y;
                // Clamp to keep the flight model intact
                playerState.currentSpeedY = THREE.MathUtils.clamp(
                    playerState.currentSpeedY,
                    -CONFIG.player.maxDescentSpeed,
                    CONFIG.player.maxSpeedY
                );
                // Sling exit bonus: give a burst of upward velocity on clean tangent arcs
                if (interaction.slungExit) {
                    playerState.currentSpeedY = Math.max(
                        playerState.currentSpeedY + GA_SLING_BONUS,
                        CONFIG.player.maxSpeedY
                    );
                    particleSystem.emit(player.position.clone(), 0x44aaff, 12, 3.0, 0.6);

                    // Record a perfect gravity-arc sling in the combo chain
                    const gaSlipstreamBonus = slingableObjectSystem.isInSlipstream(player.position) ? 2 : 1;
                    slingComboManager.recordSlingAction('perfect', player.position.clone(), gaSlipstreamBonus);
                    slingObjectiveManager.recordSling('perfect');
                    reportComboObjectiveProgress();
                    friendsManager.cheerFlotilla(player.position.clone());

                    // Sling release doppler whoosh
                    audioSystem.playGravitySlingRelease('perfect', slingComboManager.getCombo());

                    // Tarsiers near this anchor cheer the clean sling-arc!
                    if (debugSystem.isEnabled('spaceFriends')) {
                        friendsManager.cheerTarsiersNearAnchor(anchor.position);
                        dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.8);
                    }
                }
                // Inflow particles — emit from random field-edge position toward core
                if (Math.random() < 0.08) {
                    const inflowColor: number = (anchor.userData.inflowColor as number) ?? 0x4466ff;
                    const fieldR = (anchor.userData.fieldRadius as number) ?? 40;
                    // Random point on the field sphere surface
                    const theta = Math.random() * Math.PI * 2;
                    const phi   = Math.acos(2 * Math.random() - 1);
                    const spawnPos = new THREE.Vector3(
                        anchor.position.x + fieldR * 0.7 * Math.sin(phi) * Math.cos(theta),
                        anchor.position.y + fieldR * 0.7 * Math.sin(phi) * Math.sin(theta),
                        anchor.position.z + fieldR * 0.3 * Math.cos(phi)
                    );
                    // Velocity directed inward (toward anchor)
                    const inwardDir = new THREE.Vector3()
                        .subVectors(anchor.position, spawnPos)
                        .normalize()
                        .multiplyScalar(2.5 + Math.random() * 1.5);
                    particleSystem.emit(spawnPos, inflowColor, 1, inwardDir.length(), 0.35);
                }

                // Dog becomes curious when first entering a gravity anchor's field
                if (!anchor.userData.dogCuriousTriggered) {
                    anchor.userData.dogCuriousTriggered = true;
                    if (dogController.getCurrentState() === DogAnimationState.IDLE ||
                        dogController.getCurrentState() === DogAnimationState.THRUST) {
                        dogController.triggerAnimation(DogAnimationState.CURIOUS, 1.5);
                    }
                }
            } else {
                // Reset curious flag when player exits the field
                anchor.userData.dogCuriousTriggered = false;
            }
        });

        // Gravity hum audio — start/update/stop based on field presence
        if (anyInfluencing) {
            audioSystem.startGravityHum();
            audioSystem.updateGravityHum(nearestGravDist, nearestGravAngularSpeed);
        } else {
            audioSystem.stopGravityHum();
        }
    }

    // Update industrial obstacles (Level 4)
    if (debugSystem.isEnabled('industrialGeo')) {
        industrialGeometryManager.update(time);
    }

    // SWARM #3: Update Dreamy Environments
    if (player) {
        // Update flower constellations (bloom, pollen, sparkles)
        if (debugSystem.isEnabled('flowerConstellations')) {
            flowerManager.update(delta, player.position);
            flowerManager.checkPlayerProximity(player.position);
        }

        // Twirling pinwheel flowers — spin, wind gusts, blade clips
        if (debugSystem.isEnabled('pinwheelFlora')) {
            const pinwheelHits = pinwheelManager.update(delta, time, player.position);
            for (const hit of pinwheelHits) {
                playerState.velocity.add(hit.force);
                if (hit.type === 'hub_collect' && hit.scoreBonus) {
                    hudManager.addScore(hit.scoreBonus);
                    juiceManager.showFloatingText(`+${hit.scoreBonus}`, hit.position.clone(), '#ff69b4', 20);
                    audioSystem.play('twinkle', 0.65);
                } else if (hit.type === 'blade_clip') {
                    juiceManager.showFloatingText('Whoosh!', hit.position.clone(), '#ffd9ec', 16);
                    audioSystem.play('sparkle', 0.35);
                }
            }
            pinwheelManager.cleanupFarBehind(player.position.x);
        }

        // Solar sail ferns — tilt, boost zones, soft clips
        if (debugSystem.isEnabled('solarSailFerns')) {
            const sailHits = solarSailFernManager.update(
                delta,
                time,
                player.position,
                playerState.velocity
            );
            for (const hit of sailHits) {
                playerState.velocity.add(hit.force);
                if (hit.type === 'boost') {
                    juiceManager.showFloatingText('Solar wind!', hit.position.clone(), '#88eeff', 16);
                    audioSystem.play('sparkle', 0.4);
                } else if (hit.type === 'clip') {
                    juiceManager.showFloatingText('Rustle', hit.position.clone(), '#ffddaa', 14);
                    audioSystem.play('sparkle', 0.2);
                }
            }
            solarSailFernManager.cleanupFarBehind(player.position.x);
        }

        // Crystal chime clusters — proximity rings, sparkles, micro stars
        if (debugSystem.isEnabled('crystalChimes')) {
            const chimeHits = crystalChimeManager.update(
                delta,
                time,
                player.position,
                playerState.velocity
            );
            for (const hit of chimeHits) {
                if (hit.type === 'soft_push' && hit.force) {
                    playerState.velocity.add(hit.force);
                } else if (hit.type === 'star_bonus' && hit.scoreBonus) {
                    hudManager.addScore(hit.scoreBonus);
                    juiceManager.showFloatingText(`+${hit.scoreBonus}`, hit.position.clone(), '#aaddff', 18);
                    audioSystem.play('twinkle', 0.5);
                }
            }
            crystalChimeManager.cleanupFarBehind(player.position.x);
        }

        // Crystal wind-chime mobiles — slow spin, tinkle + sparkles when flown near
        if (debugSystem.isEnabled('windChimes')) {
            windChimeManager.update(delta, time, player.position, playerState.velocity);
            windChimeManager.cleanupFarBehind(player.position.x);
        }
        
        // Update candy belt (wobble, dissolve, shatter)
        if (debugSystem.isEnabled('candyBelt')) {
            candyManager.update(delta);
            
            // Check candy collisions (bouncy gummies!)
            const candyCollisions = candyManager.checkCollisions(player.position, 2.0);
            candyCollisions.forEach(collision => {
                if (collision.type === 'bouncy') {
                    // Bouncy gummies make the dog giggle!
                    dogController.triggerAnimation(DogAnimationState.POWER_UP, 0.5);
                    juiceManager.showFloatingText("Boing!", collision.candy.position, '#ff69b4');
                    audioSystem.playMagicSound('happy');
                } else if (collision.type === 'collectible') {
                    // Cotton candy dissolves into sugar sparkles
                    juiceManager.spawnSparkles(player.position, new THREE.Color(0xffb6c1), 10);
                    audioSystem.playMagicSound('collect');
                }
            });
        }
        
        // Update cloud castles (parallax scrolling)
        if (debugSystem.isEnabled('cloudCastles')) {
            castleManager.update(delta, player.position.x);
        }
    }

    // Rotate galaxies slowly
    if (debugSystem.isEnabled('moonEffects')) {
        if (galaxy1) galaxy1.rotation.z += galaxy1.userData.rotationSpeed;
        if (galaxy2) galaxy2.rotation.z += galaxy2.userData.rotationSpeed;
        if (galaxy3) galaxy3.rotation.z += galaxy3.userData.rotationSpeed;
        
        // Rotate and pulse moon atmosphere
        if (moon && moon.userData.atmosphere) {
            moon.rotation.y += 0.002;
            const pulse = Math.sin(Date.now() * 0.001) * 0.5 + 0.5;
            (moon.userData.atmosphere.material as THREE.MeshBasicMaterial).opacity = 0.1 + pulse * 0.1;
        }

        // --- NEW: Animate Alien Moon Plants ---
        // We pass 'false' for isDay because it's space (always night!) and null for audio
        moonPlants.forEach(plant => {
            animateFoliage(plant, time, null, false);
        });
    }

    // --- NEW: Pilot/Player Animations ---
    if (debugSystem.isEnabled('pilotAnim')) {
        try {
            const rocketRoot = player.children[0];
            if (rocketRoot) {
                // Pitch and roll are now driven by updatePlayer's upgraded flight model.

                // Animate pilot bob and ears
                const pilot = rocketRoot.getObjectByName('pilotGroup');
                if (pilot) {
                    const offset = pilot.userData.animationOffset || 0;
                    const baseY = pilot.userData.baseY ?? pilot.position.y;
                    const bobAmp = keys.jump ? 0.05 : 0.02;
                    const bob = Math.sin(time * 2 + offset) * bobAmp;
                    pilot.position.y = baseY + bob;

                    const head = pilot.getObjectByName('pilotHead');
                    const leftEar = pilot.getObjectByName('leftEar');
                    const rightEar = pilot.getObjectByName('rightEar');
                    if (head) {
                        head.rotation.y = head.userData.baseRotationY + Math.sin(time * 1.5 + offset) * 0.08;
                    }
                    if (leftEar && rightEar) {
                        leftEar.rotation.z = leftEar.userData.baseRotationZ + Math.sin(time * 6 + offset) * 0.3 * (keys.jump ? 1.5 : 1.0);
                        rightEar.rotation.z = rightEar.userData.baseRotationZ + Math.sin(time * 6 + offset + Math.PI) * 0.3 * (keys.jump ? 1.5 : 1.0);
                    }
                }
            }
        } catch (e) { /* swallow animation errors gracefully */ }
    }
    
    // Update distance display
    updateDistanceDisplay(playerState, player);
    
    // Update UI elements
    updateHeatBar();
    updateCoresDisplay();
    updateBoostDisplay();
    updateRollDisplay();
    updateTetherDisplay();
    
    // Check if player reached the moon (or defeated boss in level 1)
    if (player && player.position.x >= playerState.distanceToMoon - 10 && !playerState.hasWon && !playerState.bossActive) {
        // If we got here without beating the boss, spawn it now
        if (playerState.level === 1 && bossManager.getBoss() === null) {
            // Trigger boss
        } else {
            playerState.hasWon = true;
            saveManager.updateHighScore(Math.floor(player.position.x));
            saveManager.addCores(playerState.cores);
            
            // SWARM #4: Trigger victory celebration sequence
            if (victorySystem.getState() === VictoryState.NONE) {
                victorySystem.startApproach(moon.position);
            }
            
            // Legacy victory handling (combined with new system)
            audioSystem.play('boss_defeat');
            dogController.triggerAnimation(DogAnimationState.VICTORY, 5.0);
            hudManager.checkAndSaveHighScore();
        }
    }

    renderGameFrame();
}

renderer.setAnimationLoop(animate);

// =============================================================================
// RESIZE HANDLER
// =============================================================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log('🚀 Space Dash - Journey to the Moon!');
console.log('Controls: SPACE to thrust up, A to dive down');
console.log('Objective: Reach the moon while surviving asteroid impacts (3 lives)');
// I would put the full updated main.ts here if I had it
