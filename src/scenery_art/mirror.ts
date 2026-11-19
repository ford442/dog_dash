/**
 * Quantum Mirror shard (#418): a thin, sharp-edged pane broken off a mirror,
 * in place of a random-jittered icosahedron lump. Same 20 triangles. The
 * flat faces are bright (they take the chromatic mirror shift), the cut
 * edges darker, so the pane reads as glass catching light as it tumbles.
 */

import * as THREE from 'three';
import { mergeKitParts, sharedGeometry } from './kit';

const tmp = new THREE.Color();

function buildMirrorShard(): THREE.BufferGeometry {
    // Irregular six-sided shard, ~2.2 wide × 4.4 tall (the old lump was ~4 across).
    const outline: Array<[number, number]> = [
        [0.15, 2.2], [1.05, 0.7], [0.85, -1.3], [0.2, -2.2], [-0.95, -0.9], [-0.8, 1.1]
    ];
    const shape = new THREE.Shape();
    outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
    geo.translate(0, 0, -0.06);
    return mergeKitParts([{
        geometry: geo,
        flat: true,
        tint: (_p, n) => tmp.setScalar(Math.abs(n.z) > 0.9 ? 1 : 0.4).clone()
    }]);
}

/** Shared mirror-shard geometry (built once, `markShared`). */
export function getMirrorShardGeometry(): THREE.BufferGeometry {
    return sharedGeometry('scenery:mirror_shard', buildMirrorShard);
}
