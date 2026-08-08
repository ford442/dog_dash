import type { CandyFieldSystem } from './candy_obstacles/candy_field_system';
import type { BlackHoleSystem } from './black_hole';
import type { GalacticCoreSystem } from './galactic_core';
import type { DreamPortalSystem } from './dream_portal';
import type { MeteorShowerSystem } from './meteor_shower';
import type { PlanetaryHorizonSystem } from './planetary_horizon';
import type { ReEntrySystem } from './reentry';
import type { WaterfallSystem } from './waterfall';
import type { IndustrialBackgroundSystem } from './industrial_background';
import type { BiologicalBackgroundSystem } from './biological_background';
import type { CosmicDustSystem } from './cosmic_dust';
import type { MoonPalaceSystem } from './moon_palace';
import type { ChromaShiftSystem } from './chroma_shift';
import type { StormGeodeSystem } from './storm_geodes';
import type { BossManager } from './boss_system';
import type { GhostDebrisSystem } from './ghost_debris';
import type { VoidJellyfishSystem } from './void_jellyfish';
import type { IndustrialGeometryManager } from './industrial_geometry';
import type { AquaticLifeManager } from './aquatic_life';
import type { StarlightKoiManager } from './starlight_koi';
import type { RainbowBubbleCoralManager } from './bubble_coral';
import type { SlingableObjectSystem } from './slingable_objects';
import type { ToyRocketSpawnManager } from './toy_rockets';
import type { WishLanternSystem } from './wish_lanterns';
import type { WeatherSystem } from './weather_system';
import type { DancingJellyMossSystem } from './dancing_jelly_moss';
import type { DynamicStarfieldSystem } from './dynamic_starfield';
import type { DayNightCycleSystem } from './day_night_cycle';
import type { CloudCastlesSystem } from './cloud_castles_system';
import type { SingingGeodeSystem } from './singing_geodes';

const noop = () => undefined;

export function createBossManagerStub(): BossManager {
    return {
        checkBossSpawn: () => false,
        update: () => ({ pullForce: 0, isSnapping: false }),
        getBoss: () => null
    } as unknown as BossManager;
}

export function createWaterfallSystemStub(): WaterfallSystem {
    return {
        levelDistance: 2000,
        activate: noop,
        deactivate: noop,
        update: noop,
        triggerSplash: noop
    } as unknown as WaterfallSystem;
}

export function createIndustrialSystemStub(): IndustrialBackgroundSystem {
    return {
        activate: noop,
        deactivate: noop,
        update: noop
    } as unknown as IndustrialBackgroundSystem;
}

export function createBiologicalSystemStub(): BiologicalBackgroundSystem {
    return {
        activate: noop,
        deactivate: noop,
        update: noop
    } as unknown as BiologicalBackgroundSystem;
}

export function createCosmicDustSystemStub(): CosmicDustSystem {
    return {
        activate: noop,
        deactivate: noop,
        update: noop
    } as unknown as CosmicDustSystem;
}

export function createBlackHoleSystemStub(): BlackHoleSystem {
    return {
        active: false,
        activate: noop,
        deactivate: noop,
        update: noop,
        getPlayerPullForce: () => 0,
        handleProjectileInteractions: noop
    } as unknown as BlackHoleSystem;
}

export function createGalacticCoreSystemStub(): GalacticCoreSystem {
    return {
        active: false,
        activate: noop,
        deactivate: noop,
        update: noop,
        cleanup: noop,
        getApproachIntensity: () => 0,
        getStarfieldWarp: () => 0,
        getProjectilePull: (_pos: unknown, _delta: number, out?: unknown) => out
    } as unknown as GalacticCoreSystem;
}

export function createDreamPortalSystemStub(): DreamPortalSystem {
    return {
        spawnPortals: noop,
        clear: noop,
        update: noop,
        cleanup: noop,
        getScannables: () => [],
        isActive: () => false,
        isInRoom: () => false,
        getRoomOriginY: () => 0
    } as unknown as DreamPortalSystem;
}

export function createMeteorShowerSystemStub(): MeteorShowerSystem {
    return {
        activate: noop,
        deactivate: noop,
        update: noop,
        hitMeteor: () => false
    } as unknown as MeteorShowerSystem;
}

export function createPlanetaryHorizonSystemStub(): PlanetaryHorizonSystem {
    return {
        levelDistance: 2200,
        activate: noop,
        deactivate: noop,
        update: noop,
        updateMoonGate: noop,
        activateMoonGate: noop
    } as unknown as PlanetaryHorizonSystem;
}

export function createMoonPalaceSystemStub(): MoonPalaceSystem {
    return {
        levelDistance: 2200,
        activate: noop,
        deactivate: noop,
        update: noop,
        cleanup: noop
    } as unknown as MoonPalaceSystem;
}

export function createReEntrySystemStub(): ReEntrySystem {
    return {
        levelDistance: 2200,
        activate: noop,
        deactivate: noop,
        update: noop,
        updateShipTint: noop
    } as unknown as ReEntrySystem;
}

export function createChromaShiftSystemStub(): ChromaShiftSystem {
    return {
        activate: noop,
        deactivate: noop,
        clearRocks: noop,
        update: noop
    } as unknown as ChromaShiftSystem;
}

export function createStormGeodeSystemStub(): StormGeodeSystem {
    return {
        activate: noop,
        deactivate: noop,
        update: noop
    } as unknown as StormGeodeSystem;
}

export function createGhostDebrisSystemStub(): GhostDebrisSystem {
    return {
        active: false,
        activate: noop,
        deactivate: noop,
        update: noop
    } as unknown as GhostDebrisSystem;
}

export function createVoidJellyfishSystemStub(): VoidJellyfishSystem {
    return {
        activate: noop,
        deactivate: noop,
        update: noop
    } as unknown as VoidJellyfishSystem;
}

export function createIndustrialGeometryManagerStub(): IndustrialGeometryManager {
    return {
        update: noop
    } as unknown as IndustrialGeometryManager;
}

export function createAquaticLifeManagerStub(): AquaticLifeManager {
    return {
        spawnForLevel: noop,
        spawnForLevel6: noop,
        update: () => [],
        clear: noop
    } as unknown as AquaticLifeManager;
}

export function createStarlightKoiManagerStub(): StarlightKoiManager {
    return {
        spawnSchools: noop,
        update: noop,
        clear: noop
    } as unknown as StarlightKoiManager;
}

export function createBubbleCoralManagerStub(): RainbowBubbleCoralManager {
    return {
        spawnClusters: noop,
        update: noop,
        clear: noop
    } as unknown as RainbowBubbleCoralManager;
}

export function createSlingableObjectSystemStub(): SlingableObjectSystem {
    return {
        onSpecialEffect: undefined,
        onDestroyed: undefined,
        objects: [],
        update: noop,
        handleAsteroidCollisions: noop,
        setLatchedTarget: noop,
        getTetherTargets: () => [],
        isInSlipstream: () => false,
        applyTetherImpulse: () => false,
        getScannables: () => [],
        createObject: () => null
    } as unknown as SlingableObjectSystem;
}

export function createToyRocketSpawnManagerStub(): ToyRocketSpawnManager {
    return {
        spawnForLevel: noop
    } as unknown as ToyRocketSpawnManager;
}

export function createWishLanternSystemStub(): WishLanternSystem {
    return {
        active: false,
        activate: noop,
        deactivate: noop,
        update: noop,
        cleanup: noop
    } as unknown as WishLanternSystem;
}

export function createWeatherSystemStub(): WeatherSystem {
    return {
        active: false,
        activate: noop,
        deactivate: noop,
        update: noop,
        cleanup: noop
    } as unknown as WeatherSystem;
}

export function createDancingJellyMossSystemStub(): DancingJellyMossSystem {
    return {
        active: false,
        activate: noop,
        deactivate: noop,
        update: noop,
        cleanup: noop
    } as unknown as DancingJellyMossSystem;
}

export function createDynamicStarfieldSystemStub(): DynamicStarfieldSystem {
    return {
        active: false,
        activate: noop,
        deactivate: noop,
        update: noop,
        cleanup: noop
    } as unknown as DynamicStarfieldSystem;
}

export function createDayNightCycleSystemStub(): DayNightCycleSystem {
    return {
        active: false,
        activate: noop,
        deactivate: noop,
        update: noop,
        cleanup: noop
    } as unknown as DayNightCycleSystem;
}

export function createCloudCastlesSystemStub(): CloudCastlesSystem {
    return {
        active: false,
        activate: noop,
        deactivate: noop,
        update: noop,
        cleanup: noop
    } as unknown as CloudCastlesSystem;
}

export function createCandyFieldSystemStub(): CandyFieldSystem {
    return {
        active: false,
        activate: () => undefined,
        deactivate: () => undefined,
        update: () => undefined,
        setVisible: () => undefined
    } as unknown as CandyFieldSystem;
}

export function createSingingGeodeSystemStub(): SingingGeodeSystem {
    return {
        active: false,
        activate: noop,
        deactivate: noop,
        update: noop,
        cleanup: noop
    } as unknown as SingingGeodeSystem;
}
import type { FlowerConstellationsSystem } from './flower_constellations_system';
export function createFlowerConstellationsSystemStub(): FlowerConstellationsSystem {
    return {
        activate: noop,
        deactivate: noop,
        update: noop,
        cleanup: noop
    } as unknown as FlowerConstellationsSystem;
}
