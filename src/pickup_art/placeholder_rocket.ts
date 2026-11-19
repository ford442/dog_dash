/**
 * Fallback player rocket, shown when `rocket.glb` is skipped (headless,
 * `?skip_gpu_boot`) or fails to load — so it is the first thing a slow load
 * shows. Built to read as the same rocket: white hull, red nose, round
 * porthole with a gold rim, four swept red fins, a dark nozzle.
 *
 * Built along +Y (nose up), 2 units tall and centred like the normalised GLB,
 * so `player_update`'s `rotation.z = -π/2` turns the nose toward +X and the
 * flame (at -Y) trails behind it. One merged, vertex-coloured body + a glass
 * porthole. Visual-only.
 */

import * as THREE from 'three';
import { mergeKitParts, placed, type KitPart } from '../hazard_art/kit';
import { sharedGeometry } from './shapes';

/** Local -Y of the nozzle exit (the flame sits just below it). */
export const PLACEHOLDER_ROCKET_NOZZLE_Y = -1.0;
/** Porthole height, just below where `placeProceduralDogOnRocket` seats the pilot. */
const PORTHOLE_Y = 0.3;

const HULL = new THREE.Color(0xf3f1ec);
const NOSE = new THREE.Color(0xe94560);
const FIN = new THREE.Color(0xd83a52);
const TRIM = new THREE.Color(0xffc857);
const NOZZLE = new THREE.Color(0x3b3f4a);

function hullRadius(y: number): number {
    // Ogive nose (y 0.35 → 1), straight-ish body, gentle boat-tail.
    if (y > 0.35) {
        const u = (y - 0.35) / 0.65;
        return 0.42 * Math.sqrt(Math.max(0, 1 - u * u));
    }
    if (y > -0.55) return 0.42 - (0.35 - y) * 0.02;
    const u = (y + 0.55) / 0.3; // 0 at -0.55 … -1 at -0.85
    return 0.4 + u * 0.08;
}

function buildRocketBody(): THREE.BufferGeometry {
    const profile: THREE.Vector2[] = [];
    for (let i = 0; i <= 28; i++) {
        const y = -0.85 + (i / 28) * 1.85;
        profile.push(new THREE.Vector2(Math.max(0.0001, hullRadius(y)), y));
    }
    profile[profile.length - 1].x = 0;
    const hull = new THREE.LatheGeometry(profile, 24);

    const parts: KitPart[] = [{
        geometry: hull,
        tint: (p) => (p.y > 0.55 ? NOSE : Math.abs(p.y - 0.55) < 0.025 || Math.abs(p.y + 0.5) < 0.03 ? TRIM : HULL)
    }];

    // Porthole rim (glass is a separate mesh) on the camera side, where the dog sits.
    const rim = new THREE.TorusGeometry(0.2, 0.04, 8, 28);
    parts.push({ geometry: placed(rim, [0, PORTHOLE_Y, hullRadius(PORTHOLE_Y) - 0.01]), tint: TRIM });

    // Four swept fins (±X become top / bottom once the rocket lies along +X).
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0.25);
    finShape.lineTo(0.38, -0.12);
    finShape.lineTo(0.4, -0.42);
    finShape.lineTo(0, -0.22);
    finShape.lineTo(0, 0.25);
    for (let i = 0; i < 4; i++) {
        const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
        fin.translate(0.34, -0.52, -0.03);
        fin.rotateY((i / 4) * Math.PI * 2);
        parts.push({ geometry: fin, tint: FIN, flat: true });
    }

    // Nozzle bell.
    const bell = new THREE.LatheGeometry([
        new THREE.Vector2(0.2, -0.82), new THREE.Vector2(0.24, -0.92), new THREE.Vector2(0.3, -1.0),
        new THREE.Vector2(0.26, -1.0), new THREE.Vector2(0.18, -0.9)
    ], 18);
    parts.push({ geometry: bell, tint: NOZZLE });
    return mergeKitParts(parts);
}

/** The fallback rocket model (nose +Y, ~2 units tall). Shared geometry; own materials. */
export function createPlaceholderRocketModel(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'placeholder_rocket';
    const body = new THREE.Mesh(
        sharedGeometry('placeholder_rocket_body', buildRocketBody),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15 })
    );
    body.castShadow = true;
    group.add(body);

    const glass = new THREE.Mesh(
        sharedGeometry('placeholder_rocket_glass', () => {
            const g = new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
            g.rotateX(Math.PI / 2);
            g.scale(1, 1, 0.45);
            return g;
        }),
        new THREE.MeshPhysicalMaterial({ color: 0x8fdcff, emissive: 0x2a7fb0, emissiveIntensity: 0.5, roughness: 0.05, clearcoat: 1 })
    );
    glass.position.set(0, PORTHOLE_Y, hullRadius(PORTHOLE_Y) - 0.02);
    group.add(glass);
    return group;
}
