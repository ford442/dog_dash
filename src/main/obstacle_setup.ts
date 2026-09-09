import * as THREE from 'three';
import { scene } from '../scene_context';
import { player } from '../player_loader';
import { playerState } from '../game_config';
import { game, type GameContext } from '../game_runtime';
import { ObstacleSystem } from '../obstacle_system';
import { createGrazeHandler } from '../obstacle_system/graze_feedback';
import type { AudioPort, HudPort, JuicePort } from '../ports';
import { updateHealthDisplay } from '../ui_controls';
import { CANDY_FLAVOR_COLORS } from '../candy_materials';
import type { CandyAsteroidVariant, CandyFlavor } from '../candy_materials';
import { sporeClouds } from '../environment';
import { ShakeType } from '../juice_effects';
import { DogAnimationState } from '../dog_cockpit';
import { saveLastRunSummary } from '../run_seed/save_last_run';

export function handleGameOver(): void {
    saveLastRunSummary();
    if (player) {
        game.dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
        game.juiceManager.burstDamage(player.position.clone());
    }
    game.hudManager.updateHealth(0, playerState.maxHealth);
    game.hudManager.showGameOverScreen({
        score: game.hudManager.getScore(),
        distance: player ? Math.floor(player.position.x) : 0,
        orbsCollected: playerState.cores,
        powerUpsUsed: 0
    }, () => location.reload());
}

export function createObstacleSystem(systems: {
    particleSystem: GameContext['particleSystem'];
    debrisSystem: GameContext['debrisSystem'];
    waterfallSystem: GameContext['waterfallSystem'];
    audioSystem: AudioPort;
    hudManager: HudPort;
    juiceManager: JuicePort;
}): ObstacleSystem {
    return new ObstacleSystem({
        scene,
        getPlayer: () => player,
        getCurrentConfig: () => {
            const cfg = game.levelManager.config[game.levelManager.currentLevel];
            if (!cfg) return cfg;
            if (!game.levelManager.fastLaneActive) return cfg;
            const overrideRate = (cfg.environments?.asteroidField?.rate ?? 0) * 2.5;
            return {
                ...cfg,
                environments: {
                    ...cfg.environments,
                    asteroidField: overrideRate > 0 ? { rate: overrideRate } : undefined
                },
                mineRobotRate: 0,
                barnaclePodRate: 0
            };
        },
        playerState,
        getWasm: () => ({ exports: game.wasmExports, memory: game.wasmMemory }),
        setWasmMemory: (memory) => { game.wasmMemory = memory; },
        sporeClouds,
        particleSystem: systems.particleSystem,
        debrisSystem: systems.debrisSystem,
        waterfallSystem: systems.waterfallSystem,
        getCurrentLevel: () => game.levelManager.currentLevel,
        updateHealthDisplay: () => updateHealthDisplay(playerState),
        gameOver: handleGameOver,
        onPlayerHit: () => {
            game.lastPlayerDamageTime = performance.now() * 0.001;
            if (player) {
                game.dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
                game.juiceManager.shakeScreen(ShakeType.HEAVY);
                game.juiceManager.burstDamage(player.position.clone());
            }
            game.hudManager.updateHealth(playerState.health, playerState.maxHealth);
            game.audioSystem.playImpact(playerState.currentSpeedY);
            game.slingComboManager.resetCombo();
        },
        getPowerUpModifiers: () => game.powerUpManager.getCombinedModifiers(),
        onAsteroidBounce: (asteroid) => {
            game.audioSystem.playBoing();
            game.powerUpManager.triggerShieldBounce();
            game.juiceManager.showFloatingText('Boing!', asteroid.position, '#ff69b4', 28);
            game.juiceManager.shakeScreen(ShakeType.LIGHT, 0.15);
        },
        onGraze: createGrazeHandler({
            ports: {
                audio: systems.audioSystem,
                hud: systems.hudManager,
                juice: systems.juiceManager,
            },
            getPlayerPosition: () => player?.position,
            onFirstGraze: (position) => {
                game.friendsManager.cheerFlotilla(position);
            },
        }),
        tryConsumeWrenchCharge: () => {
            if (game.wrenchChargeAvailable) {
                game.wrenchChargeAvailable = false;
                return true;
            }
            return false;
        },
        tryConsumeButterflyCharge: () => game.powerUpManager.consumeButterflyCharge(),
        onButterflySave: (hitPos) => {
            game.juiceManager.showFloatingText('Butterfly shield!', hitPos.clone(), '#ffb6e6', 22);
            game.juiceManager.spawnSparkles(hitPos.clone(), new THREE.Color(0xffb6c1), 8);
            game.audioSystem.play('twinkle', 0.5);
        },
        tryConsumeSwarmEscort: (hitPos, hitRadius) =>
            game.butterflySwarmSystem.tryAbsorbHit(hitPos, hitRadius),
        onWrenchSave: (asteroid) => {
            game.juiceManager.showFloatingText('Wrench Save!', asteroid.position.clone(), '#ffaa66', 24);
            game.audioSystem.playBoing();
        },
        onMineRobotProximity: () => {
            game.creatureCatalogManager.catalog('mine_robot');
        },
        onCandyAsteroidSplit: (asteroid, bonusScore) => {
            game.hudManager.addScore(bonusScore);
            const flavor = asteroid.userData.candyFlavor as CandyFlavor;
            const variant = asteroid.userData.candyVariant as CandyAsteroidVariant;
            const label = variant === 'comet' ? 'Candy Comet!' : 'Gummy Pop!';
            const colorHex = CANDY_FLAVOR_COLORS[flavor]?.base ?? 0xff69b4;
            game.juiceManager.showFloatingText(
                `${label} +${bonusScore}`,
                asteroid.position.clone(),
                `#${colorHex.toString(16).padStart(6, '0')}`,
                24
            );
            game.audioSystem.playCollect();
        }
    });
}
