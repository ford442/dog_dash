import * as THREE from 'three';

export function shouldUseLiteMaterials(): boolean {
    return typeof window !== 'undefined' && window.usingWebGL === true;
}

export function createLiteIndustrialMaterial(
    colorHex: number,
    roughness: number,
    metalness: number,
    uPlayerPos?: unknown,
    extraUserData?: Record<string, unknown>,
    side: THREE.Side = THREE.FrontSide,
): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness,
        metalness,
        side,
    });
    if (uPlayerPos) {
        mat.userData.uPlayerPos = uPlayerPos;
    }
    if (extraUserData) {
        Object.assign(mat.userData, extraUserData);
    }
    return mat;
}
