import * as THREE from 'three';

// --- Configuration ---
export const CONFIG = {
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

// Player state - Smooth direct control system
export const playerState = {
    velocity: new THREE.Vector3(0, 0, 0),
    targetY: 5,          // Target Y position for smooth following
    currentSpeedY: 0,    // Current vertical speed for momentum feel
    isGrounded: false,
    facingRight: true,
    isRunning: false,
    autoScrollSpeed: 8, // Constant forward movement
    inSafeHarbor: false, // Protected by geode EM field
    health: 3, // Ship can survive 3 collisions
    maxHealth: 3,
    invincible: false, // Invincibility frames after hit
    distanceToMoon: 500, // Distance to reach the moon
    hasWon: false, // Track if player has won
    level: 1, // Current level
    bossActive: false, // Boss fight in progress
    cores: 0, // Cores collected this run
    slingCombo: 0,
    slingAssistTimer: 0,
    penguinSlideAssistTimer: 0
};

export let isGamePaused = false;
export let gameStarted = false;

export function setGameStarted(value: boolean): void {
    gameStarted = value;
}

export function setIsGamePaused(value: boolean): void {
    isGamePaused = value;
}

// --- Error Handling ---
export function showError(title: string, message: string) {
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
