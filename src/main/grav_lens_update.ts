/**
 * Per-frame grav-lens physics, HUD, juice, and sling-combo integration.
 */

import * as THREE from 'three';
import { player } from '../player_loader';
import { playerState } from '../game_config';
import { game } from '../game_runtime';
import { GravLensManager } from '../grav_lens';
import { ShakeType } from '../juice_effects';
import { DogAnimationState } from '../dog_cockpit';
import { updateHealthDisplay } from '../ui_controls';
import { handleGameOver } from './obstacle_setup';

export function updateGravLensSystems(delta: number): void {
    if (!player || game.gravLensManager.getLenses().length === 0) return;

    if (playerState.gravLensBoostTimer > 0) {
        playerState.gravLensBoostTimer = Math.max(0, playerState.gravLensBoostTimer - delta);
        if (playerState.gravLensBoostTimer <= 0) {
            playerState.gravLensBoostMultiplier = 1;
        }
    }

    const projectiles = game.weaponSystem.getActiveProjectiles();
    if (projectiles.length > 0) {
        game.gravLensManager.handleProjectileHits(projectiles, game.upgradeSystem.activeUpgrade, (position) => {
            game.juiceManager.showFloatingText('Detuned!', position, '#00ffff', 20);
            game.particleSystem.emit(position, 0x00ffff, 10, 3.0, 0.5);
        });
    }

    const result = game.gravLensManager.update(
        delta,
        {
            position: player.position,
            velocityX: playerState.autoScrollSpeed,
            velocityY: playerState.currentSpeedY,
            autoScrollSpeed: playerState.autoScrollSpeed,
            currentSpeedY: playerState.currentSpeedY,
            invincible: playerState.invincible,
            inSafeHarbor: playerState.inSafeHarbor
        },
        {
            onApproachAngle: (angleDeg, inRange) => {
                game.hudManager.updateGravLensApproach(angleDeg, inRange);
            },
            onCrushDamage: (amount, position) => {
                if (playerState.invincible || playerState.inSafeHarbor) return;
                playerState.health = Math.max(0, playerState.health - amount);
                playerState.invincible = true;
                setTimeout(() => { playerState.invincible = false; }, 800);
                game.lastPlayerDamageTime = performance.now() * 0.001;
                game.hudManager.updateHealth(playerState.health, playerState.maxHealth);
                updateHealthDisplay(playerState);
                game.dogController.triggerAnimation(DogAnimationState.HIT, 0.8);
                game.juiceManager.shakeScreen(ShakeType.HEAVY, 0.35);
                game.juiceManager.setGravLensDistortion(1);
                game.slingComboManager.resetCombo();
                game.audioSystem.playImpact(playerState.currentSpeedY);
                if (playerState.health <= 0) {
                    handleGameOver();
                }
            },
            onShatter: (position) => {
                game.juiceManager.flashWhite(0.15);
                game.juiceManager.shakeScreen(ShakeType.HEAVY, 0.5);
                game.particleSystem.emit(position, 0xffffff, 30, 5.0, 0.9);
                game.juiceManager.showFloatingText('Micro Singularity!', position, '#ffccff', 26);
            }
        }
    );

    for (const pos of result.failedExits) {
        game.hudManager.showGravLensGrade('failed', 0);
        game.juiceManager.showFloatingText('Crush approach!', pos, '#ff4466', 20);
    }

    for (const exit of result.slingshotExits) {
        const { grade, position, chain, boostMult, boostDuration } = exit;
        game.hudManager.showGravLensGrade(grade, chain);
        playerState.autoScrollSpeed = Math.min(playerState.autoScrollSpeed * boostMult, 28);
        playerState.currentSpeedY *= boostMult;
        playerState.gravLensBoostTimer = boostDuration;
        playerState.gravLensBoostMultiplier = boostMult;

        const quality = GravLensManager.slingQualityFromGrade(grade);
        const chainBonus = chain > 1 ? 1 + (chain - 1) * 0.25 : 1;
        game.slingComboManager.recordSlingAction(quality, position, chainBonus);
        game.slingObjectiveManager.recordSling(quality);
        game.reportComboObjectiveProgress();
        game.audioSystem.playGravitySlingRelease(quality, game.slingComboManager.getCombo());
        game.particleSystem.emit(position, grade === 'perfect' ? 0x44ffcc : 0xffaa44, 14, 4.0, 0.7);
        game.juiceManager.showFloatingText(
            grade === 'perfect' ? 'Grav Sling!' : 'Lens Boost',
            position,
            grade === 'perfect' ? '#44ffcc' : '#ffaa44',
            24
        );
        if (grade === 'perfect') {
            game.juiceManager.shakeScreen(ShakeType.MEDIUM, 0.25);
            game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.2);
        }
    }

    playerState.currentSpeedY += result.forceY;
    playerState.autoScrollSpeed = Math.min(
        Math.max(playerState.autoScrollSpeed + result.forceX, playerState.autoScrollSpeed * 0.98),
        30
    );
    player.position.x += result.forceX * 0.15;

    const crushIntensity = result.inCrushZone ? 0.85 : game.gravLensManager.isInInfluence() ? 0.12 : 0;
    game.juiceManager.setGravLensDistortion(crushIntensity);
}

export function spawnGravLensCorridorsForLevel(
    levelIndex: number,
    cfg: { gravLensCorridors?: { startX: number; lenses: { offsetX: number; y: number; z?: number }[] }[] }
): void {
    game.gravLensManager.clear();
    game.hudManager.hideGravLensHud();
    game.juiceManager.setGravLensDistortion(0);

    if (!cfg.gravLensCorridors?.length) return;
    for (const corridor of cfg.gravLensCorridors) {
        game.gravLensManager.spawnCorridor(corridor);
    }
}
