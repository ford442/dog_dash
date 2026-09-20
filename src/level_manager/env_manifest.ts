/**
 * Live deferred-env manifest. `level_env_registry.ts` loads plugins and WASM
 * chunks from `ENV_SYSTEM_MANIFEST` — do not re-declare the same flags in a
 * second table.
 *
 * Declaration order (minus load-only `dreamPortals` / `aquaticLife`) is the
 * plugin activation order.
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
    label: 'Dynamic Starfield',
    role: 'backdrop',
    biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
    paletteTags: ['monochrome', 'cool'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 800 }, // 4 parallax layers, 100+200+300+200 (dynamic_starfield.ts)
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
    label: 'Day/Night Cycle',
    role: 'backdrop',
    biomes: ['candy'],
    paletteTags: ['warm', 'cool'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 900 }, // 3 star layers x starCountPerLayer=300 (day_night_cycle.ts)
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
    label: 'Candy Planet Ring',
    role: 'backdrop',
    biomes: ['candy', 'nebula'],
    paletteTags: ['pastel', 'neon'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 77 }, // 3 candy layers, 12+25+40 (candy_field_system.ts)
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
    label: 'Pastel Nebula',
    role: 'backdrop',
    biomes: ['candy'],
    paletteTags: ['pastel'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 125 }, // 3 layers, 25+20+80 (pastel_nebula.ts)
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
    label: 'Candy Field',
    role: 'backdrop',
    biomes: ['candy', 'nebula'],
    paletteTags: ['pastel', 'neon'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 77 }, // same underlying candyPlanetRing system (candy_field_system.ts)
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
    label: 'Wish Lanterns',
    role: 'flavor',
    biomes: ['candy'],
    paletteTags: ['warm', 'pastel'],
    difficultyWeight: 1,
    budget: { category: 'effects', instances: 80 }, // fixed count (wish_lanterns.ts)
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
    label: 'Space Pets Swarm',
    role: 'flavor',
    biomes: ['candy'],
    paletteTags: ['pastel'],
    difficultyWeight: 1,
    budget: { category: 'creatures', instances: 60 }, // fixed count (space_pets_swarm.ts)
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
    label: 'Black Hole',
    role: 'hazard',
    biomes: ['nebula'],
    paletteTags: ['monochrome', 'cool'],
    difficultyWeight: 4,
    budget: { category: 'background3d', instances: 5 }, // hero set-piece: event horizon, disk, halo, lensing, shockwave (black_hole.ts)
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
    label: 'Galactic Core',
    role: 'backdrop',
    biomes: ['crystalline'],
    paletteTags: ['warm', 'iridescent'],
    difficultyWeight: 2,
    budget: { category: 'background3d', instances: 4 }, // finale set-piece, 4 meshes (already on the registrar as `galactic_core`)
    load: () => import('../galactic_core'),
    install: (ctx, mod) => {
        const { GalacticCoreSystem } = mod as typeof import('../galactic_core');
        ctx.installEnvPartial({ galacticCoreSystem: new GalacticCoreSystem(ctx.scene) });
    },
    activate: (host, value) => host.galacticCoreSystem.activate(value),
    deactivate: (host) => host.galacticCoreSystem.deactivate()
});

/**
 * Load-only: no activate/deactivate wiring.
 *
 * Dynamically imports `dream_portal_update` inside `install` so this module
 * stays importable under `node --test` (`dream_portal_update` pulls in
 * `scene_context`, which touches `document` at import time).
 */
export const dreamPortals = defineEnvSystem<'dreamPortals'>({
    flag: 'dreamPortals',
    label: 'Dream Portals',
    role: 'flavor',
    biomes: ['candy', 'nebula', 'crystalline'],
    paletteTags: ['iridescent', 'pastel'],
    difficultyWeight: 1,
    budget: { category: 'effects', instances: 27 }, // dream_portal (3) + dream_room_props (18 toys + 4 hazards + 2), both already on the registrar
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
    label: 'Industrial Background',
    role: 'backdrop',
    biomes: ['industrial'],
    paletteTags: ['warm', 'monochrome'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 102 }, // 8 layers summed, 20+30+12+15+6+6+5+8 (industrial_background/system.ts)
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
    label: 'Waterfall',
    role: 'backdrop',
    biomes: ['crystalline'],
    paletteTags: ['cool'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 300 }, // stream (100) + mist particles (200) (waterfall.ts)
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
    label: 'Planetary Horizon',
    role: 'backdrop',
    biomes: ['nebula'],
    paletteTags: ['warm', 'cool'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 7 }, // hero set-piece: horizon, planet, clouds, atmosphere, rings, moon-gate ring/core (planetary_horizon.ts)
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
    label: 'Moon Palace',
    role: 'backdrop',
    biomes: ['crystalline'],
    paletteTags: ['cool', 'monochrome'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 117 }, // windows (100) + 2 more InstancedMesh pools (5 + 12) (moon_palace.ts)
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
    label: 'Re-Entry',
    role: 'hazard',
    biomes: ['nebula'],
    paletteTags: ['warm'],
    difficultyWeight: 3,
    budget: { category: 'effects', instances: 50 }, // fixed streakCount (reentry.ts)
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
    label: 'Biological Background',
    role: 'backdrop',
    biomes: ['biological'],
    paletteTags: ['iridescent', 'cool'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 70 }, // 2 InstancedMesh groups, 40+30 (biological_background.ts)
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
    label: 'Nebula',
    role: 'backdrop',
    biomes: ['nebula', 'biological'],
    paletteTags: ['cool', 'iridescent'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 119 }, // cloud_puffs (45) + energy_motes (50) + ribbons (24), all already on the registrar
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
    label: 'Nebula Ribbons',
    role: 'backdrop',
    biomes: ['nebula', 'biological', 'crystalline'],
    paletteTags: ['cool', 'iridescent'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 24 }, // same nebula system, ribbons only (already on the registrar as `nebula_ribbons`)
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
    label: 'Cosmic Dust',
    role: 'backdrop',
    biomes: ['nebula', 'biological'],
    paletteTags: ['cool', 'iridescent'],
    difficultyWeight: 1,
    budget: { category: 'effects', instances: 2000 }, // fixed particle count (cosmic_dust.ts)
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
    label: 'God Rays',
    role: 'backdrop',
    biomes: ['candy', 'nebula', 'biological'],
    paletteTags: ['warm'],
    difficultyWeight: 1,
    budget: { category: 'effects', instances: 20 }, // fixed maxCount (godrays.ts)
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
    label: 'Aurora',
    role: 'backdrop',
    biomes: ['crystalline'],
    paletteTags: ['cool', 'iridescent'],
    difficultyWeight: 1,
    budget: { category: 'effects', instances: 10 }, // fixed maxCount ribbons (aurora.ts)
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
    label: 'Lightning',
    role: 'hazard',
    biomes: ['candy', 'nebula', 'biological'],
    paletteTags: ['monochrome', 'neon'],
    difficultyWeight: 2,
    budget: { category: 'effects', instances: 20 }, // 2 InstancedMesh classes, count=10 default each (lightning_bolt.ts)
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
    label: 'Asteroid Field',
    role: 'hazard',
    biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
    paletteTags: ['monochrome', 'warm'],
    difficultyWeight: 2,
    budget: { category: 'background3d', instances: 135 }, // 3 layers, 15+40+80 maxCount (asteroid_field.ts)
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
    label: 'Ghost Debris',
    role: 'hazard',
    biomes: ['nebula'],
    paletteTags: ['monochrome', 'cool'],
    difficultyWeight: 3,
    budget: { category: 'background3d', instances: 100 }, // fixed count default, matches level_config.ts density:100 (ghost_debris.ts)
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
    label: 'Void Jellyfish',
    role: 'flavor',
    biomes: ['biological', 'crystalline'],
    paletteTags: ['iridescent', 'cool'],
    difficultyWeight: 1,
    budget: { category: 'creatures', instances: 60 }, // fixed MAX_INSTANCES pool (void_jellyfish.ts)
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

/** Load-only: no activate/deactivate wiring. */
export const aquaticLife = defineEnvSystem<'aquaticLife'>({
    flag: 'aquaticLife',
    label: 'Aquatic Life',
    role: 'flavor',
    biomes: ['crystalline'],
    paletteTags: ['cool'],
    difficultyWeight: 1,
    budget: { category: 'creatures', instances: 40 }, // rough estimate (aquatic_life.ts); load-only flag, no activate/deactivate
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
    label: 'Meteor Shower',
    role: 'hazard',
    biomes: ['nebula'],
    paletteTags: ['warm'],
    difficultyWeight: 3,
    budget: { category: 'effects', instances: 95 }, // 3 depth layers, 15+30+50 (meteor_shower.ts)
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
    label: 'Dancing Jelly Moss',
    role: 'flavor',
    biomes: ['candy', 'biological'],
    paletteTags: ['iridescent', 'pastel'],
    difficultyWeight: 1,
    budget: { category: 'foliage', instances: 800 }, // moss (200) + fairy lights (mossCount*3=600) fixed pools (dancing_jelly_moss.ts)
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
    label: 'Weather',
    role: 'backdrop',
    biomes: ['crystalline'],
    paletteTags: ['cool', 'monochrome'],
    difficultyWeight: 2,
    budget: { category: 'effects', instances: 2000 }, // fixed rain/snow particle count (weather_system.ts)
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
    label: 'Singing Geodes',
    role: 'flavor',
    biomes: ['biological', 'crystalline'],
    paletteTags: ['cool', 'iridescent'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 80 }, // matches `singing_geodes` decoration_budget registration
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
    label: 'Cloud Castles',
    role: 'flavor',
    biomes: ['candy', 'biological'],
    paletteTags: ['pastel'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 20 }, // matches `cloud_castles` decoration_budget registration
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
    label: 'Grapple Isles',
    role: 'traversal',
    biomes: ['candy'],
    paletteTags: ['pastel', 'neon'],
    difficultyWeight: 2,
    budget: { category: 'background3d', instances: 50 }, // matches `grapple_isles` decoration_budget registration
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
    label: 'Sky Rail Terminal',
    role: 'traversal',
    biomes: ['industrial'],
    paletteTags: ['cool'],
    difficultyWeight: 2,
    budget: { category: 'background3d', instances: 70 }, // rails (60) + terminals (10), matches the two `sky_rail_terminal_*` decoration_budget ids summed
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
    label: 'Wind Currents',
    role: 'traversal',
    biomes: ['nebula'],
    paletteTags: ['cool'],
    difficultyWeight: 2,
    budget: { category: 'effects', instances: 800 }, // matches `wind_currents` decoration_budget registration (level 2's 2 zones, 400 each)
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
    label: 'Flower Constellations',
    role: 'flavor',
    biomes: ['candy', 'nebula'],
    paletteTags: ['pastel', 'neon'],
    difficultyWeight: 1,
    budget: { category: 'foliage', instances: 15 }, // matches `flower_constellations` decoration_budget registration
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
    label: 'Hide-and-Seek Stars',
    role: 'flavor',
    biomes: ['candy', 'nebula'],
    paletteTags: ['pastel', 'warm'],
    difficultyWeight: 1,
    budget: { category: 'effects', instances: 80 }, // fixed count (hide_and_seek_stars.ts)
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
    label: 'Bounce Pads',
    role: 'traversal',
    biomes: ['industrial'],
    paletteTags: ['neon', 'warm'],
    difficultyWeight: 2,
    budget: { category: 'background3d', instances: 50 }, // matches `bounce_pads` decoration_budget registration (pool size)
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
    label: 'Space Garden',
    role: 'flavor',
    biomes: ['candy'],
    paletteTags: ['pastel'],
    difficultyWeight: 1,
    budget: { category: 'foliage', instances: 80 }, // matches `space_garden` decoration_budget registration
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
    label: 'Combo Corridor',
    role: 'traversal',
    biomes: ['industrial', 'biological'],
    paletteTags: ['neon'],
    difficultyWeight: 2,
    budget: { category: 'background3d', instances: 40 }, // matches `combo_corridor` decoration_budget registration
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
    label: 'Time Shift Zones',
    role: 'traversal',
    biomes: ['industrial'],
    paletteTags: ['neon', 'cool'],
    difficultyWeight: 3,
    budget: { category: 'effects', instances: 2 }, // matches `time_shift_zones` decoration_budget registration
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
    label: 'Aerial Guard Patrol',
    role: 'hazard',
    biomes: ['industrial'],
    paletteTags: ['monochrome', 'warm'],
    difficultyWeight: 3,
    budget: { category: 'creatures', instances: 20 }, // matches `aerial_guard_patrol` decoration_budget registration (pool size)
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
    label: 'Air Tokens',
    role: 'traversal',
    biomes: ['candy'],
    paletteTags: ['neon', 'pastel'],
    difficultyWeight: 2,
    budget: { category: 'effects', instances: 32 }, // matches `air_tokens` decoration_budget registration (registerDefaultDecorationBudgets)
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
    label: 'Shooting Stars',
    role: 'flavor',
    biomes: ['candy', 'nebula'],
    paletteTags: ['warm', 'neon'],
    difficultyWeight: 1,
    budget: { category: 'effects', instances: 25 }, // matches `shooting_stars` decoration_budget registration
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
    label: 'Fossilized Space Whales',
    role: 'backdrop',
    biomes: ['biological', 'nebula'],
    paletteTags: ['cool', 'monochrome'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 310 }, // ribs (150) + fog particles (100) + barnacles (60) (fossilized_space_whales.ts)
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

export const hyperspaceTunnel = defineEnvSystem<'hyperspaceTunnel'>({
    flag: 'hyperspaceTunnel',
    label: 'Hyperspace Tunnel',
    role: 'backdrop',
    biomes: ['industrial'],
    paletteTags: ['neon'],
    difficultyWeight: 2,
    budget: { category: 'background3d', instances: 80 },
    systemKey: 'hyperspaceTunnel',
    load: () => import('../hyperspace_tunnel'),
    install: (ctx, mod) => {
        const { HyperspaceTunnelSystem } = mod as typeof import('../hyperspace_tunnel');
        ctx.installEnvPartial({ hyperspaceTunnelSystem: new HyperspaceTunnelSystem(ctx.scene) });
    },
    activate: (host, value) => host.hyperspaceTunnelSystem.activate(objectConfig(value)),
    deactivate: (host) => host.hyperspaceTunnelSystem.deactivate()
});

export const cosmicCyberGrid = defineEnvSystem<'cosmicCyberGrid'>({
    flag: 'cosmicCyberGrid',
    label: 'Cosmic Cyber Grid',
    role: 'backdrop',
    biomes: ['industrial'],
    paletteTags: ['neon'],
    difficultyWeight: 2,
    budget: { category: 'background3d', instances: 1 },
    systemKey: 'cosmicCyberGrid',
    load: () => import('../cosmic_cyber_grid'),
    install: (ctx, mod) => {
        const { CosmicCyberGridSystem } = mod as typeof import('../cosmic_cyber_grid');
        ctx.installEnvPartial({ cosmicCyberGridSystem: new CosmicCyberGridSystem(ctx.scene) });
    },
    activate: (host, value) => host.cosmicCyberGridSystem.activate(objectConfig(value)),
    deactivate: (host) => host.cosmicCyberGridSystem.deactivate()
});

export const energyRifts = defineEnvSystem<'energyRifts'>({
    flag: 'energyRifts',
    label: 'Energy Rifts',
    role: 'backdrop',
    biomes: ['nebula'],
    paletteTags: ['neon', 'iridescent'],
    difficultyWeight: 1,
    budget: { category: 'background3d', instances: 30 },
    systemKey: 'energyRifts',
    load: () => import('../energy_rifts'),
    install: (ctx, mod) => {
        const { EnergyRiftsSystem } = mod as typeof import('../energy_rifts');
        ctx.installEnvPartial({ energyRiftsSystem: new EnergyRiftsSystem(ctx.scene) });
    },
    activate: (host, value) => host.energyRiftsSystem.activate(objectConfig(value)),
    deactivate: (host) => host.energyRiftsSystem.deactivate()
});

/**
 * Declaration order (minus load-only flags) is `DEFERRED_ENV_PLUGIN_ORDER`.
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
    fossilizedSpaceWhales,
    hyperspaceTunnel,
    cosmicCyberGrid,
    energyRifts
] as const;

/** Flags with no activate/deactivate wiring — excluded from plugin-order comparisons. */
export const LOAD_ONLY_ENV_FLAGS = ['dreamPortals', 'aquaticLife'] as const;
