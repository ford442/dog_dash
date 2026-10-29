import * as THREE from 'three';
import { renderer } from '../scene_context';
import { player } from '../player_loader';
import { game } from '../game_runtime';
import { renderGameFrame } from './render_helpers';
import { updateFrameHousekeeping } from './frame_housekeeping';
import { advanceAccumulator, interpolationAlpha, MAX_FRAME_DELTA } from './fixed_timestep';
import { ObjectInterpolator, PositionInterpolator } from './render_interpolation';
import { stepSimulation } from './sim_step';
import { resetSimClock } from '../sim_clock';

let accumulator = 0;
const playerInterpolator = new PositionInterpolator();
const objectInterpolator = new ObjectInterpolator();

export function startGameLoop(): void {
    game.clock = new THREE.Clock();
    accumulator = 0;
    resetSimClock();
    playerInterpolator.reset();
    objectInterpolator.reset();
    renderer.setAnimationLoop(animate);
}

function animate(): void {
    const rawDelta = Math.min(game.clock.getDelta(), MAX_FRAME_DELTA);
    // Visual-only systems (screen shake, flashes, floating text) stay on
    // wall-clock delta; hit-pause freezes gameplay by shrinking it below.
    const hitPauseDelta = game.juiceManager.update(rawDelta);

    const paused = updateFrameHousekeeping(rawDelta);
    // No gameplay steps until startRun() has seeded the run: the title
    // overlay is opaque, and a sim that idled behind it would make a run's
    // starting state depend on how long the player sat on the title screen.
    const runActive = game.activeRunSeed !== null;

    if (paused || !runActive) {
        accumulator = 0;
    } else {
        const { steps, remainder } = advanceAccumulator(accumulator, hitPauseDelta);
        accumulator = remainder;
        for (let i = 0; i < steps; i++) {
            stepSimulation();
            if (player) playerInterpolator.recordStep(player.position);
            recordInterpolatedObjects();
        }
    }

    renderInterpolated();
}

/**
 * Fast sim-driven objects that would visibly hitch at 144 Hz against a
 * 60 Hz sim: plasma bolts, slingables, and the boss body (core included).
 */
function recordInterpolatedObjects(): void {
    objectInterpolator.beginStep();
    for (const projectile of game.weaponSystem.projectiles) {
        if (projectile.active) objectInterpolator.record(projectile.mesh);
    }
    for (const slingable of game.slingableObjectSystem.objects) {
        if (slingable.active) objectInterpolator.record(slingable.group);
    }
    const boss = game.bossManager.getBoss();
    if (boss) objectInterpolator.record(boss.group);
    objectInterpolator.endStep();
}

/**
 * Draws the frame with the player and the tracked fast objects blended
 * between their last two simulation positions, so a fixed 60Hz sim doesn't
 * look worse than wall-clock movement on a high-refresh display. All other
 * gameplay state (collision, camera targeting, HUD) already ran against the
 * true end-of-step positions inside stepSimulation — only this draw call
 * sees the interpolated blend, and true positions are restored right after.
 */
function renderInterpolated(): void {
    const alpha = interpolationAlpha(accumulator);
    const interpolated = player ? playerInterpolator.getInterpolated(alpha) : null;
    const truePosition = player && interpolated ? player.position.clone() : null;

    objectInterpolator.applyBlend(alpha);
    if (player && interpolated) player.position.copy(interpolated);
    game.juiceManager.applyShakeToCamera();
    try {
        renderGameFrame();
    } finally {
        game.juiceManager.removeShakeFromCamera();
        if (player && truePosition) player.position.copy(truePosition);
        objectInterpolator.restore();
    }
}
