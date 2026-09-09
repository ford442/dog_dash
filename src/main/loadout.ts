/**
 * Applies the crafted loadout queued in SaveData (see crafting_system.ts).
 * Called once at boot after the GameContext is installed: each pending
 * recipe charge is consumed and its effect applied for this run only.
 */

import { GRENADES_PER_CRAFT } from '../crafting_constants';
import type { GameContext } from '../game_runtime';
import type { playerState } from '../game_config';

export function applyCraftedLoadout(game: GameContext, ps: typeof playerState): void {
    const loadout = game.saveManager.consumeLoadout();
    let applied = 0;

    const stellarFuel = loadout['stellarFuel'] ?? 0;
    if (stellarFuel > 0) {
        game.boostSystem.addMaxCharge(stellarFuel);
        game.boostSystem.extendDuration(1.2 * stellarFuel);
        applied += stellarFuel;
    }

    const grenades = loadout['glitchGrenade'] ?? 0;
    if (grenades > 0) {
        game.grenadeAmmo += grenades * GRENADES_PER_CRAFT;
        applied += grenades;
    }

    const hullPatch = loadout['hullPatch'] ?? 0;
    if (hullPatch > 0) {
        ps.maxHealth += hullPatch;
        ps.health += hullPatch;
        applied += hullPatch;
    }

    const magmaLance = loadout['magmaLance'] ?? 0;
    if (magmaLance > 0) {
        game.weaponDamageMult *= 1.5 ** magmaLance;
        applied += magmaLance;
    }

    const cryoRounds = loadout['cryoRounds'] ?? 0;
    if (cryoRounds > 0) {
        game.heatSystem.heatPerShot *= 0.6 ** cryoRounds;
        applied += cryoRounds;
    }

    const phaseShifter = loadout['phaseShifter'] ?? 0;
    if (phaseShifter > 0) {
        game.rollSystem.scaleCooldown(0.5 ** phaseShifter);
        game.boostSystem.refillCharges();
        applied += phaseShifter;
    }

    if (applied > 0) {
        console.log(`🔨 Crafted loadout applied (${applied} charge(s)):`, loadout);
    }
}
