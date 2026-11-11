/**
 * The `JourneyLayout` of an Endless Dash run: chapters are generated from the
 * seed a couple ahead of the player, so prefetch and boundary checks always
 * find the next one. Installed by `startRun()` for `campaignId: 'endless'`.
 */
import type { ChapterSpan, JourneyLayout } from '../journey_layout';
import type { LevelConfig } from '../level_config';
import { EndlessSequence, type EndlessChapter } from './generator';
import { ENDLESS_LEVEL_BASE } from './constants';

/** Chapters generated past the one being flown. */
const LOOKAHEAD = 2;

const EMPTY_SPAN: ChapterSpan = { startX: 0, endX: 0, length: 0 };

/** Where an Endless layout gets its chapters: the seeded sequence, or a fixed list (headless coverage runs). */
export interface ChapterSource {
    /** Chapter `ordinal` (1-based), or null past the end of a finite source. */
    chapter(ordinal: number): EndlessChapter | null;
}

export type EndlessLayout = JourneyLayout & { readonly source: ChapterSource };

export function createEndlessLayout(seed: number): EndlessLayout {
    return layoutFromSource(new EndlessSequence(seed));
}

/** A fixed, finite chapter list as a source (chapters must be contiguous, ordinals 1..n). */
export function fixedChapterSource(chapters: readonly EndlessChapter[]): ChapterSource {
    return { chapter: (ordinal) => chapters[ordinal - 1] ?? null };
}

export function layoutFromSource(source: ChapterSource): EndlessLayout {
    const configs: { [levelIndex: number]: LevelConfig } = {};
    let filled = 0;

    const ensure = (ordinal: number): void => {
        for (let n = filled + 1; n <= ordinal; n++) {
            const chapter = source.chapter(n);
            if (!chapter) break;
            configs[chapter.levelIndex] = chapter.config;
            filled = n;
        }
    };
    const ordinalOf = (levelIndex: number): number => levelIndex - ENDLESS_LEVEL_BASE;
    const chapterAt = (levelIndex: number): EndlessChapter | null => {
        const ordinal = ordinalOf(levelIndex);
        if (!Number.isInteger(ordinal) || ordinal < 1) return null;
        ensure(ordinal);
        return source.chapter(ordinal);
    };

    ensure(1 + LOOKAHEAD);

    return {
        mode: 'endless',
        firstChapter: ENDLESS_LEVEL_BASE + 1,
        configs,
        source,
        span(levelIndex) {
            return chapterAt(levelIndex)?.span ?? EMPTY_SPAN;
        },
        next(levelIndex) {
            const ordinal = ordinalOf(levelIndex);
            if (!Number.isInteger(ordinal) || ordinal < 1) return null;
            ensure(ordinal + 1 + LOOKAHEAD);
            return source.chapter(ordinal + 1) ? levelIndex + 1 : null;
        },
        campaignTwin(levelIndex) {
            return chapterAt(levelIndex)?.twinChapter ?? 1;
        },
        chapterLabel(levelIndex) {
            return `Endless ${ordinalOf(levelIndex)}`;
        },
        progressLabel(levelIndex) {
            return `∞ Ch ${ordinalOf(levelIndex)}`;
        },
        progressPercent(playerX, levelIndex) {
            const { startX, length } = this.span(levelIndex);
            return length > 0 ? Math.min(100, Math.max(0, ((playerX - startX) / length) * 100)) : 0;
        }
    };
}
