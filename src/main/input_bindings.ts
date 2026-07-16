import * as THREE from 'three';
import { canvas, camera, renderer } from '../scene_context';
import { player } from '../player_loader';
import { playerState, gameStarted, setGameStarted, setIsGamePaused, isGamePaused } from '../game_config';
import { game } from '../game_runtime';
import { sporeClouds } from '../environment';
import { createUI, setupKeyboardControls } from '../ui_controls';
import { createBestiaryUI } from '../bestiary';
import {
    createHeatBar, createBoostDisplay, createRollDisplay,
    createTetherDisplay, createCoresDisplay
} from './hud_displays';
import { RESOLUTION_RATIOS } from './render_helpers';
import { ensureGameplayReady } from '../level_systems_loader';
import { spawnDeferredPrototypeContent, spawnDeferredVideoStars } from './startup';

async function beginGameplay(): Promise<void> {
    await ensureGameplayReady();
    void spawnDeferredPrototypeContent();
    void spawnDeferredVideoStars();
    game.levelManager.startLevel(1);
}

export let lastSpaceTapTime = 0;
export const DOUBLE_TAP_THRESHOLD = 300;
export let lastLeftTapTime = 0;
export let lastRightTapTime = 0;
export let tetherKeyHeld = false;
export let tetherMouseHeld = false;

const instructions = document.getElementById('instructions');

export function setupInputBindings(): void {
    setupKeyboardControls({
        getPlayer: () => player,
        weaponSystem: game.weaponSystem,
        reEntrySystem: game.reEntrySystem
    });

    if (instructions) {
        instructions.addEventListener('click', () => {
            instructions.style.display = 'none';
            createUI({
                getPlayer: () => player,
                playerState,
                startLevel: () => { void beginGameplay(); }
            });
            createHeatBar();
            createCoresDisplay();
            createBoostDisplay();
            createRollDisplay();
            createTetherDisplay();

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

        instructions.addEventListener('click', () => {
            setGameStarted(true);
        }, { once: true });
    }

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
            e.preventDefault();
            if (isGamePaused) {
                game.hudManager.hidePauseMenu();
                setIsGamePaused(false);
            } else {
                setIsGamePaused(true);
                game.hudManager.showPauseMenu(
                    () => { setIsGamePaused(false); },
                    () => { location.reload(); }
                );
            }
        }
        if (e.code === 'KeyM') {
            const muted = game.audioSystem.toggleMute();
            console.log(muted ? '🔇 Audio muted' : '🔊 Audio unmuted');
        }
        if (e.code === 'KeyL') {
            if (game.bestiaryUI) {
                game.bestiaryUI.remove();
                game.bestiaryUI = null;
                setIsGamePaused(false);
            } else {
                setIsGamePaused(true);
                game.bestiaryUI = createBestiaryUI(game.saveManager, () => {
                    game.bestiaryUI = null;
                    setIsGamePaused(false);
                });
                document.body.appendChild(game.bestiaryUI);
            }
        }
        if (e.code === 'KeyR') {
            game.currentRatioIndex = (game.currentRatioIndex + 1) % RESOLUTION_RATIOS.length;
            const next = RESOLUTION_RATIOS[game.currentRatioIndex];
            game.currentPixelRatio = Math.min(2, window.devicePixelRatio * next);
            renderer.setPixelRatio(game.currentPixelRatio);
            console.log(`🔧 Resolution set to ${Math.round(next * 100)}% (pixel ratio ${game.currentPixelRatio.toFixed(2)})`);
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            const now = performance.now();
            if (now - lastSpaceTapTime < DOUBLE_TAP_THRESHOLD) game.wantsBoost = true;
            lastSpaceTapTime = now;
        }
    });

    window.addEventListener('keydown', (e) => {
        const now = performance.now();
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
            if (now - lastLeftTapTime < DOUBLE_TAP_THRESHOLD) game.wantsRoll = true;
            lastLeftTapTime = now;
        }
        if (e.code === 'KeyD' || e.code === 'ArrowRight') {
            if (now - lastRightTapTime < DOUBLE_TAP_THRESHOLD) game.wantsRoll = true;
            lastRightTapTime = now;
        }
    });

    canvas.addEventListener('click', (event) => {
        if (!gameStarted) return;
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        sporeClouds.forEach(cloud => {
            if (!cloud.active) return;
            const intersects = raycaster.intersectObjects(cloud.spores, false);
            if (intersects.length > 0) {
                const hitPoint = intersects[0].point;
                const triggered = cloud.triggerChainReaction(hitPoint);
                if (triggered > 0) {
                    game.particleSystem.emit(hitPoint, 0x88ff88, 20, 8.0, 1.0, 2.0);
                }
            }
        });

        game.friendsManager.lanterns.forEach(lantern => {
            if (lantern.isPopped) return;
            const intersects = raycaster.intersectObject(lantern.group, true);
            if (intersects.length > 0) {
                game.friendsManager.popLantern(lantern);
                playerState.cores += 5;
            }
        });
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyT' && !e.repeat && gameStarted) {
            tetherKeyHeld = true;
            game.wantsTether = true;
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyT') {
            tetherKeyHeld = false;
            if (game.tetherSystem.isLatched()) game.wantsReleaseTether = true;
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 2 && gameStarted) {
            tetherMouseHeld = true;
            game.wantsTether = true;
        }
    });
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 2) {
            tetherMouseHeld = false;
            if (game.tetherSystem.isLatched()) game.wantsReleaseTether = true;
        }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
