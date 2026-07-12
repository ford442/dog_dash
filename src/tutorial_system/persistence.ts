/**
 * Tutorial persistence and audio helpers
 */

import { AudioSystem } from '../audio_system';
import { SaveManager } from '../save_manager';

const TUTORIAL_COMPLETED_KEY = 'dog_dash_tutorial_completed';

/**
 * Check if tutorial should be shown
 */
export function shouldShowTutorial(saveManager: SaveManager): boolean {
    try {
        const completed = localStorage.getItem(TUTORIAL_COMPLETED_KEY);
        return completed !== 'true';
    } catch (e) {
        // If localStorage fails, show tutorial to be safe
        return true;
    }
}

/**
 * Mark tutorial as completed in save data
 */
export function saveTutorialCompletion(): void {
    try {
        localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    } catch (e) {
        console.warn('Could not save tutorial completion:', e);
    }
}

/**
 * Reset tutorial completion (for testing or replay)
 */
export function resetTutorialCompletion(): void {
    try {
        localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
    } catch (e) {
        console.warn('Could not reset tutorial completion:', e);
    }
}

export function getAudioSystem(): AudioSystem {
    return new AudioSystem();
}
