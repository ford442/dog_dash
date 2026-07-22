import * as THREE from 'three';
import { scene, camera } from '../../scene_context';
import { player } from '../../player_loader';
import { playerState } from '../../game_config';
import { game } from '../../game_runtime';
import { DogAnimationState } from '../../dog_cockpit';
import { getLevelSpan } from '../../depth_layers';
import {
    shouldSpawnStarlightKoi,
    shouldSpawnBubbleCoral,
    getBubbleCoralPlacement,
    resolveBubbleCoralClusterCount
} from '../../level_spawn_rules';
import { gravityAnchors } from '../../environment';
import { FlotillaMember } from '../../space_friends';

/** Space friends, aquatic life, starlight koi, bubble coral. */
export function updateCombatFriends(delta: number): void {
    if (!player) return;

    if (game.debugSystem.isEnabled('spaceFriends')) {
        game.friendsManager.update(
            delta,
            player.position,
            game.weaponSystem.getActiveProjectiles(),
            new THREE.Vector3(playerState.autoScrollSpeed, playerState.currentSpeedY, 0)
        );
        game.friendsManager.maybeSpawnFriends(
            player.position.x,
            game.levelManager.config[game.levelManager.currentLevel]
        );
        game.friendsManager.cleanupFarFriends(player.position.x);
    }

    const currentLevelCfg = game.levelManager.config[game.levelManager.currentLevel];
    const isAquaEnv = !!currentLevelCfg?.environments?.aquaticLife;
    if (isAquaEnv) {
        if (game.aquaticLifeSpawnedLevel !== game.levelManager.currentLevel) {
            game.aquaticLifeManager.clear();
            game.aquaticLifeSpawnedLevel = game.levelManager.currentLevel;
            game.whaleSongTimer = 30;
            const cfgA = currentLevelCfg;
            game.aquaticLifeManager.spawnForLevel(player.position.x + 80, cfgA.distance - 200);

            const reefFriends = game.friendsManager.spawnTrappedFriendsAlong(
                player.position.x + 150,
                cfgA.distance - 400,
                3
            );
            for (const reefFriend of reefFriends) {
                game.aquaticLifeManager.spawnBubbleReef(reefFriend.position);
            }

            for (let s = 0; s < 5; s++) {
                const sx = player.position.x + 100 + Math.random() * (cfgA.distance - 300);
                const sy = (Math.random() - 0.5) * 16;
                game.friendsManager.spawnSealPup(sx, sy);
            }
        }

        const aquaEvents = game.aquaticLifeManager.update(delta, player.position);
        for (const ev of aquaEvents) {
            if (ev.type === 'jellyfish') {
                game.hudManager.addScore(15);
                game.juiceManager.showFloatingText('Jellyfish Drift! +15', ev.position.clone(), '#aaffee', 20);
                game.particleSystem.emit(ev.position.clone(), 0x66ffee, 10, 2.0, 1.0, 1.0);
                game.audioSystem.playGraze(1);
            } else if (ev.type === 'kelp') {
                game.hudManager.addScore(10);
                game.juiceManager.showFloatingText('Swimming!', ev.position.clone(), '#88ffaa', 18);
                game.particleSystem.emit(ev.position.clone(), 0x44cc88, 8, 3.0, 0.8, 0.8);
            } else if (ev.type === 'plankton') {
                game.juiceManager.burstMagic(ev.position.clone());
                game.particleSystem.emit(ev.position.clone(), 0x99ffee, 14, 2.5, 1.2, 0.8);
            }
        }
        game.aquaticLifeManager.cleanupFarBehind(player.position.x);

        game.whaleSongTimer -= delta;
        if (game.whaleSongTimer <= 0) {
            game.whaleSongTimer = 25 + Math.random() * 15;
            game.audioSystem.playWhaleSong();
        }
    } else if (game.aquaticLifeSpawnedLevel !== null) {
        game.aquaticLifeManager.clear();
        game.aquaticLifeSpawnedLevel = null;
    }

    const koiCfg = game.levelManager.config[game.levelManager.currentLevel];
    if (shouldSpawnStarlightKoi(koiCfg?.environments, koiCfg?.koiSchoolDensity)) {
        if (game.koiSpawnedLevel !== game.levelManager.currentLevel) {
            game.koiSpawnedLevel = game.levelManager.currentLevel;
            game.starlightKoiManager.activate();
            const koiSpan = getLevelSpan(game.levelManager.currentLevel);
            game.starlightKoiManager.spawnForLevel(
                koiSpan.startX + 60,
                koiSpan.length - 120,
                koiCfg!.koiSchoolDensity!
            );
        }
        if (game.debugSystem.isEnabled('starlightKoi')) {
            game.starlightKoiManager.update(delta, camera.position.x, player.position);
            game.starlightKoiManager.cleanupFarBehind(player.position.x);
        }
    } else if (game.koiSpawnedLevel !== null) {
        game.starlightKoiManager.deactivate();
        game.koiSpawnedLevel = null;
    }

    const coralCfg = game.levelManager.config[game.levelManager.currentLevel];
    if (shouldSpawnBubbleCoral(coralCfg?.environments, coralCfg?.bubbleCoralDensity)) {
        if (game.coralSpawnedLevel !== game.levelManager.currentLevel) {
            game.coralSpawnedLevel = game.levelManager.currentLevel;
            game.bubbleCoralManager.activate();
            const coralSpan = getLevelSpan(game.levelManager.currentLevel);
            const clusterCount = resolveBubbleCoralClusterCount(
                coralCfg!.bubbleCoralDensity!,
                coralCfg!.environments?.bubbleCoral
            );
            game.bubbleCoralManager.spawnForLevel(
                coralSpan.startX + 50,
                coralSpan.length - 100,
                clusterCount,
                getBubbleCoralPlacement(coralCfg!.environments, coralCfg!.levelType)
            );
        }
        if (game.debugSystem.isEnabled('bubbleCoral')) {
            game.bubbleCoralManager.update(delta, camera.position.x);
            game.bubbleCoralManager.cleanupFarBehind(player.position.x);
        }
    } else if (game.coralSpawnedLevel !== null) {
        game.bubbleCoralManager.deactivate();
        game.coralSpawnedLevel = null;
    }
}

/** Barnacle pod crack rewards (memory fragment / whale lice). */
export function onBarnacleOpened(obs: THREE.Object3D): void {
    if (obs.userData.type !== 'barnacle') return;

    if (obs.userData.hasMemoryFragment) {
        game.saveManager.addCores(25);
        game.juiceManager.showFloatingText('Memory Fragment! +25', obs.position.clone(), '#aaffee', 24);
    }
    if (obs.userData.hasWhaleLice) {
        const member = new FlotillaMember(scene, 0x88ffaa, game.friendsManager.flotilla.length);
        game.friendsManager.flotilla.push(member);
        game.juiceManager.showFloatingText('Whale Lice joined!', obs.position.clone(), '#88ffaa', 22);
        game.dogController.triggerAnimation(DogAnimationState.DELIGHTED, 1.5);
    }
}

/** Tarsiers/lemurs panic when a projectile passes near a gravity anchor. */
export function updateProjectileAnchorPanic(
    projectiles: Array<{ active: boolean; mesh: THREE.Object3D }>
): void {
    if (!game.debugSystem.isEnabled('spaceFriends') || gravityAnchors.length === 0) return;

    for (const proj of projectiles) {
        if (!proj.active) continue;
        for (const anchor of gravityAnchors) {
            if (proj.mesh.position.distanceTo(anchor.position) < 22) {
                game.friendsManager.panicTarsiersNear(anchor.position);
                game.friendsManager.panicLemursNear(anchor.position);
                if (game.dogController.getCurrentState() === DogAnimationState.IDLE) {
                    game.dogController.triggerAnimation(DogAnimationState.CURIOUS, 1.2);
                }
                break;
            }
        }
    }
}
