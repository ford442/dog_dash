import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createIceNeedleCluster } from '../../src/geological/kelp_ice.ts';
import { hexNeedleOffsets } from '../../src/geological/flora_gameplay.ts';

test('ice needles are instanced on a hex lattice, not stacked at the origin', () => {
    const cluster = createIceNeedleCluster({ count: 12 });
    const mesh = cluster.children[0] as THREE.InstancedMesh;
    assert.ok(mesh.isInstancedMesh);
    assert.equal(mesh.count, 12);
    const offsets = hexNeedleOffsets(12);
    const dummy = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    let originCount = 0;
    for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, dummy);
        pos.setFromMatrixPosition(dummy);
        if (pos.lengthSq() < 0.01) originCount++;
        assert.ok(Math.hypot(pos.x - offsets[i]!.x, pos.z - offsets[i]!.z) < 0.01);
    }
    assert.equal(originCount, 1, 'only the hex-center needle sits on the cluster origin');
});
