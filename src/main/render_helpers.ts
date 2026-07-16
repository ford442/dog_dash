import * as THREE from 'three';
import { scene, camera, mainLight, renderer, rendererBackend } from '../scene_context';
import { player } from '../player_loader';
import { playerState } from '../game_config';
import { game } from '../game_runtime';
import { sporeClouds, geodes, voidRootBalls, vacuumKelps, iceNeedleClusters, magmaHearts, gravityAnchors } from '../environment';
import {
    CollisionDebugOverlay,
    WebGLMaterialFallbackRenderer,
    WireframeDebugHelper,
    type CollisionDebugTarget
} from '../render_debug_helpers';

export const RESOLUTION_RATIOS = [0.50, 0.60, 0.75, 1.0, 1.5, 2.0];

export function initRenderHelpers(): void {
    game.currentRatioIndex = 1;
    game.currentPixelRatio = Math.min(2, window.devicePixelRatio * RESOLUTION_RATIOS[game.currentRatioIndex]);
    renderer.setPixelRatio(game.currentPixelRatio);
    game.wireframeDebugHelper = new WireframeDebugHelper();
    game.collisionDebugOverlay = new CollisionDebugOverlay(scene);
    game.webglMaterialFallbackRenderer = new WebGLMaterialFallbackRenderer(rendererBackend);
}

export function renderGameFrame(): void {
    game.webglMaterialFallbackRenderer.render(renderer, scene, camera);
}

export function getCollisionDebugTargets(): CollisionDebugTarget[] {
    const targets: CollisionDebugTarget[] = [];
    const addTarget = (position: THREE.Vector3 | null | undefined, radius: number, color: number) => {
        if (!position) return;
        targets.push({ position, radius, color });
    };

    if (player) {
        addTarget(player.position, 0.5, 0x55ff88);
    }

    if (game.obstacleSystem) {
        game.obstacleSystem.getObstacles().slice(0, 120).forEach((obs) => {
            if (!obs?.position) return;
            addTarget(
                obs.position,
                obs.userData.radius || 1.0,
                Math.abs(obs.position.z) < 2.0 ? 0xffaa33 : 0x6655ff
            );
        });

        game.obstacleSystem.getSquids().forEach((squid) => {
            if (!squid.isDestroyed) {
                addTarget(squid.getPosition(), squid.getRadius(), 0xff44cc);
            }
        });
    }

    game.slingableObjectSystem.objects.forEach((obj) => {
        if (obj?.active) {
            addTarget(obj.group?.position, obj.radius, 0x44ddff);
        }
    });

    sporeClouds.forEach((cloud) => {
        if (cloud.active) {
            addTarget(cloud.position, 5, 0x88ff88);
        }
    });

    jellyMosses.forEach((jellyMoss) => {
        if (jellyMoss.visible && jellyMoss.userData.radius) {
            addTarget(jellyMoss.position, jellyMoss.userData.radius, 0x88ffaa);
        }
    });

    gravityAnchors.forEach((anchor) => {
        addTarget(anchor.position, (anchor.userData.fieldRadius as number) || 40, 0x6699ff);
    });

    voidRootBalls.forEach((rootBall) => {
        const detection = (rootBall.userData.detectionRadius as number) || 20;
        addTarget(rootBall.position, detection, 0xcc44ff);
    });

    return targets;
}

export function updateShadowQuality(): void {
    const targetSize = playerState.bossActive ? 2048 : 1024;
    if (mainLight.shadow.mapSize.width !== targetSize) {
        mainLight.shadow.mapSize.width = targetSize;
        mainLight.shadow.mapSize.height = targetSize;
        if (mainLight.shadow.map) {
            mainLight.shadow.map.setSize(targetSize, targetSize);
        }
        console.log(`Shadow map resized to ${targetSize}x${targetSize} (${playerState.bossActive ? 'boss' : 'normal'})`);
    }
}

export function updateShadowCulling(): void {
    if (!player) return;
    game.shadowCullingFrame++;
    if (game.shadowCullingFrame % 15 !== 0) return;

    const playerX = player.position.x;
    const updateObj = (obj: THREE.Object3D | null | undefined) => {
        if (!obj || !obj.position || typeof obj.traverse !== 'function') return;
        const inRange = Math.abs(obj.position.x - playerX) < 40;
        obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).castShadow = inRange;
                (child as THREE.Mesh).receiveShadow = inRange;
            }
        });
    };

    game.levelManager.levelObjects.forEach(updateObj);
    geodes.forEach(updateObj);
    voidRootBalls.forEach(updateObj);
    vacuumKelps.forEach(updateObj);
    iceNeedleClusters.forEach(updateObj);
    magmaHearts.forEach(updateObj);
    gravityAnchors.forEach(updateObj);
    game.slingableObjectSystem.objects.forEach(obj => updateObj(obj?.group));
}
