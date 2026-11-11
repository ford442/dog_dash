/**
 * The `JourneyLayout` of an Architect Lab playtest: one sandbox chapter at
 * `ARCHITECT_LEVEL_INDEX`, nothing after it. Installed by `startRun()` for
 * `campaignId: 'architect'`; the finish line is the end of its span
 * (`loop_finish.ts`).
 */
import type { ChapterSpan, JourneyLayout } from '../journey_layout';
import { ARCHITECT_LEVEL_INDEX } from './constants';
import { SANDBOX_TWIN_CHAPTER, type SandboxCourse } from './course';

const EMPTY_SPAN: ChapterSpan = { startX: 0, endX: 0, length: 0 };

export function createArchitectLayout(course: SandboxCourse): JourneyLayout {
    return {
        mode: 'architect',
        firstChapter: ARCHITECT_LEVEL_INDEX,
        configs: { [ARCHITECT_LEVEL_INDEX]: course.config },
        span(levelIndex) {
            return levelIndex === ARCHITECT_LEVEL_INDEX ? course.span : EMPTY_SPAN;
        },
        next() {
            return null;
        },
        campaignTwin() {
            return SANDBOX_TWIN_CHAPTER;
        },
        chapterLabel() {
            return '🏗️ Lab';
        },
        progressLabel() {
            return '🏗️ Lab';
        },
        progressPercent(playerX) {
            const { startX, length } = course.span;
            return length > 0 ? Math.min(100, Math.max(0, ((playerX - startX) / length) * 100)) : 0;
        }
    };
}
