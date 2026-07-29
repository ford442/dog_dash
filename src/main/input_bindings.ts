import * as THREE from 'three';
import { canvas, camera, renderer } from '../scene_context';
import { player } from '../player_loader';
import { playerState, gameStarted, setGameStarted, setIsGamePaused, isGamePaused } from '../game_config';
import { game } from '../game_runtime';
import { sporeClouds } from '../environment';
import { createUI, setupKeyboardControls } from '../ui_controls';
import { createBestiaryUI } from '../bestiary';
import { createArchitectCodexUI } from '../architect_lore';
import {
    createHeatBar, createBoostDisplay, createRollDisplay,
    createTetherDisplay, createCoresDisplay, createGrenadeDisplay
} from './hud_displays';
import { throwGrenade } from './grenade';
import { RESOLUTION_RATIOS } from './render_helpers';
import { ensureGameplayReady } from '../level_systems_loader';
import { consumePendingStartChapter } from '../hub_screen';
import { getLevelSpan } from '../depth_layers';
import { spawnDeferredPrototypeContent, spawnDeferredVideoStars } from './startup';

async function beginGameplay(): Promise<void> {
    await ensureGameplayReady();
    void spawnDeferredPrototypeContent();
    void spawnDeferredVideoStars();
    // A hub "Go to chapter" request survives the reload via localStorage.
    const pending = consumePendingStartChapter();
    const startChapter = pending && game.saveManager.isLevelUnlocked(pending) ? pending : 1;
    // The journey is one continuous run (player.x 0->5200), so launching a
    // later chapter means placing the rocket at that chapter's start X.
    if (startChapter > 1 && player) {
        player.position.x = getLevelSpan(startChapter).startX;
    }
    game.levelManager.startLevel(startChapter);
}

export let lastSpaceTapTime = 0;
export const DOUBLE_TAP_THRESHOLD = 300;
export let lastLeftTapTime = 0;
export let lastRightTapTime = 0;
export let tetherKeyHeld = false;
export let tetherMouseHeld = false;

let architectCodexUI: HTMLDivElement | null = null;

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
            createGrenadeDisplay(() => throwGrenade());

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
        if (e.code === 'KeyJ') {
            if (game.hudManager.isJourneyMapOpen()) {
                game.hudManager.hideJourneyMapOverlay();
                setIsGamePaused(false);
            } else {
                setIsGamePaused(true);
                game.hudManager.showJourneyMapOverlay('pause', {
                    onClose: () => setIsGamePaused(false)
                });
            }
        }
        if (e.code === 'KeyK') {
            if (architectCodexUI) {
                architectCodexUI.remove();
                architectCodexUI = null;
                setIsGamePaused(false);
            } else {
                setIsGamePaused(true);
                architectCodexUI = createArchitectCodexUI(game.saveManager, () => {
                    architectCodexUI = null;
                    setIsGamePaused(false);
                });
                document.body.appendChild(architectCodexUI);
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
            const intersects = raycaster.intersectObject(cloud.spores, false);
            if (intersects.length > 0) {
                const hitPoint = intersects[0].point;
                const triggered = cloud.triggerChainReaction(hitPoint);
                if (triggered > 0) {
                    game.particleSystem.emit(hitPoint, 0x88ff88, 20, 8.0, 1.0, 2.0);
                    game.resourceHarvester.harvest('sporeCloud', 'destroy', hitPoint);
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
        if (e.code === 'KeyG' && !e.repeat && gameStarted) {
            throwGrenade();
        }
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
