import test from 'node:test';
import assert from 'node:assert/strict';
import {
    shouldSpawnStarlightKoi,
    shouldSpawnBubbleCoral,
    getBubbleCoralPlacement,
    resolveBubbleCoralClusterCount
} from '../../src/level_spawn_rules.ts';

test('shouldSpawnStarlightKoi rejects zero density', () => {
    assert.equal(shouldSpawnStarlightKoi({ biological: true }, 0), false);
    assert.equal(shouldSpawnStarlightKoi({ biological: true }, undefined), false);
});

test('shouldSpawnStarlightKoi requires biological, aquaticLife, or nebula', () => {
    assert.equal(shouldSpawnStarlightKoi({ biological: true }, 1), true);
    assert.equal(shouldSpawnStarlightKoi({ aquaticLife: true }, 0.5), true);
    assert.equal(shouldSpawnStarlightKoi({ nebula: true }, 2), true);
    assert.equal(shouldSpawnStarlightKoi({ industrial: true }, 1), false);
});

test('shouldSpawnBubbleCoral respects bubbleCoral flag and aquatic envs', () => {
    assert.equal(shouldSpawnBubbleCoral({ bubbleCoral: true }, 1), true);
    assert.equal(shouldSpawnBubbleCoral({ waterfall: true }, 1), true);
    assert.equal(shouldSpawnBubbleCoral({ industrial: true }, 1), false);
    assert.equal(shouldSpawnBubbleCoral({ biological: true }, 0), false);
});

test('getBubbleCoralPlacement picks wall, tunnel, or reef', () => {
    assert.equal(getBubbleCoralPlacement({ waterfall: true }), 'wall');
    assert.equal(getBubbleCoralPlacement({}, 'tunnel'), 'tunnel');
    assert.equal(getBubbleCoralPlacement({ biological: true }), 'reef');
    assert.equal(getBubbleCoralPlacement({}), 'reef');
});

test('resolveBubbleCoralClusterCount clamps between 1 and 12', () => {
    assert.equal(resolveBubbleCoralClusterCount(0.2), 1);
    assert.equal(resolveBubbleCoralClusterCount(5, { density: 2 }), 10);
    assert.equal(resolveBubbleCoralClusterCount(100), 12);
});
