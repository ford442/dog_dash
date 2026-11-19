/**
 * The `JourneyLayout` of a Lost Sector run: one authored chapter spanning
 * x 0 → `distance`, nothing after it. Installed by `startRun()` for
 * `campaignId: 'lost'`; the finish line is the end of its span (`loop_finish.ts`).
 */
import type { ChapterSpan, JourneyLayout } from '../journey_layout';
import { LOST_SECTOR_LEVEL_INDEX, type LostSectorId } from './constants';
import { LOST_SECTORS } from './configs';

const EMPTY_SPAN: ChapterSpan = { startX: 0, endX: 0, length: 0 };

export type LostSectorLayout = JourneyLayout & { readonly sectorId: LostSectorId };

export function lostSectorSpan(id: LostSectorId): ChapterSpan {
    const length = LOST_SECTORS[id].config.distance;
    return { startX: 0, endX: length, length };
}

export function createLostSectorLayout(id: LostSectorId): LostSectorLayout {
    const sector = LOST_SECTORS[id];
    const levelIndex = LOST_SECTOR_LEVEL_INDEX[id];
    const span = lostSectorSpan(id);
    const label = `${sector.icon} ${sector.title}`;
    return {
        mode: 'lost',
        sectorId: id,
        firstChapter: levelIndex,
        configs: { [levelIndex]: sector.config },
        span(index) {
            return index === levelIndex ? span : EMPTY_SPAN;
        },
        next() {
            return null;
        },
        campaignTwin() {
            return sector.twinChapter;
        },
        chapterLabel() {
            return label;
        },
        progressLabel() {
            return '📡 Lost Sector';
        },
        progressPercent(playerX) {
            return span.length > 0 ? Math.min(100, Math.max(0, ((playerX - span.startX) / span.length) * 100)) : 0;
        }
    };
}
