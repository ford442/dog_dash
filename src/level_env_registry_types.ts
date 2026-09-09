/**
 * Shared types and helpers for the level-environment registry
 * (`level_env_registry.ts` and its `level_env_registry_deferred_*.ts` split files).
 */
import type * as THREE from 'three';
import type { LevelConfig } from './level_config';
import type { LevelEnvironmentPorts } from './level_manager/types';
import type { ParticleSystem, DebrisSystem } from './particles';
import type { AudioSystem } from './audio_system';
import type { JuiceManager } from './juice_effects';
import type { WeaponLightManager } from './lighting';
import type { EnvPluginBuilder } from './level_manager/plugin_host';
import type { DeferredEnvSystemKey, DeferredLevelSystemKey, SystemKey } from './level_deferred_registry';

/** Runtime context passed to registry install hooks (kept narrow to avoid import cycles). */
export type DeferredLoaderContext = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    game: DeferredGamePorts;
    installEnvPartial: (partial: Partial<LevelEnvironmentPorts>) => void;
    assignGameSystem: <K extends keyof DeferredGamePorts>(key: K, value: DeferredGamePorts[K]) => void;
};

export type DeferredGamePorts = {
    obstacleSystem?: any;
    weaponLightManager: WeaponLightManager;
    audioSystem: AudioSystem;
    particleSystem: ParticleSystem;
    juiceManager: JuiceManager;
    flowerConstellationsSystem?: unknown;
    hideAndSeekStarsSystem?: unknown;
    skyRailTerminalSystem?: unknown;
    comboCorridorSystem?: unknown;
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
    spacePetsSwarmSystem: unknown;
    rewireSlingableCallbacks?: () => void;
    bossManager: unknown;
    dreamPortalSystem: unknown;
    liquidMetalSystem: unknown;
    gravLensManager: unknown;
    derelictBuoyManager: unknown;
    dataMonolithManager: unknown;
    magicPaintbrushSystem: unknown;
    crystalChimeManager: unknown;
    butterflySwarmSystem: unknown;
};

export type DeferredEnvRegistryEntry<F extends DeferredEnvSystemKey> = {
    flag: F;
    systemKey: SystemKey;
    load: () => Promise<Record<string, unknown>>;
    install: (ctx: DeferredLoaderContext, mod: Record<string, unknown>) => void | Promise<void>;
    plugin: EnvPluginBuilder;
};

export type DeferredLevelRegistryEntry = {
    systemKey: DeferredLevelSystemKey;
    needsLoad: (cfg: LevelConfig) => boolean;
    load: () => Promise<Record<string, unknown>>;
    install: (ctx: DeferredLoaderContext, mod: Record<string, unknown>) => void | Promise<void>;
};

export function objectConfig<T>(value: unknown): T | undefined {
    return typeof value === 'object' && value !== null ? (value as T) : undefined;
}

export function densityFromConfig(value: unknown): number | undefined {
    const cfg = objectConfig<{ density?: number }>(value);
    return cfg?.density;
}
