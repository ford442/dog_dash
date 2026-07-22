import * as THREE from 'three';
import type { GhostDebrisSystem } from './ghost_debris';
import type { VoidJellyfishSystem } from './void_jellyfish';
import type { ObstacleSystem } from './obstacle_system';
import type { LevelManager } from './level_manager';
import type { SlingableObjectSystem } from './slingable_objects';
import type { ToyRocketSpawnManager } from './toy_rockets';
import type { TetherSystem } from './tether_system';
import type { SlingComboManager } from './sling_combo';
import type { SlingObjectiveManager } from './sling_objective';
import type { DiscoveryManager, CreatureCatalogManager } from './discovery_system';
import type { ResourceHarvester } from './resource_harvester';
import type { CreatureManager } from './creature_manager';
import type { AquaticLifeManager } from './aquatic_life';
import type { StarlightKoiManager } from './starlight_koi';
import type { RainbowBubbleCoralManager } from './bubble_coral';
import type { IndustrialGeometryManager } from './industrial_geometry';
import type { DebugSystem } from './debug_system';
import type { VideoTumblingStar } from './video_tumbling_star';
import type { GameManagers } from './game_managers';
import type {
    particleSystem,
    debrisSystem,
    weaponSystem,
    weaponLightManager,
    reEntrySystem,
    waterfallSystem,
    asteroidFieldSystem,
    planetaryHorizonSystem,
    meteorShowerSystem,
    industrialSystem,
    godRaySystem,
    auroraSystem,
    nebulaSystem,
    cosmicDustSystem,
    biologicalSystem,
    liquidMetalSystem,
    bossManager,
    audioSystem,
    upgradeSystem,
    pickupManager,
    heatSystem,
    starfield,
    orbManager,
    powerUpManager,
    dogController,
    hudManager,
    juiceManager,
    boostSystem,
    rollSystem,
    effectManager,
    victorySystem,
    tutorialSystem,
    saveManager,
    lightningBoltSystem,
    chromaShiftSystem,
    stormGeodeSystem,
    crystalChimeManager,
    blackHoleSystem
} from './game_systems';
import { playerState } from './game_config';
import type {
    CollisionDebugOverlay,
    WebGLMaterialFallbackRenderer,
    WireframeDebugHelper
} from './render_debug_helpers';

/** Mutable runtime bag populated during bootstrap; submodules read shared refs from here. */
export interface GameRuntime {
    playerState: typeof playerState;

    wasmExports: unknown;
    wasmMemory: Float32Array | null;

    particleSystem: typeof particleSystem;
    debrisSystem: typeof debrisSystem;
    weaponSystem: typeof weaponSystem;
    weaponLightManager: typeof weaponLightManager;
    reEntrySystem: typeof reEntrySystem;
    waterfallSystem: typeof waterfallSystem;
    asteroidFieldSystem: typeof asteroidFieldSystem;
    planetaryHorizonSystem: typeof planetaryHorizonSystem;
    meteorShowerSystem: typeof meteorShowerSystem;
    industrialSystem: typeof industrialSystem;
    godRaySystem: typeof godRaySystem;
    auroraSystem: typeof auroraSystem;
    nebulaSystem: typeof nebulaSystem;
    cosmicDustSystem: typeof cosmicDustSystem;
    biologicalSystem: typeof biologicalSystem;
    liquidMetalSystem: typeof liquidMetalSystem;
    bossManager: typeof bossManager;
    audioSystem: typeof audioSystem;
    upgradeSystem: typeof upgradeSystem;
    pickupManager: typeof pickupManager;
    heatSystem: typeof heatSystem;
    starfield: typeof starfield;
    orbManager: typeof orbManager;
    powerUpManager: typeof powerUpManager;
    dogController: typeof dogController;
    hudManager: typeof hudManager;
    juiceManager: typeof juiceManager;
    boostSystem: typeof boostSystem;
    rollSystem: typeof rollSystem;
    effectManager: typeof effectManager;
    victorySystem: typeof victorySystem;
    tutorialSystem: typeof tutorialSystem;
    saveManager: typeof saveManager;
    lightningBoltSystem: typeof lightningBoltSystem;
    chromaShiftSystem: typeof chromaShiftSystem;
    stormGeodeSystem: typeof stormGeodeSystem;
    crystalChimeManager: typeof crystalChimeManager;
    blackHoleSystem: typeof blackHoleSystem;

    friendsManager: GameManagers['friendsManager'];
    flowerManager: GameManagers['flowerManager'];
    pinwheelManager: GameManagers['pinwheelManager'];
    candyManager: GameManagers['candyManager'];
    castleManager: GameManagers['castleManager'];
    butterflySwarmSystem: GameManagers['butterflySwarmSystem'];
    solarSailFernManager: GameManagers['solarSailFernManager'];
    windChimeManager: GameManagers['windChimeManager'];

    ghostDebrisSystem: GhostDebrisSystem;
    voidJellyfishSystem: VoidJellyfishSystem;
    slingableObjectSystem: SlingableObjectSystem;
    toyRocketSpawnManager: ToyRocketSpawnManager;
    tetherSystem: TetherSystem;
    slingComboManager: SlingComboManager;
    slingObjectiveManager: SlingObjectiveManager;
    discoveryManager: DiscoveryManager;
    resourceHarvester: ResourceHarvester;
    creatureCatalogManager: CreatureCatalogManager;
    creatureManager: CreatureManager;
    aquaticLifeManager: AquaticLifeManager;
    starlightKoiManager: StarlightKoiManager;
    bubbleCoralManager: RainbowBubbleCoralManager;
    industrialGeometryManager: IndustrialGeometryManager;
    debugSystem: DebugSystem;
    levelManager: LevelManager;
    obstacleSystem: ObstacleSystem;

    moon: THREE.Group;
    galaxy1: THREE.Object3D;
    galaxy2: THREE.Object3D;
    galaxy3: THREE.Object3D;
    videoTumblingStars: VideoTumblingStar[];

    clock: THREE.Clock;
    lastPlayerDamageTime: number;
    aquaticLifeSpawnedLevel: number | null;
    koiSpawnedLevel: number | null;
    coralSpawnedLevel: number | null;
    level6BossDefeated: boolean;
    whaleSongTimer: number;
    moonGateSequenceActive: boolean;
    moonGateSequenceTimer: number;
    krakenMemoryRewarded: WeakSet<object>;
    wrenchChargeAvailable: boolean;
    scoreMultiplierUntil: number;
    scoreMultiplierValue: number;
    tetherSpriteSweep: number;
    tetherSpritePrevAngle: number | null;

    fpsFrameCount: number;
    fpsElapsedTime: number;
    fpsLowDuration: number;
    fpsHighDuration: number;
    currentRatioIndex: number;
    currentPixelRatio: number;
    objectDensityMultiplier: number;
    shadowCullingFrame: number;
    shadowCullingWarningIssued: boolean;
    renderDebugWarningIssued: boolean;
    geologicalUpdateFrame: number;

    wireframeDebugHelper: WireframeDebugHelper;
    collisionDebugOverlay: CollisionDebugOverlay;
    webglMaterialFallbackRenderer: WebGLMaterialFallbackRenderer;

    bestiaryUI: HTMLDivElement | null;

    reportComboObjectiveProgress: () => void;
    handleGameOver: () => void;
    /** Re-attach slingable callbacks after deferred manager swap. */
    rewireSlingableCallbacks: () => void;

    wantsBoost: boolean;
    wasTouchBoosting: boolean;
    wantsRoll: boolean;
    wasTouchRolling: boolean;
    wantsTether: boolean;
    wantsReleaseTether: boolean;
}

export const game: GameRuntime = {
    playerState,
    wasmExports: null,
    wasmMemory: null,
} as GameRuntime;
