/**
 * When a save may fly Endless Dash: after the whole campaign is complete
 * (chapter 6's objective unlocks the post-campaign marker, level 7 — see
 * `recordChapterComplete`), plus any tutorial a traversal verb needs that
 * no campaign chapter teaches. That is what lets the generator treat every
 * taught traversal as fair game without reading the save, so a shared seed
 * produces the same chapters on every machine.
 */
import type { SaveManager } from '../save_manager';
import { CAMPAIGN_CHAPTERS, ENDLESS_REQUIRED_TUTORIALS } from './catalog';

/** Unlock marker `recordChapterComplete` sets when chapter 6 is completed. */
const CAMPAIGN_COMPLETE_MARKER = 7;

export type EndlessUnlockState = {
    unlocked: boolean;
    /** Campaign chapters whose objective this save has completed (0–6). */
    chaptersCompleted: number;
    missingTutorials: string[];
};

export function endlessUnlockState(
    save: Pick<SaveManager, 'isLevelUnlocked'>,
    hasSeenTutorial: (tutorialId: string) => boolean = () => false
): EndlessUnlockState {
    // Completing chapter N unlocks N + 1, so "N + 1 unlocked" means N was completed.
    const chaptersCompleted = CAMPAIGN_CHAPTERS.filter((c) => save.isLevelUnlocked(c + 1)).length;
    const missingTutorials = ENDLESS_REQUIRED_TUTORIALS.filter((id) => !hasSeenTutorial(id));
    return {
        unlocked: save.isLevelUnlocked(CAMPAIGN_COMPLETE_MARKER) && missingTutorials.length === 0,
        chaptersCompleted,
        missingTutorials
    };
}
