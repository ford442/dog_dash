/**
 * Single source of truth for deferred level-environment systems.
 *
 * Adding a new code-split env feature:
 * 1. Extend `LevelEnvironments` in `level_config.ts`
 * 2. Add one entry to `DEFERRED_ENV_REGISTRY` (in `level_env_registry_deferred_env.ts`)
 * 3. Add stub + `GameSystems` field in `create_game_systems.ts` if not already present
 *
 * Eager env flags (bootstrap stubs / full systems) only need an entry in `EAGER_ENV_PLUGINS`.
 *
 * This file is the public entry point: it re-exports the deferred-env and
 * deferred-level registries (defined in the sibling `level_env_registry_deferred_*.ts`
 * files) and owns the eager-plugin / plugin-order glue and the loader/installer maps.
 */
import type { LevelConfig } from './level_config';
import type { LevelPluginHost, EnvPluginBuilder } from './level_manager/plugin_host';
import {
    DEFERRED_ENV_FLAGS,
    EAGER_ENV_FLAGS,
    DEFERRED_LEVEL_SYSTEM_KEYS,
    type DeferredEnvSystemKey,
    type DeferredLevelSystemKey,
    type SystemKey
} from './level_deferred_registry';
import { DEFERRED_ENV_REGISTRY } from './level_env_registry_deferred_env';
import { DEFERRED_LEVEL_REGISTRY } from './level_env_registry_deferred_level';
import type { DeferredLoaderContext } from './level_env_registry_types';

export type {
    DeferredLoaderContext,
    DeferredGamePorts,
    DeferredEnvRegistryEntry,
    DeferredLevelRegistryEntry
} from './level_env_registry_types';

export { DEFERRED_ENV_REGISTRY } from './level_env_registry_deferred_env';
export { DEFERRED_LEVEL_REGISTRY } from './level_env_registry_deferred_level';
export { systemsNeededForLevel } from './level_deferred_registry';
export { DEFERRED_ENV_FLAGS, EAGER_ENV_FLAGS, DEFERRED_LEVEL_SYSTEM_KEYS };
export type { DeferredEnvSystemKey, DeferredLevelSystemKey, SystemKey };

// Compile-time: registry keys must match DEFERRED_ENV_FLAGS
type RegistryDeferredKeys = keyof typeof DEFERRED_ENV_REGISTRY;
type AssertRegistryMatchesFlags = Exclude<DeferredEnvSystemKey, RegistryDeferredKeys> extends never
    ? Exclude<RegistryDeferredKeys, DeferredEnvSystemKey> extends never
        ? true
        : never
    : never;
const _registryFlagCoverage: AssertRegistryMatchesFlags = true;
void _registryFlagCoverage;

type RegistryLevelKeys = keyof typeof DEFERRED_LEVEL_REGISTRY;
type AssertLevelRegistryMatchesKeys = Exclude<DeferredLevelSystemKey, RegistryLevelKeys> extends never
    ? Exclude<RegistryLevelKeys, DeferredLevelSystemKey> extends never
        ? true
        : never
    : never;
const _levelRegistryCoverage: AssertLevelRegistryMatchesKeys = true;
void _levelRegistryCoverage;

// ---------------------------------------------------------------------------
// Eager environment plugins (no dynamic import — system exists at bootstrap)
// ---------------------------------------------------------------------------

export const EAGER_ENV_PLUGIN_ORDER = [
    'bubbleCoral',
    'butterflySwarm',
    'clouds'
] as const satisfies readonly (typeof EAGER_ENV_FLAGS)[number][];

export function buildEagerEnvPlugins(
    host: LevelPluginHost,
    _cfg: LevelConfig,
    _levelLength: number
): ReturnType<EnvPluginBuilder>[] {
    const plugins: ReturnType<EnvPluginBuilder>[] = [];

    for (const flag of EAGER_ENV_PLUGIN_ORDER) {
        switch (flag) {
            case 'bubbleCoral':
                plugins.push({
                    flag,
                    activate: () => undefined,
                    deactivate: () => undefined
                });
                break;
            case 'butterflySwarm':
                plugins.push({
                    flag,
                    activate: () => host.butterflySwarmSystem.activate(),
                    deactivate: () => host.butterflySwarmSystem.deactivate()
                });
                break;
            case 'clouds':
                plugins.push({
                    flag,
                    activate: (config) => {
                        host.cloudSystem.setSkyColors(_cfg.skyColors.bottom);
                        host.cloudSystem.activate(config);
                    },
                    deactivate: () => host.cloudSystem.deactivate()
                });
                break;
        }
    }

    return plugins;
}

/** Plugin order for deferred env flags (must match prior behaviour). */
export const DEFERRED_ENV_PLUGIN_ORDER: DeferredEnvSystemKey[] = [
    'dynamicStarfield',
    'dayNightCycle',
    'candyPlanetRing',
    'pastelNebula',
    'candyField',
    'wishLanterns',
    'spacePetsSwarm',
    'blackHole',
    'galacticCore',
    'industrial',
    'waterfall',
    'planetaryHorizon',
    'moonPalace',
    'reEntry',
    'biological',
    'nebula',
    'nebulaRibbons',
    'cosmicDust',
    'godRays',
    'aurora',
    'lightning',
    'asteroidField',
    'ghostDebris',
    'voidJellyfish',
    'meteorShower',
    'dancingJellyMoss',
    'weather',
    'singingGeodes',
    'cloudCastles',
    'grappleIsles',
    'skyRailTerminal',
    'windCurrents',
    'flowerConstellations',
    'hideAndSeekStars',
    'bouncePads',
    'spaceGarden',
    'comboCorridor',
    'timeShiftZones',
    'aerialGuardPatrol',
    'airTokens',
    'shootingStars',
    'fossilizedSpaceWhales'
];

export function buildDeferredEnvPlugins(
    host: LevelPluginHost,
    cfg: LevelConfig,
    levelLength: number
): ReturnType<EnvPluginBuilder>[] {
    return DEFERRED_ENV_PLUGIN_ORDER.map((flag) =>
        DEFERRED_ENV_REGISTRY[flag].plugin(host, cfg, levelLength)
    );
}

const SYSTEM_LOADERS: Record<SystemKey, () => Promise<Record<string, unknown>>> = {
    ...Object.fromEntries(
        Object.values(DEFERRED_ENV_REGISTRY).map((entry) => [entry.systemKey, entry.load])
    ) as Record<DeferredEnvSystemKey, () => Promise<Record<string, unknown>>>,
    ...Object.fromEntries(
        Object.values(DEFERRED_LEVEL_REGISTRY).map((entry) => [entry.systemKey, entry.load])
    ) as Record<DeferredLevelSystemKey, () => Promise<Record<string, unknown>>>
};

const SYSTEM_INSTALLERS: Record<
    SystemKey,
    (ctx: DeferredLoaderContext, mod: Record<string, unknown>) => void | Promise<void>
> = {
    ...Object.fromEntries(
        Object.values(DEFERRED_ENV_REGISTRY).map((entry) => [entry.systemKey, entry.install])
    ) as Record<DeferredEnvSystemKey, (ctx: DeferredLoaderContext, mod: Record<string, unknown>) => void>,
    ...Object.fromEntries(
        Object.values(DEFERRED_LEVEL_REGISTRY).map((entry) => [entry.systemKey, entry.install])
    ) as Record<DeferredLevelSystemKey, (ctx: DeferredLoaderContext, mod: Record<string, unknown>) => void>
};

export async function installDeferredSystem(key: SystemKey, ctx: DeferredLoaderContext): Promise<void> {
    const mod = await SYSTEM_LOADERS[key]();
    await SYSTEM_INSTALLERS[key](ctx, mod);
}

/** All deferred system keys (for tests and validation scripts). */
export const ALL_DEFERRED_SYSTEM_KEYS = Object.keys(SYSTEM_LOADERS) as SystemKey[];
