import { initializeStartup } from './startup';
import { setupInputBindings } from './input_bindings';
import { initRenderHelpers } from './render_helpers';
import { setupResizeHandler } from './resize';
import { startGameLoop } from './game_loop';
import { showBootFailure } from '../boot_failure';
import { WebGpuBootError } from '../renderer_mode';

/**
 * Wire all subsystems and start the animation loop.
 *
 * Startup is async because the WebGPU boot probe is. If the probe fails we
 * show the blocking failure screen and stop — there is no WebGL fallback to
 * fall back to, by design (see docs/RENDERER_FALLBACK.md).
 */
export async function bootstrap(): Promise<void> {
    try {
        await initializeStartup();
    } catch (error) {
        if (error instanceof WebGpuBootError) {
            showBootFailure(error.probe);
            return;
        }
        throw error;
    }

    initRenderHelpers();
    setupInputBindings();
    setupResizeHandler();
    startGameLoop();

    console.log('🚀 Space Dash - Journey to the Moon!');
    console.log('Controls: SPACE to thrust up, A to dive down');
    console.log('Objective: Reach the moon while surviving asteroid impacts (3 lives)');
}
