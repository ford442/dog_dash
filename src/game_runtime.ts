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
import type { WasmBackend, WasmExports } from './wasm_loader';
import { playerState } from './game_config';
import type {
    CollisionDebugOverlay,
    WebGLMaterialFallbackRenderer,
    WireframeDebugHelper
} from './render_debug_helpers';
import type { PixelGlowSystem } from './pixel_glow';
import type { RunSeed } from './run_seed';
import type { SeededRng } from './run_seed/rng';

// ---------------------------------------------------------------------------
// GameContext field groups (Phase 2 slices — flat on `game`, typed for docs/tests)
// See docs/GAME_CONTEXT.md
// ---------------------------------------------------------------------------

/** Clock, player snapshot, and WASM collision backends. */
export type CoreRuntime = {
    playerState: typeof playerState;
    wasmExports: WasmExports | null;
    wasmMemory: Float32Array | null;
    /** Active WASM backend after load (null if both backends failed). */
    wasmBackend: WasmBackend | null;
    clock: THREE.Clock;
};

/** Per-frame perf counters, density throttle, and render debug cadence. */
export type FrameCounters = {
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
};

/** Active run seed and PRNG (Cosmic Architect foundation). */
export type SeedRuntime = {
    activeRunSeed: RunSeed | null;
    runRng: SeededRng | null;
};

/** Single-run progression, crafted loadout, and input latch flags. */
export type RunState = {
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
    /** Glitch Grenade ammo for this run (crafted in the Space Base craft bay). */
    grenadeAmmo: number;
    /** Magma Lance crafted damage multiplier for this run. */
    weaponDamageMult: number;
    scoreMultiplierUntil: number;
    scoreMultiplierValue: number;
    tetherSpriteSweep: number;
    tetherSpritePrevAngle: number | null;
    bestiaryUI: HTMLDivElement | null;
    /** Chapters whose objectives were completed this run (1–6). */
    completedChaptersThisRun: number[];
    wantsBoost: boolean;
    wasTouchBoosting: boolean;
    wantsRoll: boolean;
    wasTouchRolling: boolean;
    wantsBark: boolean;
    wasTouchBarking: boolean;
    wantsTether: boolean;
    wantsReleaseTether: boolean;
};

/** Deferred managers and scene anchors not on GameSystems / GameManagers. */
export type GameContextExtensions = {
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
    wireframeDebugHelper: WireframeDebugHelper;
    collisionDebugOverlay: CollisionDebugOverlay;
    webglMaterialFallbackRenderer: WebGLMaterialFallbackRenderer;
    pixelGlowSystem: PixelGlowSystem;
    reportComboObjectiveProgress: () => void;
    handleGameOver: () => void;
    /** Re-attach slingable callbacks after deferred manager swap. */
    rewireSlingableCallbacks: () => void;
};

/** Fully typed mutable runtime bag owned by bootstrap.
 *  Top-level keys must come only from the slice types below — never add orphan fields here. */
export interface GameContext
    extends GameSystems,
        GameManagers,
        CoreRuntime,
        FrameCounters,
        SeedRuntime,
        RunState,
        GameContextExtensions {}

/** Compile-time guard: every `game.*` key belongs to a named slice. */
type _GameContextSliceKeys =
    | keyof GameSystems
    | keyof GameManagers
    | keyof CoreRuntime
    | keyof FrameCounters
    | keyof SeedRuntime
    | keyof RunState
    | keyof GameContextExtensions;
type _AssertNoUnscopedGameContextFields = Exclude<keyof GameContext, _GameContextSliceKeys> extends never ? true : never;
const _gameContextSliceGuard: _AssertNoUnscopedGameContextFields = true;
void _gameContextSliceGuard;

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
    | 'wasmBackend'
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
    | 'grenadeAmmo'
    | 'weaponDamageMult'
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
    | 'activeRunSeed'
    | 'runRng'
    | 'bestiaryUI'
    | 'completedChaptersThisRun'
    | 'wantsBoost'
    | 'wasTouchBoosting'
    | 'wantsRoll'
    | 'wasTouchRolling'
    | 'wantsBark'
    | 'wasTouchBarking'
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
        wasmBackend: null,
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
        grenadeAmmo: 0,
        weaponDamageMult: 1,
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
        activeRunSeed: null,
        runRng: null,
        bestiaryUI: null,
        completedChaptersThisRun: [],
        wantsBoost: false,
        wasTouchBoosting: false,
        wantsRoll: false,
        wasTouchRolling: false,
        wantsBark: false,
        wasTouchBarking: false,
        wantsTether: false,
        wantsReleaseTether: false,
        reportComboObjectiveProgress: () => {},
        handleGameOver: () => {},
        rewireSlingableCallbacks: () => {},
        videoTumblingStars: []
    };
}
