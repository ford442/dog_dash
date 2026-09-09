/**
 * Journey map snapshot helpers and chapter constants.
 */

import { LEVEL_CONFIG, type LevelObjectiveType } from '../level_config';
import type { SaveManager } from '../save_manager';
import type { JourneyMapSnapshot } from './types';

export const OBJECTIVE_ICONS: Record<LevelObjectiveType, string> = {
    scan: '🌿',
    sling: '🌀',
    rescue: '🐾',
    survive: '🛡️',
    combo: '⚡',
    boss: '👑'
};

export const BIOME_TEASERS: Record<number, string> = {
    1: 'Neon gardens & pastel butterflies',
    2: 'Asteroid belt gravity wells',
    3: 'Fiery re-entry skies',
    4: 'Rusty industrial tunnels',
    5: 'Living nebula corridors',
    6: 'Aqua expanse & lunar aurora'
};

export const CHAPTER_COUNT = 6;

/** Quadratic Bezier sample for the Earth→Moon path (viewBox 0–1000 x 0–420). */
export function pathPoint(t: number): { x: number; y: number } {
    // P0 Earth-ish left, P1 high arc, P2 Moon right
    const p0 = { x: 70, y: 280 };
    const p1 = { x: 500, y: 40 };
    const p2 = { x: 930, y: 260 };
    const u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
}

export function chapterT(level: number): number {
    return (level - 0.5) / CHAPTER_COUNT;
}

export function isCompleted(level: number, completed: number[]): boolean {
    return completed.includes(level);
}

export function buildSnapshotFromSave(
    saveManager: SaveManager,
    currentLevel: number,
    rescuedCount: number,
    completedLevels?: number[]
): JourneyMapSnapshot {
    const unlocked = saveManager.getUnlockedLevels();
    // A level is "completed" if the next level is unlocked, or it was passed this run.
    const derived: number[] = [];
    for (let L = 1; L <= CHAPTER_COUNT; L++) {
        if (unlocked.includes(L + 1) || (completedLevels && completedLevels.includes(L)) || L < currentLevel) {
            derived.push(L);
        }
    }
    // Level 6 complete if runsCompleted or boss defeat, or explicitly listed
    if (unlocked.includes(7) || (completedLevels && completedLevels.includes(6))) {
        if (!derived.includes(6)) derived.push(6);
    }

    return {
        currentLevel,
        completedLevels: [...new Set(derived)].sort((a, b) => a - b),
        rescuedCount,
        discoveredSpeciesCount: saveManager.getDiscoveredSpecies().length,
        catalogedCreaturesCount: saveManager.getCatalogedCreatures().length
    };
}

export function createJourneyMapSnapshot(
    saveManager: SaveManager,
    currentLevel: number,
    rescuedCount: number,
    completedLevels?: number[]
): JourneyMapSnapshot {
    return buildSnapshotFromSave(saveManager, currentLevel, rescuedCount, completedLevels);
}

