import * as THREE from 'three';

export function disposeObject(obj: THREE.Object3D) {
    obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }
        }
    });
}
