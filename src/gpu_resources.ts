import * as THREE from 'three';

/**
 * Shared vs owned GPU resource ownership for streaming teardown.
 *
 * - Shared resources (`markShared` / refcounted retain) must not be disposed
 *   when an individual mesh is culled — they outlive any one instance.
 * - Owned resources are disposed with the mesh via `disposeObject` /
 *   `disposeMaterialIfOwned`.
 */

const TEXTURE_MAP_KEYS = [
    'map',
    'normalMap',
    'emissiveMap',
    'roughnessMap',
    'metalnessMap',
    'alphaMap',
    'bumpMap',
    'displacementMap',
    'envMap',
    'lightMap',
    'aoMap',
    'specularMap'
] as const;

type Shareable = {
    userData: Record<string, unknown>;
    dispose?: () => void;
};

const materialRefCounts = new WeakMap<THREE.Material, number>();

/** Live counters for the debug leak detector (dev / ?debug only consumers). */
export const gpuResourceStats = {
    geometriesCreated: 0,
    geometriesDisposed: 0,
    materialsCreated: 0,
    materialsDisposed: 0,
    texturesDisposed: 0
};

export function noteGeometryCreated(): void {
    gpuResourceStats.geometriesCreated++;
}

export function noteMaterialCreated(): void {
    gpuResourceStats.materialsCreated++;
}

export function getGpuResourceLiveCounts(): { geometries: number; materials: number; texturesDisposed: number } {
    return {
        geometries: Math.max(0, gpuResourceStats.geometriesCreated - gpuResourceStats.geometriesDisposed),
        materials: Math.max(0, gpuResourceStats.materialsCreated - gpuResourceStats.materialsDisposed),
        texturesDisposed: gpuResourceStats.texturesDisposed
    };
}

export function resetGpuResourceStats(): void {
    gpuResourceStats.geometriesCreated = 0;
    gpuResourceStats.geometriesDisposed = 0;
    gpuResourceStats.materialsCreated = 0;
    gpuResourceStats.materialsDisposed = 0;
    gpuResourceStats.texturesDisposed = 0;
}

export function isSharedResource(resource: { userData?: Record<string, unknown> } | null | undefined): boolean {
    return resource?.userData?.sharedResource === true;
}

/** Mark a geometry, material, or texture as process-shared (never freed by mesh teardown). */
export function markShared<T extends Shareable>(resource: T): T {
    if (!resource.userData) {
        (resource as { userData: Record<string, unknown> }).userData = {};
    }
    resource.userData.sharedResource = true;
    return resource;
}

/** Mark every value on a materials object (e.g. foliageMaterials) as shared. */
export function markSharedMaterials(bag: Record<string, THREE.Material | THREE.Material[]>): void {
    for (const value of Object.values(bag)) {
        if (Array.isArray(value)) {
            for (const mat of value) markShared(mat);
        } else if (value) {
            markShared(value);
        }
    }
}

export function retainMaterial(mat: THREE.Material): THREE.Material {
    markShared(mat);
    const prev = materialRefCounts.get(mat) ?? 0;
    materialRefCounts.set(mat, prev + 1);
    return mat;
}

/**
 * Decrement retain count. When it hits 0, dispose the material and owned maps.
 * Shared-but-never-retained (markShared only) materials are never freed here.
 */
export function releaseMaterial(mat: THREE.Material): void {
    const prev = materialRefCounts.get(mat);
    if (prev === undefined) {
        // markShared-only immortal: no-op
        if (isSharedResource(mat)) return;
        disposeMaterialIfOwned(mat);
        return;
    }
    const next = prev - 1;
    if (next > 0) {
        materialRefCounts.set(mat, next);
        return;
    }
    materialRefCounts.delete(mat);
    // Drop shared flag so dispose can free maps + material
    if (mat.userData) mat.userData.sharedResource = false;
    disposeMaterialFully(mat);
}

export function disposeTextureIfOwned(tex: THREE.Texture | null | undefined): void {
    if (!tex || isSharedResource(tex)) return;
    tex.dispose();
    gpuResourceStats.texturesDisposed++;
}

export function disposeMaterialMaps(mat: THREE.Material): void {
    const anyMat = mat as THREE.Material & Record<string, unknown>;
    for (const key of TEXTURE_MAP_KEYS) {
        const tex = anyMat[key];
        if (tex && (tex as THREE.Texture).isTexture) {
            disposeTextureIfOwned(tex as THREE.Texture);
            anyMat[key] = null;
        }
    }
}

function disposeMaterialFully(mat: THREE.Material): void {
    disposeMaterialMaps(mat);
    mat.dispose();
    gpuResourceStats.materialsDisposed++;
}

/**
 * Dispose a material only if it is not shared and has no active retain count.
 * Also frees owned texture maps.
 */
export function disposeMaterialIfOwned(mat: THREE.Material | null | undefined): void {
    if (!mat) return;
    if (isSharedResource(mat)) return;
    if ((materialRefCounts.get(mat) ?? 0) > 0) return;
    disposeMaterialFully(mat);
}

export function disposeGeometryIfOwned(geometry: THREE.BufferGeometry | null | undefined): void {
    if (!geometry || isSharedResource(geometry)) return;
    geometry.dispose();
    gpuResourceStats.geometriesDisposed++;
}

export function disposeMaterialsOnObject(
    material: THREE.Material | THREE.Material[] | null | undefined
): void {
    if (!material) return;
    if (Array.isArray(material)) {
        for (const mat of material) disposeMaterialIfOwned(mat);
    } else {
        disposeMaterialIfOwned(material);
    }
}
