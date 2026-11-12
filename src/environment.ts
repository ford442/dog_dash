import * as THREE from 'three';
import { decorationBudget } from './decoration_budget';
import {
    SporeCloud,
    createFracturedGeode,
    createNebulaJellyMoss,
    createVoidRootBall,
    disposeVoidRootBall,
    createVacuumKelp,
    vacuumKelpSoftBody,
    kelpConfigFromRng,
    createIceNeedleCluster,
    iceNeedleCountFromRng,
    createMagmaHeart,
    createGravityAnchor,
    getGeologicalWorldScene,
    getGeologicalWorldLiquidMetal,
    type GeologicalWorld
} from './geological';
import type { ParticleSystem } from './particles';
import type { WeaponSystem } from './weapons';
import type { LiquidMetalSystem } from './geological/liquid_metal';
import { disposeObject } from './utils';
import { jellyMossSoftBody } from './jelly_moss_softbody';
import { gameplayRandom } from './run_seed';

/** Injected by bootstrap — environment never imports composition-root singletons. */
export type EnvironmentSystems = {
    scene?: THREE.Scene;
    particleSystem: ParticleSystem;
    weaponSystem: WeaponSystem;
    liquidMetalSystem: LiquidMetalSystem;
};

let envSystems: EnvironmentSystems | null = null;

export function bindEnvironmentSystems(systems: EnvironmentSystems): void {
    envSystems = systems;
}

/** Refresh deferred environment system refs after an async chunk install. */
export function patchEnvironmentSystems(partial: Partial<EnvironmentSystems>): void {
    if (!envSystems) throw new Error('Environment systems not bound');
    Object.assign(envSystems, partial);
}

function requireEnvSystems(): EnvironmentSystems {
    if (!envSystems) {
        throw new Error('Environment systems not bound — call bindEnvironmentSystems from bootstrap');
    }
    return envSystems;
}

function resolveWorldScene(world: GeologicalWorld): THREE.Scene {
    const worldScene = getGeologicalWorldScene(world) ?? envSystems?.scene;
    if (!worldScene) {
        throw new Error('GeologicalWorld scene not bound');
    }
    return worldScene;
}

// =============================================================================
// GEOLOGICAL OBJECTS & ANOMALIES (owned by GeologicalWorld on game.env)
// Galaxies / moon visuals live in visuals.ts (main.ts wires + adds to canonical scene).
// =============================================================================

export function createSporeCloudAtPosition(
    world: GeologicalWorld,
    x: number,
    y: number,
    z: number
) {
    const targetScene = resolveWorldScene(world);
    const cloud = new SporeCloud(
        targetScene,
        new THREE.Vector3(x, y, z),
        500 + Math.floor(gameplayRandom('geology') * 500)
    );
    cloud.spores.userData.speciesId = 'sporeCloud';
    cloud.spores.userData.scanPosition = cloud.position;
    world.sporeClouds.push(cloud);
    return cloud;
}

export function createGeodeAtPosition(
    world: GeologicalWorld,
    x: number,
    y: number,
    z: number
) {
    const targetScene = resolveWorldScene(world);
    const geode = createFracturedGeode({ size: 3 + gameplayRandom('geology') * 2 });
    geode.position.set(x, y, z);
    geode.userData.speciesId = 'fracturedGeode';
    targetScene.add(geode);
    world.geodes.push(geode);
    return geode;
}

export function createJellyMossAtPosition(
    world: GeologicalWorld,
    x: number,
    y: number,
    z: number,
    size?: number
) {
    const targetScene = resolveWorldScene(world);
    const jellyMoss = createNebulaJellyMoss({ size: size || 2 + gameplayRandom('geology') * 8 });
    jellyMoss.position.set(x, y, z);
    jellyMoss.userData.speciesId = 'nebulaJellyMoss';
    targetScene.add(jellyMoss);
    world.jellyMosses.push(jellyMoss);
    // Verlet soft-body for up to 3 hero mosses. No-op unless the active level
    // opted in via environments.dancingJellyMoss (see applyEnvironmentPlugins).
    jellyMossSoftBody.tryAttach(jellyMoss);
    return jellyMoss;
}

export function createVoidRootBallAtPosition(
    world: GeologicalWorld,
    x: number,
    y: number,
    z: number
) {
    if (!decorationBudget.canSpawn('void_root_ball')) return null;
    if (!decorationBudget.reportSpawn('void_root_ball')) return null;
    const targetScene = resolveWorldScene(world);
    const rootBall = createVoidRootBall({ size: 2 + gameplayRandom('geology') * 2 });
    rootBall.position.set(x, y, z);
    rootBall.userData.speciesId = 'voidRootBall';
    targetScene.add(rootBall);
    world.voidRootBalls.push(rootBall);
    return rootBall;
}

/** Kelp lengths and ice-needle angles are collision geometry — seeded. */
function floraRandom(): number {
    return gameplayRandom('flora');
}

export function createVacuumKelpAtPosition(
    world: GeologicalWorld,
    x: number,
    y: number,
    z: number
) {
    if (!decorationBudget.canSpawn('vacuum_kelp')) return null;
    if (!decorationBudget.reportSpawn('vacuum_kelp')) return null;
    const targetScene = resolveWorldScene(world);
    const cfg = kelpConfigFromRng(floraRandom);
    const kelp = createVacuumKelp(cfg);
    kelp.position.set(x, y, z);
    kelp.userData.speciesId = 'vacuumKelp';
    targetScene.add(kelp);
    world.vacuumKelps.push(kelp);
    vacuumKelpSoftBody.tryAttach(kelp);
    return kelp;
}

export function createIceNeedleClusterAtPosition(
    world: GeologicalWorld,
    x: number,
    y: number,
    z: number
) {
    if (!decorationBudget.canSpawn('ice_needle_cluster')) return null;
    if (!decorationBudget.reportSpawn('ice_needle_cluster')) return null;
    const targetScene = resolveWorldScene(world);
    const cluster = createIceNeedleCluster({
        count: iceNeedleCountFromRng(floraRandom),
        random: floraRandom
    });
    cluster.position.set(x, y, z);
    cluster.userData.speciesId = 'iceNeedleCluster';
    targetScene.add(cluster);
    world.iceNeedleClusters.push(cluster);
    return cluster;
}

export function createLiquidMetalBlobAtPosition(
    world: GeologicalWorld,
    x: number,
    y: number,
    z: number
) {
    const liquidMetalSystem =
        getGeologicalWorldLiquidMetal(world) ?? requireEnvSystems().liquidMetalSystem;
    const blob = liquidMetalSystem.createBlob(
        new THREE.Vector3(x, y, z),
        2 + gameplayRandom('geology') * 3
    );
    blob.group.userData.speciesId = 'liquidMetalBlob';
    world.liquidMetalBlobs.push(blob.group);
    return blob;
}

export function createGravityAnchorAtPosition(
    world: GeologicalWorld,
    x: number,
    y: number,
    z: number,
    biome: number = 0
) {
    const targetScene = resolveWorldScene(world);
    const anchor = createGravityAnchor({ size: 8 + gameplayRandom('geology') * 7, biome });
    anchor.position.set(x, y, z);
    anchor.userData.speciesId = 'gravityAnchor';
    targetScene.add(anchor);
    world.gravityAnchors.push(anchor);
    return anchor;
}

export function createMagmaHeartAtPosition(
    world: GeologicalWorld,
    x: number,
    y: number,
    z: number
) {
    if (!decorationBudget.canSpawn('magma_heart')) return null;
    if (!decorationBudget.reportSpawn('magma_heart')) return null;
    const targetScene = resolveWorldScene(world);
    const heart = createMagmaHeart({ size: 3 + floraRandom() * 2 });
    heart.position.set(x, y, z);
    heart.userData.speciesId = 'magmaHeart';
    targetScene.add(heart);
    world.magmaHearts.push(heart);
    return heart;
}

// Cleanup geological objects that have fallen behind the camera
export function cleanupGeologicalObjects(world: GeologicalWorld, cameraX: number) {
    const cutoff = cameraX - 100;
    const targetScene = resolveWorldScene(world);

    // Spore clouds
    for (let i = world.sporeClouds.length - 1; i >= 0; i--) {
        const cloud = world.sporeClouds[i];
        if (cloud.position.x < cutoff) {
            targetScene.remove(cloud.spores);
            disposeObject(cloud.spores);
            world.sporeClouds.splice(i, 1);
        }
    }

    // Chroma rocks
    for (let i = world.chromaRocks.length - 1; i >= 0; i--) {
        const rock = world.chromaRocks[i];
        if (rock.position.x < cutoff) {
            targetScene.remove(rock);
            disposeObject(rock);
            world.chromaRocks.splice(i, 1);
        }
    }

    // Geodes
    for (let i = world.geodes.length - 1; i >= 0; i--) {
        const geode = world.geodes[i];
        if (geode.position.x < cutoff) {
            targetScene.remove(geode);
            disposeObject(geode);
            world.geodes.splice(i, 1);
        }
    }

    // Void root balls (withered roots remain as obstacles until they leave the stream)
    for (let i = world.voidRootBalls.length - 1; i >= 0; i--) {
        const rootBall = world.voidRootBalls[i];
        if (rootBall.position.x < cutoff) {
            disposeVoidRootBall(rootBall, targetScene);
            decorationBudget.reportDestroy('void_root_ball');
            world.voidRootBalls.splice(i, 1);
        }
    }

    // Vacuum kelp
    for (let i = world.vacuumKelps.length - 1; i >= 0; i--) {
        const kelp = world.vacuumKelps[i];
        if (kelp.position.x < cutoff) {
            vacuumKelpSoftBody.detach(kelp);
            targetScene.remove(kelp);
            disposeObject(kelp);
            decorationBudget.reportDestroy('vacuum_kelp');
            world.vacuumKelps.splice(i, 1);
        }
    }

    // Ice needle clusters
    for (let i = world.iceNeedleClusters.length - 1; i >= 0; i--) {
        const cluster = world.iceNeedleClusters[i];
        if (cluster.position.x < cutoff) {
            targetScene.remove(cluster);
            disposeObject(cluster);
            decorationBudget.reportDestroy('ice_needle_cluster');
            world.iceNeedleClusters.splice(i, 1);
        }
    }

    // Magma hearts
    for (let i = world.magmaHearts.length - 1; i >= 0; i--) {
        const heart = world.magmaHearts[i];
        if (heart.position.x < cutoff) {
            targetScene.remove(heart);
            disposeObject(heart);
            decorationBudget.reportDestroy('magma_heart');
            world.magmaHearts.splice(i, 1);
        }
    }

    // Gravity anchors
    for (let i = world.gravityAnchors.length - 1; i >= 0; i--) {
        const anchor = world.gravityAnchors[i];
        if (anchor.position.x < cutoff) {
            targetScene.remove(anchor);
            disposeObject(anchor);
            world.gravityAnchors.splice(i, 1);
        }
    }

    // Nebula jelly moss
    for (let i = world.jellyMosses.length - 1; i >= 0; i--) {
        const jellyMoss = world.jellyMosses[i];
        if (jellyMoss.position.x < cutoff) {
            jellyMossSoftBody.detach(jellyMoss);
            targetScene.remove(jellyMoss);
            disposeObject(jellyMoss);
            world.jellyMosses.splice(i, 1);
        }
    }

    // Liquid metal blobs
    const liquidMetalSystem =
        getGeologicalWorldLiquidMetal(world) ?? envSystems?.liquidMetalSystem;
    for (let i = world.liquidMetalBlobs.length - 1; i >= 0; i--) {
        const blobGroup = world.liquidMetalBlobs[i];
        if (blobGroup.position.x < cutoff) {
            const parent = blobGroup.userData.parent as
                | {
                      active?: boolean;
                      recombine?: () => void;
                  }
                | undefined;
            if (parent) {
                parent.recombine?.();
                parent.active = false;
            }
            if (liquidMetalSystem) {
                const blobIdx = liquidMetalSystem.blobs.findIndex((b) => b.group === blobGroup);
                if (blobIdx >= 0) liquidMetalSystem.blobs.splice(blobIdx, 1);
            }
            targetScene.remove(blobGroup);
            disposeObject(blobGroup);
            world.liquidMetalBlobs.splice(i, 1);
        }
    }
}

// =============================================================================
// ENVIRONMENT MAP GENERATION
// =============================================================================
export function createStarEnvMap() {
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
            const x = Math.random() * canvas.width; // visual-only
            const y = Math.random() * canvas.height; // visual-only
            const radius = Math.random() * 1.5; // visual-only
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fillStyle = `rgba(255, 255, 255, ${Math.random()})`; // visual-only
            context.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
}
