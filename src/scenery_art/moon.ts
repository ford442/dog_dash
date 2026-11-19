/**
 * The backdrop moon (#418): craters carved into the surface (bowl + raised
 * rim, darker floors, bright rims) instead of grey spheres stuck on as
 * bumps, plus one landmark: the space dog's flag with a paw print planted at
 * the north pole, so it is *our* moon. One merged vertex-coloured mesh.
 *
 * Deterministic (crater layout from a Fibonacci lattice + position hash).
 */

import * as THREE from 'three';
import { fbm3, fibonacciSphere, hash3, mergeKitParts, placed, sharedGeometry, type KitPart } from './kit';

export const MOON_RADIUS = 8;

interface Crater {
    dir: THREE.Vector3;
    /** Angular radius (radians). */
    radius: number;
    /** Bowl depth as a fraction of the crater's world radius. */
    depth: number;
}

function craterLayout(): Crater[] {
    const craters: Crater[] = [];
    // Big craters, spread out; skip the north cap where the flag stands.
    fibonacciSphere(13).forEach((d, i) => {
        if (d.y > 0.8) return;
        craters.push({ dir: d, radius: 0.13 + hash3(i, 1, 7) * 0.17, depth: 0.3 });
    });
    // Small craters in between.
    fibonacciSphere(30).forEach((d, i) => {
        if (d.y > 0.85) return;
        const jitter = new THREE.Vector3(hash3(i, 2, 3) - 0.5, hash3(i, 5, 1) - 0.5, hash3(i, 9, 4) - 0.5).multiplyScalar(0.35);
        craters.push({ dir: d.clone().add(jitter).normalize(), radius: 0.06 + hash3(i, 3, 3) * 0.04, depth: 0.35 });
    });
    return craters;
}

/** Radial offset and a crater shading term (−1 floor … +1 rim) for one direction. */
function craterField(dir: THREE.Vector3, craters: Crater[]): { offset: number; shade: number } {
    let offset = 0;
    let shadeTerm = 0;
    for (const c of craters) {
        const d = Math.acos(THREE.MathUtils.clamp(dir.dot(c.dir), -1, 1));
        const x = d / c.radius;
        if (x > 1.6) continue;
        const worldR = c.radius * MOON_RADIUS;
        if (x < 1) {
            offset -= c.depth * worldR * (1 - x * x);
            shadeTerm -= 0.35 + (1 - x) * 0.65;
        }
        const rim = Math.exp(-(((x - 1) / 0.22) ** 2));
        offset += rim * c.depth * worldR * 0.35;
        shadeTerm += rim * 1.2;
    }
    return { offset, shade: THREE.MathUtils.clamp(shadeTerm, -1, 1) };
}

const HIGHLAND = new THREE.Color(0x6a62a0);
const MARE = new THREE.Color(0x3a3466);
const tmp = new THREE.Color();

function moonSurface(): KitPart {
    const craters = craterLayout();
    const geo = new THREE.SphereGeometry(MOON_RADIUS, 64, 40);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    const shades = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        const { offset, shade } = craterField(v, craters);
        shades[i] = shade;
        v.multiplyScalar(MOON_RADIUS + offset);
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    // Colour by position (the merge passes the displaced position back in).
    const lookup = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) {
        lookup.set(`${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`, shades[i]);
    }
    return {
        geometry: geo,
        tint: (p) => {
            const dir = p.clone().normalize();
            const mare = THREE.MathUtils.smoothstep(fbm3(dir.x * 1.6 + 5, dir.y * 1.6, dir.z * 1.6), 0.45, 0.62);
            tmp.copy(HIGHLAND).lerp(MARE, mare);
            const s = lookup.get(`${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`) ?? 0;
            return tmp.multiplyScalar(s < 0 ? 1 + s * 0.6 : 1 + s * 0.9).clone();
        }
    };
}

/** Paw print as five discs on the flag face at z, scaled to the cloth. */
function pawPrint(cx: number, cy: number, z: number, facing: 1 | -1): KitPart[] {
    const rot: [number, number, number] = [0, facing === 1 ? 0 : Math.PI, 0];
    const disc = (x: number, y: number, r: number) => placed(new THREE.CircleGeometry(r, 8), [cx + x * facing, cy + y, z], rot);
    const PAW = 0xfff1d6;
    return [
        { geometry: disc(0, -0.08, 0.17), tint: PAW },
        { geometry: disc(-0.2, 0.13, 0.065), tint: PAW },
        { geometry: disc(-0.07, 0.22, 0.07), tint: PAW },
        { geometry: disc(0.07, 0.22, 0.07), tint: PAW },
        { geometry: disc(0.2, 0.13, 0.065), tint: PAW }
    ];
}

function flagParts(): KitPart[] {
    const base = MOON_RADIUS - 0.05;
    const poleH = 2.6;
    const cloth = { w: 1.5, h: 0.95, d: 0.04 };
    const cx = cloth.w / 2 + 0.04;
    const cy = base + poleH - cloth.h / 2 - 0.05;
    return [
        { geometry: placed(new THREE.CylinderGeometry(0.05, 0.06, poleH, 6), [0, base + poleH / 2, 0]), tint: 0xd8dde8 },
        { geometry: placed(new THREE.SphereGeometry(0.1, 6, 4), [0, base + poleH + 0.05, 0]), tint: 0xffd25a },
        { geometry: placed(new THREE.BoxGeometry(cloth.w, cloth.h, cloth.d), [cx, cy, 0]), tint: 0xff6a5a, flat: true },
        ...pawPrint(cx, cy, cloth.d / 2 + 0.005, 1),
        ...pawPrint(cx, cy, -cloth.d / 2 - 0.005, -1)
    ];
}

function buildMoonGeometry(): THREE.BufferGeometry {
    return mergeKitParts([moonSurface(), ...flagParts()]);
}

/** Shared moon geometry: carved surface + flag landmark (built once). */
export function getMoonGeometry(): THREE.BufferGeometry {
    return sharedGeometry('scenery:moon', buildMoonGeometry);
}
