/**
 * Phase 1 of the env-system-registration RFC: one manifest entry per deferred
 * env feature, built with `defineEnvSystem`. This is a PARALLEL structure —
 * it faithfully reproduces the `load`/`install`/`activate`/`deactivate`
 * behaviour already declared in `../level_env_registry.ts`
 * (`DEFERRED_ENV_REGISTRY`), but nothing imports it yet. `level_env_registry.ts`
 * remains the real source of truth this phase; see
 * `tests/unit/env_manifest_parity.test.ts` for the assertion that keeps the
 * two in sync.
 *
 * Declaration order below matches `DEFERRED_ENV_PLUGIN_ORDER` (with the two
 * load-only flags, `dreamPortals` and `aquaticLife`, inserted next to the
 * neighbours they sit beside in `DEFERRED_ENV_REGISTRY`'s declaration order —
 * they have no activate/deactivate wiring and are excluded from plugin-order
 * comparisons).
 */
import { defineEnvSystem } from './define_env_system';
import type { AsteroidFieldEnvironmentConfig } from '../level_config';

function objectConfig<T>(value: unknown): T | undefined {
    return typeof value === 'object' && value !== null ? (value as T) : undefined;
}

function densityFromConfig(value: unknown): number | undefined {
    const cfg = objectConfig<{ density?: number }>(value);
    return cfg?.density;
}

export const dynamicStarfield = defineEnvSystem<'dynamicStarfield'>({
    flag: 'dynamicStarfield',
    load: () => import('../dynamic_starfield'),
    install: (ctx, mod) => {
        const { DynamicStarfieldSystem } = mod as typeof import('../dynamic_starfield');
        ctx.installEnvPartial({ dynamicStarfieldSystem: new DynamicStarfieldSystem(ctx.scene) });
    },
    activate: (host, value) => host.dynamicStarfieldSystem.activate(objectConfig(value)),
    deactivate: (host) => host.dynamicStarfieldSystem.deactivate()
});

export const dayNightCycle = defineEnvSystem<'dayNightCycle'>({
    flag: 'dayNightCycle',
    load: () => import('../day_night_cycle'),
    install: (ctx, mod) => {
        const { DayNightCycleSystem } = mod as typeof import('../day_night_cycle');
        ctx.installEnvPartial({ dayNightCycleSystem: new DayNightCycleSystem(ctx.scene, ctx.camera) });
    },
    activate: (host, value) => host.dayNightCycleSystem.activate(objectConfig(value)),
    deactivate: (host) => host.dayNightCycleSystem.deactivate()
});

export const candyPlanetRing = defineEnvSystem<'candyPlanetRing'>({
    flag: 'candyPlanetRing',
    load: () => import('../candy_obstacles/candy_field_system'),
    install: (ctx, mod) => {
        const { CandyFieldSystem } = mod as typeof import('../candy_obstacles/candy_field_system');
        ctx.installEnvPartial({ candyFieldSystem: new CandyFieldSystem(ctx.scene) });
    },
    activate: (host) => host.candyFieldSystem.activate(),
    deactivate: (host) => host.candyFieldSystem.deactivate()
});

export const pastelNebula = defineEnvSystem<'pastelNebula'>({
    flag: 'pastelNebula',
    load: () => import('../pastel_nebula'),
    install: (ctx, mod) => {
        const { PastelNebulaSystem } = mod as typeof import('../pastel_nebula');
        ctx.installEnvPartial({
            pastelNebulaSystem: new PastelNebulaSystem(ctx.scene, ctx.game.weaponLightManager)
        });
    },
    activate: (host) => host.pastelNebulaSystem.activate(),
    deactivate: (host) => host.pastelNebulaSystem.deactivate()
});

export const candyField = defineEnvSystem<'candyField'>({
    flag: 'candyField',
    systemKey: 'candyPlanetRing',
    load: () => import('../candy_obstacles/candy_field_system'),
    install: (ctx, mod) => {
        const { CandyFieldSystem } = mod as typeof import('../candy_obstacles/candy_field_system');
        ctx.installEnvPartial({ candyFieldSystem: new CandyFieldSystem(ctx.scene) });
    },
    activate: (host) => host.candyFieldSystem.activate(),
    deactivate: (host) => host.candyFieldSystem.deactivate()
});

export const wishLanterns = defineEnvSystem<'wishLanterns'>({
    flag: 'wishLanterns',
    load: () => import('../wish_lanterns'),
    install: (ctx, mod) => {
        const { WishLanternSystem } = mod as typeof import('../wish_lanterns');
        ctx.installEnvPartial({ wishLanternSystem: new WishLanternSystem(ctx.scene) });
    },
    activate: (host) => host.wishLanternSystem.activate(),
    deactivate: (host) => host.wishLanternSystem.deactivate()
});

export const spacePetsSwarm = defineEnvSystem<'spacePetsSwarm'>({
    flag: 'spacePetsSwarm',
    load: () => import('../space_pets_swarm'),
    install: (ctx, mod) => {
        const { SpacePetsSwarmSystem } = mod as typeof import('../space_pets_swarm');
        const system = new SpacePetsSwarmSystem(ctx.scene, ctx.game.particleSystem);
        ctx.assignGameSystem('spacePetsSwarmSystem', system);
        ctx.installEnvPartial({ spacePetsSwarmSystem: system });
    },
    activate: (host) => host.spacePetsSwarmSystem.activate(),
    deactivate: (host) => host.spacePetsSwarmSystem.deactivate()
});

export const blackHole = defineEnvSystem<'blackHole'>({
    flag: 'blackHole',
    load: () => import('../black_hole'),
    install: (ctx, mod) => {
        const { BlackHoleSystem } = mod as typeof import('../black_hole');
        ctx.installEnvPartial({ blackHoleSystem: new BlackHoleSystem(ctx.scene) });
    },
    activate: (host, value) => host.blackHoleSystem.activate(value),
    deactivate: (host) => host.blackHoleSystem.deactivate()
});

export const galacticCore = defineEnvSystem<'galacticCore'>({
    flag: 'galacticCore',
    load: () => import('../galactic_core'),
    install: (ctx, mod) => {
        const { GalacticCoreSystem } = mod as typeof import('../galactic_core');
        ctx.installEnvPartial({ galacticCoreSystem: new GalacticCoreSystem(ctx.scene) });
    },
    activate: (host, value) => host.galacticCoreSystem.activate(value),
    deactivate: (host) => host.galacticCoreSystem.deactivate()
});

/**
 * Load-only: no activate/deactivate wiring (matches DEFERRED_ENV_REGISTRY.dreamPortals).
 *
 * Deviation from `DEFERRED_ENV_REGISTRY.dreamPortals`: the real registry
 * statically imports `createDreamPortalCallbacks` from `../main/dream_portal_update`
 * at module scope. That module has a real (non-type) transitive import of
 * `../scene_context`, which constructs a live THREE scene/camera and touches
 * `document`/`window` at import time — safe in a browser, but it means the
 * whole *registry module* can never be imported under `node --test`. Since
 * `env_manifest.ts` is meant to be test-importable (see
 * `tests/unit/env_manifest_parity.test.ts`), this entry dynamically imports
 * `dream_portal_update` inside `install` instead of at module scope. The
 * awaited call is otherwise identical — same constructor args, same
 * `assignGameSystem` call — so runtime behavior is unchanged, only the
 * chunk boundary moves.
 */
export const dreamPortals = defineEnvSystem<'dreamPortals'>({
    flag: 'dreamPortals',
    load: () => import('../dream_portal'),
    install: async (ctx, mod) => {
        const { DreamPortalSystem } = mod as typeof import('../dream_portal');
        const { createDreamPortalCallbacks } = await import('../main/dream_portal_update');
        ctx.assignGameSystem('dreamPortalSystem', new DreamPortalSystem(ctx.scene, createDreamPortalCallbacks()));
    },
    activate: () => undefined,
    deactivate: () => undefined
});

export const industrial = defineEnvSystem<'industrial'>({
    flag: 'industrial',
    load: () => import('../industrial_background'),
    install: (ctx, mod) => {
        const { IndustrialBackgroundSystem } = mod as typeof import('../industrial_background');
        ctx.installEnvPartial({
            industrialSystem: new IndustrialBackgroundSystem(ctx.scene, ctx.game.weaponLightManager)
        });
    },
    activate: (host, value) => host.industrialSystem.activate(objectConfig(value)),
    deactivate: (host) => host.industrialSystem.deactivate()
});

export const waterfall = defineEnvSystem<'waterfall'>({
    flag: 'waterfall',
    load: () => import('../waterfall'),
    install: (ctx, mod) => {
        const { WaterfallSystem } = mod as typeof import('../waterfall');
        ctx.installEnvPartial({
            waterfallSystem: new WaterfallSystem(ctx.scene, ctx.camera, ctx.game.weaponLightManager)
        });
    },
    activate: (host, _value, _cfg, levelLength) => {
        host.waterfallSystem.levelDistance = levelLength;
        host.waterfallSystem.activate();
    },
    deactivate: (host) => host.waterfallSystem.deactivate()
});

export const planetaryHorizon = defineEnvSystem<'planetaryHorizon'>({
    flag: 'planetaryHorizon',
    load: () => import('../planetary_horizon'),
    install: (ctx, mod) => {
        const { PlanetaryHorizonSystem } = mod as typeof import('../planetary_horizon');
        ctx.installEnvPartial({
            planetaryHorizonSystem: new PlanetaryHorizonSystem(ctx.scene, ctx.camera)
        });
    },
    activate: (host, _value, _cfg, levelLength) => {
        host.planetaryHorizonSystem.levelDistance = levelLength;
        host.planetaryHorizonSystem.activate();
    },
    deactivate: (host) => host.planetaryHorizonSystem.deactivate()
});

export const moonPalace = defineEnvSystem<'moonPalace'>({
    flag: 'moonPalace',
    load: () => import('../moon_palace'),
    install: (ctx, mod) => {
        const { MoonPalaceSystem } = mod as typeof import('../moon_palace');
        ctx.installEnvPartial({
            moonPalaceSystem: new MoonPalaceSystem(ctx.scene, ctx.camera, ctx.game.weaponLightManager)
        });
    },
    activate: (host, _value, _cfg, levelLength) => {
        host.moonPalaceSystem.levelDistance = levelLength;
        host.moonPalaceSystem.activate();
    },
    deactivate: (host) => host.moonPalaceSystem.deactivate()
});

export const reEntry = defineEnvSystem<'reEntry'>({
    flag: 'reEntry',
    load: () => import('../reentry'),
    install: (ctx, mod) => {
        const { ReEntrySystem } = mod as typeof import('../reentry');
        ctx.installEnvPartial({ reEntrySystem: new ReEntrySystem(ctx.scene, ctx.camera) });
    },
    activate: (host, _value, _cfg, levelLength) => {
        host.reEntrySystem.levelDistance = levelLength;
        host.reEntrySystem.activate();
    },
    deactivate: (host) => host.reEntrySystem.deactivate()
});

export const biological = defineEnvSystem<'biological'>({
    flag: 'biological',
    load: () => import('../biological_background'),
    install: (ctx, mod) => {
        const { BiologicalBackgroundSystem } = mod as typeof import('../biological_background');
        ctx.installEnvPartial({ biologicalSystem: new BiologicalBackgroundSystem(ctx.scene) });
    },
    activate: (host) => host.biologicalSystem.activate(),
    deactivate: (host) => host.biologicalSystem.deactivate()
});

export const nebula = defineEnvSystem<'nebula'>({
    flag: 'nebula',
    load: () => import('../nebula'),
    install: (ctx, mod) => {
        const { NebulaSystem } = mod as typeof import('../nebula');
        const instance = new NebulaSystem(ctx.scene, ctx.game.weaponLightManager);
        instance.setCamera(ctx.camera);
        ctx.installEnvPartial({ nebulaSystem: instance });
    },
    activate: (host) => {
        host.nebulaSystem.activate();
        host.nebulaSystem.activateRibbons();
    },
    deactivate: (host) => {
        host.nebulaSystem.deactivate();
        host.nebulaSystem.deactivateRibbons();
    }
});

export const nebulaRibbons = defineEnvSystem<'nebulaRibbons'>({
    flag: 'nebulaRibbons',
    systemKey: 'nebula',
    load: () => import('../nebula'),
    install: (ctx, mod) => {
        const { NebulaSystem } = mod as typeof import('../nebula');
        const instance = new NebulaSystem(ctx.scene, ctx.game.weaponLightManager);
        instance.setCamera(ctx.camera);
        ctx.installEnvPartial({ nebulaSystem: instance });
    },
    activate: (host) => host.nebulaSystem.activateRibbons(),
    deactivate: (host) => host.nebulaSystem.deactivateRibbons()
});

export const cosmicDust = defineEnvSystem<'cosmicDust'>({
    flag: 'cosmicDust',
    load: () => import('../cosmic_dust'),
    install: (ctx, mod) => {
        const { CosmicDustSystem } = mod as typeof import('../cosmic_dust');
        ctx.installEnvPartial({
            cosmicDustSystem: new CosmicDustSystem(ctx.scene, ctx.game.weaponLightManager)
        });
    },
    activate: (host) => {
        host.cosmicDustSystem.activate();
        host.nebulaSystem.activateRibbons();
    },
    deactivate: (host) => {
        host.cosmicDustSystem.deactivate();
        host.nebulaSystem.deactivateRibbons();
    }
});

export const godRays = defineEnvSystem<'godRays'>({
    flag: 'godRays',
    load: () => import('../godrays'),
    install: (ctx, mod) => {
        const { GodRaySystem } = mod as typeof import('../godrays');
        ctx.installEnvPartial({ godRaySystem: new GodRaySystem(ctx.scene) });
    },
    activate: (host, value) => host.godRaySystem.activate(value),
    deactivate: (host) => host.godRaySystem.deactivate()
});

export const aurora = defineEnvSystem<'aurora'>({
    flag: 'aurora',
    load: () => import('../aurora'),
    install: (ctx, mod) => {
        const { AuroraSystem } = mod as typeof import('../aurora');
        ctx.installEnvPartial({
            auroraSystem: new AuroraSystem(ctx.scene, ctx.game.weaponLightManager)
        });
    },
    activate: (host, value) => host.auroraSystem.activate(value),
    deactivate: (host) => host.auroraSystem.deactivate()
});

export const lightning = defineEnvSystem<'lightning'>({
    flag: 'lightning',
    load: () => import('../lightning_bolt'),
    install: (ctx, mod) => {
        const { LightningBoltSystem } = mod as typeof import('../lightning_bolt');
        const instance = new LightningBoltSystem(ctx.scene, ctx.game.weaponLightManager);
        // `LevelManager.installEnvironmentSystems` re-wires `onBoltStrike`
        // whenever `lightningBoltSystem` is replaced (see wireLightningBoltStrike).
        ctx.installEnvPartial({ lightningBoltSystem: instance });
    },
    activate: (host, value) => host.lightningBoltSystem.activate(value),
    deactivate: (host) => host.lightningBoltSystem.deactivate()
});

export const asteroidField = defineEnvSystem<'asteroidField'>({
    flag: 'asteroidField',
    load: () => import('../asteroid_field'),
    install: (ctx, mod) => {
        const { AsteroidFieldSystem } = mod as typeof import('../asteroid_field');
        ctx.installEnvPartial({
            asteroidFieldSystem: new AsteroidFieldSystem(ctx.scene, ctx.game.weaponLightManager)
        });
    },
    activate: (host, value: AsteroidFieldEnvironmentConfig, cfg) => {
        host.asteroidFieldSystem.activate();
        host.baseAsteroidDensity = value.rate * 0.5;
        host.asteroidFieldSystem.setDensity(host.baseAsteroidDensity * host.objectDensityMultiplier);
        host.asteroidFieldSystem.setCandyChance(cfg.candyAsteroidChance ?? 0);
        host.asteroidFieldSystem.resetPositions(host.camera.position.x);
    },
    deactivate: (host) => {
        host.baseAsteroidDensity = 0;
        host.asteroidFieldSystem.deactivate();
    }
});

export const ghostDebris = defineEnvSystem<'ghostDebris'>({
    flag: 'ghostDebris',
    load: () => import('../ghost_debris'),
    install: (ctx, mod) => {
        const { GhostDebrisSystem } = mod as typeof import('../ghost_debris');
        const instance = new GhostDebrisSystem(ctx.scene);
        ctx.game.ghostDebrisSystem = instance;
        if (ctx.game.levelManager) {
            ctx.game.levelManager.ghostDebrisSystem = instance;
        }
    },
    activate: (host) => host.ghostDebrisSystem.activate(),
    deactivate: (host) => host.ghostDebrisSystem.deactivate()
});

export const voidJellyfish = defineEnvSystem<'voidJellyfish'>({
    flag: 'voidJellyfish',
    load: () => import('../void_jellyfish'),
    install: (ctx, mod) => {
        const { VoidJellyfishSystem } = mod as typeof import('../void_jellyfish');
        const instance = new VoidJellyfishSystem(ctx.scene);
        ctx.game.voidJellyfishSystem = instance;
        if (ctx.game.levelManager) {
            ctx.game.levelManager.voidJellyfishSystem = instance;
        }
    },
    activate: (host, value) => host.voidJellyfishSystem.activate(value),
    deactivate: (host) => host.voidJellyfishSystem.deactivate()
});

/** Load-only: no activate/deactivate wiring (matches DEFERRED_ENV_REGISTRY.aquaticLife). */
export const aquaticLife = defineEnvSystem<'aquaticLife'>({
    flag: 'aquaticLife',
    load: () => import('../aquatic_life'),
    install: (ctx, mod) => {
        const { AquaticLifeManager } = mod as typeof import('../aquatic_life');
        ctx.game.aquaticLifeManager = new AquaticLifeManager(ctx.scene);
    },
    activate: () => undefined,
    deactivate: () => undefined
});

export const meteorShower = defineEnvSystem<'meteorShower'>({
    flag: 'meteorShower',
    load: () => import('../meteor_shower'),
    install: (ctx, mod) => {
        const { MeteorShowerSystem } = mod as typeof import('../meteor_shower');
        ctx.installEnvPartial({
            meteorShowerSystem: new MeteorShowerSystem(ctx.scene, ctx.game.weaponLightManager)
        });
    },
    activate: (host) => host.meteorShowerSystem.activate(),
    deactivate: (host) => host.meteorShowerSystem.deactivate()
});

export const dancingJellyMoss = defineEnvSystem<'dancingJellyMoss'>({
    flag: 'dancingJellyMoss',
    load: () => import('../dancing_jelly_moss'),
    install: (ctx, mod) => {
        const { DancingJellyMossSystem } = mod as typeof import('../dancing_jelly_moss');
        ctx.installEnvPartial({ dancingJellyMossSystem: new DancingJellyMossSystem(ctx.scene) });
    },
    activate: (host, value) => host.dancingJellyMossSystem.activate(objectConfig(value)),
    deactivate: (host) => host.dancingJellyMossSystem.deactivate()
});

export const weather = defineEnvSystem<'weather'>({
    flag: 'weather',
    load: () => import('../weather_system'),
    install: (ctx, mod) => {
        const { WeatherSystem } = mod as typeof import('../weather_system');
        ctx.installEnvPartial({ weatherSystem: new WeatherSystem(ctx.scene) });
    },
    activate: (host) => host.weatherSystem.activate(),
    deactivate: (host) => host.weatherSystem.deactivate()
});

export const singingGeodes = defineEnvSystem<'singingGeodes'>({
    flag: 'singingGeodes',
    load: () => import('../singing_geodes'),
    install: (ctx, mod) => {
        const { SingingGeodeSystem } = mod as typeof import('../singing_geodes');
        ctx.installEnvPartial({
            singingGeodeSystem: new SingingGeodeSystem(ctx.scene, ctx.game.audioSystem, ctx.game.particleSystem)
        });
    },
    activate: (host, value) => host.singingGeodeSystem.activate(densityFromConfig(value)),
    deactivate: (host) => host.singingGeodeSystem.deactivate()
});

export const cloudCastles = defineEnvSystem<'cloudCastles'>({
    flag: 'cloudCastles',
    load: () => import('../cloud_castles_system'),
    install: (ctx, mod) => {
        const { CloudCastlesSystem } = mod as typeof import('../cloud_castles_system');
        ctx.installEnvPartial({ cloudCastlesSystem: new CloudCastlesSystem(ctx.scene) });
    },
    activate: (host, value) => host.cloudCastlesSystem.activate(objectConfig(value)),
    deactivate: (host) => host.cloudCastlesSystem.deactivate()
});

export const grappleIsles = defineEnvSystem<'grappleIsles'>({
    flag: 'grappleIsles',
    load: () => import('../grapple_isles'),
    install: (ctx, mod) => {
        const { GrappleIslesSystem } = mod as typeof import('../grapple_isles');
        ctx.installEnvPartial({ grappleIslesSystem: new GrappleIslesSystem(ctx.scene) });
    },
    activate: (host, value) => host.grappleIslesSystem.activate(objectConfig(value)),
    deactivate: (host) => host.grappleIslesSystem.deactivate()
});

export const skyRailTerminal = defineEnvSystem<'skyRailTerminal'>({
    flag: 'skyRailTerminal',
    load: () => import('../sky_rail_terminal'),
    install: (ctx, mod) => {
        const { SkyRailTerminalSystem } = mod as typeof import('../sky_rail_terminal');
        ctx.installEnvPartial({ skyRailTerminalSystem: new SkyRailTerminalSystem(ctx.scene) });
    },
    activate: (host, value) => host.skyRailTerminalSystem.activate(typeof value === 'object' ? value : undefined),
    deactivate: (host) => host.skyRailTerminalSystem.deactivate()
});

export const windCurrents = defineEnvSystem<'windCurrents'>({
    flag: 'windCurrents',
    load: () => import('../wind_currents'),
    install: (ctx, mod) => {
        const { WindCurrentsSystem } = mod as typeof import('../wind_currents');
        ctx.installEnvPartial({ windCurrentsSystem: new WindCurrentsSystem(ctx.scene) });
    },
    activate: (host, value) => host.windCurrentsSystem.activate(objectConfig(value)),
    deactivate: (host) => host.windCurrentsSystem.deactivate()
});

export const flowerConstellations = defineEnvSystem<'flowerConstellations'>({
    flag: 'flowerConstellations',
    load: () => import('../flower_constellations_system'),
    install: (ctx, mod) => {
        const { FlowerConstellationsSystem } = mod as typeof import('../flower_constellations_system');
        const system = new FlowerConstellationsSystem(ctx.scene, ctx.game.audioSystem, ctx.game.particleSystem);
        ctx.assignGameSystem('flowerConstellationsSystem', system);
        ctx.installEnvPartial({ flowerConstellationsSystem: system });
    },
    activate: (host, value, _cfg, levelLength) => host.flowerConstellationsSystem.activate(value, levelLength),
    deactivate: (host) => host.flowerConstellationsSystem.deactivate()
});

export const hideAndSeekStars = defineEnvSystem<'hideAndSeekStars'>({
    flag: 'hideAndSeekStars',
    load: () => import('../hide_and_seek_stars'),
    install: (ctx, mod) => {
        const { HideAndSeekStarsSystem } = mod as typeof import('../hide_and_seek_stars');
        ctx.installEnvPartial({ hideAndSeekStarsSystem: new HideAndSeekStarsSystem(ctx.scene) });
    },
    activate: (host) => host.hideAndSeekStarsSystem.activate(),
    deactivate: (host) => host.hideAndSeekStarsSystem.deactivate()
});

export const bouncePads = defineEnvSystem<'bouncePads'>({
    flag: 'bouncePads',
    load: () => import('../bounce_pads'),
    install: (ctx, mod) => {
        const { BouncePadsSystem } = mod as typeof import('../bounce_pads');
        ctx.installEnvPartial({ bouncePadsSystem: new BouncePadsSystem(ctx.scene) });
    },
    activate: (host, value) => host.bouncePadsSystem.activate(typeof value === 'object' ? value : undefined),
    deactivate: (host) => host.bouncePadsSystem.deactivate()
});

export const spaceGarden = defineEnvSystem<'spaceGarden'>({
    flag: 'spaceGarden',
    load: () => import('../space_garden'),
    install: (ctx, mod) => {
        const { SpaceGardenSystem } = mod as typeof import('../space_garden');
        ctx.installEnvPartial({ spaceGardenSystem: new SpaceGardenSystem(ctx.scene) });
    },
    activate: (host) => host.spaceGardenSystem.activate(),
    deactivate: (host) => host.spaceGardenSystem.deactivate()
});

export const comboCorridor = defineEnvSystem<'comboCorridor'>({
    flag: 'comboCorridor',
    load: () => import('../combo_corridor'),
    install: (ctx, mod) => {
        const { ComboCorridorSystem } = mod as typeof import('../combo_corridor');
        ctx.installEnvPartial({ comboCorridorSystem: new ComboCorridorSystem(ctx.scene) });
    },
    activate: (host, value) => host.comboCorridorSystem.activate(typeof value === 'object' ? value : undefined),
    deactivate: (host) => host.comboCorridorSystem.deactivate()
});

export const timeShiftZones = defineEnvSystem<'timeShiftZones'>({
    flag: 'timeShiftZones',
    load: () => import('../time_shift_zones'),
    install: (ctx, mod) => {
        const { TimeShiftZonesSystem } = mod as typeof import('../time_shift_zones');
        ctx.installEnvPartial({ timeShiftZonesSystem: new TimeShiftZonesSystem(ctx.scene) });
    },
    activate: (host, value) => host.timeShiftZonesSystem.activate(objectConfig(value)),
    deactivate: (host) => host.timeShiftZonesSystem.deactivate()
});

export const aerialGuardPatrol = defineEnvSystem<'aerialGuardPatrol'>({
    flag: 'aerialGuardPatrol',
    load: () => import('../aerial_guard_patrol'),
    install: (ctx, mod) => {
        const { AerialGuardPatrolSystem } = mod as typeof import('../aerial_guard_patrol');
        ctx.installEnvPartial({ aerialGuardPatrolSystem: new AerialGuardPatrolSystem(ctx.scene) });
    },
    activate: (host, value) => host.aerialGuardPatrolSystem.activate(objectConfig(value)),
    deactivate: (host) => host.aerialGuardPatrolSystem.deactivate()
});

export const airTokens = defineEnvSystem<'airTokens'>({
    flag: 'airTokens',
    load: () => import('../air_tokens'),
    install: (ctx, mod) => {
        const { AirTokensSystem } = mod as typeof import('../air_tokens');
        ctx.installEnvPartial({ airTokensSystem: new AirTokensSystem(ctx.scene) });
    },
    activate: (host, value) => host.airTokensSystem.activate(typeof value === 'object' ? value : undefined),
    deactivate: (host) => host.airTokensSystem.deactivate()
});

export const shootingStars = defineEnvSystem<'shootingStars'>({
    flag: 'shootingStars',
    load: () => import('../shooting_stars'),
    install: (ctx, mod) => {
        const { ShootingStarsSystem } = mod as typeof import('../shooting_stars');
        ctx.installEnvPartial({ shootingStarsSystem: new ShootingStarsSystem(ctx.scene, ctx.game.particleSystem) });
    },
    activate: (host) => host.shootingStarsSystem?.activate(),
    deactivate: (host) => host.shootingStarsSystem?.deactivate()
});

export const fossilizedSpaceWhales = defineEnvSystem<'fossilizedSpaceWhales'>({
    flag: 'fossilizedSpaceWhales',
    load: () => import('../fossilized_space_whales'),
    install: (ctx, mod) => {
        const { FossilizedSpaceWhalesSystem } = mod as typeof import('../fossilized_space_whales');
        const system = new FossilizedSpaceWhalesSystem(ctx.scene);
        system.setObstacleTracking((obs) => ctx.game.obstacleSystem.addObstacle(obs));
        ctx.installEnvPartial({ fossilizedSpaceWhalesSystem: system });
    },
    activate: (host, value) => host.fossilizedSpaceWhalesSystem.activate(objectConfig(value)),
    deactivate: (host) => host.fossilizedSpaceWhalesSystem.deactivate()
});

/**
 * Declaration order matches `DEFERRED_ENV_PLUGIN_ORDER` in `level_env_registry.ts`,
 * with `dreamPortals` and `aquaticLife` (load-only, no plugin order) inserted
 * next to the neighbours they sit beside in `DEFERRED_ENV_REGISTRY`.
 */
export const ENV_SYSTEM_MANIFEST = [
    dynamicStarfield,
    dayNightCycle,
    candyPlanetRing,
    pastelNebula,
    candyField,
    wishLanterns,
    spacePetsSwarm,
    blackHole,
    galacticCore,
    dreamPortals,
    industrial,
    waterfall,
    planetaryHorizon,
    moonPalace,
    reEntry,
    biological,
    nebula,
    nebulaRibbons,
    cosmicDust,
    godRays,
    aurora,
    lightning,
    asteroidField,
    ghostDebris,
    voidJellyfish,
    aquaticLife,
    meteorShower,
    dancingJellyMoss,
    weather,
    singingGeodes,
    cloudCastles,
    grappleIsles,
    skyRailTerminal,
    windCurrents,
    flowerConstellations,
    hideAndSeekStars,
    bouncePads,
    spaceGarden,
    comboCorridor,
    timeShiftZones,
    aerialGuardPatrol,
    airTokens,
    shootingStars,
    fossilizedSpaceWhales
] as const;

/** Flags with no activate/deactivate wiring — excluded from plugin-order comparisons. */
export const LOAD_ONLY_ENV_FLAGS = ['dreamPortals', 'aquaticLife'] as const;
