import * as THREE from 'three';

export const keys = {
    left: false,
    right: false,
    jump: false,
    run: false
};

type UIOptions = {
    getPlayer: () => THREE.Group | null;
    playerState: { health: number; maxHealth: number; distanceToMoon: number };
    startLevel: () => void;
};

export function createUI(options: UIOptions) {
    const levelDiv = document.createElement('div');
    levelDiv.id = 'level-display';
    levelDiv.style.position = 'absolute';
    levelDiv.style.top = '20px';
    levelDiv.style.right = '20px';
    levelDiv.style.color = '#ffcc00';
    levelDiv.style.fontSize = '30px';
    levelDiv.style.fontWeight = 'bold';
    levelDiv.style.textShadow = '0 0 10px rgba(255, 204, 0, 0.5)';
    levelDiv.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    levelDiv.style.zIndex = '100';
    document.body.appendChild(levelDiv);

    const healthDiv = document.createElement('div');
    healthDiv.id = 'health-display';
    healthDiv.style.position = 'absolute';
    healthDiv.style.top = '20px';
    healthDiv.style.left = '20px';
    healthDiv.style.color = '#e94560';
    healthDiv.style.fontSize = '24px';
    healthDiv.style.fontWeight = 'bold';
    healthDiv.style.textShadow = '0 0 10px rgba(233, 69, 96, 0.5)';
    healthDiv.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    healthDiv.style.zIndex = '100';
    document.body.appendChild(healthDiv);

    const distanceDiv = document.createElement('div');
    distanceDiv.id = 'distance-display';
    distanceDiv.style.position = 'absolute';
    distanceDiv.style.top = '60px';
    distanceDiv.style.left = '20px';
    distanceDiv.style.color = '#4488ff';
    distanceDiv.style.fontSize = '18px';
    distanceDiv.style.fontWeight = 'bold';
    distanceDiv.style.textShadow = '0 0 10px rgba(68, 136, 255, 0.5)';
    distanceDiv.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    distanceDiv.style.zIndex = '100';
    document.body.appendChild(distanceDiv);

    updateHealthDisplay(options.playerState);
    updateDistanceDisplay(options.playerState, options.getPlayer());
    options.startLevel();
}

export function updateHealthDisplay(playerState: { health: number; maxHealth: number }) {
    const healthDiv = document.getElementById('health-display');
    if (healthDiv) {
        const hearts = '❤️'.repeat(Math.max(0, playerState.health)) + '🖤'.repeat(Math.max(0, playerState.maxHealth - playerState.health));
        healthDiv.innerHTML = `Health: ${hearts}`;

        if (playerState.health <= 1) {
            healthDiv.classList.add('hud-pulse-fast');
        } else {
            healthDiv.classList.remove('hud-pulse-fast');
        }

        if (playerState.health < playerState.maxHealth) {
            healthDiv.style.animation = 'none';
            setTimeout(() => {
                healthDiv.style.animation = 'pulse 2s ease-in-out';
            }, 10);
        }
    }
}

export function updateDistanceDisplay(
    playerState: { distanceToMoon: number },
    player: THREE.Group | null
) {
    const distanceDiv = document.getElementById('distance-display');
    if (distanceDiv && player) {
        const distance = Math.max(0, Math.floor(playerState.distanceToMoon - player.position.x));
        distanceDiv.innerHTML = `Distance to Moon: ${distance}m`;
    }
}

export function gameOver() {
    const gameOverDiv = document.createElement('div');
    gameOverDiv.style.position = 'absolute';
    gameOverDiv.style.top = '0';
    gameOverDiv.style.left = '0';
    gameOverDiv.style.width = '100%';
    gameOverDiv.style.height = '100%';
    gameOverDiv.style.display = 'flex';
    gameOverDiv.style.flexDirection = 'column';
    gameOverDiv.style.justifyContent = 'center';
    gameOverDiv.style.alignItems = 'center';
    gameOverDiv.style.background = 'rgba(26, 26, 46, 0.95)';
    gameOverDiv.style.zIndex = '200';
    gameOverDiv.innerHTML = `
        <h1 style="color: #e94560; font-size: 4em; margin: 0; text-shadow: 0 0 30px rgba(233, 69, 96, 0.5); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">GAME OVER</h1>
        <p style="color: #888; font-size: 1.5em; margin-top: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Your ship was destroyed!</p>
        <button onclick="location.reload()" style="margin-top: 30px; padding: 15px 40px; font-size: 1.2em; background: #e94560; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; box-shadow: 0 4px 0 #b83650;">Retry</button>
    `;
    document.body.appendChild(gameOverDiv);
}

export function gameWin() {
    const winDiv = document.createElement('div');
    winDiv.style.position = 'absolute';
    winDiv.style.top = '0';
    winDiv.style.left = '0';
    winDiv.style.width = '100%';
    winDiv.style.height = '100%';
    winDiv.style.display = 'flex';
    winDiv.style.flexDirection = 'column';
    winDiv.style.justifyContent = 'center';
    winDiv.style.alignItems = 'center';
    winDiv.style.background = 'rgba(26, 26, 46, 0.95)';
    winDiv.style.zIndex = '200';
    winDiv.innerHTML = `
        <h1 style="color: #4488ff; font-size: 4em; margin: 0; text-shadow: 0 0 30px rgba(68, 136, 255, 0.8); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">MISSION SUCCESS!</h1>
        <p style="color: #888; font-size: 1.5em; margin-top: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">You reached the moon!</p>
        <button onclick="location.reload()" style="margin-top: 30px; padding: 15px 40px; font-size: 1.2em; background: #4488ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; box-shadow: 0 4px 0 #3366cc;">Play Again</button>
    `;
    document.body.appendChild(winDiv);
}

type ControlOptions = {
    getPlayer: () => THREE.Group | null;
    weaponSystem: { fire: (position: THREE.Vector3, direction: THREE.Vector3) => void };
    reEntrySystem: { active: boolean; activate: () => void; deactivate: () => void };
};

export function setupKeyboardControls(options: ControlOptions) {
    const onKeyDown = (event: KeyboardEvent) => {
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
            case 'Enter':
            case 'KeyK': {
                const player = options.getPlayer();
                if (player) {
                    options.weaponSystem.fire(player.position, new THREE.Vector3(1, 0, 0));
                }
                break;
            }
            case 'KeyH':
                if (options.reEntrySystem.active) {
                    options.reEntrySystem.deactivate();
                    console.log("Heat Effect OFF");
                } else {
                    options.reEntrySystem.activate();
                    console.log("Heat Effect ON");
                }
                break;
        }
    };

    const onKeyUp = (event: KeyboardEvent) => {
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
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}
