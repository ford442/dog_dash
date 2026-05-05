import * as THREE from 'three';
import { scene } from './scene_setup';
import { player } from './player_loader';
import { playerState } from './game_config';
import {
    SporeCloud,
    createChromaShiftRock,
    updateChromaRock,
    createFracturedGeode,
    updateGeode,
    createNebulaJellyMoss,
    updateNebulaJellyMoss,
    destroyNebulaJellyMoss,
    createVoidRootBall,
    updateVoidRootBall,
    createVacuumKelp,
    updateVacuumKelp,
    createIceNeedleCluster,
    updateIceNeedleCluster,
    createMagmaHeart,
    updateMagmaHeart
} from './geological';
import { createSolarSail, updateSolarSail } from './foliage';
import { createSubwooferLotus, createFiberOpticWillow, createGlowingFlower } from './foliage';
import { particleSystem, weaponSystem, liquidMetalSystem } from './game_systems';

// =============================================================================
// SPACE ENVIRONMENT (Stars, Galaxies, Moon)
// =============================================================================

// Create distant galaxies/nebulae
function createGalaxy(x: number, y: number, z: number, color: number) {
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

// Create a few distant galaxies
export const galaxy1 = createGalaxy(200, 30, -100, 0x8844ff);
scene.add(galaxy1);

export const galaxy2 = createGalaxy(-150, -20, -120, 0x4488ff);
scene.add(galaxy2);

export const galaxy3 = createGalaxy(300, 10, -90, 0xff4488);
scene.add(galaxy3);

// =============================================================================
// GEOLOGICAL OBJECTS & ANOMALIES (from plan.md)
// =============================================================================

// Spore Clouds - floating clouds of glowing spores
export const sporeClouds: SporeCloud[] = [];

export function createSporeCloudAtPosition(x: number, y: number, z: number) {
    const cloud = new SporeCloud(scene, new THREE.Vector3(x, y, z), 500 + Math.floor(Math.random() * 500));
    sporeClouds.push(cloud);
    return cloud;
}

// Chroma-Shift Rocks - color-shifting crystalline rocks
export const chromaRocks: THREE.Group[] = [];

export function createChromaRockAtPosition(x: number, y: number, z: number) {
    const rock = createChromaShiftRock({ size: 2 + Math.random() * 2 });
    rock.position.set(x, y, z);
    scene.add(rock);
    chromaRocks.push(rock);
    return rock;
}

// Fractured Geodes - safe harbors with EM fields
export const geodes: THREE.Group[] = [];

export function createGeodeAtPosition(x: number, y: number, z: number) {
    const geode = createFracturedGeode({ size: 3 + Math.random() * 2 });
    geode.position.set(x, y, z);
    scene.add(geode);
    geodes.push(geode);
    return geode;
}

// Nebula Jelly-Moss - floating gelatinous organisms with fractal moss
export const jellyMosses: THREE.Group[] = [];

export function createJellyMossAtPosition(x: number, y: number, z: number, size?: number) {
    const jellyMoss = createNebulaJellyMoss({ size: size || 2 + Math.random() * 8 });
    jellyMoss.position.set(x, y, z);
    scene.add(jellyMoss);
    jellyMosses.push(jellyMoss);
    return jellyMoss;
}

// Solar Sails / Light Leaves - thin-film iridescent organisms catching solar wind
export const solarSails: THREE.Group[] = [];

export function createSolarSailAtPosition(x: number, y: number, z: number) {
    const solarSail = createSolarSail({ 
        leafCount: 6 + Math.floor(Math.random() * 6),
        leafLength: 8 + Math.random() * 8
    });
    solarSail.position.set(x, y, z);
    scene.add(solarSail);
    solarSails.push(solarSail);
    return solarSail;
}

// Void Root Balls - active threats with grapple mechanics
export const voidRootBalls: THREE.Group[] = [];

export function createVoidRootBallAtPosition(x: number, y: number, z: number) {
    const rootBall = createVoidRootBall({ size: 2 + Math.random() * 2 });
    rootBall.position.set(x, y, z);
    scene.add(rootBall);
    voidRootBalls.push(rootBall);
    return rootBall;
}

// Vacuum Kelp - energy-draining tunnel obstacles
export const vacuumKelps: THREE.Group[] = [];

export function createVacuumKelpAtPosition(x: number, y: number, z: number) {
    const kelp = createVacuumKelp({ length: 20 + Math.random() * 20, nodes: 5 + Math.floor(Math.random() * 4) });
    kelp.position.set(x, y, z);
    scene.add(kelp);
    vacuumKelps.push(kelp);
    return kelp;
}

// Ice Needle Clusters - super-bleed and thermal dynamics
export const iceNeedleClusters: THREE.Group[] = [];

export function createIceNeedleClusterAtPosition(x: number, y: number, z: number) {
    const cluster = createIceNeedleCluster({ count: 15 + Math.floor(Math.random() * 15) });
    cluster.position.set(x, y, z);
    scene.add(cluster);
    iceNeedleClusters.push(cluster);
    return cluster;
}

// Liquid Metal Blobs - splitting and recombination
export function createLiquidMetalBlobAtPosition(x: number, y: number, z: number) {
    const blob = liquidMetalSystem.createBlob(new THREE.Vector3(x, y, z), 2 + Math.random() * 3);
    return blob;
}

// Magma Hearts - eruption cycle mechanics
export const magmaHearts: THREE.Group[] = [];

export function createMagmaHeartAtPosition(x: number, y: number, z: number) {
    const heart = createMagmaHeart({ size: 3 + Math.random() * 2 });
    heart.position.set(x, y, z);
    scene.add(heart);
    magmaHearts.push(heart);
    return heart;
}

// Store plants that live on the moon to animate them later
export const moonPlants: THREE.Object3D[] = [];

// Phase 1 FPS Fixes - Quick Wins: safely dispose geometry when removing objects
// Materials are intentionally skipped because foliage uses shared material pools
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

// Cleanup geological objects that have fallen behind the camera
export function cleanupGeologicalObjects(cameraX: number) {
    const cutoff = cameraX - 100;

    // Spore clouds
    for (let i = sporeClouds.length - 1; i >= 0; i--) {
        const cloud = sporeClouds[i];
        if (cloud.position.x < cutoff) {
            scene.remove(cloud.spores);
            sporeClouds.splice(i, 1);
        }
    }

    // Chroma rocks
    for (let i = chromaRocks.length - 1; i >= 0; i--) {
        const rock = chromaRocks[i];
        if (rock.position.x < cutoff) {
            scene.remove(rock);
            disposeObject(rock);
            chromaRocks.splice(i, 1);
        }
    }

    // Geodes
    for (let i = geodes.length - 1; i >= 0; i--) {
        const geode = geodes[i];
        if (geode.position.x < cutoff) {
            scene.remove(geode);
            disposeObject(geode);
            geodes.splice(i, 1);
        }
    }

    // Void root balls
    for (let i = voidRootBalls.length - 1; i >= 0; i--) {
        const rootBall = voidRootBalls[i];
        if (rootBall.position.x < cutoff) {
            scene.remove(rootBall);
            disposeObject(rootBall);
            voidRootBalls.splice(i, 1);
        }
    }

    // Vacuum kelp
    for (let i = vacuumKelps.length - 1; i >= 0; i--) {
        const kelp = vacuumKelps[i];
        if (kelp.position.x < cutoff) {
            scene.remove(kelp);
            disposeObject(kelp);
            vacuumKelps.splice(i, 1);
        }
    }

    // Ice needle clusters
    for (let i = iceNeedleClusters.length - 1; i >= 0; i--) {
        const cluster = iceNeedleClusters[i];
        if (cluster.position.x < cutoff) {
            scene.remove(cluster);
            disposeObject(cluster);
            iceNeedleClusters.splice(i, 1);
        }
    }

    // Magma hearts
    for (let i = magmaHearts.length - 1; i >= 0; i--) {
        const heart = magmaHearts[i];
        if (heart.position.x < cutoff) {
            scene.remove(heart);
            disposeObject(heart);
            magmaHearts.splice(i, 1);
        }
    }
}

// Create the distant moon (goal)
function createMoon() {
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

export const moon = createMoon();
moon.position.set(500, 5, -50); // Position far ahead
scene.add(moon);

// =============================================================================
// GEOLOGICAL OBJECT UPDATES (extracted from animate loop)
// =============================================================================
export function updateGeologicalObjects(delta: number, time: number, cameraPos: THREE.Vector3) {
    // Update spore clouds (brownian motion)
    sporeClouds.forEach(cloud => cloud.update(delta));

    // Update chroma-shift rocks (color animation)
    chromaRocks.forEach(rock => updateChromaRock(rock, cameraPos, delta, time));

    // Update geodes (EM field pulse)
    geodes.forEach(geode => updateGeode(geode, delta, time));

    // Update nebula jelly-moss (pulsing and drifting)
    // Use reverse loop so we can remove items safely
    for (let i = jellyMosses.length - 1; i >= 0; i--) {
        const jellyMoss = jellyMosses[i];
        updateNebulaJellyMoss(jellyMoss, delta, time);

        // --- NEW: Jelly Moss Interaction (Stealth, Shield & Overload) ---
        if (player && jellyMoss.visible && jellyMoss.userData.radius) {
            const dist = player.position.distanceTo(jellyMoss.position);
            const radius = jellyMoss.userData.radius;

            // Player inside membrane?
            if (dist < radius) {
                // 1. Viscosity
                playerState.velocity.multiplyScalar(Math.pow(0.05, delta));

                // 2. Stealth Effect
                if (!jellyMoss.userData.isHiding) {
                    jellyMoss.userData.isHiding = true;
                    const rocket = player.children[0];
                    if (rocket) {
                         rocket.traverse((child: any) => {
                             if (child.isMesh && child.material) {
                                 if (child.userData.originalOpacity === undefined) {
                                     child.userData.originalOpacity = child.material.opacity;
                                     child.userData.originalTransparent = child.material.transparent;
                                 }
                                 child.material.transparent = true;
                                 child.material.opacity = 0.4;
                             }
                         });
                    }
                }

                // 3. Shield Leech & Overload
                const normDist = dist / radius;
                const leechIntensity = THREE.MathUtils.lerp(1.0, 0.0, normDist);

                // Build Overload! (Destruction Mechanic)
                // Rate: 0.5 per second (takes ~2 seconds to explode)
                jellyMoss.userData.overloadValue = (jellyMoss.userData.overloadValue || 0) + delta * 0.5;

                // Update Shader Uniform
                const mat = jellyMoss.material as any;
                if (mat.userData && mat.userData.uOverload) {
                    mat.userData.uOverload.value = Math.min(1.0, jellyMoss.userData.overloadValue);
                }

                // Check for Explosion
                if (jellyMoss.userData.overloadValue >= 1.0) {
                    // BOOM
                    destroyNebulaJellyMoss(jellyMoss, scene, particleSystem);

                    // Remove from list
                    jellyMosses.splice(i, 1);

                    // Restore player state immediately (exit stealth)
                    const rocket = player.children[0];
                    if (rocket) {
                         rocket.traverse((child: any) => {
                             if (child.isMesh && child.material) {
                                 if (child.userData.originalOpacity !== undefined) {
                                     child.material.opacity = child.userData.originalOpacity;
                                     child.material.transparent = child.userData.originalTransparent;
                                 } else {
                                     child.material.opacity = 1.0;
                                     child.material.transparent = false;
                                 }
                             }
                         });
                    }
                    continue; // Skip next logic
                }

                // Visual damage effect (red tint pulse)
                if (Math.random() < 0.05 * leechIntensity) {
                    const rocket = player.children[0];
                    if (rocket) {
                        rocket.traverse((child: any) => {
                            if (child.isMesh && child.material) {
                                const childMat = child.material as any;
                                if (childMat.emissive) {
                                    const oldEmissive = childMat.emissive.getHex();
                                    childMat.emissive.setHex(0xff0000);
                                    setTimeout(() => {
                                        if(childMat) childMat.emissive.setHex(oldEmissive);
                                    }, 100);
                                }
                            }
                        });
                    }
                }

            } else {
                // Exit Stealth / Decay Overload
                if (jellyMoss.userData.isHiding) {
                    jellyMoss.userData.isHiding = false;
                    const rocket = player.children[0];
                    if (rocket) {
                         rocket.traverse((child: any) => {
                             if (child.isMesh && child.material) {
                                 if (child.userData.originalOpacity !== undefined) {
                                     child.material.opacity = child.userData.originalOpacity;
                                     child.material.transparent = child.userData.originalTransparent;
                                 } else {
                                     child.material.opacity = 1.0;
                                     child.material.transparent = false;
                                 }
                             }
                         });
                    }
                }

                // Decay overload if player leaves
                if (jellyMoss.userData.overloadValue > 0) {
                    jellyMoss.userData.overloadValue = Math.max(0, jellyMoss.userData.overloadValue - delta * 0.5);
                    const mat = jellyMoss.material as any;
                    if (mat.userData && mat.userData.uOverload) {
                        mat.userData.uOverload.value = jellyMoss.userData.overloadValue;
                    }
                }
            }
        }
    }

    // Update solar sails (iridescent rippling, unfold near player)
    solarSails.forEach(solarSail => updateSolarSail(solarSail, delta, time, player ? player.position : undefined));

    // Update new geological objects from plan.md
    voidRootBalls.forEach(rootBall => {
        const interaction = updateVoidRootBall(rootBall, delta, time, player);
        if (interaction.isLatched) {
            playerState.velocity.add(interaction.force);
            // Visual feedback
            if (interaction.hitPoint && Math.random() < 0.2) {
                particleSystem.emit(interaction.hitPoint, 0x8800ff, 2, 2.0, 0.5);
            }
        }
    });
    vacuumKelps.forEach(kelp => updateVacuumKelp(kelp, delta, time));
    iceNeedleClusters.forEach(cluster => updateIceNeedleCluster(cluster, delta, time));

    // Update Liquid Metal System (Physics & Collisions)
    liquidMetalSystem.update(delta);
    if (player && weaponSystem) {
        liquidMetalSystem.checkCollisions(weaponSystem.getActiveProjectiles());
    }

    magmaHearts.forEach(heart => updateMagmaHeart(heart, delta, time));
}
