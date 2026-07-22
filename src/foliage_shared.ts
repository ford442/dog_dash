import * as THREE from 'three';
import { markSharedMaterials, noteMaterialCreated } from './gpu_resources';

export function createClayMaterial(color: number | string) {
    const mat = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.0,
        roughness: 0.8,
        flatShading: false,
    });
    noteMaterialCreated();
    return mat;
}

export const foliageMaterials = {
    grass: createClayMaterial(0x7CFC00),
    flowerStem: createClayMaterial(0x228B22),
    flowerCenter: createClayMaterial(0xFFFACD),
    flowerPetal: [
        createClayMaterial(0xFF69B4),
        createClayMaterial(0xBA55D3),
        createClayMaterial(0x87CEFA),
    ],
    lightBeam: new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }),
    blackPlastic: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.1 }),
    lotusRing: createClayMaterial(0x222222),
    opticCable: new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.3,
        roughness: 0.1
    }),
    opticTip: new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
};

markSharedMaterials(foliageMaterials);
noteMaterialCreated(); // lightBeam
noteMaterialCreated(); // blackPlastic
noteMaterialCreated(); // opticCable
noteMaterialCreated(); // opticTip

export const reactiveMaterials: THREE.Material[] = [];

export function registerReactiveMaterial(mat: THREE.Material) {
    if (reactiveMaterials.length < 3000) {
        reactiveMaterials.push(mat);
    }
}
