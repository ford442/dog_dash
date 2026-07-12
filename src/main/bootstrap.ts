import { initializeStartup } from './startup';
import { setupInputBindings } from './input_bindings';
import { initRenderHelpers } from './render_helpers';
import { setupResizeHandler } from './resize';
import { startGameLoop } from './game_loop';

/** Wire all subsystems and start the animation loop. */
export function bootstrap(): void {
    initializeStartup();
    initRenderHelpers();
    setupInputBindings();
    setupResizeHandler();
    startGameLoop();

    console.log('🚀 Space Dash - Journey to the Moon!');
    console.log('Controls: SPACE to thrust up, A to dive down');
    console.log('Objective: Reach the moon while surviving asteroid impacts (3 lives)');
}
