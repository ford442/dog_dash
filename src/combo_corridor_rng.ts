import { tryGetRunSeed, getRunRngFork } from './run_seed';

/**
 * Uniform float in [0, 1) for Combo Corridor ring placement.
 *
 * Routed through the seeded run RNG (named substream `comboCorridor`) so a
 * run replayed from the same seed places rings identically. Falls back to
 * Math.random() only if a ring is placed before beginRun() has run (e.g.
 * during isolated construction outside a real game session) — this is
 * decorative placement, not something a fallback here would desync.
 */
export function comboCorridorRandom(): number {
    return tryGetRunSeed() ? getRunRngFork('comboCorridor').random() : Math.random();
}
