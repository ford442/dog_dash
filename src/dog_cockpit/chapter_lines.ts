/**
 * Per-chapter dog reaction lines for the Moon Journey Map overlay.
 * Kid-friendly cockpit chatter keyed by chapter (level) index 1–6.
 */

export const CHAPTER_DOG_LINES: Record<number, string> = {
    1: 'Sniff sniff… so many glowing plants! Let’s catalog them all!',
    2: 'Whee! Gravity slingshots make my ears flap!',
    3: 'Friends in trouble? Bark bark — rescue mission!',
    4: 'Rusty tunnels… stay close, I’ll watch the gauges!',
    5: 'Arc Surge! Keep the combo going — I’m cheering!',
    6: 'The Moon is so close… I can almost taste moon candy!'
};

/** Shown when the player opens the map mid-run without a focused chapter. */
export const JOURNEY_MAP_IDLE_LINE =
    'Look! Our path from Earth to the Moon. Every chapter gets us closer!';

/** Shown right after a chapter objective completes. */
export function getChapterCompleteLine(level: number): string {
    const base = CHAPTER_DOG_LINES[level] ?? JOURNEY_MAP_IDLE_LINE;
    return `Chapter ${level} done! ${base}`;
}

export function getChapterDogLine(level: number): string {
    return CHAPTER_DOG_LINES[level] ?? JOURNEY_MAP_IDLE_LINE;
}
