import { player } from '../../player_loader';
import { playerState } from '../../game_config';
import { game } from '../../game_runtime';
import { updateCombatBoss, updateMoonGateSequence } from './boss';
import { updateCombatPickups, maybeSpawnRandomOrb } from './pickups';
import { updateCombatPowerups } from './powerups';
import { updateCombatFriends } from './friends';
import { updateCombatWeapons } from './weapons';

/**
 * Combat-phase loop: boss, pickups, power-ups, friends, weapons.
 * Returns true on mouth-snap game-over (early exit from animate).
 */
export function updateLoopCombat(_rawDelta: number, delta: number, time: number): boolean {
    if (updateCombatBoss(delta)) return true;

    let timeScale = game.powerUpManager.getCombinedModifiers().timeScale;
    if (player && game.levelManager.timeShiftZonesSystem) {
        timeScale *= game.levelManager.timeShiftZonesSystem.getTimeScaleModifier(player.position);
    }
    const scaledDelta = delta * timeScale;

    if (player) {
        updateCombatPickups(scaledDelta, time);
        updateCombatPowerups(scaledDelta);

        game.victorySystem.update(scaledDelta);
        game.tutorialSystem.update(scaledDelta);

        maybeSpawnRandomOrb();
        updateCombatFriends(scaledDelta);

        game.dogController.update(scaledDelta, playerState);
    }

    updateMoonGateSequence(scaledDelta);

    game.hudManager.update(scaledDelta);

    if (game.debugSystem.isEnabled('particles')) {
        game.particleSystem.update(scaledDelta);
    }
    if (game.debugSystem.isEnabled('debris')) {
        game.debrisSystem.update(scaledDelta);
    }

    updateCombatWeapons(scaledDelta);

    return false;
}
