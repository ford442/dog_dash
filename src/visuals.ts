import * as THREE from 'three';
import { createSubwooferLotus, createFiberOpticWillow, createGlowingFlower } from './foliage';
import { createGalaxyMaterial, getGalaxyGeometry } from './scenery_art/galaxy';
import { getMoonGeometry } from './scenery_art/moon';

export const moonPlants: THREE.Object3D[] = [];

/**
 * Backdrop spiral galaxy (#418): one shader disc tilted toward the camera
 * (see `scenery_art/galaxy.ts`). `loop_world.ts` spins it in its own plane
 * via `userData.rotationSpeed`.
 */
export function createGalaxy(x: number, y: number, z: number, color: number): THREE.Group {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(getGalaxyGeometry(), createGalaxyMaterial(color));
    disc.renderOrder = -10;
    group.add(disc);

    group.position.set(x, y, z);
    // Lean back and turn a little so it reads as a disc, not a face-on blob.
    group.rotation.set(-0.95 + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, Math.random() * Math.PI); // visual-only
    group.userData.rotationSpeed = (Math.random() - 0.5) * 0.02; // visual-only
    return group;
}

/**
 * Backdrop moon (#418): carved craters and the dog's flag landmark in one
 * merged mesh (`scenery_art/moon.ts`), an additive atmosphere shell and the
 * alien plants.
 */
export function createMoon(): THREE.Group {
    const group = new THREE.Group();

    const moonMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.1,
        emissive: 0x111122,
        emissiveIntensity: 0.2
    });
    const moon = new THREE.Mesh(getMoonGeometry(), moonMat);
    moon.castShadow = true;
    group.add(moon);

    // Moon glow/atmosphere
    // 2. Atmosphere
    const atmosphereGeo = new THREE.SphereGeometry(9.5, 32, 32);
    const atmosphereMat = new THREE.MeshBasicMaterial({
        color: 0x8844ff,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    group.add(atmosphere);
    
    group.userData.atmosphere = atmosphere;

    // 3. Populate with Alien Plants
    const plantCount = 15;
    for (let i = 0; i < plantCount; i++) {
        let plant;
        const type = Math.random(); // visual-only
        if (type < 0.3) {
            plant = createSubwooferLotus({ color: 0x00ff88 });
        } else if (type < 0.6) {
            plant = createFiberOpticWillow({ color: 0xff00ff });
        } else {
            plant = createGlowingFlower({ color: 0x00ffff, intensity: 2.0 });
        }

        // Random position on the top hemisphere so plants are visible
        const phi = Math.PI * 0.12 + Math.random() * Math.PI * 0.3; // visual-only; top hemisphere, clear of the flag at the pole
        const theta = Math.random() * Math.PI * 2; // visual-only
        const r = 7.8; // Slightly embedded in surface
        plant.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
        );
        plant.lookAt(0, 0, 0);
        plant.rotateX(-Math.PI / 2);
        group.add(plant);
        moonPlants.push(plant);
    }
    return group;
}
