import * as THREE from 'three';
import { renderer } from '../scene_context';
import { player } from '../player_loader';
import { game } from '../game_runtime';
import { updateLoopCore } from './loop_core';
import { updateLoopCombat } from './loop_combat';
import { updateLoopWorld } from './loop_world';
import { updateLoopGeological } from './loop_geological';
import { updateLoopFinish } from './loop_finish';
import { renderGameFrame } from './render_helpers';
import { updateFrameHousekeeping } from './frame_housekeeping';
import { advanceAccumulator, interpolationAlpha, MAX_FRAME_DELTA, SIM_STEP } from './fixed_timestep';
import { PositionInterpolator } from './render_interpolation';

let accumulator = 0;
const playerInterpolator = new PositionInterpolator();

export function startGameLoop(): void {
    game.clock = new THREE.Clock();
    accumulator = 0;
    playerInterpolator.reset();
    renderer.setAnimationLoop(animate);
}

function animate(): void {
    const rawDelta = Math.min(game.clock.getDelta(), MAX_FRAME_DELTA);
    // Visual-only systems (screen shake, flashes, floating text) stay on
    // wall-clock delta; hit-pause freezes gameplay by shrinking it below.
    const hitPauseDelta = game.juiceManager.update(rawDelta);
    const time = game.clock.getElapsedTime();

    const paused = updateFrameHousekeeping(rawDelta);

    if (paused) {
        accumulator = 0;
    } else {
        const { steps, remainder } = advanceAccumulator(accumulator, hitPauseDelta);
        accumulator = remainder;
        for (let i = 0; i < steps; i++) {
            stepSimulation(time);
            if (player) playerInterpolator.recordStep(player.position);
        }
    }

    renderInterpolated(time);
}

function stepSimulation(time: number): void {
    updateLoopCore(SIM_STEP, time);
    if (updateLoopCombat(SIM_STEP, time)) return;
    updateLoopWorld(SIM_STEP, time);
    updateLoopGeological(SIM_STEP, time);
    updateLoopFinish(time);
}

/**
 * Draws the frame with the player's rendered mesh blended between its last
 * two simulation positions, so a fixed 60Hz sim doesn't look worse than
 * wall-clock movement on a high-refresh display. All other gameplay state
 * (collision, camera targeting, HUD) already ran against the true
 * end-of-step position inside stepSimulation — only this draw call sees the
 * interpolated blend, so no other consumer of player.position is affected.
 */
function renderInterpolated(_time: number): void {
    const interpolated = player ? playerInterpolator.getInterpolated(interpolationAlpha(accumulator)) : null;
    if (!player || !interpolated) {
        renderGameFrame();
        return;
    }

    const truePosition = player.position.clone();
    player.position.copy(interpolated);
    renderGameFrame();
    player.position.copy(truePosition);
}
