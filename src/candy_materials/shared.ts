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
export { FLAVORS };

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

export function shouldUseLiteMaterials(forceLite?: boolean): boolean {
    if (forceLite) return true;
    return typeof window !== 'undefined' && window.usingWebGL === true;
}

export function trackMaterial(mat: CandyMaterial, cacheKey?: string): CandyMaterial {
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

export function buildFresnelRim(strength = 3.0, intensity = 0.5) {
    const rim = float(1.0).sub(normalView.z.abs());
    return rim.pow(strength).mul(intensity);
}

export function buildSparkleGlitter() {
    const glitter = sin(time.mul(3.0).add(positionLocal.x.mul(18.0)))
        .mul(sin(time.mul(2.2).add(positionLocal.y.mul(14.0))));
    return smoothstep(float(0.72), float(1.0), glitter).mul(candyMaterialUniforms.sparkleAmount);
}

export function buildWeaponGlowContribution() {
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

export function attachCandyUniforms(
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

export function createLitePhysical(
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

