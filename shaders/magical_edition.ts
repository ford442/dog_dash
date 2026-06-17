import * as THREE from 'three';
import {
    color,
    time,
    positionLocal,
    vec2,
    vec3,
    vec4,
    float,
    uniform,
    mix,
    sin,
    cos,
    uv,
    length,
    smoothstep,
    positionWorld
} from 'three/tsl';
import { MeshBasicNodeMaterial, MeshPhysicalNodeMaterial } from 'three/webgpu';

/**
 * Pastel Rainbow Nebula Material
 * Creates a soft, additive blending nebulous cloud with pastel rainbow shifting colors.
 */
export function createPastelRainbowNebulaMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const vUv = uv();
    const centeredUv = vUv.sub(0.5);
    const dist = length(centeredUv).mul(2.0);
    const mask = float(1.0).sub(smoothstep(0.4, 1.0, dist));

    const uTime = time;
    
    // Noise simulation for nebulous look
    const noiseAngle = vUv.y.atan2(vUv.x);
    const noise = sin(dist.mul(10.0).sub(uTime.mul(2.0))).add(cos(noiseAngle.mul(5.0).add(uTime))).mul(0.25).add(0.5);
    
    // Pastel Rainbow Shift
    // base rainbow: 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)))
    const t = dist.mul(2.0).sub(uTime.mul(0.5));
    const r = cos(t.mul(6.28318)).mul(0.5).add(0.5);
    const g = cos(t.add(0.33).mul(6.28318)).mul(0.5).add(0.5);
    const b = cos(t.add(0.67).mul(6.28318)).mul(0.5).add(0.5);
    const rainbowColor = vec3(r, g, b);

    // Make it pastel by mixing with white
    const pastelColor = mix(rainbowColor, vec3(1.0), 0.5);

    mat.colorNode = vec4(pastelColor, mask.mul(noise).mul(0.8));

    return mat;
}

/**
 * Dynamic Aurora Borealis Material
 * Undulating wave motions for magical sky environments.
 */
export function createDynamicAuroraMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const vUv = uv();
    const uTime = time;

    // Undulating wave motions based on UVs and time
    const wave1 = sin(vUv.x.mul(10.0).add(uTime.mul(3.0)));
    const wave2 = cos(vUv.x.mul(20.0).sub(uTime.mul(2.0)));
    const verticalWave = sin(vUv.y.mul(5.0).add(wave1).add(uTime));

    const intensity = wave1.add(wave2).add(verticalWave).mul(0.33).add(0.5);

    // Fade top and bottom
    const fade = smoothstep(0.0, 0.2, vUv.y).mul(float(1.0).sub(smoothstep(0.6, 1.0, vUv.y)));

    const color1 = color(0x88ffaa); // Mint green
    const color2 = color(0xaa88ff); // Lavender purple
    const color3 = color(0x88ccff); // Sky blue

    const mix1 = mix(color1, color2, sin(vUv.x.mul(5.0).add(uTime)).mul(0.5).add(0.5));
    const mix2 = mix(mix1, color3, cos(vUv.y.mul(3.0).sub(uTime)).mul(0.5).add(0.5));

    mat.colorNode = vec4(mix2, intensity.mul(fade).mul(0.7));

    return mat;
}

/**
 * Solar Sails Material
 * Physical thin-film iridescence (thickness map 200–700nm).
 */
export function createSolarSailsMaterial() {
    const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        opacity: 0.8,
        roughness: 0.1,
        metalness: 0.3,
        side: THREE.DoubleSide,
        transmission: 0.5,
        clearcoat: 1.0
    });

    const uTime = time;
    const vUv = uv();

    // Setup basic iridescent properties
    mat.iridescence = 1.0;
    mat.iridescenceIOR = 1.5;

    // Procedural thickness map from 200nm to 700nm
    const thicknessNoise = sin(vUv.x.mul(15.0).add(uTime)).add(cos(vUv.y.mul(15.0).sub(uTime))).mul(0.5).add(0.5);
    // 200 to 700 nm mapped to nanometers
    mat.iridescenceThicknessNode = mix(float(200.0), float(700.0), thicknessNoise);

    // Base color
    mat.colorNode = vec4(color(0xffffff), 0.8);

    return mat;
}
