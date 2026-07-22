/**
 * Dog Dash / Space Dash — thin entry point.
 * All game logic lives under ./main/ and shared modules (create_game_systems, game_runtime / GameContext, etc.).
 * See docs/GAME_CONTEXT.md for the composition-root pattern.
 */
import { bootstrap } from './main/bootstrap';

bootstrap();
