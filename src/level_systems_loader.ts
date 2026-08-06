/**
 * Per-level / per-flag async system loading.
 * Heavy modules are only downloaded when a level that needs them is about to start
 * (or prefetched near the end of the previous segment).
 *
 * Loader keys and install hooks are defined in `level_env_registry.ts`.
 */
import { game } from './game_runtime';
import { getLevelSpan } from './depth_layers';
import { LEVEL_CONFIG, LEVEL_DISTANCE_BOUNDARIES, type LevelConfig } from './level_config';
import type { LevelEnvironmentPorts } from './level_manager/types';
import {
    installDeferredSystem,
    systemsNeededForLevel,
    type SystemKey,
    type DeferredLoaderContext,
    type DeferredGamePorts
} from './level_env_registry';
import { scene, camera } from './scene_context';

export type { SystemKey } from './level_env_registry';
export { systemsNeededForLevel } from './level_env_registry';

const loaded = new Set<SystemKey>();
const inflight = new Map<SystemKey, Promise<void>>();
const prefetchedLevels = new Set<number>();

function installEnvPartial(partial: Partial<LevelEnvironmentPorts>): void {
    Object.assign(game, partial);
    if (game.levelManager) {
        game.levelManager.installEnvironmentSystems(partial);
    }
}

function createLoaderContext(): DeferredLoaderContext {
    return {
        scene,
        camera,
        game: game as unknown as DeferredGamePorts,
        installEnvPartial,
        assignGameSystem(key, value) {
            (game as unknown as DeferredGamePorts)[key] = value;
        }
    };
}

async function loadSystem(key: SystemKey): Promise<void> {
    if (loaded.has(key)) return;
    const existing = inflight.get(key);
    if (existing) return existing;

    const promise = (async () => {
        await installDeferredSystem(key, createLoaderContext());
        loaded.add(key);
        inflight.delete(key);
    })();

    inflight.set(key, promise);
    try {
        await promise;
    } catch (err) {
        inflight.delete(key);
        throw err;
    }
}

async function loadKeys(keys: SystemKey[]): Promise<void> {
    if (keys.length === 0) return;
    await Promise.all(keys.map((k) => loadSystem(k)));
}

/** Loads async chunks needed before the first gameplay click (Level 1 only). */
export function ensureGameplayReady(): Promise<void> {
    return ensureLevelSystemsForLevel(1);
}

/** Prefetch chunks for a target level (no-op if already covered). */
export function prefetchLevelSystems(levelIndex: number): void {
    if (prefetchedLevels.has(levelIndex)) return;
    prefetchedLevels.add(levelIndex);
    void ensureLevelSystemsForLevel(levelIndex);
}

/** Ensure systems for a level transition are loaded before startLevel runs. */
export async function ensureLevelSystemsForLevel(levelIndex: number): Promise<void> {
    const cfg = LEVEL_CONFIG[levelIndex];
    await loadKeys(systemsNeededForLevel(cfg));
}

/** Load slingable / toy-rocket systems (prototype content, non-blocking for L1 start). */
export async function ensureSlingableSystems(): Promise<void> {
    await loadSystem('slingables');
}

/** Prefetch the next level chunk when the player is ~75% through the current segment. */
export function maybePrefetchNextLevel(playerX: number, currentLevel: number): void {
    if (currentLevel >= 6) return;
    const { startX, length } = getLevelSpan(currentLevel);
    const progress = length > 0 ? (playerX - startX) / length : 0;
    if (progress >= 0.75) {
        prefetchLevelSystems(currentLevel + 1);
    }
    const nextBoundary = LEVEL_DISTANCE_BOUNDARIES[currentLevel];
    if (nextBoundary !== undefined && playerX > nextBoundary - length * 0.15) {
        prefetchLevelSystems(currentLevel + 1);
    }
}

export function isGameplayReady(): boolean {
    return loaded.size > 0 || systemsNeededForLevel(LEVEL_CONFIG[1]).every((k) => loaded.has(k));
}

export function isSystemLoaded(key: SystemKey): boolean {
    return loaded.has(key);
}
