import test from 'node:test';
import assert from 'node:assert/strict';
import {
    QUALITY_SCORE,
    comboMultiplier,
    computeSlingScoreBonus
} from '../../src/sling_combo_scoring.ts';

test('QUALITY_SCORE tiers increase from messy to perfect', () => {
    assert.equal(QUALITY_SCORE.messy, 25);
    assert.equal(QUALITY_SCORE.good, 75);
    assert.equal(QUALITY_SCORE.perfect, 150);
    assert.ok(QUALITY_SCORE.perfect > QUALITY_SCORE.good);
});

test('comboMultiplier escalates at 3, 5, and 7 chains', () => {
    assert.equal(comboMultiplier(1), 1);
    assert.equal(comboMultiplier(2), 1);
    assert.equal(comboMultiplier(3), 1.5);
    assert.equal(comboMultiplier(5), 2.5);
    assert.equal(comboMultiplier(7), 4);
    assert.equal(comboMultiplier(10), 4);
});

test('computeSlingScoreBonus rounds quality × combo × bonus multiplier', () => {
    assert.equal(computeSlingScoreBonus('good', 1), 75);
    assert.equal(computeSlingScoreBonus('good', 3), 113);
    assert.equal(computeSlingScoreBonus('perfect', 7), 600);
    assert.equal(computeSlingScoreBonus('messy', 5, 2), 125);
});
