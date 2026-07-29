import * as THREE from 'three';
import { player } from '../../player_loader';
import { playerState } from '../../game_config';
import { game } from '../../game_runtime';
import { PowerUpType } from '../../powerup_manager';
import { MagicalEffectType } from '../../magical_effects';

function applyAsteroidsToCandy(playerPos: THREE.Vector3, radius: number): void {
    const obstacles = game.obstacleSystem.getObstacles();
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        const obsRadius = obs.userData.radius || 1.0;
        if (obsRadius >= 1.2 || playerPos.distanceTo(obs.position) >= radius) continue;

        const pastelColors = [0xffb6c1, 0xffc0cb, 0xe6e6fa, 0xb0e0e6, 0x98fb98];
        const candyColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
        (obs.material as THREE.MeshStandardMaterial).color.setHex(candyColor);
        (obs.material as THREE.MeshStandardMaterial).emissive.setHex(candyColor);
        (obs.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
        obs.userData.isCandy = true;

        game.particleSystem.emit(obs.position.clone(), candyColor, 5, 3.0, 0.4, 0.6);
        game.particleSystem.emit(obs.position.clone(), 0xffffff, 3, 2.0, 0.3, 0.4);

        if (obsRadius < 0.6 && Math.random() < 0.05) {
            game.particleSystem.emit(obs.position.clone(), candyColor, 10, 4.0, 0.6, 1.0);
            game.obstacleSystem.splitAsteroid(obs);
            game.audioSystem.playMagicSound('happy');
        }
    }
}

function applyAutoCollect(playerPos: THREE.Vector3, radius: number): void {
    const orbCollectibles = game.orbManager.getActiveOrbs();
    for (const orb of orbCollectibles) {
        if (orb.collected) continue;
        const dist = playerPos.distanceTo(orb.position);
        if (dist >= radius) continue;

        const pullDir = playerPos.clone().sub(orb.position).normalize();
        const pullStrength = radius >= 20 ? 0.05 : 0.08;
        orb.position.addScaledVector(pullDir, dist * pullStrength);
        orb.mesh.position.copy(orb.position);

        if (dist < 2) {
            orb.collected = true;
            orb.mesh.visible = false;
            game.boostSystem.addCharge(1);
            game.audioSystem.playCollect();
            game.juiceManager.burstCollect(orb.position.clone());
            const scoreMult = game.powerUpManager.getCombinedModifiers().doubleValue ? 2 : 1;
            game.hudManager.addScore(Math.floor(orb.points * 1.15 * scoreMult));
        }
    }
}

function applyMagnetPull(playerPos: THREE.Vector3, radius: number): void {
    const orbCollectibles = game.orbManager.getActiveOrbs();
    for (const orb of orbCollectibles) {
        if (orb.collected) continue;
        const dist = playerPos.distanceTo(orb.position);
        if (dist >= radius) continue;

        const pullDir = playerPos.clone().sub(orb.position).normalize();
        orb.position.addScaledVector(pullDir, Math.min(dist * 0.12, 2.5));
        orb.mesh.position.copy(orb.position);
    }
}

function applyCandyVortex(playerPos: THREE.Vector3, delta: number): void {
    const obstacles = game.obstacleSystem.getObstacles();
    for (const obs of obstacles) {
        const dist = playerPos.distanceTo(obs.position);
        if (dist > 18) continue;

        const pullDir = playerPos.clone().sub(obs.position).normalize();
        obs.position.addScaledVector(pullDir, (18 - dist) * 0.04 * delta * 60);

        if (dist < 6) {
            const pastelColors = [0xff6b6b, 0xffffff, 0x00ff00];
            const color = pastelColors[Math.floor(Math.random() * pastelColors.length)];
            game.particleSystem.emit(obs.position.clone(), color, 6, 4.0, 0.5, 0.5);
            if (dist < 3 && (obs.userData.radius || 1) < 1.0) {
                game.obstacleSystem.splitAsteroid(obs);
                game.audioSystem.play('boing', 0.5);
            }
        }
    }
}

/** Power-ups, modifier gameplay, magical effects. */
export function updateCombatPowerups(delta: number): void {
    if (!player) return;

    game.powerUpManager.update(delta, player.position);

    const modifiers = game.powerUpManager.getCombinedModifiers();
    const playerPos = player.position;

    if (modifiers.invincible) {
        playerState.invincible = true;
    }

    if (modifiers.autoCollectRadius > 0) {
        applyAutoCollect(playerPos, modifiers.autoCollectRadius);
    }

    if (modifiers.magnetRadius > 0) {
        applyMagnetPull(playerPos, modifiers.magnetRadius);
    }

    if (modifiers.asteroidsToCandy) {
        const candyRadius = game.powerUpManager.hasPowerUp(PowerUpType.CANDY_CANE_VORTEX) ? 30 : 25;
        applyAsteroidsToCandy(playerPos, candyRadius);
    }

    if (game.powerUpManager.hasPowerUp(PowerUpType.CANDY_CANE_VORTEX)) {
        applyCandyVortex(playerPos, delta);
    }

    if (game.powerUpManager.hasPowerUp(PowerUpType.MAGIC_PAINTBRUSH)) {
        game.magicPaintbrushSystem.update(delta, playerPos);
    }

    const rainbowEffect = game.powerUpManager.activeEffects.get(PowerUpType.RAINBOW_COMET_TAIL);
    const rainbowTimeRemaining = rainbowEffect?.isActive ? rainbowEffect.timeRemaining : 0;
    if (rainbowTimeRemaining > 0 && rainbowTimeRemaining < 1.0) {
        const fadeRatio = rainbowTimeRemaining;
        const rocket = player.children[0];
        if (rocket) {
            rocket.traverse((child: THREE.Object3D) => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh && mesh.material && 'emissiveIntensity' in (mesh.material as THREE.MeshStandardMaterial)) {
                    (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity *= fadeRatio;
                }
            });
        }
    }

    game.effectManager.update(delta);

    const isMagicActive = game.effectManager.hasEffect(MagicalEffectType.RAINBOW_TRAIL) ||
                          game.effectManager.hasEffect(MagicalEffectType.HEART_BUBBLE);
    game.levelManager.setMagicActive(isMagicActive);
}
