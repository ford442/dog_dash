import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { time, positionWorld, uv, vec4, color, uniform, mix, float, length, smoothstep, Loop, step, fract } from 'three/tsl';
import { shouldUseLiteMaterials, createLiteIndustrialMaterial } from './materials_shared';

export function createConveyorMaterial(speed: number, uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(0x888888, 0.7, 0.6, uPlayerPos);
    }

    const mat = new MeshStandardNodeMaterial({
        color: 0x888888,
        roughness: 0.7,
        metalness: 0.6,
        side: THREE.FrontSide
    });

    const uInteractionRadius = uniform(30.0);
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);
    const uPlayerGlowColor = uniform(new THREE.Color(0xff8844));

    const weaponGlow = float(0.0).toVar();
    const uWeaponColor = uniform(new THREE.Color(0x00ffff));
    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w;
        const distToLight = length(positionWorld.sub(lightPos));
        const wGlow = smoothstep(50.0, 0.0, distToLight).mul(lightIntensity);
        weaponGlow.addAssign(wGlow);
    });

    const dynamicLighting = uPlayerGlowColor.mul(playerGlowIntensity.mul(0.5)).add(uWeaponColor.mul(weaponGlow.mul(0.8)));

    mat.userData.uPlayerPos = uPlayerPos;

    const uTime = time;
    const uSpeed = uniform(speed);
    const vUv = uv();

    const density = float(10.0);
    const patternInput = vUv.x.add(vUv.y).mul(density).sub(uTime.mul(uSpeed));
    const stripe = step(0.5, fract(patternInput));

    const colorBase = color(0x222222);
    const colorStripe = color(0xffcc00);
    const emissiveBase = color(0x000000);
    const emissiveStripe = color(0x332200);

    mat.colorNode = vec4(mix(colorBase, colorStripe, stripe), 1.0);
    mat.emissiveNode = mix(emissiveBase, emissiveStripe, stripe).add(dynamicLighting);

    return mat;
}

/**
 * Creates a TSL material for energy conduits (pulsing pipes).
 */
export function createPulsingConduitMaterial(baseColorHex: number, glowColorHex: number, pulseSpeed: number, uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(baseColorHex, 0.4, 0.9, uPlayerPos);
    }

    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        roughness: 0.4,
        metalness: 0.9,
    });

    const uInteractionRadius = uniform(30.0);
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);
    const uPlayerGlowColor = uniform(new THREE.Color(0xff8844));

    const weaponGlow = float(0.0).toVar();
    const uWeaponColor = uniform(new THREE.Color(0x00ffff));
    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w;
        const distToLight = length(positionWorld.sub(lightPos));
        const wGlow = smoothstep(50.0, 0.0, distToLight).mul(lightIntensity);
        weaponGlow.addAssign(wGlow);
    });

    const dynamicLighting = uPlayerGlowColor.mul(playerGlowIntensity.mul(0.5)).add(uWeaponColor.mul(weaponGlow.mul(0.8)));

    mat.userData.uPlayerPos = uPlayerPos;

    const uTime = time;
    const vUv = uv();

    const scrollPos = vUv.y.sub(uTime.mul(pulseSpeed));
    const repeatPattern = fract(scrollPos.mul(3.0));
    const travelingPulse = smoothstep(0.8, 1.0, repeatPattern);

    const scrollPosFast = vUv.y.sub(uTime.mul(pulseSpeed * 1.5));
    const repeatPatternFast = fract(scrollPosFast.mul(5.0));
    const travelingPulseFast = smoothstep(0.9, 1.0, repeatPatternFast).mul(0.5);

    const combinedPulse = travelingPulse.add(travelingPulseFast).clamp(0.0, 1.0);
    const glowColor = color(glowColorHex);
    const baseGlow = glowColor.mul(0.1);

    mat.emissiveNode = glowColor.mul(combinedPulse).mul(3.0).add(baseGlow).add(dynamicLighting);

    return mat;
}
