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
import type { GameSystems } from './create_game_systems';
import type { WasmExports } from './wasm_loader';
import { playerState } from './game_config';
import type {
    CollisionDebugOverlay,
    WebGLMaterialFallbackRenderer,
    WireframeDebugHelper
} from './render_debug_helpers';

/** Fully typed mutable runtime bag owned by bootstrap. */
export interface GameContext extends GameSystems, GameManagers {
    playerState: typeof playerState;

    wasmExports: WasmExports | null;
    wasmMemory: Float32Array | null;

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
    /** Chapters whose objectives were completed this run (1–6). */
    completedChaptersThisRun: number[];

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

/** @deprecated Use GameContext */
export type GameRuntime = GameContext;

/** Live binding assigned once by bootstrap via {@link installGameContext}. */
export let game!: GameContext;

export function installGameContext(ctx: GameContext): void {
    game = ctx;
}

/** Frame / UI defaults shared by every GameContext instance. */
export function createGameContextFrameState(): Pick<
    GameContext,
    | 'wasmExports'
    | 'wasmMemory'
    | 'clock'
    | 'lastPlayerDamageTime'
    | 'aquaticLifeSpawnedLevel'
    | 'koiSpawnedLevel'
    | 'coralSpawnedLevel'
    | 'level6BossDefeated'
    | 'whaleSongTimer'
    | 'moonGateSequenceActive'
    | 'moonGateSequenceTimer'
    | 'krakenMemoryRewarded'
    | 'wrenchChargeAvailable'
    | 'scoreMultiplierUntil'
    | 'scoreMultiplierValue'
    | 'tetherSpriteSweep'
    | 'tetherSpritePrevAngle'
    | 'fpsFrameCount'
    | 'fpsElapsedTime'
    | 'fpsLowDuration'
    | 'fpsHighDuration'
    | 'currentRatioIndex'
    | 'currentPixelRatio'
    | 'objectDensityMultiplier'
    | 'shadowCullingFrame'
    | 'shadowCullingWarningIssued'
    | 'renderDebugWarningIssued'
    | 'geologicalUpdateFrame'
    | 'bestiaryUI'
    | 'completedChaptersThisRun'
    | 'wantsBoost'
    | 'wasTouchBoosting'
    | 'wantsRoll'
    | 'wasTouchRolling'
    | 'wantsTether'
    | 'wantsReleaseTether'
    | 'reportComboObjectiveProgress'
    | 'handleGameOver'
    | 'rewireSlingableCallbacks'
    | 'videoTumblingStars'
> {
    return {
        wasmExports: null,
        wasmMemory: null,
        clock: new THREE.Clock(),
        lastPlayerDamageTime: -999,
        aquaticLifeSpawnedLevel: null,
        koiSpawnedLevel: null,
        coralSpawnedLevel: null,
        level6BossDefeated: false,
        whaleSongTimer: 30,
        moonGateSequenceActive: false,
        moonGateSequenceTimer: 0,
        krakenMemoryRewarded: new WeakSet<object>(),
        wrenchChargeAvailable: false,
        scoreMultiplierUntil: 0,
        scoreMultiplierValue: 1,
        tetherSpriteSweep: 0,
        tetherSpritePrevAngle: null,
        fpsFrameCount: 0,
        fpsElapsedTime: 0,
        fpsLowDuration: 0,
        fpsHighDuration: 0,
        currentRatioIndex: 1,
        currentPixelRatio: 1,
        objectDensityMultiplier: 1.0,
        shadowCullingFrame: 0,
        shadowCullingWarningIssued: false,
        renderDebugWarningIssued: false,
        geologicalUpdateFrame: 0,
        bestiaryUI: null,
        completedChaptersThisRun: [],
        wantsBoost: false,
        wasTouchBoosting: false,
        wantsRoll: false,
        wasTouchRolling: false,
        wantsTether: false,
        wantsReleaseTether: false,
        reportComboObjectiveProgress: () => {},
        handleGameOver: () => {},
        rewireSlingableCallbacks: () => {},
        videoTumblingStars: []
    };
}
