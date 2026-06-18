/**
 * Shared Z-depth bands for side-scroller placement.
 * X = scroll axis, Y = vertical flight, Z = depth (negative = into screen).
 */
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

export function randomZInLayer(layer: DepthLayer): number {
    const band = DEPTH_LAYERS[layer];
    return band.min + Math.random() * (band.max - band.min);
}

export function randomZInRange(range: readonly [number, number]): number {
    return range[0] + Math.random() * (range[1] - range[0]);
}

import { LEVEL_DISTANCE_BOUNDARIES } from './level_config';

/** Level segment length from cumulative boundaries. */
export function getLevelSpan(levelIndex: number): { startX: number; endX: number; length: number } {
    const startX = LEVEL_DISTANCE_BOUNDARIES[levelIndex - 1] ?? 0;
    const endX = LEVEL_DISTANCE_BOUNDARIES[levelIndex] ?? startX;
    return { startX, endX, length: Math.max(0, endX - startX) };
}
