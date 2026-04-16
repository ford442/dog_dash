import * as THREE from 'three';
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js';
import { WebGPURenderer } from 'three/webgpu';
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
    // Player physics - Smooth direct control (no thrust/gravity bobbing)
    player: {
        maxSpeedY: 18,        // Maximum vertical speed
        acceleration: 40,     // How quickly we reach target speed
        deceleration: 25,     // How quickly we stop when no input
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
    renderer = new WebGPURenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -30;
    mainLight.shadow.camera.right = 30;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -10;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);

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
const DEFAULT_FOG_FAR = 80;
const DEFAULT_FOG_NEAR = 20;
const FOG_FAR_DENSITY_FACTOR = 5;
const FOG_NEAR_DENSITY_FACTOR = 3;

class LevelManager {
    currentLevel: number;
    config: { [key: number]: LevelConfig };
    levelObjects: THREE.Object3D[];
    cloudSystem: CloudSystem;
    atmosphereSystem: AtmosphereSystem;

    constructor() {
        this.cloudSystem = new CloudSystem(scene);
        this.atmosphereSystem = new AtmosphereSystem(scene);
        this.currentLevel = 1;
        this.config = LEVEL_CONFIG;

        // Track planted objects to cleanup
        this.levelObjects = [];
    }

    startLevel(levelIndex: number) {
        this.currentLevel = levelIndex;
        const cfg = this.config[levelIndex];
        if (!cfg) return;

        console.log(`Starting Level ${levelIndex}: ${cfg.name}`);

        // Update Game State
        playerState.autoScrollSpeed = cfg.speed;
        playerState.distanceToMoon = cfg.distance;

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

        // Clear previous level objects that are behind (optional, but good for perf)
        // actually we just keep scrolling, but we need to spawn new density ahead

        // Populate new zone ahead of player
        this.populateZone(player.position.x + 50, player.position.x + 600, cfg);

        // Configure clouds based on level type/name
        // For now, always visible but could be customized
        this.cloudSystem.layers.forEach(l => l.mesh.visible = true);

        // Special Effects per Level
        if (levelIndex === 3) {
            // Activate Planetary Horizon in Level 3
            planetaryHorizonSystem.activate();
            // Activate Re-Entry Heat in Level 3 "Orbital Descent"
            reEntrySystem.activate();
        } else {
            planetaryHorizonSystem.deactivate();
            // Only deactivate reentry if not in level 3 (handled below generally, but explicit here for clarity)
            if (levelIndex !== 3) reEntrySystem.deactivate();
        }

        if (levelIndex === 4) {
            // Industrial Tunnel
            industrialSystem.activate();

            // Industrial background is heavy, maybe hide clouds?
            this.cloudSystem.layers.forEach(l => l.mesh.visible = false);
        } else {
            industrialSystem.deactivate();
        }

        if (levelIndex === 6) {
            waterfallSystem.activate();
        } else {
            waterfallSystem.deactivate();
        }

        // Activate Asteroid Fields in Level 2 only (Level 3 has Planet)
        if (levelIndex === 2) {
            asteroidFieldSystem.activate();
        } else {
            asteroidFieldSystem.deactivate();
        }

        if (levelIndex === 5) {
            // Activate Biological System for Space Whale Interior
            biologicalSystem.activate();
            nebulaSystem.deactivate();
            // Hide clouds in whale level
            this.cloudSystem.layers.forEach(l => l.mesh.visible = false);
        } else {
            biologicalSystem.deactivate();
            nebulaSystem.deactivate();
            // Restore clouds if not in Industrial Tunnel (Level 4)
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

    update(delta: number, cameraX: number, speed: number) {
        this.atmosphereSystem.update(delta, new THREE.Vector3(cameraX, 0, 0)); // Only X matters for now
        this.cloudSystem.update(delta, cameraX, speed);
        waterfallSystem.update(cameraX, delta);
        industrialSystem.update(cameraX, delta);
        biologicalSystem.update(delta, cameraX);
        // Pass player position to NebulaSystem for interactive lighting
        nebulaSystem.update(delta, cameraX, player ? player.position : undefined);
        if (levelManager.currentLevel === 5) {
            // nebulaSystem.updateLights(weaponSystem.getActiveProjectiles());
        }
        if (asteroidFieldSystem) asteroidFieldSystem.update(delta, cameraX);
        if (planetaryHorizonSystem) planetaryHorizonSystem.update(cameraX, delta);
    }

    populateZone(startX: number, endX: number, config: LevelConfig) {
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
        // Helper to spawn
        const spawn = (count: number, creatorFn: () => THREE.Object3D, customYRange = yRange, zRange: [number, number] = [-30, 0]) => {
            for (let i = 0; i < count; i++) {
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

        // Floating items
        if (density.orb) spawn(density.orb, () => createFloatingOrb({ color: 0x88ccff }), yRange);

        // Add clouds manually because they need the specific class wrapper
        if (density.cloud) {
            for(let i=0; i<density.cloud; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -40 + Math.random() * 30;
                createSporeCloudAtPosition(x, y, z);
            }
        }

        // Geological objects from plan.md
        if (density.voidRootBall) {
            for(let i=0; i<density.voidRootBall; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createVoidRootBallAtPosition(x, y, z);
            }
        }

        if (density.vacuumKelp) {
            for(let i=0; i<density.vacuumKelp; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * 15;
                const z = -35 + Math.random() * 25;
                createVacuumKelpAtPosition(x, y, z);
            }
        }

        if (density.iceNeedle) {
            for(let i=0; i<density.iceNeedle; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createIceNeedleClusterAtPosition(x, y, z);
            }
        }

        if (density.liquidMetal) {
            for(let i=0; i<density.liquidMetal; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createLiquidMetalBlobAtPosition(x, y, z);
            }
        }

        if (density.magmaHeart) {
            for(let i=0; i<density.magmaHeart; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = -35 + Math.random() * 25;
                createMagmaHeartAtPosition(x, y, z);
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

const industrialGeometryManager = new IndustrialGeometryManager(scene);
const levelManager = new LevelManager();

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
function createGalaxy(x: number, y: number, z: number, color: number) {
    const group = new THREE.Group();
    
    // Main nebula cloud
    const cloudGeo = new THREE.SphereGeometry(15, 16, 16);
    const cloudMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    group.add(cloud);
    
    // Inner glow
    const glowGeo = new THREE.SphereGeometry(8, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);
    
    // Bright core
    const coreGeo = new THREE.SphereGeometry(3, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);
    
    group.position.set(x, y, z);
    group.userData.rotationSpeed = (Math.random() - 0.5) * 0.02;
    return group;
}

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
const planetaryHorizonSystem = new PlanetaryHorizonSystem(scene);

// INDUSTRIAL BACKGROUND SYSTEM (Megastructures)
const industrialSystem = new IndustrialBackgroundSystem(scene);

// NEBULA SYSTEM (Volumetric Clouds & Particles)
const nebulaSystem = new NebulaSystem(scene, weaponLightManager);
nebulaSystem.setCamera(camera);

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
                break;
            case PowerUpType.FLOWER_CROWN_BOOST:
            case PowerUpType.TWINKLE_STAR_MAGNET:
                effectManager.activateEffect(MagicalEffectType.STARDUST_FIELD, config.duration);
                break;
            case PowerUpType.BUBBLEGUM_SHIELD:
                effectManager.activateEffect(MagicalEffectType.HEART_BUBBLE, config.duration);
                break;
            case PowerUpType.BUTTERFLY_ESCORT:
                effectManager.activateEffect(MagicalEffectType.BUTTERFLY_SWARM, config.duration);
                break;
            case PowerUpType.UNICORN_HORN_BLAST:
                effectManager.activateEffect(MagicalEffectType.GLITTER_BEAM, config.duration);
                break;
        }
    },
    onPowerUpEnd: (type, config) => {
        console.log(`Power-up ended: ${config.name}`);
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
const moonPlants: THREE.Object3D[] = [];

// Create the distant moon (goal)
function createMoon() {
    const group = new THREE.Group();
    
    // 1. Moon Surface (alien palette)
    const moonGeo = new THREE.SphereGeometry(8, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
        color: 0x222244, // Darker, alien purple-grey
        roughness: 0.8,
        metalness: 0.2,
        emissive: 0x111122,
        emissiveIntensity: 0.2
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.castShadow = true;
    group.add(moon);
    
    // Add some craters
    for (let i = 0; i < 8; i++) {
        const craterGeo = new THREE.SphereGeometry(0.5 + Math.random() * 1.5, 8, 8);
        const craterMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.95
        });
        const crater = new THREE.Mesh(craterGeo, craterMat);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        crater.position.set(
            Math.sin(phi) * Math.cos(theta) * 7,
            Math.sin(phi) * Math.sin(theta) * 7,
            Math.cos(phi) * 7
        );
        group.add(crater);
    }
    
    // Moon glow/atmosphere
    // 2. Atmosphere
    const atmosphereGeo = new THREE.SphereGeometry(9.5, 32, 32);
    const atmosphereMat = new THREE.MeshBasicMaterial({
        color: 0x8844ff,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    group.add(atmosphere);
    
    group.userData.atmosphere = atmosphere;

    // 3. Populate with Alien Plants
    const plantCount = 15;
    for (let i = 0; i < plantCount; i++) {
        let plant;
        const type = Math.random();
        if (type < 0.3) {
            plant = createSubwooferLotus({ color: 0x00ff88 });
        } else if (type < 0.6) {
            plant = createFiberOpticWillow({ color: 0xff00ff });
        } else {
            plant = createGlowingFlower({ color: 0x00ffff, intensity: 2.0 });
        }

        // Random position on the top hemisphere so plants are visible
        const phi = Math.random() * Math.PI * 0.4; // 0..PI/2 mostly
        const theta = Math.random() * Math.PI * 2;
        const r = 7.8; // Slightly embedded in surface
        plant.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
        );
        plant.lookAt(0, 0, 0);
        plant.rotateX(-Math.PI / 2);
        group.add(plant);
        moonPlants.push(plant);
    }
    return group;
}

const moon = createMoon();
moon.position.set(500, 5, -50); // Position far ahead
scene.add(moon);

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

    // --- NEW: Smooth Direct Vertical Control ---
    // Calculate target speed based on input (Keyboard + Touch)
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
        targetSpeed = -CONFIG.player.maxSpeedY;
    }
    
    // Smoothly interpolate current speed toward target (responsive but not jittery)
    const accel = (targetSpeed !== 0) ? CONFIG.player.acceleration : CONFIG.player.deceleration;
    playerState.currentSpeedY += (targetSpeed - playerState.currentSpeedY) * accel * delta;
    
    // Apply the movement
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

    // --- Visual Effects ---
    const rocket = player.children[0];
    if (rocket) {
        // Pitch up/down based on movement direction (subtle, responsive)
        const targetPitch = -playerState.currentSpeedY * 0.025;
        player.rotation.z += (targetPitch - player.rotation.z) * 0.15;

        // Gentle hover bob (always present, subtle)
        const hoverY = Math.sin(Date.now() * 0.004) * 0.03;
        rocket.position.y = hoverY;

        // Flame effect based on movement
        if (rocket.userData.flame) {
            if (isMovingUp || isMovingDown) {
                // Boost flame when actively moving
                const flicker = 0.9 + Math.random() * 0.2;
                rocket.userData.flame.scale.set(flicker * 1.2, flicker * 2.5, flicker * 1.2);
                
                // Emit engine trail
                const exhaustPos = player.position.clone();
                exhaustPos.x -= 0.5;
                exhaustPos.y -= 0.5;
                particleSystem.emit(exhaustPos, 0xffaa00, 1, 4.0, 0.6, 0.15);
            } else {
                // Idle flame
                const flicker = 0.5 + Math.random() * 0.2;
                rocket.userData.flame.scale.set(flicker, flicker * 1.5, flicker);
            }
        }
    }

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

    // Smooth follow with different speeds for X and Y
    camera.position.x += (targetX - camera.position.x) * 0.06;
    camera.position.y += (targetY - camera.position.y) * 0.04;

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
// ANIMATION LOOP
// =============================================================================
const clock = new THREE.Clock();

function animate() {
    const rawDelta = Math.min(clock.getDelta(), 0.1); // Cap delta
    const delta = juiceManager.update(rawDelta);
    const time = clock.getElapsedTime(); // For foliage animation and time-based motion
    
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
        audioSystem.updateEngine(playerState.currentSpeedY);
        
        // --- HEAT SYSTEM ---
        heatSystem.update(delta);
        
        // --- MAGICAL SYSTEMS (from swarm) ---
        // Update starfield with speed multiplier
        const speedMultiplier = 1 + Math.abs(playerState.currentSpeedY) / 20;
        starfield.update(delta, speedMultiplier);
        
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
        }
        
        // Update power-up manager
        powerUpManager.update(delta);
        
        // SWARM #3: Update magical effects (rainbow trails, butterflies, etc.)
        effectManager.update(delta);
        
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
        friendsManager.update(delta, player.position);
        friendsManager.maybeSpawnFriends(player.position.x);
        friendsManager.cleanupFarFriends(player.position.x);
        
        // Update dog cockpit animation
        dogController.update(delta, playerState);
    }
    
    // Update HUD system
    hudManager.update(delta);

    // --- NEW: Update Particles (engine trails & explosions)
    particleSystem.update(delta);
    debrisSystem.update(delta);

    // Update Weapon System
    if (player) {
        weaponSystem.update(delta, camera.position.x);
        weaponLightManager.update(weaponSystem.getActiveProjectiles());

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
        }
    }

    // Update Re-Entry System
    if (player) {
        reEntrySystem.update(delta, camera.position.x, camera.position.y, player);
    }

    // Update Level Manager (and Clouds)
    if (player) {
        levelManager.update(delta, camera.position.x, playerState.autoScrollSpeed);
    }

    updateCamera(delta);
    
    // Update juice camera base position
    juiceManager.updateCameraBasePosition(camera.position);
    
    // --- NEW: Update Geological Objects ---
    // Update spore clouds (brownian motion)
    sporeClouds.forEach(cloud => cloud.update(delta));

    // Update chroma-shift rocks (color animation)
    chromaRocks.forEach(rock => updateChromaRock(rock, camera.position, delta, time));

    // Update geodes (EM field pulse)
    geodes.forEach(geode => updateGeode(geode, delta, time));

    // Update nebula jelly-moss (pulsing and drifting)
    // Use reverse loop so we can remove items safely
    for (let i = jellyMosses.length - 1; i >= 0; i--) {
        const jellyMoss = jellyMosses[i];
        updateNebulaJellyMoss(jellyMoss, delta, time);

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

    // Update industrial obstacles (Level 4)
    industrialGeometryManager.update(time);

    // SWARM #3: Update Dreamy Environments
    if (player) {
        // Update flower constellations (bloom, pollen, sparkles)
        flowerManager.update(delta, player.position);
        flowerManager.checkPlayerProximity(player.position);
        
        // Update candy belt (wobble, dissolve, shatter)
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
        
        // Update cloud castles (parallax scrolling)
        castleManager.update(delta, player.position.x);
    }

    // Rotate galaxies slowly
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

    // --- NEW: Pilot/Player Animations ---
    try {
        const rocketRoot = player.children[0];
        if (rocketRoot) {
            // Tilt rocket slightly based on vertical velocity
            const targetTilt = THREE.MathUtils.clamp(-playerState.velocity.y * 0.025, -0.35, 0.35);
            rocketRoot.rotation.x += (targetTilt - rocketRoot.rotation.x) * 0.06;

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
    
    // Update distance display
    updateDistanceDisplay(playerState, player);
    
    // Update UI elements
    updateHeatBar();
    updateCoresDisplay();
    
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
