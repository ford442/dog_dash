import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { time, positionWorld, uv, vec4, color, uniform, mix, sin, cos, float, length, smoothstep, Loop } from 'three/tsl';
import { shouldUseLiteMaterials, createLiteIndustrialMaterial } from './materials_shared';

/** Creates a procedural 3D gear geometry. */
export function createGearGeometry(radius: number, teeth: number, thickness: number) {
    const shape = new THREE.Shape();
    const toothDepth = radius * 0.2;
    const holeRadius = radius * 0.3;

    const steps = teeth * 2;
    const angleStep = (Math.PI * 2) / steps;

    for (let i = 0; i < steps; i++) {
        const angle = i * angleStep;
        const r = (i % 2 === 0) ? radius : radius - toothDepth;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();

    const holePath = new THREE.Path();
    holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, false);
    shape.holes.push(holePath);

    const extrudeSettings = {
        depth: thickness,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/** Creates a piston head geometry (Cylinder with a plate). */
export function createPistonGeometry(radius: number, height: number) {
    return new THREE.CylinderGeometry(radius, radius, height, 16);
}

/** Creates a rusty mechanical material using TSL. */
export function createMechanismMaterial(colorHex: number, uPlayerPos: any, weaponLights: any) {
    if (shouldUseLiteMaterials()) {
        return createLiteIndustrialMaterial(colorHex, 0.8, 0.6, uPlayerPos);
    }

    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness: 0.8,
        metalness: 0.6
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

    const pos = uv().mul(10.0);
    const noise = sin(pos.x.mul(10.0)).mul(cos(pos.y.mul(10.0))).add(1.0).mul(0.5);

    const baseColor = color(new THREE.Color(colorHex));
    const rustColor = color(0x8b4513);

    mat.colorNode = vec4(mix(baseColor, rustColor, noise.mul(0.3)), 1.0);
    mat.emissiveNode = dynamicLighting;
    return mat;
}
