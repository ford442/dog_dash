import * as THREE from 'three';
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { time, positionLocal, positionWorld, normalWorld, normalView, normalLocal, cameraPosition, uv, vec3, vec4, color, uniform, mix, sin, cos, float, pow, length, smoothstep, dot, fract, step, attribute } from 'three/tsl';
import type { TSLNode } from '../tsl_types';
import {
    candyMaterialUniforms, updateCandyMaterialGlobals, type CandyMaterial, type CandyMaterialHandle,
    shouldUseLiteMaterials, trackMaterial, getCachedCandyMaterial, buildFresnelRim, buildSparkleGlitter, buildWeaponGlowContribution, attachCandyUniforms,
    createLitePhysical, type CandyGlossOptions
} from './shared';

export function createCandyGloss(colorHex: number, options: CandyGlossOptions = {}): CandyMaterial {
    const {
        emissive = colorHex,
        emissiveIntensity = 0.3,
        roughness = 0.2,
        metalness = 0.08,
        transmission = 0,
        thickness = 0.6,
        clearcoat = 0.85,
        flatShading = false,
        transparent = transmission > 0 || (options.opacity ?? 1) < 1,
        opacity = 0.94,
        side = THREE.FrontSide,
        depthWrite = true,
        forceLite,
        cacheKey
    } = options;

    const key = cacheKey ?? `gloss_${colorHex}_${roughness}_${transmission}_${clearcoat}`;

    if (shouldUseLiteMaterials(forceLite)) {
        return createLitePhysical(colorHex, {
            emissive,
            emissiveIntensity,
            roughness,
            metalness,
            transmission,
            thickness,
            clearcoat,
            flatShading,
            transparent,
            opacity,
            side,
            depthWrite
        }, 'gloss', key);
    }

    const cached = getCachedCandyMaterial(key);
    if (cached) return cached;

    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness,
        metalness,
        flatShading,
        transparent,
        opacity,
        side,
        depthWrite
    }) as CandyMaterial;

    const uniforms = attachCandyUniforms(mat, colorHex, emissive, emissiveIntensity);

    const rim = buildFresnelRim(3.0, 0.55);
    const sparkle = buildSparkleGlitter();
    const weaponGlow = buildWeaponGlowContribution();

    mat.colorNode = uniforms.baseColor;
    mat.emissiveNode = uniforms.emissiveColor
        .mul(uniforms.emissiveIntensity)
        .mul(rim.add(0.35))
        .add(uniforms.baseColor.mul(sparkle))
        .add(candyMaterialUniforms.weaponLightColor.mul(weaponGlow));

    mat.userData.candyRecipe = 'gloss';
    return trackMaterial(mat, key);
}

// ---------------------------------------------------------------------------
// Factory: createIridescentCrystal
// ---------------------------------------------------------------------------

export interface IridescentCrystalOptions {
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
    opacity?: number;
    transparent?: boolean;
    flatShading?: boolean;
    side?: THREE.Side;
    depthWrite?: boolean;
    /** Per-instance RGB tint (InstancedMesh) */
    instanceTintAttribute?: string;
    /** Per-instance pulse phase */
    instancePhaseAttribute?: string;
    forceLite?: boolean;
    cacheKey?: string;
}

export function createIridescentCrystal(
    colorHex: number,
    thickness = 1.0,
    options: IridescentCrystalOptions = {}
): CandyMaterial {
    const {
        emissiveIntensity = 0.22,
        roughness = 0.12,
        metalness = 0.35,
        opacity = 0.88,
        transparent = opacity < 1,
        flatShading = true,
        side = THREE.DoubleSide,
        depthWrite = false,
        instanceTintAttribute,
        instancePhaseAttribute,
        forceLite,
        cacheKey
    } = options;

    const key = cacheKey ?? `crystal_${colorHex}_${thickness}_${instanceTintAttribute ?? 'uni'}`;

    if (shouldUseLiteMaterials(forceLite)) {
        const mat = new THREE.MeshPhysicalMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity,
            roughness,
            metalness,
            iridescence: 1.0,
            iridescenceIOR: 1.3,
            iridescenceThicknessRange: [100, thickness * 400] as [number, number],
            transparent,
            opacity,
            flatShading,
            side,
            depthWrite
        }) as CandyMaterial;
        mat.userData.candyRecipe = 'crystal';
        return trackMaterial(mat, key);
    }

    const cached = getCachedCandyMaterial(key);
    if (cached) return cached;

    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness,
        metalness,
        flatShading,
        transparent,
        opacity,
        side,
        depthWrite
    }) as CandyMaterial;

    const baseTint = instanceTintAttribute
        ? attribute(instanceTintAttribute, 'vec3')
        : color(new THREE.Color(colorHex));

    const film = float(1.0).sub(normalView.z.abs());
    const huePhase = film.mul(float(thickness).mul(14.0)).add(time.mul(0.7));
    const iridA = vec3(0.6, 0.85, 1.0);
    const iridB = vec3(1.0, 0.75, 0.95);
    const iridC = vec3(0.75, 1.0, 0.85);
    const shift = sin(huePhase);
    const iridescent = mix(iridA, iridB, shift.mul(0.5).add(0.5));
    const iridescent2 = mix(iridescent, iridC, cos(huePhase.mul(1.3)).mul(0.5).add(0.5));

    let pulse: TSLNode = float(1.0);
    if (instancePhaseAttribute) {
        const phase = attribute(instancePhaseAttribute, 'float');
        pulse = sin(time.mul(1.8).add(phase)).mul(0.5).add(0.5);
    }

    const crystalColor = baseTint.mul(iridescent2.mul(0.45).add(0.55));
    const rim = buildFresnelRim(2.5, 0.65);
    const sparkle = buildSparkleGlitter();
    const weaponGlow = buildWeaponGlowContribution();

    mat.colorNode = crystalColor;
    mat.emissiveNode = crystalColor
        .mul(rim.add(pulse.mul(emissiveIntensity)))
        .add(crystalColor.mul(sparkle))
        .add(candyMaterialUniforms.weaponLightColor.mul(weaponGlow.mul(0.6)));

    mat.userData.candyRecipe = 'crystal';
    return trackMaterial(mat, key);
}

// ---------------------------------------------------------------------------
// Factory: createGummyTranslucent
// ---------------------------------------------------------------------------

export interface GummyTranslucentOptions {
    emissive?: number;
    emissiveIntensity?: number;
    roughness?: number;
    transmission?: number;
    thickness?: number;
    flatShading?: boolean;
    transparent?: boolean;
    opacity?: number;
    side?: THREE.Side;
    forceLite?: boolean;
    cacheKey?: string;
}

export function createGummyTranslucent(colorHex: number, options: GummyTranslucentOptions = {}): CandyMaterial {
    const {
        emissive = colorHex,
        emissiveIntensity = 0.28,
        roughness = 0.18,
        transmission = 0.22,
        thickness = 0.8,
        flatShading = true,
        transparent = true,
        opacity = 0.94,
        side = THREE.FrontSide,
        forceLite,
        cacheKey
    } = options;

    const key = cacheKey ?? `gummy_${colorHex}_${transmission}_${roughness}`;

    if (shouldUseLiteMaterials(forceLite)) {
        return createLitePhysical(colorHex, {
            emissive,
            emissiveIntensity,
            roughness,
            transmission,
            thickness,
            clearcoat: 0.85,
            flatShading,
            transparent,
            opacity,
            side
        }, 'gummy', key);
    }

    const cached = getCachedCandyMaterial(key);
    if (cached) return cached;

    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness,
        metalness: 0.05,
        flatShading,
        transparent,
        opacity,
        side
    }) as CandyMaterial;

    const uniforms = attachCandyUniforms(mat, colorHex, emissive, emissiveIntensity);
    const subsurface = sin(time.mul(1.5).add(positionLocal.y.mul(3.0))).mul(0.5).add(0.5);
    const rim = buildFresnelRim(2.0, 0.4);
    const weaponGlow = buildWeaponGlowContribution();

    mat.colorNode = uniforms.baseColor;
    mat.emissiveNode = uniforms.emissiveColor
        .mul(uniforms.emissiveIntensity)
        .mul(subsurface.mul(0.35).add(rim).add(0.25))
        .add(candyMaterialUniforms.weaponLightColor.mul(weaponGlow.mul(0.5)));

    mat.userData.candyRecipe = 'gummy';
    return trackMaterial(mat, key);
}

// ---------------------------------------------------------------------------
// Factory: createFluffyPastel
// ---------------------------------------------------------------------------

export interface FluffyPastelOptions {
    opacity?: number;
    noiseScale?: number;
    emissiveIntensity?: number;
    side?: THREE.Side;
    depthWrite?: boolean;
    forceLite?: boolean;
    cacheKey?: string;
}

const _fluffyNoise = (p: TSLNode) => {
    const i = p.floor();
    const f = p.fract();
    const rand = (v: TSLNode) =>
        sin(dot(v, vec3(12.9898, 78.233, 0))).mul(43758.5453).fract();
    const a = rand(i);
    const b = rand(i.add(vec3(1, 0, 0)));
    const c = rand(i.add(vec3(0, 1, 0)));
    const d = rand(i.add(vec3(1, 1, 0)));
    const u = f.mul(f).mul(float(3).sub(f.mul(2)));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
};

export function createFluffyPastel(colorHex: number, options: FluffyPastelOptions = {}): CandyMaterial {
    const {
        opacity = 0.88,
        noiseScale = 4.0,
        emissiveIntensity = 0.12,
        side = THREE.DoubleSide,
        depthWrite = false,
        forceLite,
        cacheKey
    } = options;

    const key = cacheKey ?? `fluffy_${colorHex}_${opacity}`;

    if (shouldUseLiteMaterials(forceLite)) {
        const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity,
            roughness: 0.92,
            metalness: 0,
            transparent: true,
            opacity,
            side,
            depthWrite
        }) as CandyMaterial;
        mat.userData.candyRecipe = 'fluffy';
        return trackMaterial(mat, key);
    }

    const cached = getCachedCandyMaterial(key);
    if (cached) return cached;

    const mat = new MeshStandardNodeMaterial({
        transparent: true,
        opacity,
        side,
        depthWrite,
        roughness: 0.92,
        metalness: 0
    }) as CandyMaterial;

    const uniforms = attachCandyUniforms(mat, colorHex, colorHex, emissiveIntensity);
    const vUv = uv();
    const noiseVal = _fluffyNoise(vUv.mul(noiseScale).add(time.mul(0.08)));
    const puffNormal = normalLocal.normalize();
    const softEdge = smoothstep(float(0.15), float(0.85), float(1.0).sub(puffNormal.z.abs()));
    const density = noiseVal.mul(softEdge);
    const alpha = smoothstep(float(0.08), float(0.45), density).mul(opacity);
    const shadow = noiseVal.mul(0.28).add(0.72);
    const glow = sin(time.mul(0.5)).mul(0.08).add(0.92);

    mat.colorNode = vec4(uniforms.baseColor.mul(shadow).mul(glow), alpha);
    mat.emissiveNode = uniforms.baseColor.mul(uniforms.emissiveIntensity).mul(softEdge.mul(0.5));

    mat.userData.candyRecipe = 'fluffy';
    return trackMaterial(mat, key);
}

// ---------------------------------------------------------------------------
// Legacy candy asteroid helpers (unchanged API)
// ---------------------------------------------------------------------------

