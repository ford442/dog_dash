/**
 * Persisted "start at this chapter" request across location.reload().
 * Kept separate from hub_screen so the boot path does not pull hub UI.
 */

const PENDING_CHAPTER_KEY = 'dog_dash_pending_chapter';

export function setPendingStartChapter(chapter: number): void {
    try {
        localStorage.setItem(PENDING_CHAPTER_KEY, String(chapter));
    } catch (e) {
        console.warn('Failed to store pending chapter:', e);
    }
}

/** Reads and clears the requested start chapter. Null when none was set. */
export function consumePendingStartChapter(): number | null {
    try {
        const raw = localStorage.getItem(PENDING_CHAPTER_KEY);
        if (raw === null) return null;
        localStorage.removeItem(PENDING_CHAPTER_KEY);
        const chapter = parseInt(raw, 10);
        return Number.isFinite(chapter) ? chapter : null;
    } catch (e) {
        return null;
    }
}
