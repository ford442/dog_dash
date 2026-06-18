import * as THREE from 'three';
import { scene } from './scene_context';
import { player } from './player_loader';
import { playerState } from './game_config';
import {
    SporeCloud,
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
    updateMagmaHeart,
    createGravityAnchor,
    updateGravityAnchor
} from './geological';
import { createSolarSail, updateSolarSail } from './foliage';
import { createSubwooferLotus, createFiberOpticWillow, createGlowingFlower } from './foliage';
import { particleSystem, weaponSystem, liquidMetalSystem } from './game_systems';

// =============================================================================
// GEOLOGICAL OBJECTS & ANOMALIES (single copy — see scene_context + main.ts)
// Galaxies / moon visuals live in visuals.ts (main.ts wires + adds to canonical scene).
// =============================================================================

// Spore Clouds - floating clouds of glowing spores
export const sporeClouds: SporeCloud[] = [];

export function createSporeCloudAtPosition(x: number, y: number, z: number) {
    const cloud = new SporeCloud(scene, new THREE.Vector3(x, y, z), 500 + Math.floor(Math.random() * 500));
    sporeClouds.push(cloud);
    return cloud;
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
    rootBall.userData.speciesId = 'voidRootBall';
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
    cluster.userData.speciesId = 'iceNeedleCluster';
    scene.add(cluster);
    iceNeedleClusters.push(cluster);
    return cluster;
}

// Liquid Metal Blobs - splitting and recombination
export function createLiquidMetalBlobAtPosition(x: number, y: number, z: number) {
    const blob = liquidMetalSystem.createBlob(new THREE.Vector3(x, y, z), 2 + Math.random() * 3);
    return blob;
}

// Gravity Anchors — Stellar Cores with localized inverse-square force fields
export const gravityAnchors: THREE.Group[] = [];

export function createGravityAnchorAtPosition(x: number, y: number, z: number, biome: number = 0) {
    const anchor = createGravityAnchor({ size: 8 + Math.random() * 7, biome });
    anchor.position.set(x, y, z);
    anchor.userData.speciesId = 'gravityAnchor';
    scene.add(anchor);
    gravityAnchors.push(anchor);
    return anchor;
}

// Magma Hearts - eruption cycle mechanics
export const magmaHearts: THREE.Group[] = [];

export function createMagmaHeartAtPosition(x: number, y: number, z: number) {
    const heart = createMagmaHeart({ size: 3 + Math.random() * 2 });
    heart.position.set(x, y, z);
    heart.userData.speciesId = 'magmaHeart';
    scene.add(heart);
    magmaHearts.push(heart);
    return heart;
}

// Phase 1 FPS Fixes - Quick Wins: safely dispose geometry when removing objects
// (moonPlants lives in visuals.ts; use the import from there)
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

    // Gravity anchors
    for (let i = gravityAnchors.length - 1; i >= 0; i--) {
        const anchor = gravityAnchors[i];
        if (anchor.position.x < cutoff) {
            scene.remove(anchor);
            disposeObject(anchor);
            gravityAnchors.splice(i, 1);
        }
    }
}

// (createMoon + moon auto-add removed — canonical impl + add lives in visuals.ts + main.ts
//  to guarantee single scene and no duplicate objects.)

// =============================================================================
// GEOLOGICAL OBJECT UPDATES (extracted from animate loop)
// =============================================================================
export function updateGeologicalObjects(delta: number, time: number, cameraPos: THREE.Vector3) {
    // Update spore clouds (brownian motion)
    sporeClouds.forEach(cloud => cloud.update(delta));



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

// =============================================================================
// ENVIRONMENT MAP GENERATION
// =============================================================================
export function generateEnvironment() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    if (context) {
        // Deep space gradient
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.5, '#05051a');
        gradient.addColorStop(1, '#110522');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Draw stars
        for (let i = 0; i < 500; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const radius = Math.random() * 1.5;
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fillStyle = `rgba(255, 255, 255, ${Math.random()})`;
            context.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
}
