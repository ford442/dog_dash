/**
 * The journey a run is flying: chapter configs, their X spans, and how each
 * chapter maps back onto the campaign (music bed, ambient creature tables).
 *
 * `CAMPAIGN_LAYOUT` is the default and reproduces `LEVEL_CONFIG` /
 * `LEVEL_DISTANCE_BOUNDARIES` exactly. Endless Dash (src/endless/layout.ts)
 * and Architect Lab sandboxes (src/architect/layout.ts) install their own
 * layout in `startRun()`; nothing else swaps it, so a run that never opens
 * either never leaves the campaign layout.
 */
import { LEVEL_CONFIG, LEVEL_DISTANCE_BOUNDARIES, type LevelConfig } from './level_config';

export type JourneyMode = 'campaign' | 'endless' | 'architect';

export type ChapterSpan = { startX: number; endX: number; length: number };

export interface JourneyLayout {
    readonly mode: JourneyMode;
    /** Chapter index a fresh run starts in. */
    readonly firstChapter: number;
    /** Chapter configs by index (what `LevelManager.config` reads). Endless fills it ahead of the player. */
    readonly configs: { [levelIndex: number]: LevelConfig };
    span(levelIndex: number): ChapterSpan;
    /** The chapter after `levelIndex`, or null when the journey ends there. */
    next(levelIndex: number): number | null;
    /** Campaign chapter whose music bed and ambient-creature table this chapter borrows. */
    campaignTwin(levelIndex: number): number;
    /** Level-display prefix, e.g. "Level 3" or "Endless 7". */
    chapterLabel(levelIndex: number): string;
    /** HUD journey-bar label. */
    progressLabel(levelIndex: number): string;
    /** 0–100 fill of the HUD journey bar. */
    progressPercent(playerX: number, levelIndex: number): number;
}

const CAMPAIGN_CHAPTER_COUNT = 6;

export const CAMPAIGN_LAYOUT: JourneyLayout = {
    mode: 'campaign',
    firstChapter: 1,
    configs: LEVEL_CONFIG,
    span(levelIndex) {
        const startX = LEVEL_DISTANCE_BOUNDARIES[levelIndex - 1] ?? 0;
        const endX = LEVEL_DISTANCE_BOUNDARIES[levelIndex] ?? startX;
        return { startX, endX, length: Math.max(0, endX - startX) };
    },
    next(levelIndex) {
        return levelIndex < CAMPAIGN_CHAPTER_COUNT ? levelIndex + 1 : null;
    },
    campaignTwin(levelIndex) {
        return levelIndex;
    },
    chapterLabel(levelIndex) {
        return `Level ${levelIndex}`;
    },
    progressLabel(levelIndex) {
        return `Lvl ${levelIndex}/${CAMPAIGN_CHAPTER_COUNT}`;
    },
    progressPercent(playerX) {
        const total = LEVEL_DISTANCE_BOUNDARIES[LEVEL_DISTANCE_BOUNDARIES.length - 1];
        return Math.min(100, Math.max(0, (playerX / total) * 100));
    }
};

let activeLayout: JourneyLayout = CAMPAIGN_LAYOUT;

export function getJourneyLayout(): JourneyLayout {
    return activeLayout;
}

/** Called once per run from `startRun()`, before the first chapter starts. */
export function setJourneyLayout(layout: JourneyLayout): void {
    activeLayout = layout;
}

export function isEndlessRun(): boolean {
    return activeLayout.mode === 'endless';
}

export function isArchitectRun(): boolean {
    return activeLayout.mode === 'architect';
}

/** Only campaign chapters unlock chapters, open the Moon journey map and end at the Moon. */
export function isCampaignRun(): boolean {
    return activeLayout.mode === 'campaign';
}
