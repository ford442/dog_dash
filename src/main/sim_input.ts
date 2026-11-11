import { game } from '../game_runtime';
import { keys } from '../ui_controls';
import { touchControls } from '../scene_context';
import { GhostAction, type GhostActionFlags } from '../ghost_run/types';

/**
 * The per-step input mask: everything the fixed-step sim reads from the
 * player, captured once at the top of each step. The live game records it
 * into the ghost input trace; the headless replay harness writes it back
 * with applySimInput() so `stepSimulation` sees the same keys and latches.
 */
export function captureSimInput(): GhostActionFlags {
    let mask = 0;
    if (keys.jump || keys.right) mask |= GhostAction.UP;
    if (keys.left) mask |= GhostAction.DOWN;
    if (keys.run) mask |= GhostAction.RUN;
    if (game.wantsFire) mask |= GhostAction.FIRE;
    if (game.wantsBoost) mask |= GhostAction.BOOST;
    if (game.wantsRoll) mask |= GhostAction.ROLL;
    if (game.wantsBark) mask |= GhostAction.BARK;
    if (game.wantsTether) mask |= GhostAction.TETHER;
    if (game.wantsReleaseTether) mask |= GhostAction.RELEASE_TETHER;
    if (game.wantsGrenade) mask |= GhostAction.GRENADE;
    return mask;
}

/** Whether touch controls produced any input this step (not yet re-simulated). */
export function touchInputActive(): boolean {
    if (!touchControls) return false;
    const t = touchControls.getInput();
    return Math.abs(t.vertical) > 0.1 || t.boost || t.fire || t.roll || t.bark;
}

/**
 * Replay side: drive held keys and one-shot latches from a recorded mask.
 * Latches are overwritten every step (not OR-ed), matching how the live
 * game consumes each latch within the step it was raised.
 */
export function applySimInput(mask: GhostActionFlags): void {
    keys.jump = (mask & GhostAction.UP) !== 0;
    keys.right = false;
    keys.left = (mask & GhostAction.DOWN) !== 0;
    keys.run = (mask & GhostAction.RUN) !== 0;
    game.wantsFire = (mask & GhostAction.FIRE) !== 0;
    game.wantsBoost = (mask & GhostAction.BOOST) !== 0;
    game.wantsRoll = (mask & GhostAction.ROLL) !== 0;
    game.wantsBark = (mask & GhostAction.BARK) !== 0;
    game.wantsTether = (mask & GhostAction.TETHER) !== 0;
    game.wantsReleaseTether = (mask & GhostAction.RELEASE_TETHER) !== 0;
    game.wantsGrenade = (mask & GhostAction.GRENADE) !== 0;
}
