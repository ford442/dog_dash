/**
 * `DEFERRED_ENV_REGISTRY` — one entry per code-split environment flag.
 *
 * Split out of `level_env_registry.ts` (which remains the public entry point
 * re-exporting this table alongside the deferred-level registry and the
 * eager/plugin-order glue).
 */
import type { AsteroidFieldEnvironmentConfig } from './level_config';
import type { DeferredEnvSystemKey } from './level_deferred_registry';
import { createDreamPortalCallbacks } from './main/dream_portal_update';
import { type DeferredEnvRegistryEntry, objectConfig, densityFromConfig } from './level_env_registry_types';

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
    grappleIsles: {
        flag: 'grappleIsles',
        systemKey: 'grappleIsles',
        load: () => import('./grapple_isles'),
        install: (ctx, mod) => {
            const { GrappleIslesSystem } = mod as typeof import('./grapple_isles');
            ctx.installEnvPartial({ grappleIslesSystem: new GrappleIslesSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'grappleIsles',
            activate: (config) => host.grappleIslesSystem.activate(objectConfig(config)),
            deactivate: () => host.grappleIslesSystem.deactivate()
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
    windCurrents: {
        flag: 'windCurrents',
        systemKey: 'windCurrents',
        load: () => import('./wind_currents'),
        install: (ctx, mod) => {
            const { WindCurrentsSystem } = mod as typeof import('./wind_currents');
            ctx.installEnvPartial({ windCurrentsSystem: new WindCurrentsSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'windCurrents',
            activate: (config) => host.windCurrentsSystem.activate(objectConfig(config)),
            deactivate: () => host.windCurrentsSystem.deactivate()
        })
    },
    bouncePads: {
        flag: 'bouncePads',
        systemKey: 'bouncePads',
        load: () => import('./bounce_pads'),
        install: (ctx, mod) => {
            const { BouncePadsSystem } = mod as typeof import('./bounce_pads');
            ctx.installEnvPartial({ bouncePadsSystem: new BouncePadsSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'bouncePads',
            activate: (config) => host.bouncePadsSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => host.bouncePadsSystem.deactivate()
        })
    },
    timeShiftZones: {
        flag: 'timeShiftZones',
        systemKey: 'timeShiftZones',
        load: () => import('./time_shift_zones'),
        install: (ctx, mod) => {
            const { TimeShiftZonesSystem } = mod as typeof import('./time_shift_zones');
            ctx.installEnvPartial({ timeShiftZonesSystem: new TimeShiftZonesSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'timeShiftZones',
            activate: (config) => host.timeShiftZonesSystem.activate(objectConfig(config)),
            deactivate: () => host.timeShiftZonesSystem.deactivate()
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
    hideAndSeekStars: {
        flag: 'hideAndSeekStars',
        systemKey: 'hideAndSeekStars',
        load: () => import('./hide_and_seek_stars'),
        install: (ctx, mod) => {
            const { HideAndSeekStarsSystem } = mod as typeof import('./hide_and_seek_stars');
            ctx.installEnvPartial({ hideAndSeekStarsSystem: new HideAndSeekStarsSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'hideAndSeekStars',
            activate: () => host.hideAndSeekStarsSystem.activate(),
            deactivate: () => host.hideAndSeekStarsSystem.deactivate()
        })
    },
    spaceGarden: {
        flag: 'spaceGarden',
        systemKey: 'spaceGarden',
        load: () => import('./space_garden'),
        install: (ctx, mod) => {
            const { SpaceGardenSystem } = mod as typeof import('./space_garden');
            ctx.installEnvPartial({ spaceGardenSystem: new SpaceGardenSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'spaceGarden',
            activate: () => host.spaceGardenSystem.activate(),
            deactivate: () => host.spaceGardenSystem.deactivate()
        })
    },
    comboCorridor: {
        flag: 'comboCorridor',
        systemKey: 'comboCorridor',
        load: () => import('./combo_corridor'),
        install: (ctx, mod) => {
            const { ComboCorridorSystem } = mod as typeof import('./combo_corridor');
            ctx.installEnvPartial({ comboCorridorSystem: new ComboCorridorSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'comboCorridor',
            activate: (config) => host.comboCorridorSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => host.comboCorridorSystem.deactivate()
        })
    },
    aerialGuardPatrol: {
        flag: 'aerialGuardPatrol',
        systemKey: 'aerialGuardPatrol',
        load: () => import('./aerial_guard_patrol'),
        install: (ctx, mod) => {
            const { AerialGuardPatrolSystem } = mod as typeof import('./aerial_guard_patrol');
            ctx.installEnvPartial({ aerialGuardPatrolSystem: new AerialGuardPatrolSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'aerialGuardPatrol',
            activate: (config) => host.aerialGuardPatrolSystem.activate(objectConfig(config)),
            deactivate: () => host.aerialGuardPatrolSystem.deactivate()
        })
    },
    airTokens: {
        flag: 'airTokens',
        systemKey: 'airTokens',
        load: () => import('./air_tokens'),
        install: (ctx, mod) => {
            const { AirTokensSystem } = mod as typeof import('./air_tokens');
            ctx.installEnvPartial({ airTokensSystem: new AirTokensSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'airTokens',
            activate: (config) => host.airTokensSystem.activate(typeof config === 'object' ? config : undefined),
            deactivate: () => host.airTokensSystem.deactivate()
        })
    },
    shootingStars: {
        flag: 'shootingStars',
        systemKey: 'shootingStars',
        load: () => import('./shooting_stars'),
        install: (ctx, mod) => {
            const { ShootingStarsSystem } = mod as typeof import('./shooting_stars');
            ctx.installEnvPartial({ shootingStarsSystem: new ShootingStarsSystem(ctx.scene, ctx.game.particleSystem) });
        },
        plugin: (host) => ({
            flag: 'shootingStars',
            activate: () => host.shootingStarsSystem?.activate(),
            deactivate: () => host.shootingStarsSystem?.deactivate()
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
    spacePetsSwarm: {
        flag: 'spacePetsSwarm',
        systemKey: 'spacePetsSwarm',
        load: () => import('./space_pets_swarm'),
        install: (ctx, mod) => {
            const { SpacePetsSwarmSystem } = mod as typeof import('./space_pets_swarm');
            const system = new SpacePetsSwarmSystem(ctx.scene, ctx.game.particleSystem);
            ctx.assignGameSystem('spacePetsSwarmSystem', system);
            ctx.installEnvPartial({ spacePetsSwarmSystem: system });
        },
        plugin: (host) => ({
            flag: 'spacePetsSwarm',
            activate: () => host.spacePetsSwarmSystem.activate(),
            deactivate: () => host.spacePetsSwarmSystem.deactivate()
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
            activate: () => host.biologicalSystem.activate(),
            deactivate: () => host.biologicalSystem.deactivate()
        })
    },
    candyPlanetRing: {
        flag: 'candyPlanetRing',
        systemKey: 'candyPlanetRing',
        load: () => import('./candy_obstacles/candy_field_system'),
        install: (ctx, mod) => {
            const { CandyFieldSystem } = mod as typeof import('./candy_obstacles/candy_field_system');
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
    },
    pastelNebula: {
        flag: 'pastelNebula',
        systemKey: 'pastelNebula',
        load: () => import('./pastel_nebula'),
        install: (ctx, mod) => {
            const { PastelNebulaSystem } = mod as typeof import('./pastel_nebula');
            ctx.installEnvPartial({
                pastelNebulaSystem: new PastelNebulaSystem(ctx.scene, ctx.game.weaponLightManager)
            });
        },
        plugin: (host) => ({
            flag: 'pastelNebula',
            activate: () => host.pastelNebulaSystem.activate(),
            deactivate: () => host.pastelNebulaSystem.deactivate()
        })
    },
    nebula: {
        flag: 'nebula',
        systemKey: 'nebula',
        load: () => import('./nebula'),
        install: (ctx, mod) => {
            const { NebulaSystem } = mod as typeof import('./nebula');
            const instance = new NebulaSystem(ctx.scene, ctx.game.weaponLightManager);
            instance.setCamera(ctx.camera);
            ctx.installEnvPartial({ nebulaSystem: instance });
        },
        plugin: (host) => ({
            flag: 'nebula',
            activate: () => {
                host.nebulaSystem.activate();
                host.nebulaSystem.activateRibbons();
            },
            deactivate: () => {
                host.nebulaSystem.deactivate();
                host.nebulaSystem.deactivateRibbons();
            }
        })
    },
    nebulaRibbons: {
        flag: 'nebulaRibbons',
        systemKey: 'nebula',
        load: () => import('./nebula'),
        install: (ctx, mod) => {
            const { NebulaSystem } = mod as typeof import('./nebula');
            const instance = new NebulaSystem(ctx.scene, ctx.game.weaponLightManager);
            instance.setCamera(ctx.camera);
            ctx.installEnvPartial({ nebulaSystem: instance });
        },
        plugin: (host) => ({
            flag: 'nebulaRibbons',
            activate: () => host.nebulaSystem.activateRibbons(),
            deactivate: () => host.nebulaSystem.deactivateRibbons()
        })
    },
    godRays: {
        flag: 'godRays',
        systemKey: 'godRays',
        load: () => import('./godrays'),
        install: (ctx, mod) => {
            const { GodRaySystem } = mod as typeof import('./godrays');
            ctx.installEnvPartial({ godRaySystem: new GodRaySystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'godRays',
            activate: (config) => host.godRaySystem.activate(config),
            deactivate: () => host.godRaySystem.deactivate()
        })
    },
    aurora: {
        flag: 'aurora',
        systemKey: 'aurora',
        load: () => import('./aurora'),
        install: (ctx, mod) => {
            const { AuroraSystem } = mod as typeof import('./aurora');
            ctx.installEnvPartial({
                auroraSystem: new AuroraSystem(ctx.scene, ctx.game.weaponLightManager)
            });
        },
        plugin: (host) => ({
            flag: 'aurora',
            activate: (config) => host.auroraSystem.activate(config),
            deactivate: () => host.auroraSystem.deactivate()
        })
    },
    lightning: {
        flag: 'lightning',
        systemKey: 'lightning',
        load: () => import('./lightning_bolt'),
        install: (ctx, mod) => {
            const { LightningBoltSystem } = mod as typeof import('./lightning_bolt');
            const instance = new LightningBoltSystem(ctx.scene, ctx.game.weaponLightManager);
            // `LevelManager.installEnvironmentSystems` re-wires `onBoltStrike`
            // whenever `lightningBoltSystem` is replaced (see wireLightningBoltStrike).
            ctx.installEnvPartial({ lightningBoltSystem: instance });
        },
        plugin: (host) => ({
            flag: 'lightning',
            activate: (config) => host.lightningBoltSystem.activate(config),
            deactivate: () => host.lightningBoltSystem.deactivate()
        })
    },
    asteroidField: {
        flag: 'asteroidField',
        systemKey: 'asteroidField',
        load: () => import('./asteroid_field'),
        install: (ctx, mod) => {
            const { AsteroidFieldSystem } = mod as typeof import('./asteroid_field');
            ctx.installEnvPartial({
                asteroidFieldSystem: new AsteroidFieldSystem(ctx.scene, ctx.game.weaponLightManager)
            });
        },
        plugin: (host, cfg) => ({
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
        })
    },
    candyField: {
        flag: 'candyField',
        systemKey: 'candyPlanetRing',
        load: () => import('./candy_obstacles/candy_field_system'),
        install: (ctx, mod) => {
            const { CandyFieldSystem } = mod as typeof import('./candy_obstacles/candy_field_system');
            ctx.installEnvPartial({ candyFieldSystem: new CandyFieldSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'candyField',
            activate: () => host.candyFieldSystem.activate(),
            deactivate: () => host.candyFieldSystem.deactivate()
        })
    },
    fossilizedSpaceWhales: {
        flag: 'fossilizedSpaceWhales',
        systemKey: 'fossilizedSpaceWhales',
        load: () => import('./fossilized_space_whales'),
        install: (ctx, mod) => {
            const { FossilizedSpaceWhalesSystem } = mod as typeof import('./fossilized_space_whales');
            const system = new FossilizedSpaceWhalesSystem(ctx.scene);
            system.setObstacleTracking((obs) => ctx.game.obstacleSystem.addObstacle(obs));
            ctx.installEnvPartial({ fossilizedSpaceWhalesSystem: system });
        },
        plugin: (host) => ({
            flag: 'fossilizedSpaceWhales',
            activate: (config) => host.fossilizedSpaceWhalesSystem.activate(objectConfig(config)),
            deactivate: () => host.fossilizedSpaceWhalesSystem.deactivate()
        })
    },
    hyperspaceTunnel: {
        flag: 'hyperspaceTunnel',
        systemKey: 'hyperspaceTunnel',
        load: () => import('./hyperspace_tunnel'),
        install: (ctx, mod) => {
            const { HyperspaceTunnelSystem } = mod as typeof import('./hyperspace_tunnel');
            ctx.installEnvPartial({ hyperspaceTunnelSystem: new HyperspaceTunnelSystem(ctx.scene) });
        },
        plugin: (host) => ({
            flag: 'hyperspaceTunnel',
            activate: (config) => host.hyperspaceTunnelSystem.activate(objectConfig(config)),
            deactivate: () => host.hyperspaceTunnelSystem.deactivate()
        })
    }
};
