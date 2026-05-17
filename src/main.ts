import * as THREE from 'three';
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js';
import { WebGPURenderer } from 'three/webgpu';
import { GhostDebrisSystem } from './ghost_debris';
import { godRaySystem } from './game_systems';
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
    createChromaShiftRock,
    updateChromaRock,
    createFracturedGeode,
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
    LiquidMetalSystem
} from './geological';
import { ReEntrySystem } from './reentry';
import { WaterfallSystem } from './waterfall';
import { AsteroidFieldSystem } from './asteroid_field';
import { PlanetaryHorizonSystem } from './planetary_horizon';
import { IndustrialBackgroundSystem } from './industrial_background';
import { NebulaSystem } from './nebula';
import { CosmicDustSystem } from './cosmic_dust';
import { BiologicalBackgroundSystem } from './biological_background';
import { AtmosphereSystem } from './sky';
import { WeaponSystem } from './weapons';
import { WeaponLightManager } from './lighting';
import { generateEnvironment } from './environment';
import { IndustrialGeometryManager } from './industrial_geometry';
import { LEVEL_CONFIG, type LevelConfig } from './level_config';
import { ObstacleSystem } from './obstacle_system';
import { createUI, gameOver, gameWin, keys, setupKeyboardControls, updateDistanceDisplay, updateHealthDisplay } from './ui_controls';
import { checkPlatformCollision } from './physics_utils';
import { BossManager, StarEaterBoss } from './boss_system';
import { getAudioSystem, initAudioOnInteraction } from './audio_system';
import { UpgradeSystem, PickupManager, HeatSystem, UPGRADE_CONFIGS } from './upgrade_system';
import { getSaveManager, createShopUI } from './save_manager';
import { StarfieldSystem } from './stars';
import { OrbManager, OrbType } from './collectibles';
import { PowerUpManager, PowerUpType } from './powerup_manager';
import { FriendsManager } from './space_friends';
import { DogCockpitController, DogAnimationState, DogAccessory } from './dog_cockpit';
import { HUDManager } from './hud_system';
import { JuiceManager, ShakeType, BurstType } from './juice_effects';
import { ConstellationManager, FlowerType } from './flower_constellations';
import { CandyBeltManager, CandyType } from './candy_obstacles';
import { CastleBackgroundManager } from './cloud_castles';
import { EffectManager, MagicalEffectType } from './magical_effects';
import { 
    TouchControlsManager, 
    ControlMode, 
    TouchInput,
    detectTouchDevice,
    getRecommendedControlMode
} from './touch_controls';
import { 
    createTouchSettingsButton,
    showTouchSettings,
    loadTouchSettings
} from './touch_settings';
import { VictorySystem, VictoryState } from './victory_system';
import { TutorialSystem, TutorialStep, shouldShowTutorial } from './tutorial_system';
import type { NebulaKraken } from './space_robot_squid';
import { BOSS_DISPLAY_NAME } from './space_robot_squid';
import { BoostSystem } from './boost_system';
import { RollSystem } from './roll_system';
import { ButterflySwarmSystem } from './butterfly_swarm';
import { LevelManager } from './level_manager';
import { DebugSystem } from './debug_system';
import { createGalaxy, createMoon, moonPlants } from './visuals';
import { disposeObject } from './utils';
import { VideoTumblingStar } from './video_tumbling_star';

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

// --- Scene Setup ---
const canvas = document.querySelector('#glCanvas') as HTMLCanvasElement;
const scene = new THREE.Scene();
const butterflySwarmSystem = new ButterflySwarmSystem(scene);
scene.background = new THREE.Color(CONFIG.colors.background);
scene.fog = new THREE.Fog(CONFIG.colors.background, 20, 80);

let renderer: WebGPURenderer;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
const rimLight = new THREE.DirectionalLight(0x6699ff, 0.4);
const accentLight1 = new THREE.PointLight(0xff8844, 0.6, 50);
const accentLight2 = new THREE.PointLight(0x44ff88, 0.5, 50);
const ambientLight = new THREE.AmbientLight(0x404060, 0.5);

// --- Touch Controls ---
let touchControls: TouchControlsManager | null = null;
let touchSettingsBtn: HTMLElement | null = null;

// Check WebGPU & Initialize
try {
    if (!WebGPU.isAvailable()) {
        const warning = WebGPU.getErrorMessage();
        // Extract message from warning element if possible, or use default text
        const msg = warning.textContent || 'WebGPU is not supported by your browser/device.';
        showError('WebGPU Not Supported', msg);
        throw new Error('WebGPU not supported');
    }

    if (!window.isSecureContext) {
         showError('Insecure Context', 'WebGPU requires a secure context (HTTPS or localhost). Please check your connection.');
         throw new Error('Insecure Context');
    }

    // --- Camera (Side-view, follows player on X axis) ---
    // Camera positioned to the side, looking at Z=0 plane
    camera.position.set(0, CONFIG.cameraHeight, CONFIG.cameraDistance);
    camera.lookAt(0, CONFIG.cameraHeight, 0);

    // --- Renderer ---
    // PERFORMANCE: Start at 60% resolution for smooth playability on mid-range hardware.
    // Press R in-game to cycle through higher resolutions and test performance.
    const basePixelRatio = 0.60;
    renderer = new WebGPURenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio * basePixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3; // Slightly higher for more vibrant colors
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- Touch Controls Initialization ---
    touchControls = new TouchControlsManager();
    touchControls.initialize(canvas);
    
    // Load saved settings and apply
    const savedSettings = loadTouchSettings();
    touchControls.setMode(savedSettings.mode);
    
    // Add settings button (only on touch devices)
    if (detectTouchDevice()) {
        touchSettingsBtn = createTouchSettingsButton(touchControls);
        document.body.appendChild(touchSettingsBtn);
    }

    // --- Lighting (Moody, atmospheric) ---
    scene.add(ambientLight);

    // Environment Map (for metallic reflections)
    const envMap = generateEnvironment();
    scene.environment = envMap;

    // Main directional light (from the side for dramatic shadows)
    mainLight.position.set(-5, 10, 10);
    mainLight.castShadow = true;
    // Phase 1 FPS Fixes - Quick Wins: default shadow map to 1024, scaled up during boss fights
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -30;
    mainLight.shadow.camera.right = 30;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -10;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);
    scene.add(mainLight.target);

    // Rim light from behind (cinematic depth) - enhanced
    rimLight.position.set(5, 5, -10);
    scene.add(rimLight);

    // Add accent lights for more depth
    accentLight1.position.set(0, 5, 5);
    scene.add(accentLight1);

    accentLight2.position.set(0, 3, -5);
    scene.add(accentLight2);

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
let wasmExports: any = null;
let wasmMemory: Float32Array | null = null;

async function loadWasm() {
    try {
        // Fetch the compiled WASM binary
        const response = await fetch('./build/optimized.wasm');
        const buffer = await response.arrayBuffer();
        const module = await WebAssembly.instantiate(buffer, {
            env: {
                abort: () => console.log('Abort called from WASM')
            }
        });
        
        wasmExports = module.instance.exports;
        wasmMemory = new Float32Array((wasmExports.memory as WebAssembly.Memory).buffer);
        console.log("✅ WASM Module Loaded");
    } catch (err) {
        console.error("❌ Failed to load WASM:", err);
    }
}

// Start loading immediately
loadWasm();

// =============================================================================
// PLAYER (Rocket Character) - GLB Model Integration
// =============================================================================
let player: THREE.Group | null = null;
const gltfLoader = new GLTFLoader();
// Load the rocket GLB model
gltfLoader.load(
    'rocket.glb',
    (gltf) => {
        const rocketModel = gltf.scene;
        
        // Enable shadows for all meshes in the model
        rocketModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                // Don't set receiveShadow to avoid self-shadowing artifacts
            }
        });
        
        // Create a container group for the model
        const group = new THREE.Group();
        group.add(rocketModel);
        
        // Scale the model to match the previous rocket size (~2 units tall)
        const box = new THREE.Box3().setFromObject(rocketModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        const targetSize = 2.0;
        const scale = targetSize / maxDimension;
        rocketModel.scale.setScalar(scale);
        
        // Center the model
        box.setFromObject(rocketModel);
        const center = box.getCenter(new THREE.Vector3());
        rocketModel.position.sub(center);
        
        // ROTATE HORIZONTAL: Nose points RIGHT (+X direction)
        group.rotation.z = -Math.PI / 2;
        
        // Add a flame effect to the thruster (procedural, like before)
        const glowMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff4400,
            emissiveIntensity: 1.0
        });
        const flameGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
        const flame = new THREE.Mesh(flameGeo, glowMat);
        flame.position.y = -0.5;
        flame.rotation.x = Math.PI;
        group.add(flame);
        group.userData.flame = flame;
        
        // Container for pitch animation
        const tiltGroup = new THREE.Group();
        tiltGroup.add(group);
        tiltGroup.position.set(0, 5, 0); // Start higher in space
        
        // Set as the player
        player = tiltGroup;
        scene.add(player);
        
        // Connect player to effect manager (for magical effects)
        effectManager.setTarget(player);
        
        // Initialize dog cockpit animation system
        dogController.initialize(rocketModel);
        
        console.log('🚀 Rocket GLB model loaded successfully!');
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('Error loading rocket GLB model:', error);
        // Fallback: create a simple placeholder if model fails to load
        const group = new THREE.Group();
        
        const geometry = new THREE.ConeGeometry(0.5, 2, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xe94560 });
        const placeholder = new THREE.Mesh(geometry, material);
        placeholder.rotation.x = Math.PI;
        placeholder.castShadow = true;
        group.add(placeholder);
        
        // Add flame effect (same as GLB version)
        const glowMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff4400,
            emissiveIntensity: 1.0
        });
        const flameGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
        const flame = new THREE.Mesh(flameGeo, glowMat);
        flame.position.y = -0.5;
        flame.rotation.x = Math.PI;
        group.add(flame);
        group.userData.flame = flame;
        
        const tiltGroup = new THREE.Group();
        tiltGroup.add(group);
        tiltGroup.position.set(0, 5, 0);
        
        player = tiltGroup;
        scene.add(player);
        
        // Connect player to effect manager (for magical effects)
        effectManager.setTarget(player);
        
        // Initialize dog cockpit animation system
        dogController.initialize(group);
        
        console.warn('Using placeholder rocket due to loading error');
    }
);

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
    cores: 0 // Cores collected this run
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

// Add stars to the scene
const stars = createStars(3000);
scene.add(stars);
uStarOpacity.value = 0.8; // Make stars visible

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
const waterfallSystem = new WaterfallSystem(scene, camera);

// ASTEROID FIELD SYSTEM (Parallax Asteroids)
const asteroidFieldSystem = new AsteroidFieldSystem(scene, weaponLightManager);

// PLANETARY HORIZON SYSTEM (Massive scrolling planet)
const planetaryHorizonSystem = new PlanetaryHorizonSystem(scene, camera);

// INDUSTRIAL BACKGROUND SYSTEM (Megastructures)
const industrialSystem = new IndustrialBackgroundSystem(scene, weaponLightManager);

// NEBULA SYSTEM (Volumetric Clouds & Particles)
const nebulaSystem = new NebulaSystem(scene, weaponLightManager);
const cosmicDustSystem = new CosmicDustSystem(scene);
nebulaSystem.setCamera(camera);

// === GHOST DEBRIS (new Cosmic Architect feature) ===
const ghostDebrisSystem = new GhostDebrisSystem(scene);

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

// SPACE FRIENDS (cute companions for a 7-year-old girl)
const friendsManager = new FriendsManager(scene, audioSystem, particleSystem);

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
const juiceManager = new JuiceManager(camera, scene, particleSystem);

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

// SWARM #3 - DREAMY ENVIRONMENTS
const flowerManager = new ConstellationManager(scene, audioSystem, particleSystem);
const candyManager = new CandyBeltManager(scene, audioSystem, particleSystem);
const castleManager = new CastleBackgroundManager(scene);

// Effect manager - will set target when player loads
const tempTarget = new THREE.Group();
const effectManager = new EffectManager(scene, audioSystem, tempTarget);

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
debugSystem.register('candyBelt', 'Candy Belt', true);
debugSystem.register('cloudCastles', 'Cloud Castles', true);
debugSystem.register('shadows', 'Shadows', true);
debugSystem.register('nebula', 'Nebula', true);
debugSystem.register('cosmicDust', 'Cosmic Dust', true);
debugSystem.register('biological', 'Biological Background', true);
debugSystem.register('industrialBg', 'Industrial Background', true);
debugSystem.register('waterfall', 'Waterfall', true);
debugSystem.register('asteroidField', 'Asteroid Field', true);
debugSystem.register('planetaryHorizon', 'Planetary Horizon', true);
debugSystem.register('ghostDebris', 'Ghost Debris', true);
debugSystem.register('godRays', 'God Rays', true);

let isGamePaused = false;

// =============================================================================
// GEOLOGICAL OBJECTS & ANOMALIES (from plan.md)
// =============================================================================

// Spore Clouds - floating clouds of glowing spores
const sporeClouds: SporeCloud[] = [];

function createSporeCloudAtPosition(x: number, y: number, z: number) {
    const cloud = new SporeCloud(scene, new THREE.Vector3(x, y, z), 500 + Math.floor(Math.random() * 500));
    sporeClouds.push(cloud);
    return cloud;
}

// Chroma-Shift Rocks - color-shifting crystalline rocks
const chromaRocks: THREE.Group[] = [];

function createChromaRockAtPosition(x: number, y: number, z: number) {
    const rock = createChromaShiftRock({ size: 2 + Math.random() * 2 });
    rock.position.set(x, y, z);
    scene.add(rock);
    chromaRocks.push(rock);
    return rock;
}

// Fractured Geodes - safe harbors with EM fields
const geodes: THREE.Group[] = [];

function createGeodeAtPosition(x: number, y: number, z: number) {
    const geode = createFracturedGeode({ size: 3 + Math.random() * 2 });
    geode.position.set(x, y, z);
    scene.add(geode);
    geodes.push(geode);
    return geode;
}

// Nebula Jelly-Moss - floating gelatinous organisms with fractal moss
const jellyMosses: THREE.Group[] = [];

function createJellyMossAtPosition(x: number, y: number, z: number, size?: number) {
    const jellyMoss = createNebulaJellyMoss({ size: size || 2 + Math.random() * 8 });
    jellyMoss.position.set(x, y, z);
    scene.add(jellyMoss);
    jellyMosses.push(jellyMoss);
    return jellyMoss;
}

// Solar Sails / Light Leaves - thin-film iridescent organisms catching solar wind
const solarSails: THREE.Group[] = [];

function createSolarSailAtPosition(x: number, y: number, z: number) {
    const solarSail = createSolarSail({ 
        leafCount: 6 + Math.floor(Math.random() * 6),
        leafLength: 8 + Math.random() * 8
    });
    solarSail.position.set(x, y, z);
    scene.add(solarSail);
    solarSails.push(solarSail);
    return solarSail;
}

// Void Root Balls - active threats with grapple mechanics
const voidRootBalls: THREE.Group[] = [];

function createVoidRootBallAtPosition(x: number, y: number, z: number) {
    const rootBall = createVoidRootBall({ size: 2 + Math.random() * 2 });
    rootBall.position.set(x, y, z);
    scene.add(rootBall);
    voidRootBalls.push(rootBall);
    return rootBall;
}

// Vacuum Kelp - energy-draining tunnel obstacles
const vacuumKelps: THREE.Group[] = [];

function createVacuumKelpAtPosition(x: number, y: number, z: number) {
    const kelp = createVacuumKelp({ length: 20 + Math.random() * 20, nodes: 5 + Math.floor(Math.random() * 4) });
    kelp.position.set(x, y, z);
    scene.add(kelp);
    vacuumKelps.push(kelp);
    return kelp;
}

// Ice Needle Clusters - super-bleed and thermal dynamics
const iceNeedleClusters: THREE.Group[] = [];

function createIceNeedleClusterAtPosition(x: number, y: number, z: number) {
    const cluster = createIceNeedleCluster({ count: 15 + Math.floor(Math.random() * 15) });
    cluster.position.set(x, y, z);
    scene.add(cluster);
    iceNeedleClusters.push(cluster);
    return cluster;
}

// Liquid Metal Blobs - splitting and recombination
function createLiquidMetalBlobAtPosition(x: number, y: number, z: number) {
    const blob = liquidMetalSystem.createBlob(new THREE.Vector3(x, y, z), 2 + Math.random() * 3);
    return blob;
}

// Magma Hearts - eruption cycle mechanics
const magmaHearts: THREE.Group[] = [];

function createMagmaHeartAtPosition(x: number, y: number, z: number) {
    const heart = createMagmaHeart({ size: 3 + Math.random() * 2 });
    heart.position.set(x, y, z);
    scene.add(heart);
    magmaHearts.push(heart);
    return heart;
}

// Store plants that live on the moon to animate them later
/* moonPlants moved to ./visuals */

// disposeObject moved to ./utils

// Cleanup geological objects that have fallen behind the camera
function cleanupGeologicalObjects(cameraX: number) {
    const cutoff = cameraX - 100;

    // Spore clouds
    for (let i = sporeClouds.length - 1; i >= 0; i--) {
        const cloud = sporeClouds[i];
        if (cloud.position.x < cutoff) {
            scene.remove(cloud.spores);
            sporeClouds.splice(i, 1);
        }
    }

    // Chroma rocks
    for (let i = chromaRocks.length - 1; i >= 0; i--) {
        const rock = chromaRocks[i];
        if (rock.position.x < cutoff) {
            scene.remove(rock);
            disposeObject(rock);
            chromaRocks.splice(i, 1);
        }
    }

    // Geodes
    for (let i = geodes.length - 1; i >= 0; i--) {
        const geode = geodes[i];
        if (geode.position.x < cutoff) {
            scene.remove(geode);
            disposeObject(geode);
            geodes.splice(i, 1);
        }
    }

    // Void root balls
    for (let i = voidRootBalls.length - 1; i >= 0; i--) {
        const rootBall = voidRootBalls[i];
        if (rootBall.position.x < cutoff) {
            scene.remove(rootBall);
            disposeObject(rootBall);
            voidRootBalls.splice(i, 1);
        }
    }

    // Vacuum kelp
    for (let i = vacuumKelps.length - 1; i >= 0; i--) {
        const kelp = vacuumKelps[i];
        if (kelp.position.x < cutoff) {
            scene.remove(kelp);
            disposeObject(kelp);
            vacuumKelps.splice(i, 1);
        }
    }

    // Ice needle clusters
    for (let i = iceNeedleClusters.length - 1; i >= 0; i--) {
        const cluster = iceNeedleClusters[i];
        if (cluster.position.x < cutoff) {
            scene.remove(cluster);
            disposeObject(cluster);
            iceNeedleClusters.splice(i, 1);
        }
    }

    // Magma hearts
    for (let i = magmaHearts.length - 1; i >= 0; i--) {
        const heart = magmaHearts[i];
        if (heart.position.x < cutoff) {
            scene.remove(heart);
            disposeObject(heart);
            magmaHearts.splice(i, 1);
        }
    }
}

// createMoon moved to ./visuals

const moon = createMoon();
moon.position.set(500, 5, -50); // Position far ahead
scene.add(moon);

const videoTumblingStars = [
    new VideoTumblingStar(scene, 360, 12, -45),
    new VideoTumblingStar(scene, 980, -6, -40),
    new VideoTumblingStar(scene, 1620, 8, -48)
];

const industrialGeometryManager = new IndustrialGeometryManager(scene);
const levelManager = new LevelManager({
    scene,
    camera: camera,
    getPlayer: () => player,
    industrialGeometryManager,
    planetaryHorizonSystem,
    ghostDebrisSystem,
    godRaySystem,
    reEntrySystem,
    industrialSystem,
    waterfallSystem,
    asteroidFieldSystem,
    biologicalSystem,
    nebulaSystem,
    cosmicDustSystem,
    butterflySwarmSystem,
    flowerManager,
    castleManager,
    candyManager,
    debugSystem,
    creators: {
        createStarDustFern,
        createNebulaRose,
        createSubwooferLotus,
        createGlowingFlower,
        createFloweringTree,
        createFloatingOrb
    },
    spawners: {
        createSporeCloudAtPosition,
        createVoidRootBallAtPosition,
        createVacuumKelpAtPosition,
        createIceNeedleClusterAtPosition,
        createLiquidMetalBlobAtPosition,
        createMagmaHeartAtPosition
    },
    onLevelStart: (cfg) => {
        playerState.autoScrollSpeed = cfg.speed;
        playerState.distanceToMoon = cfg.distance;
    },
    onUpdateLevelDisplay: (levelIndex, name) => {
        const levelDiv = document.getElementById('level-display');
        if (levelDiv) levelDiv.innerHTML = `Level ${levelIndex}: ${name}`;
    }
});

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
    getCurrentConfig: () => levelManager.config[levelManager.currentLevel],
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
        if (player) {
            dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
            juiceManager.shakeScreen(ShakeType.HEAVY);
            juiceManager.burstDamage(player.position.clone());
        }
        hudManager.updateHealth(playerState.health, playerState.maxHealth);
        audioSystem.playImpact(playerState.currentSpeedY);
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
        }
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
    }
    
    const accel = (targetSpeed !== -CONFIG.player.gravity && targetSpeed !== 0)
        ? CONFIG.player.acceleration
        : CONFIG.player.deceleration;
    
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
                particleSystem.emit(exhaustPos, 0xffaa00, 2, 5.0, 0.8, 0.2);
            } else if (isMovingDown) {
                // Diving → very small, dim flame + extra downward particle streaks
                const flicker = 0.4 + Math.random() * 0.2;
                rocket.userData.flame.scale.set(flicker, flicker, flicker);
                
                // Extra downward streaks
                const streakPos = player.position.clone();
                streakPos.x -= 0.5;
                streakPos.y -= 0.3;
                particleSystem.emit(streakPos, 0xff4400, 1, 3.0, 0.5, 0.3);
            } else {
                // Gliding / idle → smaller, softer flame
                const flicker = 0.5 + Math.random() * 0.2;
                rocket.userData.flame.scale.set(flicker, flicker * 1.5, flicker);
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

    // --- AUDIO SYSTEM ---
    audioSystem.updateEngineState(playerState.currentSpeedY, isMovingUp, isMovingDown, isBoosting);

    // Level Checking
    levelManager.checkProgress(player.position.x);
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
let geologicalUpdateFrame = 0;
let objectDensityMultiplier = 1.0;

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
    const updateObj = (obj: THREE.Object3D) => {
        const inRange = Math.abs(obj.position.x - playerX) < 40;
        obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).castShadow = inRange;
                (child as THREE.Mesh).receiveShadow = inRange;
            }
        });
    };

    levelManager.levelObjects.forEach(updateObj);
    chromaRocks.forEach(updateObj);
    geodes.forEach(updateObj);
    voidRootBalls.forEach(updateObj);
    vacuumKelps.forEach(updateObj);
    iceNeedleClusters.forEach(updateObj);
    magmaHearts.forEach(updateObj);
}

function animate() {
    const rawDelta = Math.min(clock.getDelta(), 0.1); // Cap delta
    const delta = juiceManager.update(rawDelta);
    const time = clock.getElapsedTime(); // For foliage animation and time-based motion

    // --- Debug System ---
    debugSystem.update(rawDelta);

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
        renderer.render(scene, camera);
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
                        saveManager.recordBossDefeated();
                        audioSystem.play('boss_defeat');
                        playerState.bossActive = false;
                        
                        // Resume auto-scroll
                        playerState.autoScrollSpeed = saveManager.applyToSpeed(8);
                        
                        // Show victory message briefly
                        console.log('🎉 BOSS DEFEATED! +50 Cores');
                    },
                    onPlayerHit: () => {
                        // Boss hit player
                        if (!playerState.invincible) {
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
        if (debugSystem.isEnabled('starfield')) {
            starfield.update(delta, speedMultiplier);
        }
        
        // Update orb manager and check collection
        orbManager.update(delta, time);
        const collectionResult = orbManager.checkCollection(player.position);
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
        nebulaSystem.setMagicActive(isMagicActive);

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
            friendsManager.update(delta, player.position);
            friendsManager.maybeSpawnFriends(player.position.x);
            friendsManager.cleanupFarFriends(player.position.x);
        }
        
        // Update dog cockpit animation
        dogController.update(delta, playerState);
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
        if (debugSystem.isEnabled('weaponLights')) {
            weaponLightManager.update(weaponSystem.getActiveProjectiles());
        }

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
                        particleSystem.emit(obs.position, 0x00ffff, 10, 5.0, 1.0, 2.0); // Cyan splash

                        // 2. Destroy Asteroid
                        audioSystem.play('explode');
                        
                        // Try spawn pickup
                        pickupManager.trySpawn(obs.position.clone());
                        
                        obstacleSystem.splitAsteroid(obs); // This modifies obstacles array!

                        // 3. Destroy Projectile
                        proj.deactivate();

                        // Break inner loop (projectile done)
                        // Outer loop continues (next asteroid), but current 'obs' is removed?
                        // splitAsteroid removes 'obs' from 'obstacles' array.
                        // Since we iterate backwards, removing current index is safe for outer loop continuation?
                        // splitAsteroid does: const idx = obstacles.indexOf(asteroid); if (idx > -1) obstacles.splice(idx, 1);
                        // If we splice, the indices shift. Iterating backwards handles this safely.
                        // However, 'obs' is now invalid. We must break inner loop.
                        break;
                    }
                }
            }

            // Check projectiles against Nebula Kraken (boss squids)
            const squids = obstacleSystem.getSquids();
            for (const squid of squids) {
                if (squid.isDestroyed) continue;
                for (const proj of projectiles) {
                    if (!proj.active) continue;
                    const dist = proj.mesh.position.distanceTo(squid.getPosition());
                    if (dist < squid.getRadius() + 0.5) {
                        // Hit the boss!
                        particleSystem.emit(proj.mesh.position.clone(), 0x9900ff, 15, 6.0, 1.0, 1.5);
                        squid.takeDamage(30);
                        proj.deactivate();
                        break;
                    }
                }
            }

            // Update boss health bar UI
            updateBossHealthBar(squids);
        }
    }

    // Update Re-Entry System
    if (player && debugSystem.isEnabled('reEntry')) {
        reEntrySystem.update(delta, camera.position.x, camera.position.y, player);
    }

    // Update Level Manager (and Clouds)
    if (player) {
        levelManager.update(delta, camera.position.x, playerState.autoScrollSpeed);
        if (debugSystem.isEnabled('butterflySwarm')) {
            butterflySwarmSystem.update(delta, camera.position.x, player.position);
        }
        videoTumblingStars.forEach(star => star.update(delta, camera));
    }

    // Phase 1 FPS Fixes - Quick Wins: shadow & object cleanup
    updateShadowQuality();
    updateShadowCulling();
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

        // Update chroma-shift rocks (color animation)
        chromaRocks.forEach(rock => {
            const isFar = camera.position.distanceTo(rock.position) > 80;
            if (!isFar || farUpdateFrame) {
                updateChromaRock(rock, camera.position, delta, time);
            }
        });

        // Update geodes (EM field pulse)
        geodes.forEach(geode => updateGeode(geode, delta, time));

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
        vacuumKelps.forEach(kelp => updateVacuumKelp(kelp, delta, time));
        iceNeedleClusters.forEach(cluster => updateIceNeedleCluster(cluster, delta, time));

        // Update Liquid Metal System (Physics & Collisions)
        liquidMetalSystem.update(delta);
        if (player && weaponSystem) {
            liquidMetalSystem.checkCollisions(weaponSystem.getActiveProjectiles());
        }

        magmaHearts.forEach(heart => updateMagmaHeart(heart, delta, time));
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

    renderer.render(scene, camera);
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
