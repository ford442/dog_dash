/**
 * Brush vocabulary for Cosmic Architect — data-only registry.
 * Composes level env flags + densities; does not fork LevelManager.
 *
 * Each brush names the env systems it switches on (`systems`, used for the
 * manifest decoration budget) and writes itself into a sandbox config at a
 * world X. Placing the same brush twice stacks (two wind zones, two doors)
 * instead of overwriting. Add a row here when a system becomes playable in
 * isolation; the Lab lists whatever this table holds.
 */

import type { EnvDescriptorKey } from '../env_system_descriptors';
import type { BossEncounterKind, LevelConfig, LevelEnvironments, LevelObjectiveType } from '../level_config';
import type { ChapterSpan } from '../journey_layout';
import { BOSS_TITLES } from '../endless/patches';

export const BRUSH_IDS = [
    'spore_field',
    'candy_belt_slice',
    'sling_arena',
    'dream_room_door',
    'boss_gate',
    'wind_corridor',
    'sky_rail_flourish'
] as const;

export type BrushId = (typeof BRUSH_IDS)[number];

export type BrushPlacement = {
    brushId: BrushId;
    /** 0–1 density scalar applied by `apply`. */
    density: number;
    /** Metres from the sandbox start. Omitted: spread evenly along the course. */
    x?: number;
};

/**
 * `anchor` brushes happen at their X (a door, a wind zone, a boss trigger).
 * `course` brushes tune the whole sandbox; their X only orders the timeline.
 */
export type BrushScope = 'anchor' | 'course';

export type BrushContext = {
    /** Absolute world X of the placement. */
    x: number;
    span: ChapterSpan;
    /** 0-based count of earlier placements of the same brush (alternating patterns). */
    nth: number;
};

export type BrushDef = {
    id: BrushId;
    label: string;
    icon: string;
    decorationCost: number;
    /** Level objective types where this brush is allowed. */
    allowedLevelTypes: LevelObjectiveType[];
    /** Env systems this brush switches on. */
    systems: readonly EnvDescriptorKey[];
    scope: BrushScope;
    /** Most placements one course may hold (unlimited when absent). */
    maxPerCourse?: number;
    /** Lab slider label; absent when density has no effect. */
    densityLabel?: string;
    apply: (cfg: LevelConfig, density: number, ctx: BrushContext) => void;
};

function env(cfg: LevelConfig): LevelEnvironments {
    cfg.environments ??= {};
    return cfg.environments;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/** Boss Gate density picks the boss, gentlest first. */
const BOSS_BY_DENSITY: readonly BossEncounterKind[] = ['zephyr', 'starEater', 'kraken'];

export function bossKindFor(density: number): BossEncounterKind {
    return BOSS_BY_DENSITY[Math.min(BOSS_BY_DENSITY.length - 1, Math.floor(density * BOSS_BY_DENSITY.length))];
}

export const BRUSH_REGISTRY: Record<BrushId, BrushDef> = {
    spore_field: {
        id: 'spore_field',
        label: 'Spore Field',
        icon: '🍄',
        decorationCost: 12,
        allowedLevelTypes: ['scan', 'survive', 'combo'],
        systems: ['clouds'],
        scope: 'course',
        densityLabel: 'Cloud cover',
        apply: (cfg, density) => {
            const current = typeof cfg.environments?.clouds === 'object' ? cfg.environments.clouds.density : 0;
            env(cfg).clouds = { density: Math.max(current, 1 + Math.round(density * 4)) };
        }
    },
    candy_belt_slice: {
        id: 'candy_belt_slice',
        label: 'Candy Belt Slice',
        icon: '🍬',
        decorationCost: 18,
        allowedLevelTypes: ['combo', 'sling', 'survive'],
        systems: ['candyField', 'candyPlanetRing'],
        scope: 'course',
        densityLabel: 'Candy rocks',
        apply: (cfg, density) => {
            env(cfg).candyField = true;
            env(cfg).candyPlanetRing = true;
            cfg.candyAsteroidChance = Math.max(cfg.candyAsteroidChance ?? 0, round2(Math.min(0.6, 0.15 + density * 0.35)));
        }
    },
    sling_arena: {
        id: 'sling_arena',
        label: 'Sling Arena',
        icon: '🪃',
        decorationCost: 8,
        allowedLevelTypes: ['sling', 'combo'],
        systems: ['slingables'],
        scope: 'course',
        densityLabel: 'Toy rockets',
        apply: (cfg, density) => {
            // toy_rockets.ts caps live wrecks at 3.
            cfg.toyRocketCount = Math.min(3, (cfg.toyRocketCount ?? 0) + Math.max(1, Math.floor(1 + density * 2)));
            // A boss gate's objective wins, whichever brush comes first.
            if (cfg.objective?.type !== 'boss') {
                cfg.objective = { type: 'sling', target: 3, description: 'Sling perfect shots' };
            }
        }
    },
    dream_room_door: {
        id: 'dream_room_door',
        label: 'Dream Room Door',
        icon: '🚪',
        decorationCost: 14,
        allowedLevelTypes: ['scan', 'survive', 'rescue'],
        systems: ['dreamPortals'],
        scope: 'anchor',
        densityLabel: 'Toys inside',
        apply: (cfg, density, ctx) => {
            const portals = env(cfg).dreamPortals?.portals ?? [];
            env(cfg).dreamPortals = {
                enabled: true,
                portals: [...portals, { x: ctx.x, y: 4, z: -1, theme: 'pastel', durationSeconds: 32, toyCount: Math.floor(4 + density * 8) }]
            };
        }
    },
    boss_gate: {
        id: 'boss_gate',
        label: 'Boss Gate',
        icon: '👾',
        decorationCost: 6,
        allowedLevelTypes: ['boss'],
        systems: ['boss'],
        scope: 'anchor',
        maxPerCourse: 1,
        densityLabel: 'Boss',
        apply: (cfg, density, ctx) => {
            const kind = bossKindFor(density);
            cfg.bossEncounter = { kind, triggerX: ctx.x };
            cfg.objective = { type: 'boss', target: 1, description: `Defeat ${BOSS_TITLES[kind]}` };
            // A Kraken gate is the course's only Kraken.
            if (kind === 'kraken') cfg.squidSpawnRate = 0;
        }
    },
    wind_corridor: {
        id: 'wind_corridor',
        label: 'Wind Corridor',
        icon: '🌬️',
        decorationCost: 10,
        allowedLevelTypes: ['survive', 'sling', 'combo'],
        systems: ['windCurrents'],
        scope: 'anchor',
        densityLabel: 'Gust strength',
        apply: (cfg, density, ctx) => {
            const current = env(cfg).windCurrents;
            const zones = typeof current === 'object' ? current.zones : [];
            // Alternate lift and dive, like the campaign's chapter 2 pair.
            const sign = ctx.nth % 2 === 0 ? 1 : -1;
            env(cfg).windCurrents = {
                zones: [...zones, {
                    x: ctx.x,
                    y: 5,
                    width: Math.round(80 + density * 120),
                    height: 20,
                    forceX: 0,
                    forceY: sign * Math.round(12 + density * 24)
                }]
            };
        }
    },
    sky_rail_flourish: {
        id: 'sky_rail_flourish',
        label: 'Sky-Rail Flourish',
        icon: '🚝',
        decorationCost: 16,
        allowedLevelTypes: ['survive', 'scan', 'combo'],
        systems: ['skyRailTerminal'],
        scope: 'course',
        apply: (cfg) => {
            env(cfg).skyRailTerminal = true;
        }
    }
};

/** Sum decoration budget cost for a brush placement list. */
export function totalBrushCost(placements: readonly BrushPlacement[]): number {
    return placements.reduce((sum, p) => {
        const def = BRUSH_REGISTRY[p.brushId];
        return sum + (def?.decorationCost ?? 0);
    }, 0);
}
