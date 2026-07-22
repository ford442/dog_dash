import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { time, positionWorld, uv, vec4, color, uniform, mix, sin, cos, float, length, smoothstep, Loop, step, fract } from 'three/tsl';
import { shouldUseLiteMaterials, createLiteIndustrialMaterial } from './materials_shared';

/** Creates a material for foreground silhouette structures. */
export function createForegroundMaterial(uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(0x1a1a1a, 0.9, 0.2, uPlayerPos);
    }

    const mat = new MeshStandardNodeMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.2,
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

    mat.emissiveNode = dynamicLighting;
    return mat;
}

export function createSimpleIndustrialMaterial(colorHex: number, r: number, m: number, uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(colorHex, r, m, uPlayerPos);
    }

    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness: r,
        metalness: m
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

    mat.emissiveNode = dynamicLighting;
    return mat;
}

export function createTunnelMaterial(speed: number, uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(0x332211, 0.8, 0.5, uPlayerPos, { uCameraX: { value: 0 } }, THREE.BackSide);
    }

    const mat = new MeshStandardNodeMaterial({
        color: 0x332211,
        roughness: 0.8,
        metalness: 0.5,
        side: THREE.BackSide
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
    const uCameraX = uniform(0.0);
    const vUv = uv();

    const scrollV = vUv.y.add(uCameraX.mul(0.02));

    const panelU = vUv.x.mul(12.0);
    const panelV = scrollV.mul(10.0);

    const grid = step(0.95, fract(panelU)).add(step(0.95, fract(panelV))).clamp(0.0, 1.0);

    const wallColor = color(0x221105);
    const gridColor = color(0x110800);
    const lightColor = color(0xff6600);

    const panelId = panelU.floor().add(panelV.floor().mul(10.0));
    const lightProb = sin(panelId).add(1.0).mul(0.5);
    const isLight = step(0.9, lightProb);

    const pulse = sin(uTime.mul(2.0).add(panelId)).add(1.0).mul(0.5);

    mat.colorNode = vec4(mix(wallColor, gridColor, grid), 1.0);
    mat.emissiveNode = mix(color(0x000000), lightColor.mul(pulse), isLight.mul(float(1.0).sub(grid))).add(dynamicLighting);

    mat.userData.uCameraX = uCameraX;

    return mat;
}
