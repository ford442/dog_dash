import * as THREE from 'three';
import { FlowerType, FLOWER_CONFIGS } from './types';

export function createDaisyPetal(color: number): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.25, 16, 16);
    geometry.scale(1, 2.5, 0.3);

    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.9,
        roughness: 0.4,
        metalness: 0.1
    });

    return new THREE.Mesh(geometry, material);
}

export function createTulipPetal(color: number, index: number): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.4, 16, 16);
    geometry.scale(0.8, 1.5, 0.6);

    const colorVariation = new THREE.Color(color);
    colorVariation.offsetHSL(0, 0, (index % 3 - 1) * 0.1);

    const material = new THREE.MeshStandardMaterial({
        color: colorVariation,
        emissive: color,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.85,
        roughness: 0.5,
        metalness: 0.2,
        side: THREE.DoubleSide
    });

    return new THREE.Mesh(geometry, material);
}

export function createLotusPetal(color: number, index: number): THREE.Mesh {
    const geometry = new THREE.ConeGeometry(0.25, 1.8, 16);
    geometry.scale(1, 1, 0.2);

    const colorVariation = new THREE.Color(color);
    if (index < 8) {
        colorVariation.offsetHSL(0, -0.2, 0.2);
    }

    const material = new THREE.MeshStandardMaterial({
        color: colorVariation,
        emissive: color,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.9,
        roughness: 0.3,
        metalness: 0.15,
        side: THREE.DoubleSide
    });

    return new THREE.Mesh(geometry, material);
}

export function createSunflowerPetal(color: number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(0.3, 2.0, 0.1);

    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
        const y = positions[i + 1];
        if (y > 0) {
            positions[i] *= 0.5;
        }
    }
    geometry.attributes.position.needsUpdate = true;

    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.95,
        roughness: 0.2,
        metalness: 0.6
    });

    return new THREE.Mesh(geometry, material);
}

export function createPetalForType(type: FlowerType, color: number, index: number): THREE.Mesh {
    switch (type) {
        case FlowerType.DAISY:
            return createDaisyPetal(color);
        case FlowerType.TULIP:
            return createTulipPetal(color, index);
        case FlowerType.LOTUS:
            return createLotusPetal(color, index);
        case FlowerType.SUNFLOWER:
            return createSunflowerPetal(color);
        default:
            return createDaisyPetal(color);
    }
}

export function createFlowerCenter(
    type: FlowerType,
    config: typeof FLOWER_CONFIGS[FlowerType.DAISY]
): THREE.Mesh {
    let geometry: THREE.BufferGeometry;

    if (type === FlowerType.SUNFLOWER) {
        geometry = new THREE.SphereGeometry(0.5, 24, 24);
    } else if (type === FlowerType.DAISY) {
        geometry = new THREE.SphereGeometry(0.4, 20, 20);
    } else {
        geometry = new THREE.SphereGeometry(0.35, 16, 16);
    }

    const material = new THREE.MeshStandardMaterial({
        color: config.centerColor,
        emissive: config.centerColor,
        emissiveIntensity: 0.8,
        roughness: 0.6,
        metalness: 0.3
    });

    return new THREE.Mesh(geometry, material);
}
