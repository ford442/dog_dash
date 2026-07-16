import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    time,
    positionWorld,
    normalView,
    color,
    uniform,
    mix,
    sin,
    float,
    smoothstep,
    distance,
    Loop,
    vec3,
    attribute
} from 'three/tsl';
import type { ParticleSystem } from '../particles';
import type { CandyFlavor, CandyAsteroidVariant } from './shared';
import { FLAVORS, CANDY_FLAVOR_COLORS, candyMaterialUniforms, updateCandyMaterialGlobals } from './shared';
import { createCandyGloss, createGummyTranslucent } from './factories';

export function pickCandyFlavor(): CandyFlavor {
    return FLAVORS[Math.floor(Math.random() * FLAVORS.length)];
}

export function pickCandyVariant(): CandyAsteroidVariant {
    return Math.random() < 0.3 ? 'comet' : 'gummy';
}

const obstacleMaterialCache = new Map<string, THREE.MeshPhysicalMaterial>();

/** Gameplay obstacle material — MeshPhysical for gloss + WebGL parity (always lite). */
export function createCandyObstacleMaterial(
    flavor: CandyFlavor,
    variant: CandyAsteroidVariant
): THREE.MeshPhysicalMaterial {
    const key = `${flavor}_${variant}`;
    const cached = obstacleMaterialCache.get(key);
    if (cached) return cached;

    const palette = CANDY_FLAVOR_COLORS[flavor];
    const isComet = variant === 'comet';

    const mat = new THREE.MeshPhysicalMaterial({
        color: palette.base,
        emissive: palette.emissive,
        emissiveIntensity: isComet ? 0.45 : 0.28,
        roughness: isComet ? 0.12 : 0.18,
        metalness: 0.05,
        transmission: isComet ? 0.35 : 0.22,
        thickness: 0.8,
        ior: 1.42,
        clearcoat: 0.85,
        clearcoatRoughness: 0.08,
        flatShading: true,
        transparent: true,
        opacity: 0.94
    });

    obstacleMaterialCache.set(key, mat);
    return mat;
}

/** Parallax asteroid-field material with per-instance candy mix attribute. */
export function createAsteroidFieldMaterial(
    baseColorHex: number,
    opacity: number,
    weaponLights: unknown,
    candyChance: number,
    uPlayerPos?: any
): MeshStandardNodeMaterial {
    updateCandyMaterialGlobals({ weaponLights });

    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true,
        transparent: opacity < 1.0,
        opacity
    });

    const rim = float(1.0).sub(normalView.z.abs());
    const rimGlow = rim.pow(3.0).mul(0.5);

    const weaponGlow = float(0.0).toVar();

    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = (weaponLights as { element: (idx: number) => unknown }).element(i);
        const lightPos = (lightData as { xyz: unknown }).xyz;
        const lightIntensity = (lightData as { w: unknown }).w;
        const distToLight = distance(positionWorld, lightPos);
        const falloff = smoothstep(float(20.0), float(0.0), distToLight);
        weaponGlow.addAssign(falloff.mul(lightIntensity as ReturnType<typeof float>));
    });

    let finalPlayerGlow = float(0.0);
    if (uPlayerPos) {
        const distToPlayer = distance(positionWorld, uPlayerPos);
        finalPlayerGlow = smoothstep(float(30.0), float(0.0), distToPlayer).mul(0.6);
    }


    const aCandyMix = attribute('aCandyMix', 'float');
    const aCandyHue = attribute('aCandyHue', 'float');

    const rockColor = color(new THREE.Color(baseColorHex));
    const strawberry = color(new THREE.Color(CANDY_FLAVOR_COLORS.strawberry.base));
    const lime = color(new THREE.Color(CANDY_FLAVOR_COLORS.lime.base));
    const grape = color(new THREE.Color(CANDY_FLAVOR_COLORS.grape.base));

    const candyColor = mix(strawberry, lime, smoothstep(float(0.33), float(0.66), aCandyHue));
    const candyTint = mix(candyColor, grape, smoothstep(float(0.66), float(1.0), aCandyHue));

    const glossPulse = sin(time.mul(2.5).add(aCandyHue.mul(6.28))).mul(0.5).add(0.5);
    const candyGloss = candyTint.mul(vec3(1.15, 1.1, 1.2).add(glossPulse.mul(0.15)));

    const surfaceColor = mix(rockColor, candyGloss, aCandyMix.mul(float(candyChance > 0 ? 1 : 0)));
    const candyRim = rimGlow.mul(aCandyMix).mul(0.8);
    const uPlayerGlowColor = uniform(new THREE.Color(0xff8844));
    const finalEmissive = surfaceColor.mul(rimGlow)
        .add(candyMaterialUniforms.weaponLightColor.mul(weaponGlow.mul(candyMaterialUniforms.playerLightInfluence)))
        .add(uPlayerGlowColor.mul(finalPlayerGlow))
        .add(candyTint.mul(candyRim));


    mat.emissiveNode = finalEmissive;

    return mat;
}

export function emitSugarCrystalBurst(
    particleSystem: ParticleSystem,
    position: THREE.Vector3,
    flavor: CandyFlavor,
    intensity: number = 1
): void {
    const palette = CANDY_FLAVOR_COLORS[flavor];
    const count = Math.floor(10 + intensity * 8);
    particleSystem.emit(position.clone(), palette.sparkle, count, 4.5 + intensity * 2, 0.7, 0.35);
    particleSystem.emit(position.clone(), 0xffffff, Math.floor(4 + intensity * 3), 3.0, 0.45, 0.25);
}

export function getCandyScoreBonus(variant: CandyAsteroidVariant): number {
    return variant === 'comet' ? 40 : 25;
}

export function getCandySlingComboBonus(variant: CandyAsteroidVariant): number {
    return variant === 'comet' ? 1.35 : 1.2;
}
