/**
 * Cloud castle TSL materials and color palettes
 */

import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    time,
    uv,
    vec2,
    vec3,
    vec4,
    color,
    sin,
    float,
    smoothstep,
    dot,
    mix,
    positionLocal,
    length
} from 'three/tsl';
import type { TSLNode } from '../tsl_types';

export const PASTEL_COLORS = {
    cottonCandy: 0xFFB6E6,
    lavender: 0xE6B6FF,
    mint: 0xB6FFE6,
    sky: 0xB6E6FF,
    peach: 0xFFE6B6,
    cream: 0xFFFEF0,
    gold: 0xFFE4B5,
    rose: 0xFFB6C1
};

export const TOWER_COLORS = [
    0xFFF0F5,
    0xF0FFF0,
    0xFFF5EE,
    0xF5FFFA,
    0xFFE4E1,
    0xE6E6FA,
];

export const RAINBOW_COLORS = [
    0xFF6B6B,
    0xFFB347,
    0xFFEB3B,
    0x77DD77,
    0x6BB5FF,
    0x9B59B6,
    0xFF69B4,
];

const random2D = (v: any) => {
    return sin(dot(v, vec2(12.9898, 78.233))).mul(43758.5453).fract();
};

const valueNoise = (v: any) => {
    const i = v.floor();
    const f = v.fract();
    const a = random2D(i);
    const b = random2D(i.add(vec2(1.0, 0.0)));
    const c = random2D(i.add(vec2(0.0, 1.0)));
    const d = random2D(i.add(vec2(1.0, 1.0)));
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
    return mix(a, b, u.x).add(
        (c.sub(a).mul(u.y).mul(float(1.0).sub(u.x))).add(
        (d.sub(b).mul(u.x).mul(u.y)))
    );
};

const fbm = (v: any) => {
    let total: TSLNode = float(0.0);
    let amplitude: TSLNode = float(0.5);
    let frequency: TSLNode = float(1.0);
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    return total;
};

export function createDreamyCloudMaterial(baseColorHex: number, opacity: number = 0.9) {
    const mat = new MeshStandardNodeMaterial({
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.9,
        metalness: 0.0
    });

    const uTime = time;
    const vUv = uv();
    const baseColor = color(new THREE.Color(baseColorHex));

    const p = vUv.mul(4.0);
    const t = uTime.mul(0.1);
    const noiseVal = fbm(p.add(vec2(t, t.mul(0.5))));

    const normal = positionLocal.normalize();
    const fresnel = float(1.0).sub(normal.z.abs());
    const softEdge = smoothstep(0.2, 0.8, fresnel);

    const density = noiseVal.mul(softEdge);
    const alpha = smoothstep(0.1, 0.5, density).mul(opacity);

    const shadowFactor = noiseVal.mul(0.3).add(0.7);
    const finalColor = baseColor.mul(shadowFactor);

    const glow = sin(uTime.mul(0.5)).add(1.0).mul(0.1).add(0.9);

    mat.colorNode = vec4(finalColor.mul(glow), alpha);

    return mat;
}

export function createTowerMaterial(colorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness: 0.6,
        metalness: 0.1
    });

    const uTime = time;
    const vUv = uv();

    const shimmer = sin(uTime.mul(2.0).add(vUv.x.mul(10.0)).add(vUv.y.mul(5.0)))
        .add(1.0).mul(0.5).mul(0.1);

    const shimmerColor = color(new THREE.Color(0xFFFFFF));

    mat.emissiveNode = shimmerColor.mul(shimmer);

    return mat;
}

export function createWindowGlowMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });

    const uTime = time;

    const twinkle = sin(uTime.mul(3.0)).add(1.0).mul(0.5).mul(0.3).add(0.7);
    const warmColor = color(new THREE.Color(0xFFE4B5)).mul(twinkle);

    const vUv = uv();
    const centered = vUv.sub(0.5);
    const dist = length(centered).mul(2.0);
    const alpha = smoothstep(1.0, 0.3, dist);

    mat.colorNode = vec4(warmColor, alpha);

    return mat;
}

export function createRainbowMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const uTime = time;
    const vUv = uv();

    const hue = vUv.x.add(sin(uTime.mul(0.5)).mul(0.1));

    let rainbow: TSLNode = vec3(0.0, 0.0, 0.0);

    const r = sin(hue.mul(Math.PI * 2.0)).mul(0.5).add(0.5);
    const g = sin(hue.mul(Math.PI * 2.0).add(2.0)).mul(0.5).add(0.5);
    const b = sin(hue.mul(Math.PI * 2.0).add(4.0)).mul(0.5).add(0.5);

    rainbow = vec3(r, g, b).mul(0.8).add(0.2);

    const sparkleNoise = fbm(vUv.mul(20.0).add(uTime));
    const sparkle = smoothstep(0.7, 0.9, sparkleNoise).mul(0.5);

    const finalColor = rainbow.add(vec3(sparkle));
    const alpha = float(0.6).add(sparkle.mul(0.3));

    mat.colorNode = vec4(finalColor, alpha);

    return mat;
}

export function createHeartFlagMaterial(colorHex: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide
    });

    const uTime = time;
    const vUv = uv();

    const centered = vUv.sub(0.5);
    const x = centered.x;
    const y = centered.y;

    const a = x.mul(x).add(y.mul(y)).sub(0.25);
    const heartDist = a.mul(a).mul(a).sub(x.mul(x).mul(y.mul(y).mul(y)));

    const heartMask = smoothstep(0.001, 0.0, heartDist.mul(100.0));

    const wave = sin(uTime.mul(2.0).add(vUv.x.mul(5.0))).mul(0.1);
    const waveMask = smoothstep(0.4, 0.5, vUv.y.add(wave));

    const baseColor = color(new THREE.Color(colorHex));
    const alpha = heartMask.mul(waveMask);

    mat.colorNode = vec4(baseColor, alpha);
    mat.alphaTest = 0.1;

    return mat;
}

export function createGlowFlowerMaterial(colorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.5,
        roughness: 0.8
    });

    const uTime = time;

    const pulse = sin(uTime.mul(1.5)).add(1.0).mul(0.5).mul(0.3).add(0.7);
    mat.emissiveNode = color(new THREE.Color(colorHex)).mul(pulse.mul(0.5));

    return mat;
}
