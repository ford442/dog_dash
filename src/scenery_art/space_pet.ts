/**
 * Space bunny for the Space Pets Swarm (#418): one merged low-poly body
 * (lavender body, white helmet with a blue visor, long ears through the
 * helmet, pink inner ears, white tail, little feet, gold collar). ~230
 * triangles, fewer than the 12×12 sphere it replaces (264). Front is +Z,
 * up is +Y, about 1 unit tall like the old 0.5-radius sphere.
 */

import * as THREE from 'three';
import { mergeKitParts, placed, sharedGeometry, type KitPart } from './kit';

const FUR = 0xd8ccff;
const BELLY = 0xf2ecff;
const HELMET = 0xf4f6ff;
const VISOR = 0x2f4f8f;
const EAR_INNER = 0xffaad0;
const COLLAR = 0xffcc55;

/** Ear tips start above this local y; the material flops them. */
export const PET_EAR_BASE_Y = 0.55;

const tmp = new THREE.Color();

function buildSpacePetGeometry(): THREE.BufferGeometry {
    const parts: KitPart[] = [];

    const body = placed(new THREE.SphereGeometry(0.3, 7, 5), [0, 0, 0], [0, 0, 0], [1, 0.9, 1.1]);
    parts.push({ geometry: body, tint: (_p, n) => tmp.set(n.z > 0.55 && n.y < 0.3 ? BELLY : FUR).clone() });

    // Helmet: visor on the front, white shell elsewhere.
    const head = placed(new THREE.SphereGeometry(0.26, 8, 6), [0, 0.36, 0.05]);
    parts.push({ geometry: head, tint: (_p, n) => tmp.set(n.z > 0.4 && n.y < 0.55 && n.y > -0.35 ? VISOR : HELMET).clone() });

    // Collar where the helmet meets the body.
    parts.push({ geometry: placed(new THREE.CylinderGeometry(0.17, 0.2, 0.06, 8, 1, true), [0, 0.15, 0.03]), tint: COLLAR });

    // Long ears poking up through the helmet, inner face pink.
    for (const side of [-1, 1]) {
        const ear = placed(new THREE.ConeGeometry(0.075, 0.44, 5), [side * 0.1, 0.78, 0.02], [0, 0, side * -0.22], [1, 1, 0.5]);
        parts.push({ geometry: ear, flat: true, tint: (_p, n) => tmp.set(n.z > 0.35 ? EAR_INNER : FUR).clone() });
    }

    // Tail puff and feet.
    parts.push({ geometry: placed(new THREE.IcosahedronGeometry(0.1, 0), [0, -0.02, -0.33]), tint: 0xffffff, flat: true });
    for (const side of [-1, 1]) {
        parts.push({ geometry: placed(new THREE.SphereGeometry(0.08, 5, 3), [side * 0.13, -0.25, 0.12], [0, 0, 0], [1, 0.6, 1.4]), tint: BELLY });
    }

    return mergeKitParts(parts);
}

/** Shared space-bunny geometry (built once, `markShared`). */
export function getSpacePetGeometry(): THREE.BufferGeometry {
    return sharedGeometry('scenery:space_pet', buildSpacePetGeometry);
}
