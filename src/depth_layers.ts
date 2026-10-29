/**
 * Shared Z-depth bands for side-scroller placement.
 * X = scroll axis, Y = vertical flight, Z = depth (negative = into screen).
 */
import { getJourneyLayout } from './journey_layout';
import { gameplayRandom, type GameplayStream } from './run_seed';

export const DEPTH_LAYERS = {
    /** Deepest parallax — galaxies, far castles */
    FAR_BACKGROUND: { min: -80, max: -55 } as const,
    /** Clouds, tissue walls, flower constellations */
    BACKGROUND: { min: -50, max: -30 } as const,
    /** Foliage, geological props, mid castles */
    MIDGROUND: { min: -28, max: -8 } as const,
    /** Candy, friends, near obstacles */
    NEAR: { min: -10, max: 5 } as const,
    /** Player plane */
    GAMEPLAY: { min: -2, max: 2 } as const,
} as const;

export type DepthLayer = keyof typeof DEPTH_LAYERS;

/**
 * Seeded depth picks. Callers placing hazards / pickups pass their own
 * gameplay stream; decor keeps the default 'environment' stream so its
 * draw count (which scales with adaptive density) never shifts gameplay rolls.
 */
export function randomZInLayer(layer: DepthLayer, stream: GameplayStream = 'environment'): number {
    const band = DEPTH_LAYERS[layer];
    return band.min + gameplayRandom(stream) * (band.max - band.min);
}

export function randomZInRange(range: readonly [number, number], stream: GameplayStream = 'environment'): number {
    return range[0] + gameplayRandom(stream) * (range[1] - range[0]);
}

/** Chapter segment of the active journey (campaign boundaries unless an Endless run is active). */
export function getLevelSpan(levelIndex: number): { startX: number; endX: number; length: number } {
    return getJourneyLayout().span(levelIndex);
}
