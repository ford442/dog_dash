/**
 * Dog Dash / Space Dash — thin entry point.
 * All game logic lives under ./main/ and shared modules (create_game_systems, game_runtime / GameContext, etc.).
 * See docs/GAME_CONTEXT.md for the composition-root pattern.
 */
import { bootstrap } from './main/bootstrap';

void bootstrap().catch((error) => {
    // bootstrap() already renders the WebGPU boot-failure screen; anything
    // reaching here is an unexpected startup fault worth surfacing loudly.
    console.error('[bootstrap] fatal:', error);
});
