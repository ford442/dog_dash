import test from 'node:test';
import assert from 'node:assert/strict';
import {
    RARE_SPECIES,
    headingTo,
    isRareResource,
    pickNearestRare,
    rareLabel
} from '../../src/quantum_compass/picker.ts';
import { CollisionLayer, SpatialIndex } from '../../src/spatial_index.ts';

test('picks the nearest of N candidates', () => {
    const candidates = [
        { x: 50, y: 0, z: 0 },
        { x: 12, y: 3, z: -4 },
        { x: 30, y: -10, z: 0 },
        { x: 11, y: 20, z: 0 }
    ];
    assert.equal(pickNearestRare(0, 0, 0, candidates), 1);
});

test('nearest-of-N matches a brute-force sort over many random layouts', () => {
    // Deterministic LCG so the test never touches Math.random.
    let s = 12345;
    const rand = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 0x100000000);
    for (let trial = 0; trial < 200; trial++) {
        const n = 1 + Math.floor(rand() * 40);
        const candidates = Array.from({ length: n }, () => ({
            x: rand() * 160 - 20, y: rand() * 40 - 20, z: rand() * 20 - 10
        }));
        const ox = rand() * 20, oy = rand() * 10 - 5, oz = 0;
        const eligible = candidates
            .map((c, i) => ({ i, d: (c.x - ox) ** 2 + (c.y - oy) ** 2 + (c.z - oz) ** 2, behind: c.x < ox - 4 }))
            .filter((c) => !c.behind)
            .sort((a, b) => a.d - b.d || a.i - b.i);
        assert.equal(pickNearestRare(ox, oy, oz, candidates), eligible[0]?.i ?? -1, `trial ${trial}`);
    }
});

test('skips targets behind the player, empty lists and non-finite positions', () => {
    assert.equal(pickNearestRare(0, 0, 0, []), -1);
    assert.equal(pickNearestRare(100, 0, 0, [{ x: 90, y: 0, z: 0 }]), -1, '10 m behind is gone');
    assert.equal(pickNearestRare(100, 0, 0, [{ x: 97, y: 0, z: 0 }]), 0, 'just behind still counts');
    assert.equal(pickNearestRare(100, 0, 0, [{ x: 90, y: 0, z: 0 }], { behindTolerance: 20 }), 0);
    assert.equal(pickNearestRare(0, 0, 0, [{ x: NaN, y: 0, z: 0 }, { x: 5, y: Infinity, z: 0 }, { x: 40, y: 0, z: 0 }]), 2);
});

test('ties keep the earlier candidate', () => {
    assert.equal(pickNearestRare(0, 0, 0, [{ x: 10, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, { x: 10, y: 0, z: 0 }]), 0);
});

test('rare allowlist covers magma core, frost heart, geode and buoy, plus the explicit tag', () => {
    for (const id of ['magmaHeart', 'iceNeedleCluster', 'fracturedGeode', 'derelictBuoy']) {
        assert.ok(isRareResource({ speciesId: id }), id);
        assert.equal(rareLabel({ speciesId: id }), RARE_SPECIES[id]);
    }
    assert.ok(isRareResource({ speciesId: 'rose', rareResource: true }));
    assert.equal(rareLabel({ rareResource: true }), 'Treasure');
    assert.equal(isRareResource({ speciesId: 'rose' }), false);
    assert.equal(isRareResource({ speciesId: 'toString' }), false, 'no prototype keys');
    assert.equal(isRareResource({ rareResource: 'yes' }), false);
    assert.equal(isRareResource(undefined), false);
});

test('heading is screen-plane: right = 0, up = +π/2', () => {
    assert.equal(headingTo(0, 0, 10, 0), 0);
    assert.ok(Math.abs(headingTo(0, 0, 0, 10) - Math.PI / 2) < 1e-9);
});

test('the Rare layer is invisible to gameplay layer masks', () => {
    const index = new SpatialIndex();
    index.begin();
    index.add(5, 0, 0, 1, CollisionLayer.Obstacle, 0, 'obstacle');
    index.add(5, 0, 0, 1, CollisionLayer.Rare, 0, 'rare');
    index.commit();
    const gameplayMask = CollisionLayer.Obstacle | CollisionLayer.Collectible | CollisionLayer.Creature
        | CollisionLayer.Tether | CollisionLayer.Boss | CollisionLayer.Spore | CollisionLayer.Projectile;
    assert.deepEqual(index.query(0, 0, 0, 10, gameplayMask).map((r) => r.kind), ['obstacle']);
    assert.deepEqual(index.query(0, 0, 0, 10, CollisionLayer.Rare).map((r) => r.kind), ['rare']);
});
