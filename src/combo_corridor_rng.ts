import { gameplayRandom } from './run_seed';

/**
 * Uniform float in [0, 1) for Combo Corridor ring placement.
 *
 * Routed through the seeded run RNG (named substream `comboCorridor`) so a
 * run replayed from the same seed places rings identically. Rings placed
 * before beginRun() draw from the fixed boot stream (see gameplay_random.ts).
 */
export function comboCorridorRandom(): number {
    return gameplayRandom('comboCorridor');
}
