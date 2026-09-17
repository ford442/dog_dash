import test from 'node:test';
import assert from 'node:assert/strict';
import { createIceNeedleCluster } from '../../src/geological/kelp_ice.ts';

test('ice needles radiate away from the origin', () => {
    const cluster = createIceNeedleCluster({ count: 12 });
    assert.equal(cluster.children.length, 12);
    const originCount = cluster.children.filter((child) => {
        return child.position.lengthSq() < 0.01;
    }).length;
    assert.equal(originCount, 0, 'needles must not all sit at the cluster origin');
    for (const child of cluster.children) {
        assert.ok(child.position.length() > 0.5);
    }
});
