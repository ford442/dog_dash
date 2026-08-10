/**
 * Single source of truth for deferred level-environment systems.
 *
 * Adding a new code-split env feature:
 * 1. Extend `LevelEnvironments` in `level_config.ts`
 * 2. Add one entry to `DEFERRED_ENV_REGISTRY` (load + install + plugin hooks)
 * 3. Add stub + `GameSystems` field in `create_game_systems.ts` if not already present
 *
 * Eager env flags (bootstrap stubs / full systems) only need an entry in `EAGER_ENV_PLUGINS`.
 */
import type * as THREE from 'three';
import type { LevelConfig, LevelEnvironments, AsteroidFieldEnvironmentConfig } from './level_config';
import type { LevelEnvironmentPorts } from './level_manager/types';
import type { LevelPluginHost, EnvPluginBuilder } from './level_manager/plugin_host';
import { isEnvironmentEnabled } from './level_manager/types';
import {
    shouldSpawnStarlightKoi,
    shouldSpawnBubbleCoral
} from './level_spawn_rules';
import type { ParticleSystem, DebrisSystem } from './particles';
import type { AudioSystem } from './audio_system';
import type { WeaponLightManager } from './lighting';
import { createDreamPortalCallbacks } from './main/dream_portal_update';

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
    'weather',
    'dynamicStarfield',
    'dayNightCycle',
    'galacticCore',
    'dreamPortals',
    'singingGeodes',
    'cloudCastles',
    'flowerConstellations'
] as const satisfies readonly (keyof LevelEnvironments)[];

/** Environment flags constructed eagerly at bootstrap (stub or full). */
export const EAGER_ENV_FLAGS = [
    'pastelNebula',
    'butterflySwarm',
    'nebula',
    'nebulaRibbons',
    'godRays',
    'aurora',
    'lightning',
    'asteroidField',
    'candyField',
    'bubbleCoral'
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
    'slingables'
] as const;

export type DeferredEnvSystemKey = (typeof DEFERRED_ENV_FLAGS)[number];
export type DeferredLevelSystemKey = (typeof DEFERRED_LEVEL_SYSTEM_KEYS)[number];
export type SystemKey = DeferredEnvSystemKey | DeferredLevelSystemKey;

/** Runtime context passed to registry install hooks (kept narrow to avoid import cycles). */
export type DeferredLoaderContext = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    game: DeferredGamePorts;
    installEnvPartial: (partial: Partial<LevelEnvironmentPorts>) => void;
    assignGameSystem: <K extends keyof DeferredGamePorts>(key: K, value: DeferredGamePorts[K]) => void;
};

export type DeferredGamePorts = {
    weaponLightManager: WeaponLightManager;
    audioSystem: AudioSystem;
    particleSystem: ParticleSystem;
    flowerConstellationsSystem?: unknown;
    skyRailTerminalSystem?: unknown;
    debrisSystem: DebrisSystem;
    lightningBoltSystem: { onBoltStrike?: (pos: THREE.Vector3, color: THREE.Color) => void };
    levelManager: {
        installEnvironmentSystems: (partial: Partial<LevelEnvironmentPorts>) => void;
        ghostDebrisSystem?: unknown;
        voidJellyfishSystem?: unknown;
        industrialGeometryManager?: unknown;
    } | null;
    ghostDebrisSystem: unknown;
    voidJellyfishSystem: unknown;
    industrialGeometryManager: unknown;
    aquaticLifeManager: unknown;
    starlightKoiManager: unknown;
    bubbleCoralManager: unknown;
    slingableObjectSystem: unknown;
    toyRocketSpawnManager: unknown;
    rewireSlingableCallbacks?: () => void;
    bossManager: unknown;
    dreamPortalSystem: unknown;
};

type DeferredEnvRegistryEntry<F extends DeferredEnvSystemKey> = {
    flag: F;
    systemKey: SystemKey;
    load: () => Promise<Record<string, unknown>>;
    install: (ctx: DeferredLoaderContext, mod: Record<string, unknown>) => void | Promise<void>;
    plugin: EnvPluginBuilder;
};

type DeferredLevelRegistryEntry = {
    systemKey: DeferredLevelSystemKey;
    needsLoad: (cfg: LevelConfig) => boolean;
    load: () => Promise<Record<string, unknown>>;
    install: (ctx: DeferredLoaderContext, mod: Record<string, unknown>) => void | Promise<void>;
};

function objectConfig<T>(value: unknown): T | undefined {
    return typeof value === 'object' && value !== null ? (value as T) : undefined;
}

function densityFromConfig(value: unknown): number | undefined {
    const cfg = objectConfig<{ density?: number }>(value);
    return cfg?.density;
}

// ---------------------------------------------------------------------------
// Deferred env registry — one entry per code-split environment flag.
// ---------------------------------------------------------------------------

export const DEFERRED_ENV_REGISTRY: {
    [F in DeferredEnvSystemKey]: DeferredEnvRegistryEntry<F>;
} = {
    reEntry: {
        flag: 'reEntry',
        systemKey: 'reEntry',
        load: () => import('./reentry'),
        install: (ctx, mod) => {
            const { ReEntrySystem } = mod as typeof import('./reentry');
            ctx.installEnvPartial({ reEntrySystem: new ReEntrySystem(ctx.scene, ctx.camera) });
        },
        plugin: (host, _cfg, levelLength) => ({
            flag: 'reEntry',
            activate: () => {
                host.reEntrySystem.levelDistance = levelLength;
                host.reEntrySystem.activate();
            },
            deactivate: () => host.reEntrySystem.deactivate()
        })
    },
    waterfall: {
        flag: 'waterfall',
        systemKey: 'waterfall',
        load: () => import('./waterfall'),
        install: (ctx, mod) => {
            const { WaterfallSystem } = mod as typeof import('./waterfall');
            ctx.installEnvPartial({
                waterfallSystem: new WaterfallSystem(ctx.scene, ctx.camera, ctx.game.weaponLightManager)
            });
        },
        plugin: (host, _cfg, levelLength) => ({
            flag: 'waterfall',
            activate: () => {
                host.waterfallSystem.levelDistance = levelLength;
                host.waterfallSystem.activate();
            },
            deactivate: () => host.waterfallSystem.deactivate()
        })
    },
    singingGeodes: {
        flag: 'singingGeodes',
        systemKey: 'singingGeodes',
        load: () => import('./singing_geodes'),
        install: (ctx, mod) => {
            const { SingingGeodeSystem } = mod as typeof import('./singing_geodes');
            ctx.installEnvPartial({
                singingGeodeSystem: new SingingGeodeSystem(ctx.scene, ctx.game.audioSystem, ctx.game.particleSystem)
            });
        },
        plugin: (host) => ({
            flag: 'singingGeodes',
            activate: (config) => host.singingGeodeSystem.activate(densityFromConfig(config)),
            deactivate: () => host.singingGeodeSystem.deactivate()
        })
    },
    cloudCastles: {
        flag: 'cloudCastles',
        systemKey: 'cloudCastles',
        load: () => import('./cloud_castles_system'),
        install: (ctx, mod) => {
            const { CloudCastlesSystem } = mod as typeof import('./cloud_castles_system');
            ctx.installEnvPartial({ cloudCastlesSystem: new CloudCastlesSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'cloudCastles',
            activate: (config) => host.cloudCastlesSystem.activate(objectConfig(config)),
            deactivate: () => host.cloudCastlesSystem.deactivate()
        })
    },
    skyRailTerminal: {
        flag: 'skyRailTerminal',
        systemKey: 'skyRailTerminal',
        load: () => import('./sky_rail_terminal'),
        install: (ctx, mod) => {
            const { SkyRailTerminalSystem } = mod as typeof import('./sky_rail_terminal');
            ctx.installEnvPartial({ skyRailTerminalSystem: new SkyRailTerminalSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'skyRailTerminal',
            activate: (config) => host.skyRailTerminalSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => host.skyRailTerminalSystem.deactivate()
        })
    },
    flowerConstellations: {
        flag: 'flowerConstellations',
        systemKey: 'flowerConstellations',
        load: () => import('./flower_constellations_system'),
        install: (ctx, mod) => {
            const { FlowerConstellationsSystem } = mod as typeof import('./flower_constellations_system');
            const system = new FlowerConstellationsSystem(ctx.scene, ctx.game.audioSystem, ctx.game.particleSystem);
            ctx.assignGameSystem('flowerConstellationsSystem', system);
            ctx.installEnvPartial({ flowerConstellationsSystem: system });
        },
        plugin: (host, _cfg, levelLength) => ({
            flag: 'flowerConstellations',
            activate: (config) => host.flowerConstellationsSystem.activate(config, levelLength),
            deactivate: () => host.flowerConstellationsSystem.deactivate()
        })
    },
    dayNightCycle: {
        flag: 'dayNightCycle',
        systemKey: 'dayNightCycle',
        load: () => import('./day_night_cycle'),
        install: (ctx, mod) => {
            const { DayNightCycleSystem } = mod as typeof import('./day_night_cycle');
            ctx.installEnvPartial({ dayNightCycleSystem: new DayNightCycleSystem(ctx.scene, ctx.camera) });
        },
        plugin: (host) => ({
            flag: 'dayNightCycle',
            activate: (config) => host.dayNightCycleSystem.activate(objectConfig(config)),
            deactivate: () => host.dayNightCycleSystem.deactivate()
        })
    },
    dancingJellyMoss: {
        flag: 'dancingJellyMoss',
        systemKey: 'dancingJellyMoss',
        load: () => import('./dancing_jelly_moss'),
        install: (ctx, mod) => {
            const { DancingJellyMossSystem } = mod as typeof import('./dancing_jelly_moss');
            ctx.installEnvPartial({ dancingJellyMossSystem: new DancingJellyMossSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'dancingJellyMoss',
            activate: (config) => host.dancingJellyMossSystem.activate(objectConfig(config)),
            deactivate: () => host.dancingJellyMossSystem.deactivate()
        })
    },
    dynamicStarfield: {
        flag: 'dynamicStarfield',
        systemKey: 'dynamicStarfield',
        load: () => import('./dynamic_starfield'),
        install: (ctx, mod) => {
            const { DynamicStarfieldSystem } = mod as typeof import('./dynamic_starfield');
            ctx.installEnvPartial({ dynamicStarfieldSystem: new DynamicStarfieldSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'dynamicStarfield',
            activate: (config) => host.dynamicStarfieldSystem.activate(objectConfig(config)),
            deactivate: () => host.dynamicStarfieldSystem.deactivate()
        })
    },
    weather: {
        flag: 'weather',
        systemKey: 'weather',
        load: () => import('./weather_system'),
        install: (ctx, mod) => {
            const { WeatherSystem } = mod as typeof import('./weather_system');
            ctx.installEnvPartial({ weatherSystem: new WeatherSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'weather',
            activate: () => host.weatherSystem.activate(),
            deactivate: () => host.weatherSystem.deactivate()
        })
    },
    wishLanterns: {
        flag: 'wishLanterns',
        systemKey: 'wishLanterns',
        load: () => import('./wish_lanterns'),
        install: (ctx, mod) => {
            const { WishLanternSystem } = mod as typeof import('./wish_lanterns');
            ctx.installEnvPartial({ wishLanternSystem: new WishLanternSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'wishLanterns',
            activate: () => host.wishLanternSystem.activate(),
            deactivate: () => host.wishLanternSystem.deactivate()
        })
    },
    meteorShower: {
        flag: 'meteorShower',
        systemKey: 'meteorShower',
        load: () => import('./meteor_shower'),
        install: (ctx, mod) => {
            const { MeteorShowerSystem } = mod as typeof import('./meteor_shower');
            ctx.installEnvPartial({
                meteorShowerSystem: new MeteorShowerSystem(ctx.scene, ctx.game.weaponLightManager)
            });
        },
        plugin: (host) => ({
            flag: 'meteorShower',
            activate: () => host.meteorShowerSystem.activate(),
            deactivate: () => host.meteorShowerSystem.deactivate()
        })
    },
    industrial: {
        flag: 'industrial',
        systemKey: 'industrial',
        load: () => import('./industrial_background'),
        install: (ctx, mod) => {
            const { IndustrialBackgroundSystem } = mod as typeof import('./industrial_background');
            ctx.installEnvPartial({
                industrialSystem: new IndustrialBackgroundSystem(ctx.scene, ctx.game.weaponLightManager)
            });
        },
        plugin: (host) => ({
            flag: 'industrial',
            activate: (config) => host.industrialSystem.activate(objectConfig(config)),
            deactivate: () => host.industrialSystem.deactivate()
        })
    },
    biological: {
        flag: 'biological',
        systemKey: 'biological',
        load: () => import('./biological_background'),
        install: (ctx, mod) => {
            const { BiologicalBackgroundSystem } = mod as typeof import('./biological_background');
            ctx.installEnvPartial({ biologicalSystem: new BiologicalBackgroundSystem(ctx.scene) });
        },
        plugin: (host, cfg) => ({
            flag: 'biological',
            activate: () => {
                host.biologicalSystem.activate();
                host.cloudSystem.layers.forEach((l) => {
                    l.mesh.visible = false;
                });
            },
            deactivate: () => {
                host.biologicalSystem.deactivate();
                const cloudsVisible = (cfg.foliageDensity.cloud ?? 20) > 0;
                host.cloudSystem.layers.forEach((l) => {
                    l.mesh.visible = cloudsVisible;
                });
            }
        })
    },
    candyPlanetRing: {
        flag: 'candyPlanetRing',
        systemKey: 'candyPlanetRing',
        load: () => import('./candy_obstacles'),
        install: (ctx, mod) => {
            const { CandyFieldSystem } = mod as typeof import('./candy_obstacles');
            ctx.installEnvPartial({ candyFieldSystem: new CandyFieldSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'candyPlanetRing',
            activate: () => host.candyFieldSystem.activate(),
            deactivate: () => host.candyFieldSystem.deactivate()
        })
    },
    cosmicDust: {
        flag: 'cosmicDust',
        systemKey: 'cosmicDust',
        load: () => import('./cosmic_dust'),
        install: (ctx, mod) => {
            const { CosmicDustSystem } = mod as typeof import('./cosmic_dust');
            ctx.installEnvPartial({
                cosmicDustSystem: new CosmicDustSystem(ctx.scene, ctx.game.weaponLightManager)
            });
        },
        plugin: (host) => ({
            flag: 'cosmicDust',
            activate: () => {
                host.cosmicDustSystem.activate();
                host.nebulaSystem.activateRibbons();
            },
            deactivate: () => {
                host.cosmicDustSystem.deactivate();
                host.nebulaSystem.deactivateRibbons();
            }
        })
    },
    planetaryHorizon: {
        flag: 'planetaryHorizon',
        systemKey: 'planetaryHorizon',
        load: () => import('./planetary_horizon'),
        install: (ctx, mod) => {
            const { PlanetaryHorizonSystem } = mod as typeof import('./planetary_horizon');
            ctx.installEnvPartial({
                planetaryHorizonSystem: new PlanetaryHorizonSystem(ctx.scene, ctx.camera)
            });
        },
        plugin: (host, _cfg, levelLength) => ({
            flag: 'planetaryHorizon',
            activate: () => {
                host.planetaryHorizonSystem.levelDistance = levelLength;
                host.planetaryHorizonSystem.activate();
            },
            deactivate: () => host.planetaryHorizonSystem.deactivate()
        })
    },
    moonPalace: {
        flag: 'moonPalace',
        systemKey: 'moonPalace',
        load: () => import('./moon_palace'),
        install: (ctx, mod) => {
            const { MoonPalaceSystem } = mod as typeof import('./moon_palace');
            ctx.installEnvPartial({
                moonPalaceSystem: new MoonPalaceSystem(ctx.scene, ctx.camera, ctx.game.weaponLightManager)
            });
        },
        plugin: (host, _cfg, levelLength) => ({
            flag: 'moonPalace',
            activate: () => {
                host.moonPalaceSystem.levelDistance = levelLength;
                host.moonPalaceSystem.activate();
            },
            deactivate: () => host.moonPalaceSystem.deactivate()
        })
    },
    blackHole: {
        flag: 'blackHole',
        systemKey: 'blackHole',
        load: () => import('./black_hole'),
        install: (ctx, mod) => {
            const { BlackHoleSystem } = mod as typeof import('./black_hole');
            ctx.installEnvPartial({ blackHoleSystem: new BlackHoleSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'blackHole',
            activate: (config) => host.blackHoleSystem.activate(config),
            deactivate: () => host.blackHoleSystem.deactivate()
        })
    },
    galacticCore: {
        flag: 'galacticCore',
        systemKey: 'galacticCore',
        load: () => import('./galactic_core'),
        install: (ctx, mod) => {
            const { GalacticCoreSystem } = mod as typeof import('./galactic_core');
            ctx.installEnvPartial({ galacticCoreSystem: new GalacticCoreSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'galacticCore',
            activate: (config) => host.galacticCoreSystem.activate(config),
            deactivate: () => host.galacticCoreSystem.deactivate()
        })
    },
    dreamPortals: {
        flag: 'dreamPortals',
        systemKey: 'dreamPortals',
        load: () => import('./dream_portal'),
        install: (ctx, mod) => {
            const { DreamPortalSystem } = mod as typeof import('./dream_portal');
            ctx.assignGameSystem(
                'dreamPortalSystem',
                new DreamPortalSystem(ctx.scene, createDreamPortalCallbacks())
            );
        },
        plugin: () => ({
            flag: 'dreamPortals',
            activate: () => undefined,
            deactivate: () => undefined
        })
    },
    ghostDebris: {
        flag: 'ghostDebris',
        systemKey: 'ghostDebris',
        load: () => import('./ghost_debris'),
        install: (ctx, mod) => {
            const { GhostDebrisSystem } = mod as typeof import('./ghost_debris');
            const instance = new GhostDebrisSystem(ctx.scene);
            ctx.game.ghostDebrisSystem = instance;
            if (ctx.game.levelManager) {
                ctx.game.levelManager.ghostDebrisSystem = instance;
            }
        },
        plugin: (host) => ({
            flag: 'ghostDebris',
            activate: () => host.ghostDebrisSystem.activate(),
            deactivate: () => host.ghostDebrisSystem.deactivate()
        })
    },
    voidJellyfish: {
        flag: 'voidJellyfish',
        systemKey: 'voidJellyfish',
        load: () => import('./void_jellyfish'),
        install: (ctx, mod) => {
            const { VoidJellyfishSystem } = mod as typeof import('./void_jellyfish');
            const instance = new VoidJellyfishSystem(ctx.scene);
            ctx.game.voidJellyfishSystem = instance;
            if (ctx.game.levelManager) {
                ctx.game.levelManager.voidJellyfishSystem = instance;
            }
        },
        plugin: (host) => ({
            flag: 'voidJellyfish',
            activate: (config) => host.voidJellyfishSystem.activate(config),
            deactivate: () => host.voidJellyfishSystem.deactivate()
        })
    },
    aquaticLife: {
        flag: 'aquaticLife',
        systemKey: 'aquaticLife',
        load: () => import('./aquatic_life'),
        install: (ctx, mod) => {
            const { AquaticLifeManager } = mod as typeof import('./aquatic_life');
            ctx.game.aquaticLifeManager = new AquaticLifeManager(ctx.scene);
        },
        plugin: () => ({
            flag: 'aquaticLife',
            activate: () => undefined,
            deactivate: () => undefined
        })
    }
};

// ---------------------------------------------------------------------------
// Non-env deferred systems (density / objective / spawn-rule driven)
// ---------------------------------------------------------------------------

export const DEFERRED_LEVEL_REGISTRY: Record<DeferredLevelSystemKey, DeferredLevelRegistryEntry> = {
    boss: {
        systemKey: 'boss',
        needsLoad: (cfg) => cfg.objective?.type === 'boss',
        load: () => import('./boss_system'),
        install: (ctx, mod) => {
            const { BossManager } = mod as typeof import('./boss_system');
            ctx.assignGameSystem('bossManager', new BossManager(ctx.scene));
        }
    },
    chromaShift: {
        systemKey: 'chromaShift',
        needsLoad: (cfg) => (cfg.chromaShiftDensity ?? 0) > 0,
        load: () => import('./chroma_shift'),
        install: (ctx, mod) => {
            const { ChromaShiftSystem } = mod as typeof import('./chroma_shift');
            ctx.installEnvPartial({ chromaShiftSystem: new ChromaShiftSystem(ctx.scene) });
        }
    },
    stormGeode: {
        systemKey: 'stormGeode',
        needsLoad: (cfg) => (cfg.stormGeodeDensity ?? 0) > 0,
        load: () => import('./storm_geodes'),
        install: (ctx, mod) => {
            const { StormGeodeSystem } = mod as typeof import('./storm_geodes');
            ctx.installEnvPartial({
                stormGeodeSystem: new StormGeodeSystem(ctx.scene, {
                    playHit: () => ctx.game.audioSystem.play('hit'),
                    onBoltStrike: (pos, color) => ctx.game.lightningBoltSystem.onBoltStrike?.(pos, color)
                })
            });
        }
    },
    industrialGeometry: {
        systemKey: 'industrialGeometry',
        needsLoad: (cfg) => cfg.levelType === 'tunnel' || cfg.levelType === 'organic_tunnel',
        load: () => import('./industrial_geometry'),
        install: (ctx, mod) => {
            const { IndustrialGeometryManager } = mod as typeof import('./industrial_geometry');
            const instance = new IndustrialGeometryManager(ctx.scene);
            ctx.game.industrialGeometryManager = instance;
            if (ctx.game.levelManager) {
                ctx.game.levelManager.industrialGeometryManager = instance;
            }
        }
    },
    starlightKoi: {
        systemKey: 'starlightKoi',
        needsLoad: (cfg) => shouldSpawnStarlightKoi(cfg.environments, cfg.koiSchoolDensity),
        load: () => import('./starlight_koi'),
        install: (ctx, mod) => {
            const { StarlightKoiManager } = mod as typeof import('./starlight_koi');
            ctx.game.starlightKoiManager = new StarlightKoiManager(ctx.scene, ctx.game.particleSystem);
        }
    },
    bubbleCoral: {
        systemKey: 'bubbleCoral',
        needsLoad: (cfg) => shouldSpawnBubbleCoral(cfg.environments, cfg.bubbleCoralDensity),
        load: () => import('./bubble_coral'),
        install: (ctx, mod) => {
            const { RainbowBubbleCoralManager } = mod as typeof import('./bubble_coral');
            ctx.game.bubbleCoralManager = new RainbowBubbleCoralManager(ctx.scene, ctx.game.particleSystem);
        }
    },
    slingables: {
        systemKey: 'slingables',
        needsLoad: (cfg) => (cfg.toyRocketCount ?? 0) > 0 || cfg.objective?.type === 'sling',
        load: async () => {
            const [slingables, rockets] = await Promise.all([
                import('./slingable_objects'),
                import('./toy_rockets')
            ]);
            return { ...slingables, ...rockets };
        },
        install: (ctx, mod) => {
            const { SlingableObjectSystem, ToyRocketSpawnManager } = mod as typeof import('./slingable_objects') &
                typeof import('./toy_rockets');
            const slingableObjectSystem = new SlingableObjectSystem(
                ctx.scene,
                ctx.game.particleSystem,
                ctx.game.debrisSystem
            );
            ctx.game.slingableObjectSystem = slingableObjectSystem;
            ctx.game.toyRocketSpawnManager = new ToyRocketSpawnManager(slingableObjectSystem);
            if (typeof ctx.game.rewireSlingableCallbacks === 'function') {
                ctx.game.rewireSlingableCallbacks();
            }
        }
    }
};

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
    'pastelNebula',
    'candyField',
    'butterflySwarm',
    'nebula',
    'nebulaRibbons',
    'godRays',
    'aurora',
    'lightning',
    'asteroidField',
    'bubbleCoral'
] as const satisfies readonly (typeof EAGER_ENV_FLAGS)[number][];

export function buildEagerEnvPlugins(
    host: LevelPluginHost,
    cfg: LevelConfig,
    levelLength: number
): ReturnType<EnvPluginBuilder>[] {
    const plugins: ReturnType<EnvPluginBuilder>[] = [];

    for (const flag of EAGER_ENV_PLUGIN_ORDER) {
        switch (flag) {
            case 'pastelNebula':
                plugins.push({
                    flag,
                    activate: () => host.pastelNebulaSystem.activate(),
                    deactivate: () => host.pastelNebulaSystem.deactivate()
                });
                break;
            case 'candyField':
                plugins.push({
                    flag,
                    activate: () => host.candyFieldSystem.activate(),
                    deactivate: () => host.candyFieldSystem.deactivate()
                });
                break;
            case 'butterflySwarm':
                plugins.push({
                    flag,
                    activate: () => host.butterflySwarmSystem.activate(),
                    deactivate: () => host.butterflySwarmSystem.deactivate()
                });
                break;
            case 'nebula':
                plugins.push({
                    flag,
                    activate: () => {
                        host.nebulaSystem.activate();
                        host.nebulaSystem.activateRibbons();
                    },
                    deactivate: () => {
                        host.nebulaSystem.deactivate();
                        host.nebulaSystem.deactivateRibbons();
                    }
                });
                break;
            case 'nebulaRibbons':
                plugins.push({
                    flag,
                    activate: () => host.nebulaSystem.activateRibbons(),
                    deactivate: () => host.nebulaSystem.deactivateRibbons()
                });
                break;
            case 'godRays':
                plugins.push({
                    flag,
                    activate: (config) => host.godRaySystem.activate(config),
                    deactivate: () => host.godRaySystem.deactivate()
                });
                break;
            case 'aurora':
                plugins.push({
                    flag,
                    activate: (config) => host.auroraSystem.activate(config),
                    deactivate: () => host.auroraSystem.deactivate()
                });
                break;
            case 'lightning':
                plugins.push({
                    flag,
                    activate: (config) => host.lightningBoltSystem.activate(config),
                    deactivate: () => host.lightningBoltSystem.deactivate()
                });
                break;
            case 'asteroidField':
                plugins.push({
                    flag,
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
                });
                break;
            case 'bubbleCoral':
                plugins.push({
                    flag,
                    activate: () => undefined,
                    deactivate: () => undefined
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
    'wishLanterns',
    'blackHole',
    'galacticCore',
    'industrial',
    'waterfall',
    'planetaryHorizon',
    'moonPalace',
    'reEntry',
    'biological',
    'cosmicDust',
    'ghostDebris',
    'voidJellyfish',
    'meteorShower',
    'dancingJellyMoss',
    'weather',
    'singingGeodes',
    'cloudCastles',
    'flowerConstellations',
    'skyRailTerminal'
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

export function systemsNeededForLevel(cfg: LevelConfig | undefined): SystemKey[] {
    if (!cfg) return [];
    const keys = new Set<SystemKey>();
    const env = cfg.environments || {};

    for (const flag of DEFERRED_ENV_FLAGS) {
        if (isEnvironmentEnabled(env[flag])) {
            keys.add(DEFERRED_ENV_REGISTRY[flag].systemKey);
        }
    }

    for (const entry of Object.values(DEFERRED_LEVEL_REGISTRY)) {
        if (entry.needsLoad(cfg)) {
            keys.add(entry.systemKey);
        }
    }

    return [...keys];
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
