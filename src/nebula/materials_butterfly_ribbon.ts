import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time, positionLocal, uv, vec3, vec4, color, uniform,
    mix, sin, cos, float, pow, smoothstep
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

/** Cheap ribbon/veil material: sky tint + one global time uniform (swirl + opacity pulse). */
export function createRibbonVeilMaterial(
    topColorHex: number,
    bottomColorHex: number,
    opacity: number,
    uvPhase: number
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
    const uPhase = uniform(uvPhase);
    const vUv = uv();

    const swirl = sin(vUv.x.mul(4.0).add(time.mul(0.1).add(uPhase)))
        .mul(cos(vUv.y.mul(3.0).sub(time.mul(0.07).add(uPhase.mul(0.5)))));
    const pulse = sin(time.mul(0.32).add(uPhase)).mul(0.5).add(0.5);

    const skyTint = mix(uBottom, uTop, vUv.y);
    const edgeFade = smoothstep(float(0.0), float(0.28), vUv.y)
        .mul(smoothstep(float(1.0), float(0.42), vUv.y));
    const alpha = edgeFade
        .mul(uOpacity)
        .mul(pulse.mul(0.12).add(0.88))
        .mul(swirl.mul(0.22).add(0.78));

    mat.colorNode = vec4(skyTint, alpha);
    mat.userData.uTop = uTop;
    mat.userData.uBottom = uBottom;

    return mat;
}
