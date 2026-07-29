/**
 * Glitch Grenade — crafted consumable (see crafting_system.ts).
 * One tap (G key or the 💥 HUD counter) poofs every obstacle in a
 * kid-friendly blast a short distance ahead of the rocket.
 */

import { player } from '../player_loader';
import { game } from '../game_runtime';
import { ShakeType } from '../juice_effects';
import { blastObstacle } from './loop_combat/weapons';
import { updateGrenadeDisplay } from './hud_displays';

/** How far ahead of the player the blast is centered (world units). */
const BLAST_FORWARD = 12;
/** Blast radius (world units); obstacle radii are added on top. */
const BLAST_RADIUS = 15;

export function throwGrenade(): void {
    if (!player || game.grenadeAmmo <= 0) return;

    game.grenadeAmmo--;
    updateGrenadeDisplay();

    const center = player.position.clone();
    center.x += BLAST_FORWARD;

    // Collect targets first — destruction mutates the obstacle list.
    const targets = game.obstacleSystem.getObstacles().filter(obs =>
        obs.position.distanceTo(center) < BLAST_RADIUS + (obs.userData.radius || 1.0)
    );
    for (const obs of targets) {
        blastObstacle(obs);
    }

    game.particleSystem.emit(center, 0xff66ff, 40, 8.0, 1.2, 2.0);
    game.audioSystem.play('explode');
    game.juiceManager.shakeScreen(ShakeType.MEDIUM, 0.3);
    if (targets.length > 0) {
        game.juiceManager.showFloatingText(`BOOM! ×${targets.length}`, center, '#ff88ff', 30);
    }
}
