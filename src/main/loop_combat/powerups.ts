import * as THREE from 'three';
import { player } from '../../player_loader';
import { game } from '../../game_runtime';
import { PowerUpType } from '../../powerup_manager';
import { MagicalEffectType } from '../../magical_effects';

/** Power-ups, rainbow comet gameplay, magical effects → nebula. */
export function updateCombatPowerups(delta: number): void {
    if (!player) return;

    game.powerUpManager.update(delta);

    const hasRainbowComet = game.powerUpManager.hasPowerUp(PowerUpType.RAINBOW_COMET_TAIL);
    const rainbowEffect = game.powerUpManager.activeEffects.get(PowerUpType.RAINBOW_COMET_TAIL);
    const rainbowTimeRemaining = rainbowEffect ? rainbowEffect.timeRemaining : 0;

    if (hasRainbowComet && player) {
        const orbCollectibles = game.orbManager.getActiveOrbs();
        for (const orb of orbCollectibles) {
            if (orb.collected) continue;
            const dist = player.position.distanceTo(orb.position);
            if (dist < 45) {
                const pullDir = player.position.clone().sub(orb.position).normalize();
                orb.position.addScaledVector(pullDir, dist * 0.05);
                orb.mesh.position.copy(orb.position);
                if (dist < 2) {
                    orb.collected = true;
                    orb.mesh.visible = false;
                    game.boostSystem.addCharge(1);
                    game.audioSystem.playCollect();
                    game.juiceManager.burstCollect(orb.position.clone());
                    game.hudManager.addScore(Math.floor(orb.points * 1.15));
                }
            }
        }

        const obstacles = game.obstacleSystem.getObstacles();
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            const radius = obs.userData.radius || 1.0;
            if (radius < 1.2 && player.position.distanceTo(obs.position) < 25) {
                const pastelColors = [0xffb6c1, 0xffc0cb, 0xe6e6fa, 0xb0e0e6, 0x98fb98];
                const candyColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
                (obs.material as THREE.MeshStandardMaterial).color.setHex(candyColor);
                (obs.material as THREE.MeshStandardMaterial).emissive.setHex(candyColor);
                (obs.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
                obs.userData.isCandy = true;

                game.particleSystem.emit(obs.position.clone(), candyColor, 5, 3.0, 0.4, 0.6);
                game.particleSystem.emit(obs.position.clone(), 0xffffff, 3, 2.0, 0.3, 0.4);

                if (radius < 0.6 && Math.random() < 0.05) {
                    game.particleSystem.emit(obs.position.clone(), candyColor, 10, 4.0, 0.6, 1.0);
                    game.obstacleSystem.splitAsteroid(obs);
                    game.audioSystem.playMagicSound('happy');
                }
            }
        }
    }

    if (hasRainbowComet && rainbowTimeRemaining < 1.0 && rainbowTimeRemaining > 0) {
        const fadeRatio = rainbowTimeRemaining;
        if (player) {
            const rocket = player.children[0];
            if (rocket) {
                rocket.traverse((child: any) => {
                    if (child.isMesh && child.material && child.material.emissiveIntensity !== undefined) {
                        child.material.emissiveIntensity *= fadeRatio;
                    }
                });
            }
        }
    }

    if (game.debugSystem.isEnabled('magicalEffects')) {
        game.effectManager.update(delta);
    }

    const isMagicActive = game.effectManager.hasEffect(MagicalEffectType.RAINBOW_TRAIL) ||
                          game.effectManager.hasEffect(MagicalEffectType.HEART_BUBBLE);
    game.levelManager.setMagicActive(isMagicActive);
}
