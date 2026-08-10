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
    'windCurrents',
    'bubbleCoral',
    'flowerConstellations'
] as const satisfies readonly (keyof LevelEnvironments)[];

export function buildEnvironmentPlugins(
    host: LevelPluginHost,
    cfg: LevelConfig,
    levelLength: number
): AnyEnvironmentPlugin[] {
    return [
        {
            flag: 'dynamicStarfield',
            activate: (config: any) => host.dynamicStarfieldSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => host.dynamicStarfieldSystem.deactivate()
        },
        {
            flag: 'dayNightCycle',
            activate: (config: any) => host.dayNightCycleSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => host.dayNightCycleSystem.deactivate()
        },
        {
            flag: 'candyPlanetRing',
            activate: () => host.candyFieldSystem.activate(),
            deactivate: () => host.candyFieldSystem.deactivate()
        },
        {
            flag: 'pastelNebula',
            activate: () => host.pastelNebulaSystem.activate(),
            deactivate: () => host.pastelNebulaSystem.deactivate()
        },
        {
            flag: 'candyField',
            activate: () => host.candyFieldSystem.activate(),
            deactivate: () => host.candyFieldSystem.deactivate()
        },
        {
            flag: 'wishLanterns',
            activate: () => host.wishLanternSystem.activate(),
            deactivate: () => host.wishLanternSystem.deactivate()
        },
        {
            flag: 'butterflySwarm',
            activate: () => host.butterflySwarmSystem.activate(),
            deactivate: () => host.butterflySwarmSystem.deactivate()
        },
        {
            flag: 'blackHole',
            activate: (blackHoleConfig) => host.blackHoleSystem.activate(blackHoleConfig),
            deactivate: () => host.blackHoleSystem.deactivate()
        },
        {
            flag: 'galacticCore',
            activate: (coreConfig) => host.galacticCoreSystem.activate(coreConfig),
            deactivate: () => host.galacticCoreSystem.deactivate()
        },
        {
            flag: 'industrial',
            activate: (config: any) => host.industrialSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => host.industrialSystem.deactivate()
        },
        {
            flag: 'waterfall',
            activate: () => {
                host.waterfallSystem.levelDistance = levelLength;
                host.waterfallSystem.activate();
            },
            deactivate: () => host.waterfallSystem.deactivate()
        },
        {
            flag: 'planetaryHorizon',
            activate: () => {
                host.planetaryHorizonSystem.levelDistance = levelLength;
                host.planetaryHorizonSystem.activate();
            },
            deactivate: () => host.planetaryHorizonSystem.deactivate()
        },
        {
            flag: 'moonPalace',
            activate: () => {
                host.moonPalaceSystem.levelDistance = levelLength;
                host.moonPalaceSystem.activate();
            },
            deactivate: () => host.moonPalaceSystem.deactivate()
        },
        {
            flag: 'reEntry',
            activate: () => {
                host.reEntrySystem.levelDistance = levelLength;
                host.reEntrySystem.activate();
            },
            deactivate: () => host.reEntrySystem.deactivate()
        },
        {
            flag: 'biological',
            activate: () => {
                host.biologicalSystem.activate();
                host.cloudSystem.layers.forEach(l => { l.mesh.visible = false; });
            },
            deactivate: () => {
                host.biologicalSystem.deactivate();
                const cloudsVisible = (cfg.foliageDensity.cloud ?? 20) > 0;
                host.cloudSystem.layers.forEach(l => { l.mesh.visible = cloudsVisible; });
            }
        },
        {
            flag: 'nebula',
            activate: () => {
                host.nebulaSystem.activate();
                host.nebulaSystem.activateRibbons();
            },
            deactivate: () => host.nebulaSystem.deactivate()
        },
        {
            flag: 'nebulaRibbons',
            activate: () => host.nebulaSystem.activateRibbons(),
            deactivate: () => host.nebulaSystem.deactivateRibbons()
        },
        {
            flag: 'cosmicDust',
            activate: () => {
                host.cosmicDustSystem.activate();
                host.nebulaSystem.activateRibbons();
            },
            deactivate: () => {
                host.cosmicDustSystem.deactivate();
                host.nebulaSystem.deactivateRibbons();
            }
        },
        {
            flag: 'godRays',
            activate: (config: GodRaysEnvironmentConfig) => host.godRaySystem.activate(config),
            deactivate: () => host.godRaySystem.deactivate()
        },
        {
            flag: 'aurora',
            activate: (config: AuroraEnvironmentConfig) => host.auroraSystem.activate(config),
            deactivate: () => host.auroraSystem.deactivate()
        },
        {
            flag: 'lightning',
            activate: (config: LightningEnvironmentConfig) => host.lightningBoltSystem.activate(config),
            deactivate: () => host.lightningBoltSystem.deactivate()
        },
        {
            flag: 'asteroidField',
            activate: (config: AsteroidFieldEnvironmentConfig) => {
                host.asteroidFieldSystem.activate();
                host.baseAsteroidDensity = config.rate * 0.5;
                host.asteroidFieldSystem.setDensity(host.baseAsteroidDensity * host.objectDensityMultiplier);
                host.asteroidFieldSystem.setCandyChance(cfg.candyAsteroidChance ?? 0);
                host.asteroidFieldSystem.resetPositions(host.camera.position.x);
            },
            deactivate: () => {
                host.baseAsteroidDensity = 0;
                host.asteroidFieldSystem.deactivate();
            }
        },
        {
            flag: 'ghostDebris',
            activate: () => host.ghostDebrisSystem.activate(),
            deactivate: () => host.ghostDebrisSystem.deactivate()
        },
        {
            flag: 'voidJellyfish',
            activate: (config) => host.voidJellyfishSystem.activate(config),
            deactivate: () => host.voidJellyfishSystem.deactivate()
        },
        {
            flag: 'meteorShower',
            activate: () => host.meteorShowerSystem.activate(),
            deactivate: () => host.meteorShowerSystem.deactivate()
        },
        {
            flag: 'dancingJellyMoss',
            activate: (config: any) => host.dancingJellyMossSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => host.dancingJellyMossSystem.deactivate()
        },
        {
            flag: 'weather',
            activate: () => host.weatherSystem.activate(),
            deactivate: () => host.weatherSystem.deactivate()
        },
        {
            flag: 'cloudCastles',
            activate: (config: any) => host.cloudCastlesSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => host.cloudCastlesSystem.deactivate()
        },
        {
            flag: 'singingGeodes',
            activate: (config: any) => host.singingGeodeSystem.activate(typeof config === 'object' ? config.density : undefined),
            deactivate: () => host.singingGeodeSystem.deactivate()
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
    const plugins = buildEnvironmentPlugins(host, cfg, levelLength);
    for (const plugin of plugins) {
        const value = environments[plugin.flag];
        if (isEnvironmentEnabled(value)) {
            plugin.activate(value as never);
        } else {
            plugin.deactivate();
        }
    }
}
