import * as THREE from 'three';
import { canvas, camera, renderer } from '../scene_context';
import { player } from '../player_loader';
import { playerState, gameStarted, setGameStarted, setIsGamePaused, isGamePaused } from '../game_config';
import { game } from '../game_runtime';
import { sporeClouds } from '../environment';
import { PowerUpType } from '../powerup_manager';
import { createUI, setupKeyboardControls } from '../ui_controls';
import { createArchitectCodexUI } from '../architect_lore';
import {
    createHeatBar, createBoostDisplay, createRollDisplay,
    createBarkDisplay, createTetherDisplay, createCoresDisplay, createGrenadeDisplay
} from './hud_displays';
import { RESOLUTION_RATIOS } from './render_helpers';
import { ensureGameplayReady, ensureLevelSystemsForLevel } from '../level_systems_loader';
import { consumePendingStartChapter } from '../hub_pending_chapter';
import { consumePendingRunSeed, parseSeedFromUrl } from '../hub_pending_seed';
import { beginRun, createDefaultRunSeed, getRunRng, type RunSeed } from '../run_seed';
import { consumeEndlessSeedFromHash } from '../endless/seed';
import { CAMPAIGN_LAYOUT, getJourneyLayout, setJourneyLayout, type JourneyLayout } from '../journey_layout';
import { hasDebugUrlFlag } from '../renderer_mode';
import { biomeNoise } from '../biome_noise';
import { resetSimClock } from '../sim_clock';
import {
    ghostRunRecorder,
    ghostRunReplayer,
    loadGhostRecording,
    ghostMatchesSeed
} from '../ghost_run';
import { getLevelSpan } from '../depth_layers';
import { spawnDeferredPrototypeContent, spawnDeferredVideoStars } from './startup';
import { ensureBestiaryUi, prefetchMetaUi } from '../meta_ui_loader';
import { restartRun } from './restart_run';

async function beginGameplay(): Promise<void> {
    const endlessSeed = consumeEndlessSeedFromHash();
    const urlSeed = parseSeedFromUrl();
    const pendingSeed = consumePendingRunSeed();
    let seed = endlessSeed ?? urlSeed ?? pendingSeed ?? createDefaultRunSeed();

    // Endless is post-campaign: a shared #endless link on a save that has not
    // reached the Moon starts the campaign instead (?debug skips the check).
    if (seed.campaignId === 'endless' && !hasDebugUrlFlag('debug')) {
        const { endlessUnlockState } = await import('../endless/unlock');
        if (!endlessUnlockState(game.saveManager).unlocked) {
            console.warn('[endless] Endless Dash unlocks after the campaign; starting the campaign.');
            seed = createDefaultRunSeed();
        }
    }

    // An Architect course that fails its schema or budget never starts (fail
    // closed): say why on the HUD and fly the campaign instead.
    if (seed.campaignId === 'architect') {
        const { resolveArchitectRun } = await import('../architect/run');
        const resolved = resolveArchitectRun(seed);
        if (!resolved.ok) {
            console.warn(`[architect] ${resolved.reason} Starting the campaign.`);
            game.hudManager.showNotice(`🏗️ ${resolved.reason}`);
            seed = createDefaultRunSeed();
        }
    }

    // A hub "Go to chapter" request survives the reload via localStorage.
    const pending = consumePendingStartChapter();
    await startRun(seed, pending, { loadGhost: true });
}

/**
 * Seeds the run, loads the systems the first chapter needs and starts the
 * level. Shared by the title-screen click and the headless replay harness,
 * which passes its fixture seed and chapter directly (no URL, no hub
 * localStorage, no ghost overlay).
 */
export async function startRun(
    seed: RunSeed,
    requestedChapter: number | null,
    options: {
        loadGhost: boolean;
        /** Journey to fly instead of the one the seed implies (headless coverage runs). */
        layout?: JourneyLayout;
    }
): Promise<void> {
    // The journey this run flies: the campaign, the Endless chapter sequence
    // generated from the seed, or an Architect sandbox course (both
    // code-split; never loaded otherwise).
    if (options.layout) {
        setJourneyLayout(options.layout);
    } else if (seed.campaignId === 'endless') {
        const { createEndlessLayout } = await import('../endless/layout');
        setJourneyLayout(createEndlessLayout(seed.rngSeed));
    } else if (seed.campaignId === 'architect') {
        const { createArchitectRunLayout } = await import('../architect/run');
        setJourneyLayout(createArchitectRunLayout(seed));
    } else {
        setJourneyLayout(CAMPAIGN_LAYOUT);
    }
    const layout = getJourneyLayout();
    game.hudManager.setJourneyTicksVisible(layout.mode === 'campaign');

    await ensureGameplayReady();
    if (layout.mode !== 'campaign') await ensureLevelSystemsForLevel(layout.firstChapter);
    // Seed before the prototype set-pieces so their anchors, tarsiers and
    // slingables draw from the run streams. Awaited (not fire-and-forget) so
    // they exist before the first sim step on every machine.
    beginRun(seed);
    await spawnDeferredPrototypeContent();
    void spawnDeferredVideoStars();
    prefetchMetaUi();

    biomeNoise.bindRunSeed(seed.rngSeed);
    game.activeRunSeed = seed;
    game.runRng = getRunRng();
    resetSimClock();

    ghostRunRecorder.begin(seed);
    const prevGhost = options.loadGhost ? loadGhostRecording() : null;
    if (prevGhost && ghostMatchesSeed(prevGhost, seed)) {
        ghostRunReplayer.setRecording(prevGhost);
    } else {
        ghostRunReplayer.setRecording(null);
    }

    const startChapter = layout.mode !== 'campaign'
        ? layout.firstChapter
        : requestedChapter && game.saveManager.isLevelUnlocked(requestedChapter) ? requestedChapter : 1;
    ghostRunRecorder.setStartChapter(startChapter);
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
let paintbrushMouseDown = false;

function screenToWorldXY(clientX: number, clientY: number): THREE.Vector3 | null {
    if (!player) return null;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const target = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, target)) return null;
    target.z = player.position.z;
    return target;
}

let architectCodexUI: HTMLDivElement | null = null;

const instructions = document.getElementById('instructions');

export function setupInputBindings(): void {
    setupKeyboardControls({
        getPlayer: () => player,
        requestFire: () => { game.wantsFire = true; },
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
            createBarkDisplay();
            createTetherDisplay();
            createGrenadeDisplay(() => { game.wantsGrenade = true; });

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
                    restartRun
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
                void ensureBestiaryUi().then(({ createBestiaryUI }) => {
                    if (game.bestiaryUI) return;
                    game.bestiaryUI = createBestiaryUI(game.saveManager, () => {
                        game.bestiaryUI = null;
                        setIsGamePaused(false);
                    });
                    document.body.appendChild(game.bestiaryUI);
                });
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
        if (e.code === 'KeyP') {
            if (game.pixelGlowSystem) {
                game.pixelGlowSystem.toggle();
            }
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
            // Latched; loop_core throws it at the top of the next sim step.
            game.wantsGrenade = true;
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyB' && !e.repeat && gameStarted) {
            game.wantsBark = true;
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
        if (e.button === 0 && gameStarted && game.powerUpManager.hasPowerUp(PowerUpType.MAGIC_PAINTBRUSH)) {
            paintbrushMouseDown = true;
            game.magicPaintbrushSystem.setPainting(true);
            const pos = screenToWorldXY(e.clientX, e.clientY);
            if (pos) game.magicPaintbrushSystem.paintAt(pos);
            return;
        }
        if (e.button === 2 && gameStarted) {
            tetherMouseHeld = true;
            game.wantsTether = true;
        }
    });
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0 && paintbrushMouseDown) {
            paintbrushMouseDown = false;
            game.magicPaintbrushSystem.setPainting(false);
        }
        if (e.button === 2) {
            tetherMouseHeld = false;
            if (game.tetherSystem.isLatched()) game.wantsReleaseTether = true;
        }
    });
    window.addEventListener('mousemove', (e) => {
        if (!paintbrushMouseDown || !gameStarted) return;
        const pos = screenToWorldXY(e.clientX, e.clientY);
        if (pos) game.magicPaintbrushSystem.paintAt(pos);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
