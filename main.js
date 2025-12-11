import * as THREE from 'three';
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js';
import { WebGPURenderer } from 'three/webgpu';

// =============================================================================
// DOG DASH - 2.5D Side-Scroller
// Inspired by Inside, Little Nightmares, Metroid Dread
// =============================================================================

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
        jumpForce: 12,
        gravity: 30,
        groundFriction: 0.85,
        airFriction: 0.95
    },
    // World
    groundLevel: 0
};

// --- Scene Setup ---
const canvas = document.querySelector('#glCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.background);
scene.fog = new THREE.Fog(CONFIG.colors.background, 20, 80);

// Check WebGPU
if (!WebGPU.isAvailable()) {
    const warning = WebGPU.getErrorMessage();
    document.body.appendChild(warning);
    throw new Error('WebGPU not supported');
}

// --- Camera (Side-view, follows player on X axis) ---
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
// Camera positioned to the side, looking at Z=0 plane
camera.position.set(0, CONFIG.cameraHeight, CONFIG.cameraDistance);
camera.lookAt(0, CONFIG.cameraHeight, 0);

// --- Renderer ---
const renderer = new WebGPURenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// --- Lighting (Moody, atmospheric) ---
const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
scene.add(ambientLight);

// Main directional light (from the side for dramatic shadows)
const mainLight = new THREE.DirectionalLight(0xffffff, 0.6);
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
scene.add(mainLight);

// Rim light from behind (cinematic depth)
const rimLight = new THREE.DirectionalLight(0x4488ff, 0.3);
rimLight.position.set(5, 5, -10);
scene.add(rimLight);

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

// =============================================================================
// PLAYER (Dog Character)
// =============================================================================
function createPlayer() {
    const group = new THREE.Group();

    // Body (capsule-like shape for the dog)
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.6, 8, 16);
    const body = new THREE.Mesh(bodyGeo, materials.player);
    body.rotation.z = Math.PI / 2; // Lay horizontal
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const head = new THREE.Mesh(headGeo, materials.player);
    head.position.set(0.5, 0.1, 0);
    head.castShadow = true;
    group.add(head);

    // Ears
    const earGeo = new THREE.ConeGeometry(0.1, 0.2, 8);
    const leftEar = new THREE.Mesh(earGeo, materials.player);
    leftEar.position.set(0.55, 0.35, -0.1);
    leftEar.rotation.z = -0.3;
    group.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, materials.player);
    rightEar.position.set(0.55, 0.35, 0.1);
    rightEar.rotation.z = -0.3;
    group.add(rightEar);

    // Snout
    const snoutGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.2, 8);
    const snout = new THREE.Mesh(snoutGeo, materials.player);
    snout.position.set(0.7, 0.05, 0);
    snout.rotation.z = Math.PI / 2;
    group.add(snout);

    // Legs (4 small cylinders)
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8);
    const legPositions = [
        { x: 0.25, z: 0.15 },  // Front right
        { x: 0.25, z: -0.15 }, // Front left
        { x: -0.25, z: 0.15 }, // Back right
        { x: -0.25, z: -0.15 } // Back left
    ];

    group.userData.legs = [];
    legPositions.forEach((pos, i) => {
        const leg = new THREE.Mesh(legGeo, materials.player);
        leg.position.set(pos.x, -0.3, pos.z);
        leg.castShadow = true;
        group.add(leg);
        group.userData.legs.push(leg);
    });

    // Tail
    const tailGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.3, 8);
    const tail = new THREE.Mesh(tailGeo, materials.player);
    tail.position.set(-0.55, 0.15, 0);
    tail.rotation.z = Math.PI / 4;
    group.add(tail);
    group.userData.tail = tail;

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.65, 0.15, -0.12);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.65, 0.15, 0.12);
    group.add(rightEye);

    // Position player
    group.position.set(0, 1, 0);

    return group;
}

const player = createPlayer();
scene.add(player);

// Player state
const playerState = {
    velocity: new THREE.Vector3(0, 0, 0),
    isGrounded: false,
    facingRight: true,
    isRunning: false
};

// =============================================================================
// LEVEL GEOMETRY
// =============================================================================

// Ground (extends infinitely in X, flat in Z)
const groundGeo = new THREE.BoxGeometry(200, 2, 20);
const ground = new THREE.Mesh(groundGeo, materials.ground);
ground.position.set(0, -1, 0);
ground.receiveShadow = true;
scene.add(ground);

// Platforms array for collision detection
const platforms = [];

function createPlatform(x, y, width, height = 0.4, depth = 4) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const platform = new THREE.Mesh(geo, materials.platform);
    platform.position.set(x, y, 0);
    platform.receiveShadow = true;
    platform.castShadow = true;
    scene.add(platform);

    // Store collision box
    platforms.push({
        mesh: platform,
        minX: x - width / 2,
        maxX: x + width / 2,
        minY: y - height / 2,
        maxY: y + height / 2
    });

    return platform;
}

// Create some test platforms
createPlatform(5, 1.5, 4);
createPlatform(10, 3, 3);
createPlatform(15, 2, 5);
createPlatform(-5, 2, 4);
createPlatform(-10, 3.5, 3);
createPlatform(-15, 1, 6);

// Background elements (parallax layers for depth)
function createBackgroundLayer(zOffset, color, count) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 1.0,
        metalness: 0
    });

    for (let i = 0; i < count; i++) {
        const width = 2 + Math.random() * 6;
        const height = 3 + Math.random() * 10;
        const geo = new THREE.BoxGeometry(width, height, 1);
        const box = new THREE.Mesh(geo, mat);
        box.position.set(
            (Math.random() - 0.5) * 100,
            height / 2,
            zOffset
        );
        group.add(box);
    }

    scene.add(group);
    return group;
}

// Create parallax background layers
const bgLayer1 = createBackgroundLayer(-8, 0x15152a, 20);  // Far
const bgLayer2 = createBackgroundLayer(-5, 0x1a1a35, 15);  // Mid
const bgLayer3 = createBackgroundLayer(-3, 0x202045, 10);  // Near

// =============================================================================
// INPUT HANDLING
// =============================================================================
const keys = {
    left: false,
    right: false,
    jump: false,
    run: false
};

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyA':
        case 'ArrowLeft':
            keys.left = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.right = true;
            break;
        case 'KeyW':
        case 'ArrowUp':
        case 'Space':
            keys.jump = true;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.run = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyA':
        case 'ArrowLeft':
            keys.left = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.right = false;
            break;
        case 'KeyW':
        case 'ArrowUp':
        case 'Space':
            keys.jump = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.run = false;
            break;
    }
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Click to start (hide instructions)
const instructions = document.getElementById('instructions');
instructions.addEventListener('click', () => {
    instructions.style.display = 'none';
});

// =============================================================================
// PHYSICS & COLLISION
// =============================================================================
function checkPlatformCollision(x, y, radius = 0.3) {
    // Check ground
    if (y - radius <= CONFIG.groundLevel) {
        return { collided: true, groundY: CONFIG.groundLevel };
    }

    // Check platforms
    for (const platform of platforms) {
        // Simple AABB collision for standing on platforms
        if (x >= platform.minX && x <= platform.maxX) {
            // Check if player is falling onto platform
            if (y - radius <= platform.maxY && y - radius >= platform.maxY - 0.5) {
                if (playerState.velocity.y <= 0) {
                    return { collided: true, groundY: platform.maxY };
                }
            }
        }
    }

    return { collided: false, groundY: null };
}

function updatePlayer(delta) {
    const speed = keys.run ? CONFIG.player.runSpeed : CONFIG.player.speed;

    // Horizontal movement
    if (keys.left) {
        playerState.velocity.x = -speed;
        playerState.facingRight = false;
    } else if (keys.right) {
        playerState.velocity.x = speed;
        playerState.facingRight = true;
    } else {
        // Apply friction
        const friction = playerState.isGrounded ? CONFIG.player.groundFriction : CONFIG.player.airFriction;
        playerState.velocity.x *= friction;
    }

    // Jump
    if (keys.jump && playerState.isGrounded) {
        playerState.velocity.y = CONFIG.player.jumpForce;
        playerState.isGrounded = false;
    }

    // Gravity
    if (!playerState.isGrounded) {
        playerState.velocity.y -= CONFIG.player.gravity * delta;
    }

    // Apply velocity
    player.position.x += playerState.velocity.x * delta;
    player.position.y += playerState.velocity.y * delta;

    // Collision detection
    const collision = checkPlatformCollision(player.position.x, player.position.y);
    if (collision.collided) {
        player.position.y = collision.groundY + 0.5; // Player height offset
        playerState.velocity.y = 0;
        playerState.isGrounded = true;
    } else {
        playerState.isGrounded = false;
    }

    // Face direction
    player.scale.x = playerState.facingRight ? 1 : -1;

    // Animate legs when moving
    if (Math.abs(playerState.velocity.x) > 0.5 && playerState.isGrounded) {
        const legAnim = Math.sin(Date.now() * 0.02) * 0.3;
        player.userData.legs.forEach((leg, i) => {
            leg.rotation.x = legAnim * (i < 2 ? 1 : -1);
        });
    }

    // Animate tail
    player.userData.tail.rotation.z = Math.PI / 4 + Math.sin(Date.now() * 0.005) * 0.2;
}

// =============================================================================
// CAMERA FOLLOW
// =============================================================================
function updateCamera() {
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

    // Update main light to follow
    mainLight.position.x = camera.position.x - 5;
    mainLight.target.position.x = camera.position.x;
}

// =============================================================================
// ANIMATION LOOP
// =============================================================================
const clock = new THREE.Clock();

function animate() {
    const delta = Math.min(clock.getDelta(), 0.1); // Cap delta

    updatePlayer(delta);
    updateCamera();

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

console.log('🐕 Dog Dash - 2.5D Side-Scroller loaded!');
console.log('Controls: A/D or Arrow Keys to move, W/Space to jump, Shift to run');
