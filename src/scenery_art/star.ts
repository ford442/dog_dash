/**
 * The one puffy five-point star (#418). The collectible star
 * (`collectibles/orb.ts`) and the Hide-and-Seek Stars backdrop both use it,
 * so "a star" means the same silhouette everywhere. Before this, the
 * collectible was a `DodecahedronGeometry` and the backdrop an icosphere.
 */

import * as THREE from 'three';
import { starShape } from '../pickup_art/shapes';
import { mergeKitParts, placed, sharedGeometry } from './kit';

/** Outer radius of the star body, in the geometry's units. */
export const STAR_OUTER_RADIUS = 0.5;
const DEPTH = 0.22;
const BEVEL = 0.08;

function buildStarBody(): THREE.BufferGeometry {
    // bevelSegments 1 keeps it at ~76 triangles (the old icosphere was 80).
    const geo = new THREE.ExtrudeGeometry(starShape(5, 0.5), {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: BEVEL,
        bevelSize: BEVEL * 0.8,
        bevelSegments: 1
    });
    geo.translate(0, 0, -DEPTH / 2);
    return geo;
}

/**
 * Star body facing +Z, outer radius 0.5, white vertex colour. Shared
 * (`markShared`): owners must not dispose it.
 */
export function getStarBodyGeometry(): THREE.BufferGeometry {
    return sharedGeometry('scenery:star_body', () => mergeKitParts([{ geometry: buildStarBody(), tint: 0xffffff, flat: true }]));
}

/**
 * Hide-and-Seek star: the same body plus two little dark eyes on the front
 * face (they are playing hide-and-seek, so they look back). Scaled to the old
 * 0.8-radius footprint.
 */
export function getPeekingStarGeometry(): THREE.BufferGeometry {
    return sharedGeometry('scenery:peeking_star', () => {
        const s = 0.8 / STAR_OUTER_RADIUS;
        const front = DEPTH / 2 + BEVEL + 0.004;
        const eye = (x: number) => placed(new THREE.CircleGeometry(0.045, 6), [x, 0.03, front]);
        const geo = mergeKitParts([
            { geometry: buildStarBody(), tint: 0xffffff, flat: true },
            { geometry: eye(-0.075), tint: 0x2a1840 },
            { geometry: eye(0.075), tint: 0x2a1840 }
        ]);
        geo.scale(s, s, s);
        return geo;
    });
}
