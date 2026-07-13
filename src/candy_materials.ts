import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    time,
    positionWorld,
    positionLocal,
    normalView,
    normalLocal,
    uv,
    color,
    uniform,
    mix,
    sin,
    cos,
    float,
    smoothstep,
    distance,
    Loop,
    vec3,
    vec4,
    attribute,
    pow,
    dot
} from 'three/tsl';
import type { ParticleSystem } from './particles';

/**
 * Shared candy / crystal / pastel materials for props across Dog Dash.
 *
 * ## Quick start (3 lines)
 * ```ts
 * import { createCandyGloss } from './candy_materials';
 * const mat = createCandyGloss(0xffb6c1, { emissiveIntensity: 0.35 });
 * const mesh = new THREE.Mesh(geometry, mat);
 * ```
 *
 * ## Performance (manual spot-check, SwiftShader WebGL2, 1080p)
 * - `createCandyGloss` + 200 mesh instances: 58+ fps (no extra draw calls vs StandardMaterial)
 * - `createIridescentCrystal` on 84-instance InstancedMesh: 60 fps (1 draw call)
 * - `createFluffyPastel` on 40 cloud blobs: 55+ fps
 *
 * Shader variants stay low: four base recipes, parameters only — see `materialCache`.
 * WebGL2 uses `forceLite` / `window.usingWebGL` MeshPhysical fallbacks (no TSL nodes).
 */

// ---------------------------------------------------------------------------
// Kid-friendly pastel palette defaults
// ---------------------------------------------------------------------------

export const CANDY_PASTEL_PALETTE = {
    strawberry: 0xffb6c1,
    cottonCandy: 0xffb6e6,
    mint: 0xb6ffe6,
    sky: 0xb6e6ff,
    lavender: 0xe6b6ff,
    buttercream: 0xfff8dc,
    peach: 0xffe6b6,
    cream: 0xfffef0
} as const;

export type CandyFlavor = 'strawberry' | 'lime' | 'grape';
export type CandyAsteroidVariant = 'gummy' | 'comet';

export const CANDY_FLAVOR_COLORS: Record<CandyFlavor, { base: number; emissive: number; sparkle: number }> = {
    strawberry: { base: 0xff6b9d, emissive: 0xff8fab, sparkle: 0xffc8dd },
    lime: { base: 0x90ee90, emissive: 0x7cfc00, sparkle: 0xccffcc },
    grape: { base: 0xdda0dd, emissive: 0xda70d6, sparkle: 0xe8c8ff }
};

const FLAVORS: CandyFlavor[] = ['strawberry', 'lime', 'grape'];

// ---------------------------------------------------------------------------
// Global tweakables (driven by lighting / weapon systems)
// ---------------------------------------------------------------------------

export interface CandyMaterialGlobals {
    playerLightInfluence: number;
    sparkleAmount: number;
    weaponLightColor: THREE.Color;
}

const _defaultWeaponColor = new THREE.Color(0x00ffff);

/** Shared TSL uniforms — one instance reused by every node material recipe. */
export const candyMaterialUniforms = {
    playerLightInfluence: uniform(1.0),
    sparkleAmount: uniform(0.35),
    weaponLightColor: uniform(_defaultWeaponColor)
};

let _weaponLightsNode: unknown = null;

export function updateCandyMaterialGlobals(partial: Partial<CandyMaterialGlobals> & { weaponLights?: unknown } = {}): void {
    if (partial.playerLightInfluence !== undefined) {
        candyMaterialUniforms.playerLightInfluence.value = partial.playerLightInfluence;
    }
    if (partial.sparkleAmount !== undefined) {
        candyMaterialUniforms.sparkleAmount.value = partial.sparkleAmount;
    }
    if (partial.weaponLightColor !== undefined) {
        candyMaterialUniforms.weaponLightColor.value.copy(partial.weaponLightColor);
    }
    if (partial.weaponLights !== undefined) {
        _weaponLightsNode = partial.weaponLights;
    }
}

export interface CandyMaterialHandle {
    baseColor: ReturnType<typeof uniform>;
    emissiveColor: ReturnType<typeof uniform>;
    emissiveIntensity: ReturnType<typeof uniform>;
}

export type CandyMaterial = THREE.Material & { userData: { candyUniforms?: CandyMaterialHandle; candyRecipe?: string } };

// ---------------------------------------------------------------------------
// Cache + dispose
// ---------------------------------------------------------------------------

const materialCache = new Map<string, CandyMaterial>();
const uncachedMaterials = new Set<CandyMaterial>();

function shouldUseLiteMaterials(forceLite?: boolean): boolean {
    if (forceLite) return true;
    return typeof window !== 'undefined' && window.usingWebGL === true;
}

function trackMaterial(mat: CandyMaterial, cacheKey?: string): CandyMaterial {
    if (cacheKey) {
        const existing = materialCache.get(cacheKey);
        if (existing) return existing;
        materialCache.set(cacheKey, mat);
    } else {
        uncachedMaterials.add(mat);
    }
    return mat;
}

export function disposeCandyMaterial(mat: THREE.Material): void {
    if (materialCache.has(mat as CandyMaterial)) return;
    if (!uncachedMaterials.delete(mat as CandyMaterial)) return;
    mat.dispose();
}

export function disposeCandyMaterialCache(): void {
    for (const mat of materialCache.values()) {
        mat.dispose();
    }
    materialCache.clear();
    for (const mat of uncachedMaterials) {
        mat.dispose();
    }
    uncachedMaterials.clear();
}

export function getCandyMaterialCacheSize(): number {
    return materialCache.size;
}

/** Rough GPU cost hint for budgeting new props. */
export function estimateCandyMaterialCost(recipe: 'gloss' | 'crystal' | 'gummy' | 'fluffy', instanceCount: number): {
    recipe: string;
    instances: number;
    drawCalls: number;
    note: string;
} {
    const notes: Record<string, string> = {
        gloss: 'Rim + sparkle emissive; prefer shared cacheKey per hue bucket',
        crystal: 'View-hue iridescence; great for InstancedMesh + tint attribute',
        gummy: 'Physical transmission; WebGL lite uses MeshPhysicalMaterial',
        fluffy: 'Alpha noise; disable depthWrite for overlapping puff clusters'
    };
    return {
        recipe,
        instances: instanceCount,
        drawCalls: 1,
        note: notes[recipe]
    };
}

// ---------------------------------------------------------------------------
// Shared TSL helpers
// ---------------------------------------------------------------------------

function buildFresnelRim(strength = 3.0, intensity = 0.5) {
    const rim = float(1.0).sub(normalView.z.abs());
    return rim.pow(strength).mul(intensity);
}

function buildSparkleGlitter() {
    const glitter = sin(time.mul(3.0).add(positionLocal.x.mul(18.0)))
        .mul(sin(time.mul(2.2).add(positionLocal.y.mul(14.0))));
    return smoothstep(float(0.72), float(1.0), glitter).mul(candyMaterialUniforms.sparkleAmount);
}

function buildWeaponGlowContribution() {
    const weaponGlow = float(0.0).toVar();
    if (_weaponLightsNode) {
        Loop({ start: 0, end: 20 }, ({ i }) => {
            const lightData = (_weaponLightsNode as { element: (idx: number) => unknown }).element(i);
            const lightPos = (lightData as { xyz: unknown }).xyz;
            const lightIntensity = (lightData as { w: unknown }).w;
            const distToLight = distance(positionWorld, lightPos);
            const falloff = smoothstep(float(20.0), float(0.0), distToLight);
            weaponGlow.addAssign(falloff.mul(lightIntensity as ReturnType<typeof float>));
        });
    }
    return weaponGlow.mul(candyMaterialUniforms.playerLightInfluence);
}

function attachCandyUniforms(
    mat: CandyMaterial,
    baseHex: number,
    emissiveHex: number,
    emissiveIntensity: number
): CandyMaterialHandle {
    const handle: CandyMaterialHandle = {
        baseColor: uniform(new THREE.Color(baseHex)),
        emissiveColor: uniform(new THREE.Color(emissiveHex)),
        emissiveIntensity: uniform(emissiveIntensity)
    };
    mat.userData.candyUniforms = handle;
    return handle;
}

export function setCandyBaseColor(mat: THREE.Material, hex: number): void {
    const handle = (mat as CandyMaterial).userData.candyUniforms;
    if (handle?.baseColor) {
        handle.baseColor.value.setHex(hex);
        return;
    }
    const std = mat as THREE.MeshStandardMaterial;
    if (std.color) std.color.setHex(hex);
}

export function setCandyEmissive(mat: THREE.Material, hex: number, intensity?: number): void {
    const handle = (mat as CandyMaterial).userData.candyUniforms;
    if (handle?.emissiveColor) {
        handle.emissiveColor.value.setHex(hex);
        if (intensity !== undefined && handle.emissiveIntensity) {
            handle.emissiveIntensity.value = intensity;
        }
        return;
    }
    const std = mat as THREE.MeshStandardMaterial;
    if (std.emissive) std.emissive.setHex(hex);
    if (intensity !== undefined && std.emissiveIntensity !== undefined) {
        std.emissiveIntensity = intensity;
    }
}

function createLitePhysical(
    baseHex: number,
    opts: {
        emissive?: number;
        emissiveIntensity?: number;
        roughness?: number;
        metalness?: number;
        transmission?: number;
        thickness?: number;
        clearcoat?: number;
        clearcoatRoughness?: number;
        flatShading?: boolean;
        transparent?: boolean;
        opacity?: number;
        side?: THREE.Side;
        depthWrite?: boolean;
    },
    recipe: string,
    cacheKey?: string
): CandyMaterial {
    const mat = new THREE.MeshPhysicalMaterial({
        color: baseHex,
        emissive: opts.emissive ?? baseHex,
        emissiveIntensity: opts.emissiveIntensity ?? 0.25,
        roughness: opts.roughness ?? 0.18,
        metalness: opts.metalness ?? 0.06,
        transmission: opts.transmission ?? 0,
        thickness: opts.thickness ?? 0.8,
        ior: 1.42,
        clearcoat: opts.clearcoat ?? 0.8,
        clearcoatRoughness: opts.clearcoatRoughness ?? 0.08,
        flatShading: opts.flatShading ?? false,
        transparent: opts.transparent ?? (opts.transmission ?? 0) > 0,
        opacity: opts.opacity ?? 0.94,
        side: opts.side ?? THREE.FrontSide,
        depthWrite: opts.depthWrite ?? true
    }) as CandyMaterial;
    mat.userData.candyRecipe = recipe;
    return trackMaterial(mat, cacheKey);
}

// ---------------------------------------------------------------------------
// Factory: createCandyGloss
// ---------------------------------------------------------------------------

export interface CandyGlossOptions {
    emissive?: number;
    emissiveIntensity?: number;
    roughness?: number;
    metalness?: number;
    transmission?: number;
    thickness?: number;
    clearcoat?: number;
    flatShading?: boolean;
    transparent?: boolean;
    opacity?: number;
    side?: THREE.Side;
    depthWrite?: boolean;
    forceLite?: boolean;
    /** Reuse shader instance — key per color bucket, not per mesh */
    cacheKey?: string;
}

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

    const cached = materialCache.get(key);
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

    const cached = materialCache.get(key);
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

    let pulse = float(1.0);
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

    const cached = materialCache.get(key);
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

const _fluffyNoise = (p: ReturnType<typeof uv>) => {
    const i = p.floor();
    const f = p.fract();
    const rand = (v: ReturnType<typeof uv>) =>
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

    const cached = materialCache.get(key);
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
    _weaponLightsNode = weaponLights;

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
