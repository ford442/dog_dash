import * as THREE from 'three';
import { decorationBudget } from '../decoration_budget';
import { jellyMossSoftBody } from '../jelly_moss_softbody';
import type { SpatialIndex } from '../spatial_index';
import { disposeObject } from '../utils';
import { verletBodyPool } from '../verlet_body_pool';
import { disposeVoidRootBall } from '../void_root_ball';
import type { LiquidMetalSystem } from './liquid_metal';
import type { SporeCloud } from './spore_gravity';
import { vacuumKelpSoftBody } from './vacuum_kelp';

export type GeologicalWorld = {
    sporeClouds: SporeCloud[];
    jellyMosses: THREE.Mesh[];
    solarSails: THREE.Group[];
    chromaRocks: THREE.Group[];
    geodes: THREE.Group[];
    voidRootBalls: THREE.Group[];
    vacuumKelps: THREE.Group[];
    iceNeedleClusters: THREE.Group[];
    magmaHearts: THREE.Mesh[];
    gravityAnchors: THREE.Group[];
    liquidMetalBlobs: THREE.Object3D[];
    reset(): void; // dispose + empty, for replay / chapter swap
};

export type CreateGeologicalWorldOptions = {
    scene?: THREE.Scene | (() => THREE.Scene | null | undefined);
    getLiquidMetalSystem?: () => LiquidMetalSystem | null | undefined;
    spatialIndex?: SpatialIndex;
    onReset?: () => void;
};

type WorldInternalMeta = {
    getScene: () => THREE.Scene | null | undefined;
    getLiquidMetalSystem?: () => LiquidMetalSystem | null | undefined;
};

const worldMeta = new WeakMap<GeologicalWorld, WorldInternalMeta>();

export function getGeologicalWorldScene(world: GeologicalWorld): THREE.Scene | null | undefined {
    return worldMeta.get(world)?.getScene();
}

export function getGeologicalWorldLiquidMetal(
    world: GeologicalWorld
): LiquidMetalSystem | null | undefined {
    return worldMeta.get(world)?.getLiquidMetalSystem?.();
}

function resolveScene(
    sceneOpt: CreateGeologicalWorldOptions['scene'],
    fallbackScene: THREE.Scene
): THREE.Scene {
    if (typeof sceneOpt === 'function') {
        return sceneOpt() ?? fallbackScene;
    }
    return sceneOpt ?? fallbackScene;
}

function removeFromParentOrScene(obj: THREE.Object3D, scene: THREE.Scene | null | undefined): void {
    if (scene) {
        scene.remove(obj);
    }
    if (obj.parent) {
        obj.parent.remove(obj);
    }
}

export function createGeologicalWorld(
    sceneOrOptions?: THREE.Scene | CreateGeologicalWorldOptions
): GeologicalWorld {
    const options: CreateGeologicalWorldOptions =
        sceneOrOptions instanceof THREE.Scene
            ? { scene: sceneOrOptions }
            : (sceneOrOptions ?? {});
    const defaultScene =
        options.scene instanceof THREE.Scene ? options.scene : new THREE.Scene();

    const getScene = () => resolveScene(options.scene, defaultScene);

    const world: GeologicalWorld = {
        sporeClouds: [],
        jellyMosses: [],
        solarSails: [],
        chromaRocks: [],
        geodes: [],
        voidRootBalls: [],
        vacuumKelps: [],
        iceNeedleClusters: [],
        magmaHearts: [],
        gravityAnchors: [],
        liquidMetalBlobs: [],
        reset(): void {
            const targetScene = getScene();

            for (let i = world.sporeClouds.length - 1; i >= 0; i--) {
                const cloud = world.sporeClouds[i];
                removeFromParentOrScene(cloud.spores, targetScene ?? cloud.scene);
                disposeObject(cloud.spores);
            }
            world.sporeClouds.length = 0;

            for (let i = world.chromaRocks.length - 1; i >= 0; i--) {
                const rock = world.chromaRocks[i];
                removeFromParentOrScene(rock, targetScene);
                disposeObject(rock);
            }
            world.chromaRocks.length = 0;

            for (let i = world.geodes.length - 1; i >= 0; i--) {
                const geode = world.geodes[i];
                removeFromParentOrScene(geode, targetScene);
                disposeObject(geode);
            }
            world.geodes.length = 0;

            for (let i = world.voidRootBalls.length - 1; i >= 0; i--) {
                const rootBall = world.voidRootBalls[i];
                disposeVoidRootBall(rootBall, targetScene);
                decorationBudget.reportDestroy('void_root_ball');
            }
            world.voidRootBalls.length = 0;

            for (let i = world.vacuumKelps.length - 1; i >= 0; i--) {
                const kelp = world.vacuumKelps[i];
                vacuumKelpSoftBody.detach(kelp);
                removeFromParentOrScene(kelp, targetScene);
                disposeObject(kelp);
                decorationBudget.reportDestroy('vacuum_kelp');
            }
            world.vacuumKelps.length = 0;

            for (let i = world.iceNeedleClusters.length - 1; i >= 0; i--) {
                const cluster = world.iceNeedleClusters[i];
                removeFromParentOrScene(cluster, targetScene);
                disposeObject(cluster);
                decorationBudget.reportDestroy('ice_needle_cluster');
            }
            world.iceNeedleClusters.length = 0;

            for (let i = world.magmaHearts.length - 1; i >= 0; i--) {
                const heart = world.magmaHearts[i];
                removeFromParentOrScene(heart, targetScene);
                disposeObject(heart);
                decorationBudget.reportDestroy('magma_heart');
            }
            world.magmaHearts.length = 0;

            for (let i = world.gravityAnchors.length - 1; i >= 0; i--) {
                const anchor = world.gravityAnchors[i];
                removeFromParentOrScene(anchor, targetScene);
                disposeObject(anchor);
            }
            world.gravityAnchors.length = 0;

            for (let i = world.jellyMosses.length - 1; i >= 0; i--) {
                const jellyMoss = world.jellyMosses[i];
                jellyMossSoftBody.detach(jellyMoss);
                removeFromParentOrScene(jellyMoss, targetScene);
                disposeObject(jellyMoss);
            }
            world.jellyMosses.length = 0;

            for (let i = world.solarSails.length - 1; i >= 0; i--) {
                const sail = world.solarSails[i];
                removeFromParentOrScene(sail, targetScene);
                disposeObject(sail);
            }
            world.solarSails.length = 0;

            const liquidMetalSystem = options.getLiquidMetalSystem?.();
            for (let i = world.liquidMetalBlobs.length - 1; i >= 0; i--) {
                const blobGroup = world.liquidMetalBlobs[i];
                const parent = blobGroup.userData?.parent as
                    | { active?: boolean; recombine?: () => void }
                    | undefined;
                if (parent) {
                    parent.recombine?.();
                    parent.active = false;
                }
                if (liquidMetalSystem?.blobs) {
                    const blobIdx = liquidMetalSystem.blobs.findIndex((b) => b.group === blobGroup);
                    if (blobIdx >= 0) liquidMetalSystem.blobs.splice(blobIdx, 1);
                }
                removeFromParentOrScene(blobGroup, targetScene);
                disposeObject(blobGroup);
            }
            world.liquidMetalBlobs.length = 0;

            for (let i = targetScene.children.length - 1; i >= 0; i--) {
                const child = targetScene.children[i];
                if (child.userData?.isCollectible) {
                    targetScene.remove(child);
                    disposeObject(child);
                }
            }

            jellyMossSoftBody.clear();
            vacuumKelpSoftBody.clear();
            verletBodyPool.relayout();

            if (options.spatialIndex) {
                options.spatialIndex.begin();
                options.spatialIndex.commit();
            }
            options.onReset?.();
        }
    };

    worldMeta.set(world, {
        getScene,
        getLiquidMetalSystem: options.getLiquidMetalSystem
    });

    return world;
}
