/**
 * 2D emblem outlines (heart, star, flame, lightning bolt, crescent, arrowhead,
 * butterfly wing) and helpers that turn them into small extruded solids.
 *
 * Shared by the pickup / power-up / projectile / slingable kit. Everything is
 * deterministic, visual-only geometry: no RNG of any kind.
 */

import * as THREE from 'three';
import { markShared, noteGeometryCreated } from '../gpu_resources';

/** Heart, point down, roughly 1 wide × 1 tall, centred on the origin. */
export function heartShape(): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(-0.15, -0.32, -0.5, -0.12, -0.5, 0.15);
    s.bezierCurveTo(-0.5, 0.42, -0.2, 0.55, 0, 0.3);
    s.bezierCurveTo(0.2, 0.55, 0.5, 0.42, 0.5, 0.15);
    s.bezierCurveTo(0.5, -0.12, 0.15, -0.32, 0, -0.5);
    return s;
}

/** `points`-pointed star with outer radius 0.5 and the given inner ratio. */
export function starShape(points = 5, inner = 0.45): THREE.Shape {
    const s = new THREE.Shape();
    for (let i = 0; i <= points * 2; i++) {
        const a = Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? 0.5 : 0.5 * inner;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    return s;
}

/** Three-tongued flame, base at y = -0.5, tip at y = +0.5. */
export function flameShape(): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(-0.3, -0.5, -0.42, -0.25, -0.38, 0.0);
    s.bezierCurveTo(-0.35, 0.18, -0.26, 0.24, -0.28, 0.38);  // left tongue
    s.bezierCurveTo(-0.14, 0.26, -0.1, 0.18, -0.08, 0.1);
    s.bezierCurveTo(-0.06, 0.28, 0.02, 0.4, 0.0, 0.5);       // centre tip
    s.bezierCurveTo(0.14, 0.36, 0.18, 0.24, 0.14, 0.12);
    s.bezierCurveTo(0.2, 0.18, 0.28, 0.26, 0.3, 0.32);       // right tongue
    s.bezierCurveTo(0.42, 0.12, 0.4, -0.2, 0.3, -0.36);
    s.bezierCurveTo(0.22, -0.48, 0.12, -0.5, 0, -0.5);
    return s;
}

/** Zig-zag lightning bolt, ~0.55 wide × 1 tall, leaning right. */
export function boltShape(): THREE.Shape {
    const s = new THREE.Shape();
    const pts: Array<[number, number]> = [
        [0.08, 0.5], [-0.24, 0.02], [-0.02, 0.02], [-0.16, -0.5],
        [0.26, 0.08], [0.04, 0.08], [0.24, 0.5]
    ];
    pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
    return s;
}

/** Crescent moon opening to +X, 1 tall. */
export function crescentShape(): THREE.Shape {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.5, Math.PI * 0.32, Math.PI * 1.68, false);
    s.absarc(0.2, 0, 0.4, Math.PI * 1.55, Math.PI * 0.45, true);
    return s;
}

/** Barbed arrowhead pointing +X, tip at x = +0.5, base at x = -0.5. */
export function arrowheadShape(): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(0.5, 0);
    s.lineTo(-0.5, 0.42);
    s.lineTo(-0.22, 0.0);
    s.lineTo(-0.5, -0.42);
    s.lineTo(0.5, 0);
    return s;
}

/** Fletching vane for an arrow tail, swept back toward -X. */
export function vaneShape(): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(0.5, 0);
    s.lineTo(-0.2, 0.42);
    s.lineTo(-0.5, 0.42);
    s.lineTo(-0.3, 0);
    s.lineTo(0.5, 0);
    return s;
}

/**
 * Butterfly wing (upper + lower lobe) growing out from the body along +X.
 * Root at the origin; ~1.1 wide × 1.3 tall.
 */
export function butterflyWingShape(): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(0, 0.05);
    s.bezierCurveTo(0.2, 0.7, 1.05, 0.85, 1.05, 0.45);   // upper lobe
    s.bezierCurveTo(1.05, 0.15, 0.6, 0.05, 0.35, 0.0);
    s.bezierCurveTo(0.75, -0.15, 0.8, -0.55, 0.5, -0.6); // lower lobe
    s.bezierCurveTo(0.25, -0.62, 0.05, -0.3, 0, -0.05);
    return s;
}

/**
 * Extrude a 2D shape to `depth` (centred on z = 0) with a soft bevel so it
 * catches light at the edges. The result is in shape units; scale with
 * `placed()` or the mesh.
 */
export function extrudeShape(shape: THREE.Shape, depth: number, bevel = depth * 0.35, curveSegments = 10): THREE.BufferGeometry {
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel * 0.8,
        bevelSegments: 2,
        curveSegments
    });
    geo.translate(0, 0, -depth / 2);
    return geo;
}

/** Shared-geometry cache: build once, markShared so `disposeObject` skips it. */
const cache = new Map<string, THREE.BufferGeometry>();

export function sharedGeometry(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geo = cache.get(key);
    if (!geo) {
        geo = markShared(build());
        geo.computeBoundingSphere();
        geo.computeBoundingBox();
        noteGeometryCreated();
        cache.set(key, geo);
    }
    return geo;
}
