/**
 * Brush vocabulary for Cosmic Architect — data-only registry.
 * Composes level env flags + densities; does not fork LevelManager.
 */

import type { LevelConfig, LevelObjectiveType } from '../level_config';

export type BrushId =
    | 'spore_field'
    | 'candy_belt_slice'
    | 'sling_arena'
    | 'dream_room_door'
    | 'boss_gate'
    | 'wind_corridor'
    | 'sky_rail_flourish';

export type BrushPlacement = {
    brushId: BrushId;
    /** 0–1 density scalar applied by toEnvPatch. */
    density: number;
    /** World X anchor for sandbox placement (Phase 4). */
    x?: number;
};

export type BrushDef = {
    id: BrushId;
    label: string;
    decorationCost: number;
    /** Level objective types where this brush is allowed. */
    allowedLevelTypes: LevelObjectiveType[];
    toEnvPatch: (density: number) => Partial<LevelConfig>;
};

export const BRUSH_REGISTRY: Record<BrushId, BrushDef> = {
    spore_field: {
        id: 'spore_field',
        label: 'Spore Field',
        decorationCost: 12,
        allowedLevelTypes: ['scan', 'survive', 'combo'],
        toEnvPatch: (density) => ({
            foliageDensity: {
                cloud: Math.max(0.2, density * 2)
            }
        })
    },
    candy_belt_slice: {
        id: 'candy_belt_slice',
        label: 'Candy Belt Slice',
        decorationCost: 18,
        allowedLevelTypes: ['combo', 'sling', 'survive'],
        toEnvPatch: (density) => ({
            environments: { candyField: true, candyPlanetRing: true },
            candyAsteroidChance: Math.min(0.6, 0.15 + density * 0.35)
        })
    },
    sling_arena: {
        id: 'sling_arena',
        label: 'Sling Arena',
        decorationCost: 8,
        allowedLevelTypes: ['sling', 'combo'],
        toEnvPatch: (density) => ({
            objective: { type: 'sling', target: 3, description: 'Sling perfect shots' },
            toyRocketCount: Math.max(1, Math.floor(1 + density * 2))
        })
    },
    dream_room_door: {
        id: 'dream_room_door',
        label: 'Dream Room Door',
        decorationCost: 14,
        allowedLevelTypes: ['scan', 'survive', 'rescue'],
        toEnvPatch: (density) => ({
            environments: {
                dreamPortals: {
                    enabled: true,
                    portals: [{ x: 0, y: 0, toyCount: Math.floor(4 + density * 8) }]
                }
            }
        })
    },
    boss_gate: {
        id: 'boss_gate',
        label: 'Boss Gate',
        decorationCost: 6,
        allowedLevelTypes: ['boss'],
        toEnvPatch: () => ({
            objective: { type: 'boss', target: 1, description: 'Defeat the boss' }
        })
    },
    wind_corridor: {
        id: 'wind_corridor',
        label: 'Wind Corridor',
        decorationCost: 10,
        allowedLevelTypes: ['survive', 'sling', 'combo'],
        toEnvPatch: (density) => ({
            environments: {
                windCurrents: {
                    zones: [{
                        x: 0,
                        y: 0,
                        width: 80 + density * 120,
                        height: 24,
                        forceX: 0,
                        forceY: 2 + density * 4
                    }]
                }
            }
        })
    },
    sky_rail_flourish: {
        id: 'sky_rail_flourish',
        label: 'Sky-Rail Flourish',
        decorationCost: 16,
        allowedLevelTypes: ['survive', 'scan', 'combo'],
        toEnvPatch: (density) => ({
            environments: {
                skyRailTerminal: density >= 0.5
            }
        })
    }
};

/** Sum decoration budget cost for a brush placement list. */
export function totalBrushCost(placements: BrushPlacement[]): number {
    return placements.reduce((sum, p) => {
        const def = BRUSH_REGISTRY[p.brushId];
        return sum + (def?.decorationCost ?? 0);
    }, 0);
}

/** Merge brush env patches into a base level config (shallow merge). */
export function applyBrushPlacements(
    base: LevelConfig,
    placements: BrushPlacement[]
): LevelConfig {
    let merged: LevelConfig = { ...base, environments: { ...base.environments } };
    for (const placement of placements) {
        const def = BRUSH_REGISTRY[placement.brushId];
        if (!def) continue;
        const patch = def.toEnvPatch(placement.density);
        merged = {
            ...merged,
            ...patch,
            environments: {
                ...merged.environments,
                ...(patch.environments ?? {})
            },
            foliageDensity: {
                ...merged.foliageDensity,
                ...(patch.foliageDensity ?? {})
            }
        };
    }
    return merged;
}
