import * as THREE from 'three';
import { renderer } from '../scene_context';
import { game } from '../game_runtime';
import { updateLoopCore } from './loop_core';
import { updateLoopCombat } from './loop_combat';
import { updateLoopWorld } from './loop_world';
import { updateLoopGeological } from './loop_geological';
import { updateLoopFinish } from './loop_finish';

export function startGameLoop(): void {
    game.clock = new THREE.Clock();
    renderer.setAnimationLoop(animate);
}

function animate(): void {
    const rawDelta = Math.min(game.clock.getDelta(), 0.1);
    const delta = game.juiceManager.update(rawDelta);
    const time = game.clock.getElapsedTime();

    if (updateLoopCore(rawDelta, delta, time)) return;
    if (updateLoopCombat(rawDelta, delta, time)) return;

    updateLoopWorld(delta, time);
    updateLoopGeological(delta, time);
    updateLoopFinish(time);
}
