import * as THREE from 'three';
import { scene, camera, mainLight, renderer, touchControls } from '../scene_context';
import { player } from '../player_loader';
import { playerState, isGamePaused } from '../game_config';
import { game } from '../game_runtime';
import { DogAnimationState } from '../dog_cockpit';
import { ShakeType } from '../juice_effects';
import { PowerUpType } from '../powerup_manager';
import { MagicalEffectType } from '../magical_effects';
import { VictoryState } from '../victory_system';
import { FlotillaMember } from '../space_friends';
import { getCandySlingComboBonus, CANDY_FLAVOR_COLORS, updateCandyMaterialGlobals } from '../candy_materials';
import type { CandyAsteroidVariant, CandyFlavor } from '../candy_materials';
import { getLevelSpan } from '../depth_layers';
import {
    shouldSpawnStarlightKoi,
    shouldSpawnBubbleCoral,
    getBubbleCoralPlacement,
    resolveBubbleCoralClusterCount
} from '../level_spawn_rules';
import { animateFoliage, updateSolarSail } from '../foliage';
import { moonPlants } from '../visuals';
import { keys, updateHealthDisplay } from '../ui_controls';
import {
    sporeClouds, jellyMosses, solarSails, geodes, voidRootBalls, vacuumKelps,
    iceNeedleClusters, magmaHearts, gravityAnchors, liquidMetalBlobs, cleanupGeologicalObjects
} from '../environment';
import {
    damageGeode, updateGeode, updateNebulaJellyMoss, destroyNebulaJellyMoss,
    updateVoidRootBall, updateVacuumKelp, updateIceNeedleCluster, updateMagmaHeart,
    updateGravityAnchor, GA_SLING_BONUS
} from '../geological';

import { updatePlayer } from './player_update';
import { renderGameFrame, getCollisionDebugTargets, RESOLUTION_RATIOS } from './render_helpers';
import { updateGpuLeakDetector } from '../gpu_leak_detector';


export function updateLoopCore(rawDelta: number, delta: number, _time: number): boolean {
        // --- Sling Combo Manager ---
        game.slingComboManager.update(delta);
    
        // --- Debug System ---
        game.debugSystem.update(rawDelta);
        updateGpuLeakDetector(rawDelta);
        try {
            game.wireframeDebugHelper.update(scene, game.debugSystem.isEnabled('wireframe'));
            game.collisionDebugOverlay.update(
                game.debugSystem.isEnabled('collisionDebug'),
                getCollisionDebugTargets()
            );
        } catch (error) {
            if (!game.renderDebugWarningIssued) {
                game.renderDebugWarningIssued = true;
                console.warn('Renderer debug helpers skipped because a tracked object was malformed.', error);
            }
        }
    
        // --- FPS Tracking & Dynamic Pixel Ratio ---
        game.fpsFrameCount++;
        game.fpsElapsedTime += rawDelta;
        if (game.fpsElapsedTime >= 1.0) {
            const fps = game.fpsFrameCount / game.fpsElapsedTime;
            game.fpsFrameCount = 0;
            game.fpsElapsedTime = 0;
    
            if (fps < 45) {
                game.fpsLowDuration += 1.0;
                game.fpsHighDuration = 0;
                if (game.fpsLowDuration >= 3.0 && game.currentRatioIndex > 0) {
                    game.currentRatioIndex--;
                    game.currentPixelRatio = Math.min(2, window.devicePixelRatio * RESOLUTION_RATIOS[game.currentRatioIndex]);
                    renderer.setPixelRatio(game.currentPixelRatio);
                    console.log(`Performance low — dropping resolution to ${Math.round(RESOLUTION_RATIOS[game.currentRatioIndex] * 100)}%`);
                }
            } else if (fps > 55) {
                game.fpsHighDuration += 1.0;
                game.fpsLowDuration = 0;
                if (game.fpsHighDuration >= 5.0 && game.currentRatioIndex < RESOLUTION_RATIOS.length - 1) {
                    game.currentRatioIndex++;
                    game.currentPixelRatio = Math.min(2, window.devicePixelRatio * RESOLUTION_RATIOS[game.currentRatioIndex]);
                    renderer.setPixelRatio(game.currentPixelRatio);
                    console.log(`Performance recovered — restoring resolution to ${Math.round(RESOLUTION_RATIOS[game.currentRatioIndex] * 100)}%`);
                }
            } else {
                game.fpsLowDuration = 0;
                game.fpsHighDuration = 0;
            }
    
            if (fps < 45 && game.objectDensityMultiplier > 0.25) {
                game.objectDensityMultiplier = Math.max(0.25, game.objectDensityMultiplier - 0.25);
                game.levelManager.setObjectDensityMultiplier(game.objectDensityMultiplier);
                console.log(`Performance low — reducing object density to ${Math.round(game.objectDensityMultiplier * 100)}%`);
            } else if (fps > 55 && game.objectDensityMultiplier < 1.0) {
                game.objectDensityMultiplier = Math.min(1.0, game.objectDensityMultiplier + 0.25);
                game.levelManager.setObjectDensityMultiplier(game.objectDensityMultiplier);
                console.log(`Performance recovered — restoring object density to ${Math.round(game.objectDensityMultiplier * 100)}%`);
            }
        }
    
        // --- Debug Shadow Toggle ---
        const shadowsOn = game.debugSystem.isEnabled('shadows');
        if (mainLight.castShadow !== shadowsOn) {
            mainLight.castShadow = shadowsOn;
            renderer.shadowMap.enabled = shadowsOn;
        }
        
        if (isGamePaused) {
            renderGameFrame();
            return true;
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
        game.obstacleSystem.update(delta);
    
        // Bestiary creatures: Crystal Tarsier Guardian, Living Geode Titan, etc.
        if (player) {
            const creatureResults = game.creatureManager.update(
                delta,
                player.position.x,
                player.position.y,
                game.levelManager.config[game.levelManager.currentLevel],
                game.weaponSystem.getActiveProjectiles(),
                game.levelManager.currentLevel
            );
            for (const result of creatureResults) {
                let cores = result.cores ?? 0;
                // Memory bonuses: cataloging a creature once grants small lasting perks
                if (result.type === 'geode_titan_flythrough' && cores > 0 && game.saveManager.hasMemory('geode_titan')) {
                    cores = Math.round(cores * 1.5);
                }
                if (result.type === 'moon_snail_blessing' && cores > 0 && game.saveManager.hasMemory('moon_snail')) {
                    cores += 8;
                }
                if (cores) {
                    game.saveManager.addCores(cores);
                }
                if (result.label) {
                    game.juiceManager.showFloatingText(result.label, result.position.clone(), '#aaffee', 24);
                }
                // Non-lethal, calm interactions catalog the creature for the bestiary
                if (result.type === 'tarsier_guardian_blessing') {
                    game.creatureCatalogManager.catalog('tarsier');
                } else if (result.type === 'geode_titan_flythrough') {
                    game.creatureCatalogManager.catalog('geode_titan');
                } else if (result.type === 'moon_snail_blessing') {
                    game.creatureCatalogManager.catalog('moon_snail');
                    if (result.blessingPowerUp) {
                        game.powerUpManager.activatePowerUp(result.blessingPowerUp);
                    }
                } else if (result.type === 'puff_puffer_catalog') {
                    game.creatureCatalogManager.catalog('nebula_puffer');
                    const pufferMemory = game.saveManager.hasMemory('nebula_puffer');
                    const grazeDuration = (result.grazeWindowDuration ?? 8) + (pufferMemory ? 4 : 0);
                    const grazeBonus = (result.grazeWindowBonus ?? 0.55) + (pufferMemory ? 0.25 : 0);
                    game.obstacleSystem.applyGrazeWindowBonus(grazeDuration, grazeBonus);
                }
                if (result.score) {
                    game.hudManager.addScore(result.score);
                    if (result.label && result.type === 'puff_puffer_bubble_pop') {
                        game.juiceManager.showFloatingText(result.label, result.position.clone(), '#aaddff', 18);
                    }
                }
                if (result.type === 'tarsier_guardian_blessing' || result.type === 'geode_titan_flythrough' || result.type === 'puff_puffer_catalog' || result.type === 'moon_snail_blessing') {
                    game.juiceManager.burstMagic(result.position.clone());
                    game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
                } else if (result.type === 'moon_snail_bump') {
                    if (result.playerNudge) {
                        playerState.currentSpeedY += result.playerNudge.y ?? 0;
                        playerState.autoScrollSpeed = Math.max(6, playerState.autoScrollSpeed + (result.playerNudge.x ?? 0) * 0.15);
                    }
                    game.juiceManager.shakeScreen(ShakeType.LIGHT, 0.06);
                } else if (result.type === 'puff_puffer_bubble_pop') {
                    game.juiceManager.shakeScreen(ShakeType.LIGHT, 0.08);
                } else {
                    game.juiceManager.shakeScreen(ShakeType.LIGHT, 0.15);
                }
            }
        }
    
        game.slingableObjectSystem.update(delta, camera.position.x, player?.position);
        game.slingableObjectSystem.handleAsteroidCollisions(
            game.obstacleSystem.getObstacles(),
            (asteroid) => {
                if (asteroid.userData.isCandyAsteroid) {
                    game.obstacleSystem.triggerCandySquash(asteroid, 1.5);
                    const variant = asteroid.userData.candyVariant as CandyAsteroidVariant;
                    game.slingComboManager.recordSlingAction(
                        'good',
                        asteroid.position.clone(),
                        getCandySlingComboBonus(variant)
                    );
                }
                game.audioSystem.play('explode');
                game.pickupManager.trySpawn(asteroid.position.clone());
                game.obstacleSystem.splitAsteroid(asteroid);
            },
            (position, heavyHit) => {
                if (heavyHit) {
                    game.juiceManager.shakeScreen(ShakeType.MEDIUM, 0.18);
                }
                game.particleSystem.emit(position.clone(), 0xffffff, 4, 3.5, 0.5, 0.6);
            }
        );
    
        // Update graze combo HUD visibility
        if (game.obstacleSystem.getGrazeCombo() === 0) {
            game.hudManager.hideGrazeCombo();
        }

        return false;
}
