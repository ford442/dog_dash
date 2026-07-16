import { game } from './game_runtime';
import { particleSystem, debrisSystem } from './game_systems';
import {
    installLevelEnvironmentSystems,
    type LevelEnvironmentSystemExports
} from './game_systems';
import type { LevelEnvironmentSystems } from './level_environment_systems';
import type { DeferredManagers } from './deferred_managers';
import { getLevelSpan } from './depth_layers';
import { LEVEL_DISTANCE_BOUNDARIES } from './level_config';

let environmentPromise: Promise<LevelEnvironmentSystems> | null = null;
let managersPromise: Promise<DeferredManagers> | null = null;
let gameplayReadyPromise: Promise<void> | null = null;
const prefetchedLevels = new Set<number>();

function loadEnvironmentSystems(): Promise<LevelEnvironmentSystems> {
    if (!environmentPromise) {
        environmentPromise = import('./level_environment_systems').then((mod) => {
            const systems = mod.createLevelEnvironmentSystems();
            installLevelEnvironmentSystems(systems as LevelEnvironmentSystemExports);
            Object.assign(game, systems);
            return systems;
        });
    }
    return environmentPromise;
}

function loadDeferredManagers(): Promise<DeferredManagers> {
    if (!managersPromise) {
        managersPromise = import('./deferred_managers').then((mod) => {
            const managers = mod.createDeferredManagers(particleSystem, debrisSystem);
            game.ghostDebrisSystem = managers.ghostDebrisSystem;
            game.voidJellyfishSystem = managers.voidJellyfishSystem;
            game.industrialGeometryManager = managers.industrialGeometryManager;
            game.aquaticLifeManager = managers.aquaticLifeManager;
            game.starlightKoiManager = managers.starlightKoiManager;
            game.bubbleCoralManager = managers.bubbleCoralManager;
            game.slingableObjectSystem = managers.slingableObjectSystem;
            game.toyRocketSpawnManager = managers.toyRocketSpawnManager;
            if (game.levelManager) {
                game.levelManager.ghostDebrisSystem = managers.ghostDebrisSystem;
                game.levelManager.voidJellyfishSystem = managers.voidJellyfishSystem;
                game.levelManager.industrialGeometryManager = managers.industrialGeometryManager;
            }
            return managers;
        });
    }
    return managersPromise;
}

/** Loads async chunks needed before the first gameplay click (Level 1). */
export function ensureGameplayReady(): Promise<void> {
    if (!gameplayReadyPromise) {
        gameplayReadyPromise = Promise.all([
            loadEnvironmentSystems(),
            loadDeferredManagers()
        ]).then(() => undefined);
    }
    return gameplayReadyPromise;
}

/** Prefetch chunks for a target level (no-op if already covered). */
export function prefetchLevelSystems(levelIndex: number): void {
    if (prefetchedLevels.has(levelIndex)) return;
    prefetchedLevels.add(levelIndex);
    void ensureGameplayReady();
}

/** Ensure systems for a level transition are loaded before startLevel runs. */
export async function ensureLevelSystemsForLevel(levelIndex: number): Promise<void> {
    prefetchLevelSystems(levelIndex);
    await ensureGameplayReady();
}

/** Prefetch the next level chunk when the player is ~75% through the current segment. */
export function maybePrefetchNextLevel(playerX: number, currentLevel: number): void {
    if (currentLevel >= 6) return;
    const { startX, length } = getLevelSpan(currentLevel);
    const progress = length > 0 ? (playerX - startX) / length : 0;
    if (progress >= 0.75) {
        prefetchLevelSystems(currentLevel + 1);
    }
    // Also prefetch when approaching the hard boundary (backup trigger).
    const nextBoundary = LEVEL_DISTANCE_BOUNDARIES[currentLevel];
    if (nextBoundary !== undefined && playerX > nextBoundary - length * 0.15) {
        prefetchLevelSystems(currentLevel + 1);
    }
}

export function isGameplayReady(): boolean {
    return gameplayReadyPromise !== null;
}
