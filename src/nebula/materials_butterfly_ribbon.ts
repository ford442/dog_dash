import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time, positionLocal, uv, vec3, vec4, color, uniform,
    mix, sin, float, pow, smoothstep
} from 'three/tsl';

/** TSL material for a whimsical butterfly mote. */
export function createButterflyMaterial(colorHex: number, uGlobalPulse: any, uMagicIntensity: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const uTime = time;
    const pos = positionLocal;

    const flapSpeed = float(15.0).add(uMagicIntensity.mul(15.0));
    const flap = sin(uTime.mul(flapSpeed));
    const zOffset = pos.x.abs().mul(flap);

    mat.positionNode = vec3(pos.x, pos.y, pos.z.add(zOffset));

    const phase = pos.x.mul(10.0).add(pos.y.mul(20.0)).add(pos.z.mul(30.0));
    const sparkle = sin(uTime.mul(5.0).add(phase)).add(1.0).mul(0.5);
    const sharpSparkle = pow(sparkle, 2.0);

    const baseColor = color(new THREE.Color(colorHex));
    const pastelColor = mix(baseColor, color(0xffffff), 0.5);

    const magicGlow = mix(float(0.5), float(1.0), uMagicIntensity);
    const globalSync = uGlobalPulse.mul(0.5).add(0.5);

    mat.colorNode = vec4(pastelColor, sharpSparkle.mul(globalSync).mul(magicGlow));

    return mat;
}

/**
 * Ribbon/veil material: a static vertical sky-tint gradient with a soft edge
 * fade. The animated swirl + opacity pulse were dropped — they cost a
 * per-fragment sin/cos pair on very large overdrawing sheets and read as
 * generic "swirl" rather than as the game.
 */
export function createRibbonVeilMaterial(
    topColorHex: number,
    bottomColorHex: number,
    opacity: number,
    _uvPhase: number
) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending
    });

    const uTop = uniform(new THREE.Color(topColorHex));
    const uBottom = uniform(new THREE.Color(bottomColorHex));
    const uOpacity = uniform(opacity);
    const vUv = uv();

    const skyTint = mix(uBottom, uTop, vUv.y);
    const edgeFade = smoothstep(float(0.0), float(0.28), vUv.y)
        .mul(smoothstep(float(1.0), float(0.42), vUv.y));

    mat.colorNode = vec4(skyTint, edgeFade.mul(uOpacity));
    mat.userData.uTop = uTop;
    mat.userData.uBottom = uBottom;

    return mat;
}
