import type {
    LevelConfig,
    LevelEnvironments
} from '../level_config';
import type { EnvironmentPlugin } from './types';
import { isEnvironmentEnabled } from './types';
import type * as THREE from 'three';
import type { LevelPluginHost } from './plugin_host';
import {
    buildDeferredEnvPlugins,
    buildEagerEnvPlugins
} from '../level_env_registry';
import { jellyMossSoftBody } from '../jelly_moss_softbody';

export type { LevelPluginHost } from './plugin_host';

/** Discriminated union of plugins keyed by environment flag, so each
 * `activate` receives its own config type. */
type AnyEnvironmentPlugin = { [K in keyof LevelEnvironments]-?: EnvironmentPlugin<K> }[keyof LevelEnvironments];

/** Plugin order preserved for level transitions (matches pre-registry behaviour). */
const PLUGIN_ORDER = [
    'dynamicStarfield',
    'dayNightCycle',
    'candyPlanetRing',
    'pastelNebula',
    'candyField',
    'wishLanterns',
    'spacePetsSwarm',
    'butterflySwarm',
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
    'clouds',
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
    'windCurrents',
    'timeShiftZones',
    'bubbleCoral',
    'flowerConstellations',
    'hideAndSeekStars',
    'skyRailTerminal',
    'bouncePads',
    'spaceGarden',
    'comboCorridor',
    'aerialGuardPatrol',
    'airTokens',
    'shootingStars',
    'fossilizedSpaceWhales',
    'hyperspaceTunnel',
    'cosmicCyberGrid'
] as const satisfies readonly (keyof LevelEnvironments)[];

export function buildEnvironmentPlugins(
    host: LevelPluginHost,
    cfg: LevelConfig,
    levelLength: number
): AnyEnvironmentPlugin[] {
        const eagerByFlag = new Map(
        buildEagerEnvPlugins(host, cfg, levelLength).map((p) => [p.flag, p])
    );
    const deferredByFlag = new Map(
        buildDeferredEnvPlugins(host, cfg, levelLength).map((p) => [p.flag, p])
    );

    return PLUGIN_ORDER.map((flag) => {
        const plugin = deferredByFlag.get(flag) ?? eagerByFlag.get(flag);
        if (!plugin) {
            throw new Error(`Missing environment plugin for flag "${String(flag)}"`);
        }
        return plugin as AnyEnvironmentPlugin;
    });
}

export function applyEnvironmentPlugins(
    host: LevelPluginHost,
    cfg: LevelConfig,
    environments: LevelEnvironments,
    levelLength: number
): void {
    // Verlet soft-body moss is opt-in per level: only levels that ask for
    // dancing jelly-moss pay for the hero-moss nets.
    jellyMossSoftBody.setLevelEnabled(isEnvironmentEnabled(environments.dancingJellyMoss));

    const plugins = buildEnvironmentPlugins(host, cfg, levelLength);
    for (const plugin of plugins) {
        const value = environments[plugin.flag as keyof LevelEnvironments];
        if (isEnvironmentEnabled(value)) {
            (plugin.activate as (config: unknown) => void)(value);
        } else {
            plugin.deactivate();
        }
    }
}
