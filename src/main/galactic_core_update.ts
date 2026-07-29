/**
 * Galactic Core gameplay hooks: mild projectile lensing plus a low rumble as
 * the finale approach peaks. The backdrop itself is driven by LevelManager.
 */

import * as THREE from 'three';
import { game } from '../game_runtime';
import { ShakeType } from '../juice_effects';

const pullVec = new THREE.Vector3();

export function updateGalacticCoreEffects(delta: number): void {
    const core = game.galacticCoreSystem;
    if (!core?.active) return;

    // Plasma bolts bend toward the singularity when they fly near it.
    const projectiles = game.weaponSystem.getActiveProjectiles();
    for (const proj of projectiles) {
        if (!proj.active) continue;
        core.getProjectilePull(proj.mesh.position, delta, pullVec);
        if (pullVec.lengthSq() > 0) proj.velocity.add(pullVec);
    }

    // Deep in the approach, the ship trembles in the core's gravity well.
    const approach = core.getApproachIntensity();
    if (approach > 0.7 && Math.random() < delta * (approach - 0.7) * 3) {
        game.juiceManager.shakeScreen(ShakeType.LIGHT, 0.1);
    }
}
