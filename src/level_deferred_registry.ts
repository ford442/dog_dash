/**
 * Pure deferred-system metadata for level loading.
 * Kept free of Three.js / dynamic imports so unit tests can validate registry math.
 */
import type { LevelConfig, LevelEnvironments } from './level_config';
import { isEnvironmentEnabled } from './level_manager/types';
import {
    shouldSpawnStarlightKoi,
    shouldSpawnBubbleCoral
} from './level_spawn_rules';

// ---------------------------------------------------------------------------
// Env flag classification — every `LevelEnvironments` key must appear here.
// ---------------------------------------------------------------------------

/** Environment flags whose real implementation is dynamically imported. */
export const DEFERRED_ENV_FLAGS = [
    'skyRailTerminal',
    'candyPlanetRing',
    'blackHole',
    'industrial',
    'waterfall',
    'biological',
    'cosmicDust',
    'moonPalace',
    'planetaryHorizon',
    'reEntry',
    'aquaticLife',
    'ghostDebris',
    'voidJellyfish',
    'meteorShower',
    'wishLanterns',
    'dancingJellyMoss',
    'spacePetsSwarm',
    'weather',
    'dynamicStarfield',
    'dayNightCycle',
    'galacticCore',
    'dreamPortals',
    'singingGeodes',
    'cloudCastles',
    'grappleIsles',
    'windCurrents',
    'timeShiftZones',
    'flowerConstellations',
    'hideAndSeekStars',
    'bouncePads',
    'spaceGarden',
    'comboCorridor',
    'aerialGuardPatrol',
    'airTokens',
    'shootingStars',
    'pastelNebula',
    'nebula',
    'nebulaRibbons',
    'godRays',
    'aurora',
    'lightning',
    'asteroidField',
    'candyField'
] as const satisfies readonly (keyof LevelEnvironments)[];

/** Environment flags constructed eagerly at bootstrap (stub or full). */
export const EAGER_ENV_FLAGS = [
    'bubbleCoral',
    /** Owned by ensureGameManagers — plugin only, no dynamic import. */
    'butterflySwarm'
] as const satisfies readonly (keyof LevelEnvironments)[];

type AllClassifiedEnvFlags = (typeof DEFERRED_ENV_FLAGS)[number] | (typeof EAGER_ENV_FLAGS)[number];
type AssertAllEnvFlagsClassified = Exclude<keyof LevelEnvironments, AllClassifiedEnvFlags> extends never
    ? true
    : never;
const _envFlagCoverage: AssertAllEnvFlagsClassified = true;
void _envFlagCoverage;

// ---------------------------------------------------------------------------
// Deferred system keys (env-flag-driven + level-config predicates)
// ---------------------------------------------------------------------------

export const DEFERRED_LEVEL_SYSTEM_KEYS = [
    'boss',
    'chromaShift',
    'stormGeode',
    'industrialGeometry',
    'starlightKoi',
    'bubbleCoral',
    'slingables',
    'liquidMetal',
    'crystalChimes',
    'gravLens',
    'derelictBuoys',
    'dataMonoliths',
    'magicPaintbrush'
] as const;

export type DeferredEnvSystemKey = (typeof DEFERRED_ENV_FLAGS)[number];
export type DeferredLevelSystemKey = (typeof DEFERRED_LEVEL_SYSTEM_KEYS)[number];
export type SystemKey = DeferredEnvSystemKey | DeferredLevelSystemKey;

/**
 * Maps each deferred env flag to its runtime system key.
 * Must stay in sync with `DEFERRED_ENV_REGISTRY` in level_env_registry.ts.
 */
export const DEFERRED_ENV_FLAG_SYSTEM_KEY: Record<DeferredEnvSystemKey, SystemKey> = {
    skyRailTerminal: 'skyRailTerminal',
    candyPlanetRing: 'candyPlanetRing',
    blackHole: 'blackHole',
    industrial: 'industrial',
    waterfall: 'waterfall',
    biological: 'biological',
    cosmicDust: 'cosmicDust',
    moonPalace: 'moonPalace',
    planetaryHorizon: 'planetaryHorizon',
    reEntry: 'reEntry',
    aquaticLife: 'aquaticLife',
    ghostDebris: 'ghostDebris',
    voidJellyfish: 'voidJellyfish',
    meteorShower: 'meteorShower',
    wishLanterns: 'wishLanterns',
    dancingJellyMoss: 'dancingJellyMoss',
    spacePetsSwarm: 'spacePetsSwarm',
    weather: 'weather',
    dynamicStarfield: 'dynamicStarfield',
    dayNightCycle: 'dayNightCycle',
    galacticCore: 'galacticCore',
    dreamPortals: 'dreamPortals',
    singingGeodes: 'singingGeodes',
    cloudCastles: 'cloudCastles',
    grappleIsles: 'grappleIsles',
    windCurrents: 'windCurrents',
    timeShiftZones: 'timeShiftZones',
    flowerConstellations: 'flowerConstellations',
    hideAndSeekStars: 'hideAndSeekStars',
    bouncePads: 'bouncePads',
    spaceGarden: 'spaceGarden',
    comboCorridor: 'comboCorridor',
    aerialGuardPatrol: 'aerialGuardPatrol',
    airTokens: 'airTokens',
    shootingStars: 'shootingStars',
    pastelNebula: 'pastelNebula',
    nebula: 'nebula',
    nebulaRibbons: 'nebula',
    godRays: 'godRays',
    aurora: 'aurora',
    lightning: 'lightning',
    asteroidField: 'asteroidField',
    candyField: 'candyPlanetRing'
};

/** Pure load predicates for non-env deferred systems. */
export const DEFERRED_LEVEL_LOAD_RULES: {
    systemKey: DeferredLevelSystemKey;
    needsLoad: (cfg: LevelConfig) => boolean;
}[] = [
    {
        systemKey: 'boss',
        needsLoad: (cfg) => cfg.objective?.type === 'boss'
    },
    {
        systemKey: 'chromaShift',
        needsLoad: (cfg) => (cfg.chromaShiftDensity ?? 0) > 0
    },
    {
        systemKey: 'stormGeode',
        needsLoad: (cfg) => (cfg.stormGeodeDensity ?? 0) > 0
    },
    {
        systemKey: 'industrialGeometry',
        needsLoad: (cfg) => cfg.levelType === 'tunnel' || cfg.levelType === 'organic_tunnel'
    },
    {
        systemKey: 'starlightKoi',
        needsLoad: (cfg) => shouldSpawnStarlightKoi(cfg.environments, cfg.koiSchoolDensity)
    },
    {
        systemKey: 'bubbleCoral',
        needsLoad: (cfg) => shouldSpawnBubbleCoral(cfg.environments, cfg.bubbleCoralDensity)
    },
    {
        systemKey: 'slingables',
        needsLoad: (cfg) => (cfg.toyRocketCount ?? 0) > 0 || cfg.objective?.type === 'sling'
    },
    {
        systemKey: 'liquidMetal',
        needsLoad: (cfg) => (cfg.foliageDensity?.liquidMetal ?? 0) > 0
    },
    {
        systemKey: 'crystalChimes',
        needsLoad: (cfg) => (cfg.chimeDensity ?? 0) > 0
    },
    {
        systemKey: 'gravLens',
        needsLoad: (cfg) => (cfg.gravLensCorridors?.length ?? 0) > 0
    },
    {
        systemKey: 'derelictBuoys',
        needsLoad: (cfg) => (cfg.derelictBuoys?.length ?? 0) > 0
    },
    {
        systemKey: 'dataMonoliths',
        needsLoad: (cfg) => (cfg.dataMonoliths?.length ?? 0) > 0
    },
    {
        systemKey: 'magicPaintbrush',
        needsLoad: () => true
    }
];

export const DEFERRED_LEVEL_NEEDS_LOAD = Object.fromEntries(
    DEFERRED_LEVEL_LOAD_RULES.map((rule) => [rule.systemKey, rule.needsLoad])
) as Record<DeferredLevelSystemKey, (cfg: LevelConfig) => boolean>;

export function systemsNeededForLevel(cfg: LevelConfig | undefined): SystemKey[] {
    if (!cfg) return [];
    const keys = new Set<SystemKey>();
    const env = cfg.environments || {};

    for (const flag of DEFERRED_ENV_FLAGS) {
        if (isEnvironmentEnabled(env[flag])) {
            keys.add(DEFERRED_ENV_FLAG_SYSTEM_KEY[flag]);
        }
    }

    for (const rule of DEFERRED_LEVEL_LOAD_RULES) {
        if (rule.needsLoad(cfg)) {
            keys.add(rule.systemKey);
        }
    }

    return [...keys];
}
