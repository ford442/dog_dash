import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    CHAPTER_MUSIC,
    HUB_MUSIC_PROFILE,
    SCALE_STEPS,
    getChapterMusicProfile,
    scaleNote,
    type ChapterMusicProfile
} from '../../src/audio_system/chapter_music';

const ALL_PROFILES: ChapterMusicProfile[] = [
    ...Object.values(CHAPTER_MUSIC),
    HUB_MUSIC_PROFILE
];

test('all six chapters have a profile', () => {
    for (let level = 1; level <= 6; level++) {
        assert.ok(CHAPTER_MUSIC[level], `level ${level} has no music profile`);
    }
});

test('chapter identities are distinct', () => {
    const ids = Object.values(CHAPTER_MUSIC).map(p => p.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate profile id');

    // A blind A/B has to be possible: no two chapters may share the same
    // scale + tempo + layer stack, or they would read as the same music.
    const signatures = Object.values(CHAPTER_MUSIC).map(
        p => `${p.scale}|${p.bpm}|${[...p.layers].sort().join(',')}`
    );
    assert.equal(new Set(signatures).size, signatures.length, 'two chapters share an identity');
});

test('profiles are internally consistent', () => {
    for (const profile of ALL_PROFILES) {
        assert.ok(profile.bpm >= 40 && profile.bpm <= 200, `${profile.id}: implausible bpm`);
        assert.ok(profile.baseTempoScale >= 0 && profile.baseTempoScale <= 1, `${profile.id}: tempo scale`);
        assert.ok(profile.rootHz > 20 && profile.rootHz < 2000, `${profile.id}: root out of range`);
        assert.ok(profile.layers.length > 0, `${profile.id}: no layers`);
        assert.equal(new Set(profile.layers).size, profile.layers.length, `${profile.id}: duplicate layer`);
        assert.ok(SCALE_STEPS[profile.scale], `${profile.id}: unknown scale`);

        if (profile.delaySend !== undefined) {
            assert.ok(profile.delaySend >= 0 && profile.delaySend <= 1, `${profile.id}: delaySend range`);
        }
        if (profile.noiseBed !== undefined) {
            assert.ok(profile.noiseBed >= 0 && profile.noiseBed <= 1, `${profile.id}: noiseBed range`);
        }
        // Timbre overrides must name layers the profile actually voices.
        for (const layer of Object.keys(profile.timbre ?? {})) {
            assert.ok(
                profile.layers.includes(layer as never),
                `${profile.id}: timbre for unused layer "${layer}"`
            );
        }
    }
});

test('speed scaling stays inside a musical range', () => {
    for (const profile of ALL_PROFILES) {
        const maxBpm = profile.bpm * (1 + profile.baseTempoScale);
        assert.ok(maxBpm <= 200, `${profile.id}: runs away to ${maxBpm} bpm at full speed`);
    }
});

test('scaleNote walks the scale and wraps into octaves', () => {
    const root = 100;

    assert.equal(scaleNote(root, 'major', 0), root);

    // Degree 7 of a 7-note scale is the octave.
    assert.ok(Math.abs(scaleNote(root, 'major', 7) - root * 2) < 1e-9);
    // Degree 5 of a 5-note pentatonic is likewise the octave.
    assert.ok(Math.abs(scaleNote(root, 'pentatonic', 5) - root * 2) < 1e-9);

    // A major third is 4 semitones up.
    assert.ok(Math.abs(scaleNote(root, 'major', 2) - root * Math.pow(2, 4 / 12)) < 1e-9);

    // Notes ascend monotonically across an octave boundary.
    let previous = 0;
    for (let step = 0; step < 16; step++) {
        const freq = scaleNote(root, 'minor', step);
        assert.ok(freq > previous, `step ${step} did not ascend`);
        previous = freq;
    }
});

test('scaleNote handles negative steps by descending', () => {
    const root = 440;
    assert.ok(scaleNote(root, 'major', -7) < root);
    assert.ok(Math.abs(scaleNote(root, 'major', -7) - root / 2) < 1e-9);
});

test('getChapterMusicProfile falls back for unknown levels', () => {
    assert.equal(getChapterMusicProfile(1).id, CHAPTER_MUSIC[1].id);
    assert.equal(getChapterMusicProfile(6).id, CHAPTER_MUSIC[6].id);
    assert.equal(getChapterMusicProfile(99).id, CHAPTER_MUSIC[1].id);
    assert.equal(getChapterMusicProfile(0).id, CHAPTER_MUSIC[1].id);
});
