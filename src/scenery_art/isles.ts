/**
 * Floating island for the Grapple Isles backdrop (#418).
 *
 * One merged, vertex-coloured geometry shared by all four parallax layers:
 * a flat grassy top with a dirt rim, a rocky underside tapering to a point,
 * hanging roots, a candy-pink tree, a lantern and a gold grapple hook ring.
 * Unit radius, grass surface at y = 0, so instance scale is the island's
 * radius. `aMask`: 0 body, 1 lantern glass (glows), 2 hook ring (lights up
 * when the player is near).
 */

import * as THREE from 'three';
import { hash3, mergeMaskedParts, placed, shade, sharedGeometry, type MaskedPart } from './kit';

export const ISLE_MASK_LANTERN = 1;
export const ISLE_MASK_RING = 2;

const GRASS = 0x8fe3a0;
const DIRT = 0xb07a5a;
const ROCK = 0x6b5b7b;
const ROOT = 0x6a8f4a;
const TRUNK = 0x8b5a3c;
const CANOPY = 0xff9fd0;
const LANTERN = 0xffd27a;
const POST = 0x4a3a30;
const RING = 0xffc94a;

const tmp = new THREE.Color();

function rockyUnderside(): THREE.BufferGeometry {
    // Inverted cone, apex down, base ring just under the dirt rim.
    const depth = 1.45;
    const cone = new THREE.ConeGeometry(0.97, depth, 7, 2, true);
    cone.rotateX(Math.PI);
    cone.translate(0, -0.16 - depth / 2, 0);
    const pos = cone.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const t = THREE.MathUtils.clamp((-0.16 - v.y) / depth, 0, 1); // 0 at the rim, 1 at the tip
        if (t < 0.02) continue; // keep the rim ring sealed against the dirt band
        // Position hash (not index) so the duplicated seam vertices move together.
        const h = hash3(Math.round(v.x * 100), Math.round(v.y * 100), Math.round(v.z * 100));
        const bulge = 1 + (h - 0.5) * 0.45 * (1 - t * 0.5);
        v.x *= bulge;
        v.z *= bulge;
        // Off-centre tip so the underside is a crag, not a perfect cone.
        if (t > 0.98) { v.x += 0.18; v.z -= 0.08; }
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    return cone;
}

function buildIsleGeometry(): THREE.BufferGeometry {
    const parts: MaskedPart[] = [];

    // Grass top (flat, faces up) + dirt rim band.
    const top = new THREE.CircleGeometry(1, 7);
    top.rotateX(-Math.PI / 2);
    parts.push({ geometry: top, tint: GRASS, flat: true });
    const rim = new THREE.CylinderGeometry(1, 0.97, 0.16, 7, 1, true);
    rim.translate(0, -0.08, 0);
    parts.push({ geometry: rim, flat: true, tint: (p) => tmp.set(p.y > -0.05 ? GRASS : DIRT).clone() });

    // Rocky underside, darker toward the tip.
    parts.push({
        geometry: rockyUnderside(),
        flat: true,
        tint: (p) => shade(ROCK, 1.1 - THREE.MathUtils.clamp(-p.y / 1.6, 0, 1) * 0.55)
    });

    // Hanging roots.
    const roots: Array<[number, number, number, number]> = [
        [-0.55, -0.35, 0.3, 0.7], [0.35, -0.5, 0.45, 0.55], [0.1, -0.7, -0.4, 0.6]
    ];
    for (const [x, y, z, len] of roots) {
        const root = new THREE.ConeGeometry(0.06, len, 3, 1, true);
        root.rotateX(Math.PI);
        parts.push({ geometry: placed(root, [x, y - len / 2, z], [0.15, 0, -0.1]), tint: ROOT, flat: true });
    }

    // Tree: trunk + two-lobed canopy, set back from the centre.
    const trunk = new THREE.ConeGeometry(0.07, 0.55, 3, 1, true);
    parts.push({ geometry: placed(trunk, [-0.35, 0.27, -0.2]), tint: TRUNK, flat: true });
    parts.push({ geometry: placed(new THREE.IcosahedronGeometry(0.3, 0), [-0.35, 0.65, -0.2], [0.3, 0.2, 0]), tint: CANOPY, flat: true });
    parts.push({ geometry: placed(new THREE.IcosahedronGeometry(0.2, 0), [-0.12, 0.55, -0.12], [0.1, 0.6, 0.2]), tint: shade(CANOPY, 0.85), flat: true });

    // Lantern on a post, toward the front-right.
    const post = new THREE.CylinderGeometry(0.02, 0.025, 0.42, 3, 1, true);
    parts.push({ geometry: placed(post, [0.5, 0.21, 0.35]), tint: POST, flat: true });
    parts.push({ geometry: placed(new THREE.OctahedronGeometry(0.08, 0), [0.5, 0.47, 0.35], [0, 0, 0], [1, 1.35, 1]), tint: LANTERN, flat: true, mask: ISLE_MASK_LANTERN });

    // Grapple hook ring standing on the front edge (faces the camera).
    const ring = new THREE.TorusGeometry(0.14, 0.03, 3, 7);
    parts.push({ geometry: placed(ring, [0.05, 0.2, 0.78]), tint: RING, flat: true, mask: ISLE_MASK_RING });
    const stake = new THREE.CylinderGeometry(0.02, 0.02, 0.08, 3, 1, true);
    parts.push({ geometry: placed(stake, [0.05, 0.03, 0.78]), tint: POST, flat: true });

    return mergeMaskedParts(parts);
}

/** Shared floating-island geometry (built once, `markShared`). */
export function getIsleGeometry(): THREE.BufferGeometry {
    return sharedGeometry('scenery:isle', buildIsleGeometry);
}
