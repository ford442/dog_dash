import * as THREE from 'three';
import { createSubwooferLotus, createFiberOpticWillow, createGlowingFlower } from './foliage';

export const moonPlants: THREE.Object3D[] = [];

export function createGalaxy(x: number, y: number, z: number, color: number): THREE.Group {
    const group = new THREE.Group();
    
    // Main nebula cloud
    const cloudGeo = new THREE.SphereGeometry(15, 16, 16);
    const cloudMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    group.add(cloud);
    
    // Inner glow
    const glowGeo = new THREE.SphereGeometry(8, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);
    
    // Bright core
    const coreGeo = new THREE.SphereGeometry(3, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);
    
    group.position.set(x, y, z);
    group.userData.rotationSpeed = (Math.random() - 0.5) * 0.02;
    return group;
}

export function createMoon(): THREE.Group {
    const group = new THREE.Group();
    
    // 1. Moon Surface (alien palette)
    const moonGeo = new THREE.SphereGeometry(8, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
        color: 0x222244, // Darker, alien purple-grey
        roughness: 0.8,
        metalness: 0.2,
        emissive: 0x111122,
        emissiveIntensity: 0.2
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.castShadow = true;
    group.add(moon);
    
    // Add some craters
    for (let i = 0; i < 8; i++) {
        const craterGeo = new THREE.SphereGeometry(0.5 + Math.random() * 1.5, 8, 8);
        const craterMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.95
        });
        const crater = new THREE.Mesh(craterGeo, craterMat);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        crater.position.set(
            Math.sin(phi) * Math.cos(theta) * 7,
            Math.sin(phi) * Math.sin(theta) * 7,
            Math.cos(phi) * 7
        );
        group.add(crater);
    }
    
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
        const type = Math.random();
        if (type < 0.3) {
            plant = createSubwooferLotus({ color: 0x00ff88 });
        } else if (type < 0.6) {
            plant = createFiberOpticWillow({ color: 0xff00ff });
        } else {
            plant = createGlowingFlower({ color: 0x00ffff, intensity: 2.0 });
        }

        // Random position on the top hemisphere so plants are visible
        const phi = Math.random() * Math.PI * 0.4; // 0..PI/2 mostly
        const theta = Math.random() * Math.PI * 2;
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
