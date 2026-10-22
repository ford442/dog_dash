import test from 'node:test';
import assert from 'node:assert/strict';
import {
    endlessRunSeed,
    endlessShareLink,
    formatEndlessCode,
    isoWeek,
    parseEndlessCode,
    weeklyEndlessSeed
} from '../../src/endless/seed.ts';
import { endlessUnlockState } from '../../src/endless/unlock.ts';
import { createEndlessLayout, fixedChapterSource, layoutFromSource } from '../../src/endless/layout.ts';
import { EndlessSequence } from '../../src/endless/generator.ts';
import { CAMPAIGN_LAYOUT } from '../../src/journey_layout.ts';
import { LEVEL_CONFIG, LEVEL_DISTANCE_BOUNDARIES } from '../../src/level_config.ts';
import { parseRunSeed, serializeRunSeed } from '../../src/run_seed/codec.ts';

test('seed codes round-trip every 32-bit seed edge', () => {
    for (const seed of [0, 1, 35, 36, 0x7fffffff, 0x80000000, 0xffffffff, 0xd06de002]) {
        const code = formatEndlessCode(seed);
        assert.equal(code.length, 7);
        assert.match(code, /^[0-9A-Z]{7}$/);
        assert.equal(parseEndlessCode(code), seed);
    }
});

test('seed codes accept pasted links, lower case, spaces and dashes', () => {
    const seed = 0xd06de002;
    const code = formatEndlessCode(seed);
    assert.equal(parseEndlessCode(code.toLowerCase()), seed);
    assert.equal(parseEndlessCode(` ${code.slice(0, 3)}-${code.slice(3)} `), seed);
    assert.equal(parseEndlessCode(endlessShareLink(seed, 'https://example.test/dash/')), seed);
    assert.equal(parseEndlessCode(`#endless=${code}&debug`), seed);
    assert.equal(endlessShareLink(seed, 'https://example.test/'), `https://example.test/#endless=${code}`);
});

test('invalid seed codes are rejected', () => {
    for (const bad of ['', '   ', 'HELLO!', '12345678', 'ZZZZZZZ', '#endless=', null, 42, undefined]) {
        assert.equal(parseEndlessCode(bad), null, `accepted ${String(bad)}`);
    }
});

test('endless run seeds survive the run-seed codec (ghost / last-run storage)', () => {
    const seed = endlessRunSeed(0xffffffff);
    assert.equal(seed.campaignId, 'endless');
    assert.deepEqual(parseRunSeed(serializeRunSeed(seed)), seed);
});

test('ISO weeks are UTC and roll over on Monday', () => {
    assert.deepEqual(isoWeek(new Date('2026-10-19T00:00:00Z')), { year: 2026, week: 43 });
    assert.deepEqual(isoWeek(new Date('2026-10-25T23:59:59Z')), { year: 2026, week: 43 });
    assert.deepEqual(isoWeek(new Date('2026-10-26T00:00:00Z')), { year: 2026, week: 44 });
    // Year edges: 2026 starts on a Thursday, so it has 53 weeks.
    assert.deepEqual(isoWeek(new Date('2025-12-29T00:00:00Z')), { year: 2026, week: 1 });
    assert.deepEqual(isoWeek(new Date('2027-01-01T00:00:00Z')), { year: 2026, week: 53 });
});

test('the weekly seed is shared for a whole week and changes the next', () => {
    const monday = weeklyEndlessSeed(new Date('2026-10-19T00:00:00Z'));
    assert.equal(weeklyEndlessSeed(new Date('2026-10-21T12:34:56Z')), monday);
    assert.equal(weeklyEndlessSeed(new Date('2026-10-25T23:59:59Z')), monday);
    assert.notEqual(weeklyEndlessSeed(new Date('2026-10-26T00:00:00Z')), monday);
    assert.equal(formatEndlessCode(monday), '1R4C6QE', 'weekly seed hash changed: every shared weekly link breaks');
});

test('Endless unlocks only after the whole campaign is complete', () => {
    const save = (levels: number[]) => ({ isLevelUnlocked: (l: number) => levels.includes(l) });
    assert.deepEqual(endlessUnlockState(save([1])), { unlocked: false, chaptersCompleted: 0, missingTutorials: [] });
    assert.equal(endlessUnlockState(save([1, 2, 3, 4, 5, 6])).unlocked, false);
    assert.equal(endlessUnlockState(save([1, 2, 3, 4, 5, 6])).chaptersCompleted, 5);
    const done = endlessUnlockState(save([1, 2, 3, 4, 5, 6, 7]));
    assert.equal(done.unlocked, true);
    assert.equal(done.chaptersCompleted, 6);
});

test('campaign layout matches the authored level boundaries', () => {
    for (let level = 1; level <= 6; level++) {
        const span = CAMPAIGN_LAYOUT.span(level);
        assert.equal(span.startX, LEVEL_DISTANCE_BOUNDARIES[level - 1]);
        assert.equal(span.endX, LEVEL_DISTANCE_BOUNDARIES[level]);
        assert.equal(span.length, span.endX - span.startX);
        assert.equal(CAMPAIGN_LAYOUT.campaignTwin(level), level);
        assert.equal(CAMPAIGN_LAYOUT.next(level), level < 6 ? level + 1 : null);
    }
    assert.equal(CAMPAIGN_LAYOUT.configs, LEVEL_CONFIG);
    assert.equal(CAMPAIGN_LAYOUT.mode, 'campaign');
    assert.equal(CAMPAIGN_LAYOUT.chapterLabel(3), 'Level 3');
    assert.equal(CAMPAIGN_LAYOUT.progressLabel(3), 'Lvl 3/6');
    assert.equal(CAMPAIGN_LAYOUT.progressPercent(2600, 4), 50);
});

test('endless layout generates chapters ahead of the player', () => {
    const seed = 0xd06de002;
    const layout = createEndlessLayout(seed);
    const expected = new EndlessSequence(seed).first(10);
    assert.equal(layout.mode, 'endless');
    assert.equal(layout.firstChapter, 101);
    assert.deepEqual(Object.keys(layout.configs).map(Number), [101, 102, 103]);

    let level: number | null = layout.firstChapter;
    for (const ch of expected) {
        assert.equal(level, ch.levelIndex);
        assert.deepEqual(layout.span(ch.levelIndex), ch.span);
        assert.deepEqual(layout.configs[ch.levelIndex], ch.config);
        assert.equal(layout.campaignTwin(ch.levelIndex), ch.twinChapter);
        level = layout.next(ch.levelIndex);
        // The next two chapters exist before the player reaches the boundary (prefetch).
        assert.ok(layout.configs[ch.levelIndex + 2], `chapter ${ch.ordinal + 2} not generated ahead`);
    }
    assert.equal(layout.chapterLabel(104), 'Endless 4');
    assert.equal(layout.progressLabel(104), '∞ Ch 4');
    const { startX, length } = layout.span(104);
    assert.equal(layout.progressPercent(startX + length / 2, 104), 50);
    // Campaign indices never resolve in an Endless layout.
    assert.equal(layout.next(6), null);
    assert.equal(layout.span(6).length, 0);
});

test('a fixed chapter source ends the journey after its last chapter', () => {
    const chapters = new EndlessSequence(5).first(3);
    const layout = layoutFromSource(fixedChapterSource(chapters));
    assert.equal(layout.next(101), 102);
    assert.equal(layout.next(102), 103);
    assert.equal(layout.next(103), null);
    assert.deepEqual(layout.span(103), chapters[2].span);
});
