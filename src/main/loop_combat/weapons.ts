import * as THREE from 'three';
import { camera } from '../../scene_context';
import { player } from '../../player_loader';
import { game } from '../../game_runtime';
import { CANDY_FLAVOR_COLORS, updateCandyMaterialGlobals } from '../../candy_materials';
import type { CandyFlavor } from '../../candy_materials';
import { updateCombatBossKraken } from './boss';
import { onBarnacleOpened, updateProjectileAnchorPanic } from './friends';

/** Weapons update, projectile↔obstacles/field/meteors, kraken + anchor panic. */
export function updateCombatWeapons(delta: number): void {
    if (!player) return;

    game.weaponSystem.update(delta, camera.position.x);
    game.weaponLightManager.update(game.weaponSystem.getActiveProjectiles());
    updateCandyMaterialGlobals({ weaponLights: game.weaponLightManager.storageNode });

    const projectiles = game.weaponSystem.getActiveProjectiles();
    if (projectiles.length === 0) return;

    const obstacles = game.obstacleSystem.getObstacles();
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        const obsRadius = obs.userData.radius || 1.0;

        for (const proj of projectiles) {
            if (!proj.active) continue;

            const dist = proj.mesh.position.distanceTo(obs.position);
            if (dist < obsRadius + 0.5) {
                if (obs.userData.isCandyAsteroid) {
                    const flavor = obs.userData.candyFlavor as CandyFlavor;
                    const sparkle = CANDY_FLAVOR_COLORS[flavor]?.sparkle ?? 0xffffff;
                    game.particleSystem.emit(obs.position, sparkle, 14, 5.5, 0.9, 1.2);
                    game.obstacleSystem.triggerCandySquash(obs as THREE.Mesh, 1.2);
                } else {
                    game.particleSystem.emit(obs.position, 0x00ffff, 10, 5.0, 1.0, 2.0);
                }

                game.audioSystem.play('explode');

                onBarnacleOpened(obs);

                game.pickupManager.trySpawn(obs.position.clone());

                game.obstacleSystem.splitAsteroid(obs as THREE.Mesh);

                proj.deactivate();
                break;
            }
        }
    }

    for (const proj of projectiles) {
        if (!proj.active) continue;
        const shotDir = new THREE.Vector3(1, 0, 0);
        if ((proj as any).velocity) {
            shotDir.copy((proj as any).velocity).normalize();
        }
        const hitAsteroid = game.asteroidFieldSystem.hitAsteroid(
            proj.mesh.position, game.particleSystem, camera.position, shotDir
        );
        const hitMeteor = game.meteorShowerSystem.hitMeteor(
            proj.mesh.position, game.particleSystem, camera.position, shotDir
        );
        if (hitAsteroid || hitMeteor) {
            game.audioSystem.play('explode');
        }
    }

    updateCombatBossKraken(projectiles);
    updateProjectileAnchorPanic(projectiles);
}
