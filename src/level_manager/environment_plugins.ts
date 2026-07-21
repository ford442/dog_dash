import {
    blackHoleSystem,
    waterfallSystem,
    industrialSystem,
    chromaShiftSystem,
    stormGeodeSystem,
    biologicalSystem,
    nebulaSystem,
    cosmicDustSystem,
    meteorShowerSystem,
    asteroidFieldSystem,
    planetaryHorizonSystem,
    reEntrySystem,
    pastelNebulaSystem,
    lightningBoltSystem
} from '../game_systems';
import type {
    LevelConfig,
    LevelEnvironments,
    GodRaysEnvironmentConfig,
    AuroraEnvironmentConfig,
    LightningEnvironmentConfig,
    AsteroidFieldEnvironmentConfig
} from '../level_config';
import type { EnvironmentPlugin } from './types';
import { isEnvironmentEnabled } from './types';

/** Systems registry host for environment plugin activation. */
export interface LevelPluginHost {
    butterflySwarmSystem: { activate: () => void; deactivate: () => void };
    cloudSystem: { layers: { mesh: { visible: boolean } }[] };
    godRaySystem: { activate: (config: GodRaysEnvironmentConfig) => void; deactivate: () => void };
    auroraSystem: { activate: (config: AuroraEnvironmentConfig) => void; deactivate: () => void };
    ghostDebrisSystem: { activate: () => void; deactivate: () => void };
    voidJellyfishSystem: { activate: (config: NonNullable<LevelEnvironments['voidJellyfish']>) => void; deactivate: () => void };
    camera: { position: { x: number } };
    baseAsteroidDensity: number;
    objectDensityMultiplier: number;
}

export function buildEnvironmentPlugins(
    host: LevelPluginHost,
    cfg: LevelConfig,
    levelLength: number
): EnvironmentPlugin[] {
    return [
        {
            flag: 'pastelNebula',
            activate: () => pastelNebulaSystem.activate(),
            deactivate: () => pastelNebulaSystem.deactivate()
        },
        {
            flag: 'butterflySwarm',
            activate: () => host.butterflySwarmSystem.activate(),
            deactivate: () => host.butterflySwarmSystem.deactivate()
        },
        {
            flag: 'blackHole',
            activate: (blackHoleConfig) => blackHoleSystem.activate(blackHoleConfig),
            deactivate: () => blackHoleSystem.deactivate()
        },
        {
            flag: 'industrial',
            activate: (config: any) => industrialSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => industrialSystem.deactivate()
        },
        {
            flag: 'waterfall',
            activate: () => {
                waterfallSystem.levelDistance = levelLength;
                waterfallSystem.activate();
            },
            deactivate: () => waterfallSystem.deactivate()
        },
        {
            flag: 'planetaryHorizon',
            activate: () => {
                planetaryHorizonSystem.levelDistance = levelLength;
                planetaryHorizonSystem.activate();
            },
            deactivate: () => planetaryHorizonSystem.deactivate()
        },
        {
            flag: 'reEntry',
            activate: () => {
                reEntrySystem.levelDistance = levelLength;
                reEntrySystem.activate();
            },
            deactivate: () => reEntrySystem.deactivate()
        },
        {
            flag: 'biological',
            activate: () => {
                biologicalSystem.activate();
                host.cloudSystem.layers.forEach(l => { l.mesh.visible = false; });
            },
            deactivate: () => {
                biologicalSystem.deactivate();
                const cloudsVisible = (cfg.foliageDensity.cloud ?? 20) > 0;
                host.cloudSystem.layers.forEach(l => { l.mesh.visible = cloudsVisible; });
            }
        },
        {
            flag: 'nebula',
            activate: () => {
                nebulaSystem.activate();
                nebulaSystem.activateRibbons();
            },
            deactivate: () => nebulaSystem.deactivate()
        },
        {
            flag: 'nebulaRibbons',
            activate: () => nebulaSystem.activateRibbons(),
            deactivate: () => nebulaSystem.deactivateRibbons()
        },
        {
            flag: 'cosmicDust',
            activate: () => {
                cosmicDustSystem.activate();
                nebulaSystem.activateRibbons();
            },
            deactivate: () => {
                cosmicDustSystem.deactivate();
                nebulaSystem.deactivateRibbons();
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
            activate: (config: LightningEnvironmentConfig) => lightningBoltSystem.activate(config),
            deactivate: () => lightningBoltSystem.deactivate()
        },
        {
            flag: 'asteroidField',
            activate: (config: AsteroidFieldEnvironmentConfig) => {
                asteroidFieldSystem.activate();
                host.baseAsteroidDensity = config.rate * 0.5;
                asteroidFieldSystem.setDensity(host.baseAsteroidDensity * host.objectDensityMultiplier);
                asteroidFieldSystem.setCandyChance(cfg.candyAsteroidChance ?? 0);
                asteroidFieldSystem.resetPositions(host.camera.position.x);
            },
            deactivate: () => {
                host.baseAsteroidDensity = 0;
                asteroidFieldSystem.deactivate();
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
            activate: () => meteorShowerSystem.activate(),
            deactivate: () => meteorShowerSystem.deactivate()
        }
    ];
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
