import { player } from '../../player_loader';
import { playerState } from '../../game_config';
import { game } from '../../game_runtime';
import { updateHealthDisplay } from '../../ui_controls';
import { DogAnimationState } from '../../dog_cockpit';

/** Pickups → upgrades, heat, starfield, orb collection / random spawn. */
export function updateCombatPickups(delta: number, time: number): void {
    if (!player) return;

    const collected = game.pickupManager.update(delta, time, player.position);
    if (collected) {
        game.upgradeSystem.setPlayerGroup(player);
        game.upgradeSystem.activateUpgrade(collected);
    }

    game.upgradeSystem.update(delta, time);

    game.heatSystem.update(delta);

    const speedMultiplier = 1 + Math.abs(playerState.currentSpeedY) / 20;
    game.starfield.update(delta, speedMultiplier);

    game.orbManager.update(delta, time);
    const collectionResult = game.orbManager.checkCollection(
        player.position,
        game.friendsManager.hasFullFlotilla() ? 4.0 : 2.0
    );
    if (collectionResult.collected && player) {
        game.dogController.triggerAnimation(DogAnimationState.COLLECT, 0.5);
        game.juiceManager.burstCollect(player.position.clone());
        game.juiceManager.showScoreText(collectionResult.points || 10, player.position.clone());
        if (collectionResult.healthRestore) {
            playerState.health = Math.min(
                playerState.health + collectionResult.healthRestore,
                playerState.maxHealth
            );
            game.hudManager.updateHealth(playerState.health, playerState.maxHealth);
            updateHealthDisplay(playerState);
        }
        game.boostSystem.addCharge(1);
    }
}

/** Random orb spawns (runs after victory/tutorial, matching prior loop order). */
export function maybeSpawnRandomOrb(): void {
    if (!player) return;
    if (Math.random() < 0.02) {
        const spawnX = player.position.x + 40 + Math.random() * 20;
        const spawnY = (Math.random() - 0.5) * 12;
        game.orbManager.spawnRandomOrb(spawnX, spawnY);
    }
}
