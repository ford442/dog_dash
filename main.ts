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
import type { NebulaKraken } from './space_robot_squid';
import { BOSS_DISPLAY_NAME } from './space_robot_squid';

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
    // Player physics
    player: {
        speed: 8,
        runSpeed: 14,
        thrustForce: 25, // Upward force
        gravity: 8,      // Low gravity for space
        groundFriction: 0.85,
        airFriction: 0.98 // Less drag in space
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
        
        console.warn('Using placeholder rocket due to loading error');
    }
);

// Player state
const playerState = {
    velocity: new THREE.Vector3(0, 0, 0),
    isGrounded: false,
    facingRight: true,
    isRunning: false,
    autoScrollSpeed: 6, // Constant forward movement
    health: 3, // Ship can survive 3 collisions
    maxHealth: 3,
    invincible: false, // Invincibility frames after hit
    distanceToMoon: 500, // Distance to reach the moon
    hasWon: false, // Track if player has won
    level: 1 // Current level
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
    gameOver
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
    }, { once: true });
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
});

// Track when game starts
if (instructions) {
    instructions.addEventListener('click', () => {
        gameStarted = true;
    }, { once: true });
}

// =============================================================================
// PHYSICS & COLLISION
// =============================================================================
function updatePlayer(delta: number) {
    // Don't update if player hasn't loaded yet
    if (!player) return;
    
    // Auto-scroll (constant forward movement)
    player.position.x += playerState.autoScrollSpeed * delta;

    // Vertical movement (thrust)
    if (keys.jump) {
        playerState.velocity.y += CONFIG.player.thrustForce * delta;

        // Boost flame when thrusting
        const rocket = player.children[0];
        if (rocket && rocket.userData.flame) {
            rocket.userData.flame.scale.set(1.5, 3.0, 1.5);
        }
    }

    // Optional: Down thrust
    if (keys.left) {
        playerState.velocity.y -= CONFIG.player.thrustForce * 0.5 * delta;
    }

    // Gravity (light)
    playerState.velocity.y -= CONFIG.player.gravity * delta;

    // Cap vertical speed
    playerState.velocity.y = Math.max(Math.min(playerState.velocity.y, 12), -12);

    // Apply velocity
    player.position.y += playerState.velocity.y * delta;

    // Air friction
    playerState.velocity.y *= CONFIG.player.airFriction;

    // Thrust (Flight)
    if (keys.jump) {
        playerState.velocity.y += CONFIG.player.thrustForce * delta;
        playerState.isGrounded = false;

        // Boost flame when thrusting
        const rocket = player.children[0];
        if (rocket && rocket.userData.flame) {
            rocket.userData.flame.scale.set(1.5, 3.0, 1.5); // Big flame
        }

        // --- NEW: Emit Engine Trail ---
        const exhaustPos = player.position.clone();
        exhaustPos.x -= 0.5; // slightly behind the rocket
        exhaustPos.y -= 0.5; // at the nozzle
        particleSystem.emit(exhaustPos, 0xffaa00, 2, 5.0, 0.8, 0.2);
    }

    // Gravity
    playerState.velocity.y -= CONFIG.player.gravity * delta;

    // Apply velocity
    player.position.x += playerState.velocity.x * delta;
    player.position.y += playerState.velocity.y * delta;

    // Cap vertical speed (terminal velocity)
    playerState.velocity.y = Math.max(Math.min(playerState.velocity.y, 10), -15);

    // Collision detection
    const collision = checkPlatformCollision(player.position.x, player.position.y, CONFIG.groundLevel);
    if (collision.collided && collision.groundY !== null) {
        player.position.y = collision.groundY + 0.5; // Player height offset
        playerState.velocity.y = 0;
        playerState.isGrounded = true;
    } else {
        playerState.isGrounded = false;
    }

    // Animation: Pitch based on vertical velocity
    const rocket = player.children[0];
    if (rocket) {
        // Pitch up/down based on Y velocity
        const targetPitch = playerState.velocity.y * 0.03;
        player.rotation.z += (targetPitch - player.rotation.z) * 0.1;

        // Bobbing
        const hoverY = Math.sin(Date.now() * 0.003) * 0.05;
        rocket.position.y = hoverY;

        // Flame Flicker
        if (rocket.userData.flame && !keys.jump) {
            const flicker = 0.6 + Math.random() * 0.3;
            rocket.userData.flame.scale.set(flicker, flicker * 1.5, flicker);
        }
    }

    // Level Checking
    levelManager.checkProgress(player.position.x);
}

// =============================================================================
// CAMERA FOLLOW
// =============================================================================
function updateCamera() {
    // Don't update if player hasn't loaded yet
    if (!player) return;
    
    // Smooth follow player on X axis
    const targetX = player.position.x;
    const targetY = Math.max(player.position.y + 1, CONFIG.cameraHeight);

    camera.position.x += (targetX - camera.position.x) * 0.08;
    camera.position.y += (targetY - camera.position.y) * 0.05;

    // Look slightly ahead of player
    const lookAhead = playerState.facingRight ? 2 : -2;
    camera.lookAt(
        camera.position.x + lookAhead,
        camera.position.y - 1,
        0
    );

    // Update main light to follow player
    mainLight.position.x = camera.position.x - 5;
    mainLight.target.position.x = camera.position.x;
    
    // Update accent lights to follow player with offset
    accentLight1.position.x = player.position.x + 10;
    accentLight1.position.y = player.position.y + 5;
    
    accentLight2.position.x = player.position.x - 8;
    accentLight2.position.y = player.position.y + 3;
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

function animate() {
    const delta = Math.min(clock.getDelta(), 0.1); // Cap delta
    const time = clock.getElapsedTime(); // For foliage animation and time-based motion

    updatePlayer(delta);
    obstacleSystem.update(delta);

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
    if (player) {
        reEntrySystem.update(delta, camera.position.x, camera.position.y, player);
    }

    // Update Level Manager (and Clouds)
    if (player) {
        levelManager.update(delta, camera.position.x, playerState.autoScrollSpeed);
    }

    updateCamera();
    
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
    
    // Check if player reached the moon
    if (player && player.position.x >= playerState.distanceToMoon - 10 && !playerState.hasWon) {
        playerState.hasWon = true;
        gameWin();
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
