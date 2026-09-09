/**
 * Chapter unlock progress — eager tiny module so boot / callbacks do not
 * pull the journey map DOM overlay.
 */

import type { SaveManager } from './save_manager';

const CHAPTER_COUNT = 6;

/**
 * Mark a chapter complete in save progress (unlocks the next level).
 * Safe to call repeatedly.
 */
export function recordChapterComplete(saveManager: SaveManager, level: number): void {
    if (level < 1 || level > CHAPTER_COUNT) return;
    const unlocked = saveManager.getUnlockedLevels();
    saveManager.unlockLevel(level);
    if (level < CHAPTER_COUNT) {
        saveManager.unlockLevel(level + 1);
    } else {
        const firstFullClear = !unlocked.includes(7);
        saveManager.unlockLevel(7);
        if (firstFullClear) {
            saveManager.recordRunCompleted();
        }
    }
}
