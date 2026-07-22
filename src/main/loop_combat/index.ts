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

    if (player) {
        updateCombatPickups(delta, time);
        updateCombatPowerups(delta);

        game.victorySystem.update(delta);
        game.tutorialSystem.update(delta);

        maybeSpawnRandomOrb();
        updateCombatFriends(delta);

        game.dogController.update(delta, playerState);
    }

    updateMoonGateSequence(delta);

    game.hudManager.update(delta);

    if (game.debugSystem.isEnabled('particles')) {
        game.particleSystem.update(delta);
    }
    if (game.debugSystem.isEnabled('debris')) {
        game.debrisSystem.update(delta);
    }

    updateCombatWeapons(delta);

    return false;
}
