import * as THREE from 'three';
import {
    disposeGeometryIfOwned,
    disposeMaterialsOnObject,
    isSharedResource
} from './gpu_resources';

function hasRenderableGeometry(
    obj: THREE.Object3D
): obj is THREE.Object3D & { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] } {
    const anyObj = obj as THREE.Object3D & {
        isMesh?: boolean;
        isInstancedMesh?: boolean;
        isSkinnedMesh?: boolean;
        isPoints?: boolean;
        isLine?: boolean;
        isSprite?: boolean;
        geometry?: THREE.BufferGeometry;
    };
    return !!(
        (anyObj.isMesh ||
            anyObj.isInstancedMesh ||
            anyObj.isSkinnedMesh ||
            anyObj.isPoints ||
            anyObj.isLine ||
            anyObj.isSprite) &&
        anyObj.geometry
    );
}

/**
 * Recursively free owned GPU resources on an object tree.
 * Shared geometries / materials (`markShared` / retain) are left intact.
 */
export function disposeObject(obj: THREE.Object3D): void {
    const onDispose = obj.userData?.onDispose;
    if (typeof onDispose === 'function') {
        try {
            onDispose(obj);
        } catch {
            // Custom teardown must not block resource walk
        }
    }

    obj.traverse((child) => {
        const childOnDispose = child.userData?.onDispose;
        if (child !== obj && typeof childOnDispose === 'function') {
            try {
                childOnDispose(child);
            } catch {
                // ignore
            }
        }

        if (!hasRenderableGeometry(child)) return;

        disposeGeometryIfOwned(child.geometry);
        disposeMaterialsOnObject(child.material);
    });
}

export { isSharedResource };
