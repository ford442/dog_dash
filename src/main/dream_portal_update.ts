/**
 * Dream Portal orchestration: binds the `DreamPortalSystem` to the game context
 * (orbs, cores, score, juice, audio) and drives it from the main loop.
 *
 * The system itself owns no game singletons — everything it needs arrives
 * through {@link createDreamPortalCallbacks}, which is also what the deferred
 * loader uses when it constructs the system for a level that declares
 * `environments.dreamPortals`.
 */

import * as THREE from 'three';
import { camera } from '../scene_context';
import { player } from '../player_loader';
import { playerState, DREAM_ROOM_Y } from '../game_config';
import { game } from '../game_runtime';
import { ShakeType } from '../juice_effects';
import { DogAnimationState } from '../dog_cockpit';
import { VictoryState } from '../victory_system';
import type { DreamPortalCallbacks } from '../dream_portal';
import type { PlayerMotionPort } from '../ports';
import type { LevelConfig } from '../level_config';

/** Anything above this Y belongs to the bonus pocket, never the main run. */
const POCKET_Y_FLOOR = DREAM_ROOM_Y - 500;

function clearPocketOrbs(): void {
    game.orbManager.cleanupOrbsAboveY(POCKET_Y_FLOOR);
}

export function createDreamPortalCallbacks(): DreamPortalCallbacks {
    const motion: PlayerMotionPort = {
        getScrollSpeed: () => playerState.autoScrollSpeed,
        setScrollSpeed: (speed) => {
            playerState.autoScrollSpeed = speed;
            playerState.currentSpeedY = 0;
        },
        setWorldOriginY: (y) => {
            playerState.worldOriginY = y;
        },
        nudgePlayer: (dx, dy) => {
            playerState.currentSpeedY += dy;
            if (player) player.position.x += dx * 0.08;
        },
    };

    return {
        getPlayer: () => player,
        motion,
        snapCamera: (y) => {
            // Skip the follow lerp — otherwise the camera crawls across the gap.
            camera.position.y = y + 2;
        },
        spawnOrb: (x, y, z) => {
            game.orbManager.spawnStarOrb(x, y, z);
        },

        onEnter: (portalPosition) => {
            clearPocketOrbs();
            game.juiceManager.flashRainbow(0.6);
            game.juiceManager.burstMagic(portalPosition.clone());
            game.juiceManager.showFloatingText('Dream Door!', portalPosition.clone(), '#ffc8f0', 28);
            game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.4);
            game.audioSystem.playMagicSequence('power_up');
        },

        onToyCollected: (position, score) => {
            game.hudManager.addScore(score);
            playerState.cores += 2;
            game.saveManager.addCores(2);
            game.juiceManager.spawnSparkles(position, new THREE.Color(0xffe9a8), 8);
            game.audioSystem.playCollect();
        },

        onBumper: (position) => {
            game.juiceManager.shakeScreen(ShakeType.LIGHT, 0.12);
            game.juiceManager.spawnSparkles(position, new THREE.Color(0xaa88ff), 6);
            game.audioSystem.play('sparkle', 0.35);
        },

        onExit: (reward, exitPosition) => {
            clearPocketOrbs();

            playerState.cores += reward.cores;
            game.saveManager.addCores(reward.cores);
            game.hudManager.addScore(reward.score);

            const label = reward.cleared
                ? `Dream Cleared! +${reward.cores} Cores`
                : `Sweet dreams! +${reward.cores} Cores`;
            const anchor = player?.position.clone() ?? exitPosition;
            game.juiceManager.showFloatingText(label, anchor, '#9fe8ff', 28);
            game.juiceManager.flashRainbow(0.8);
            game.juiceManager.burstMagic(anchor);
            game.dogController.triggerAnimation(DogAnimationState.VICTORY, 1.6);
            game.audioSystem.playMagicSequence('power_up');
            game.friendsManager.cheerFlotilla(anchor);
        }
    };
}

/** Per-level portal placement — mirrors `spawnGravLensCorridorsForLevel`. */
export function spawnDreamPortalsForLevel(cfg: LevelConfig): void {
    game.dreamPortalSystem.clear();

    const config = cfg.environments?.dreamPortals;
    if (!config?.enabled || !config.portals?.length) return;
    game.dreamPortalSystem.spawnPortals(config.portals);
}

/**
 * Frame hook. Portals stay dormant during boss fights and the victory approach
 * so a bonus room can never interrupt a scripted sequence.
 */
export function updateDreamPortals(delta: number, time: number): void {
    if (!player) return;
    const system = game.dreamPortalSystem;
    if (!system) return;

    if (!system.isActive()) {
        if (playerState.bossActive) return;
        if (game.victorySystem.getState() !== VictoryState.NONE) return;
        if (game.moonGateSequenceActive) return;
    }

    system.update(delta, time);
}
