import { camera, touchControls } from '../scene_context';
import { player } from '../player_loader';
import { playerState } from '../game_config';
import { game } from '../game_runtime';
import { DogAnimationState } from '../dog_cockpit';
import { ShakeType } from '../juice_effects';
import { PowerUpType } from '../powerup_manager';
import { MagicalEffectType } from '../magical_effects';
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
import { ghostRunRecorder, buildActionFlags } from '../ghost_run';
import { updateChapterMusicDynamics } from './music_update';

/**
 * Gameplay-affecting portion of the "core" loop phase, run once per fixed
 * simulation step (see fixed_timestep.ts). Per-frame-only bookkeeping (FPS
 * tracking, dynamic resolution, debug toggles, the pause gate) lives in
 * frame_housekeeping.ts and runs once per rendered frame instead.
 */
export function updateLoopCore(delta: number, _time: number): void {
        // --- Sling Combo Manager ---
        game.slingComboManager.update(delta);

        updatePlayer(delta);

        if (player) {
            const touchInput = touchControls?.getInput();
            ghostRunRecorder.tick(
                delta,
                player.position.x,
                player.position.y,
                buildActionFlags({
                    wantsBoost: game.wantsBoost,
                    wantsRoll: game.wantsRoll,
                    wantsBark: game.wantsBark,
                    wantsTether: game.wantsTether,
                    wantsReleaseTether: game.wantsReleaseTether,
                    fire: touchInput?.fire ?? false
                })
            );
        }

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

        // Update Action UI (Boost & Dash)
        if (game.boostSystem && game.boostSystem.getMaxCharges() > 0) {
            const boostRatio = game.boostSystem.getCharges() / game.boostSystem.getMaxCharges();
            game.hudManager.updateBoost(boostRatio);
        }
        if (game.rollSystem) {
            game.hudManager.updateDash(game.rollSystem.canRoll(), game.rollSystem.getCooldownRatio());
        }

        // Feed speed / boost / danger / quiet into the chapter music mix.
        updateChapterMusicDynamics();
}
