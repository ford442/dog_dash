import { updateLoopCore } from './loop_core';
import { updateLoopCombat } from './loop_combat';
import { updateLoopWorld } from './loop_world';
import { updateLoopGeological } from './loop_geological';
import { updateLoopFinish } from './loop_finish';
import { SIM_STEP } from './fixed_timestep';
import { advanceSimClock, getSimTime, runDueSimTimers } from '../sim_clock';

/**
 * One fixed gameplay step. Shared by the browser loop (`game_loop.ts`) and
 * the headless replay harness (`tests/replay/`), so a replay exercises the
 * exact same phase order the player sees. Never import the renderer here.
 */
export function stepSimulation(): void {
    advanceSimClock(SIM_STEP);
    runDueSimTimers();
    const time = getSimTime();
    updateLoopCore(SIM_STEP, time);
    if (updateLoopCombat(SIM_STEP, time)) return;
    updateLoopWorld(SIM_STEP, time);
    updateLoopGeological(SIM_STEP, time);
    updateLoopFinish(time);
}
