import type { LevelConfig, LevelEnvironments } from '../level_config';
import type * as THREE from 'three';
import type { GodRaySystem } from '../godrays';
import type { AuroraSystem } from '../aurora';
import type { GhostDebrisSystem } from '../ghost_debris';
import type { VoidJellyfishSystem } from '../void_jellyfish';
import type { DebugSystem } from '../debug_system';
import type { FriendsManager } from '../space_friends';
import type { ButterflySwarmSystem } from '../butterfly_swarm';
import type { WeaponLightManager } from '../lighting';
import type { ConstellationManager } from '../flower_constellations';
import type { PinwheelFloraManager } from '../pinwheel_flora';
import type { WindChimeManager } from '../wind_chimes';
import type { SolarSailFernManager } from '../solar_sail_ferns';
import type { CastleBackgroundManager } from '../cloud_castles';
import type { CandyBeltManager } from '../candy_obstacles';
import type { IndustrialGeometryManager } from '../industrial_geometry';
import type { ParticleSystem } from '../particles';
import type { JuiceManager } from '../juice_effects';
import type { LightningBoltSystem } from '../lightning_bolt';
import type { CrystalChimeManager } from '../crystal_chimes';
import type { NebulaSystem } from '../nebula';
import type { AsteroidFieldSystem } from '../asteroid_field';
import type { WaterfallSystem } from '../waterfall';
import type { IndustrialBackgroundSystem } from '../industrial_background';
import type { BiologicalBackgroundSystem } from '../biological_background';
import type { MeteorShowerSystem } from '../meteor_shower';
import type { CosmicDustSystem } from '../cosmic_dust';
import type { PlanetaryHorizonSystem } from '../planetary_horizon';
import type { MoonPalaceSystem } from '../moon_palace';
import type { BlackHoleSystem } from '../black_hole';
import type { ReEntrySystem } from '../reentry';
import type { ChromaShiftSystem } from '../chroma_shift';
import type { StormGeodeSystem } from '../storm_geodes';
import type { PastelNebulaSystem } from '../pastel_nebula';
import type { WishLanternSystem } from '../wish_lanterns';

export type EnvironmentPlugin<K extends keyof LevelEnvironments = keyof LevelEnvironments> = {
    flag: K;
    activate: (value: NonNullable<LevelEnvironments[K]>) => void;
    deactivate: () => void;
};

export function isEnvironmentEnabled(value: LevelEnvironments[keyof LevelEnvironments] | undefined): boolean {
    if (!value) return false;
    if (typeof value === 'boolean') return value;
    if ('enabled' in value) return value.enabled;
    // For configs like asteroidField or ghostDebris that might not have an enabled flag but have a value
    return true;
}

export type GeologicalSpawners = {
    createSporeCloudAtPosition: (x: number, y: number, z: number) => unknown;
    createVoidRootBallAtPosition: (x: number, y: number, z: number) => unknown;
    createVacuumKelpAtPosition: (x: number, y: number, z: number) => unknown;
    createIceNeedleClusterAtPosition: (x: number, y: number, z: number) => unknown;
    createLiquidMetalBlobAtPosition: (x: number, y: number, z: number) => unknown;
    createMagmaHeartAtPosition: (x: number, y: number, z: number) => unknown;
    createGravityAnchorAtPosition: (x: number, y: number, z: number, biome?: number) => unknown;
    createGeodeAtPosition: (x: number, y: number, z: number) => unknown;
};

export type GeologicalCounts = {
    sporeClouds: () => number;
    voidRootBalls: () => number;
    vacuumKelps: () => number;
    iceNeedleClusters: () => number;
    magmaHearts: () => number;
    gravityAnchors: () => number;
    geodes: () => number;
};

/** Level-environment systems injected from GameContext (not imported as singletons). */
export type LevelEnvironmentPorts = {
    particleSystem: ParticleSystem;
    juiceManager: JuiceManager;
    lightningBoltSystem: LightningBoltSystem;
    crystalChimeManager: CrystalChimeManager;
    nebulaSystem: NebulaSystem;
    asteroidFieldSystem: AsteroidFieldSystem;
    waterfallSystem: WaterfallSystem;
    industrialSystem: IndustrialBackgroundSystem;
    biologicalSystem: BiologicalBackgroundSystem;
    meteorShowerSystem: MeteorShowerSystem;
    cosmicDustSystem: CosmicDustSystem;
    planetaryHorizonSystem: PlanetaryHorizonSystem;
    moonPalaceSystem: MoonPalaceSystem;
    blackHoleSystem: BlackHoleSystem;
    reEntrySystem: ReEntrySystem;
    chromaShiftSystem: ChromaShiftSystem;
    stormGeodeSystem: StormGeodeSystem;
    pastelNebulaSystem: PastelNebulaSystem;
    wishLanternSystem: WishLanternSystem;
};

export type LevelManagerOptions = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    weaponLightManager: WeaponLightManager;
    godRaySystem: GodRaySystem;
    auroraSystem: AuroraSystem;
    ghostDebrisSystem: GhostDebrisSystem;
    voidJellyfishSystem: VoidJellyfishSystem;
    debugSystem?: DebugSystem;
    friendsManager?: FriendsManager;
    industrialGeometryManager: IndustrialGeometryManager;
    butterflySwarmSystem: ButterflySwarmSystem;
    flowerManager: ConstellationManager;
    pinwheelManager: PinwheelFloraManager;
    windChimeManager: WindChimeManager;
    solarSailFernManager: SolarSailFernManager;
    castleManager: CastleBackgroundManager;
    candyManager: CandyBeltManager;
    getPlayer: () => THREE.Group | null;
    spawners: GeologicalSpawners;
    geologicalCounts: GeologicalCounts;
    onLevelStart?: (cfg: LevelConfig) => void;
    onUpdateLevelDisplay?: (levelIndex: number, name: string) => void;
    env: LevelEnvironmentPorts;
};
