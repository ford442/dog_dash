import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { shouldSkipGpuBoot } from './webgpu_probe';

// =============================================================================
// PLAYER (Rocket Character) - GLB Model Integration
// =============================================================================
// Never calls gltfLoader.load at module import time.
// Bootstrap calls loadPlayer(scene) after the WebGPU probe (or builds a stub
// mesh under ?skip_gpu_boot / headless).

export let player: THREE.Group | null = null;
export const gltfLoader = new GLTFLoader();

export const playerLoadCallbacks: ((player: THREE.Group, rocketModel: THREE.Object3D) => void)[] = [];

/** Register a callback; runs immediately if the rocket is already loaded. */
export function onPlayerLoaded(cb: (player: THREE.Group, rocketModel: THREE.Object3D) => void): void {
    playerLoadCallbacks.push(cb);
    if (player) {
        const rocketModel = (player.children[0] as THREE.Object3D | undefined) ?? player;
        cb(player, rocketModel);
    }
}

function attachFlameAndShadow(group: THREE.Group, targetScene: THREE.Scene): THREE.Group {
    const glowMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff4400,
        emissiveIntensity: 1.0
    });
    const flameGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
    const flame = new THREE.Mesh(flameGeo, glowMat);
    flame.position.y = -0.5;
    flame.rotation.x = Math.PI;
    group.add(flame);
    group.userData.flame = flame;

    const tiltGroup = new THREE.Group();
    tiltGroup.add(group);
    tiltGroup.position.set(0, 5, 0);

    player = tiltGroup;
    targetScene.add(player);

    // Dog's shadow blob (added to scene, not player, so it doesn't pitch/roll)
    const shadowGeo = new THREE.PlaneGeometry(1.5, 0.8);
    const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.5,
        depthWrite: false
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    targetScene.add(shadow);
    player.userData.shadow = shadow;

    return tiltGroup;
}

export function createPlaceholderPlayer(
    targetScene: THREE.Scene,
    onReady?: (loadedPlayer: THREE.Group) => void
): THREE.Group {
    const group = new THREE.Group();

    const geometry = new THREE.ConeGeometry(0.5, 2, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xe94560 });
    const placeholder = new THREE.Mesh(geometry, material);
    placeholder.rotation.x = Math.PI;
    placeholder.castShadow = true;
    group.add(placeholder);

    const tiltGroup = attachFlameAndShadow(group, targetScene);
    onReady?.(tiltGroup);
    playerLoadCallbacks.forEach((cb) => cb(tiltGroup, group));
    return tiltGroup;
}

export type LoadPlayerOptions = {
    /** Skip network fetch of rocket.glb and build the placeholder rocket mesh immediately. */
    stub?: boolean;
    /** Optional hook invoked before playerLoadCallbacks fire (e.g. to set game.player). */
    onReady?: (loadedPlayer: THREE.Group) => void;
};

/**
 * Load the rocket GLB model onto `targetScene` (or construct a stub mesh when
 * `options.stub` or `?skip_gpu_boot` is active). Never runs at module import time.
 */
export function loadPlayer(
    targetScene: THREE.Scene,
    options?: LoadPlayerOptions
): Promise<THREE.Group> {
    player = null;

    if (options?.stub || shouldSkipGpuBoot()) {
        const stubPlayer = createPlaceholderPlayer(targetScene, options?.onReady);
        return Promise.resolve(stubPlayer);
    }

    return new Promise<THREE.Group>((resolve) => {
        gltfLoader.load(
            'rocket.glb',
            (gltf) => {
                const rocketModel = gltf.scene;

                // Enable shadows for all meshes in the model
                rocketModel.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = true;
                        // Don't set receiveShadow to avoid self-shadowing artifacts
                    }
                });

                // Create a container group for the model
                const group = new THREE.Group();
                group.add(rocketModel);

                // Scale the model to match the previous rocket size (~2 units tall)
                const box = new THREE.Box3().setFromObject(rocketModel);
                const size = box.getSize(new THREE.Vector3());
                const maxDimension = Math.max(size.x, size.y, size.z);
                const targetSize = 2.0;
                const scale = targetSize / maxDimension;
                rocketModel.scale.setScalar(scale);

                // Center the model
                box.setFromObject(rocketModel);
                const center = box.getCenter(new THREE.Vector3());
                rocketModel.position.sub(center);

                // ROTATE HORIZONTAL: Nose points RIGHT (+X direction)
                group.rotation.z = -Math.PI / 2;

                const tiltGroup = attachFlameAndShadow(group, targetScene);
                options?.onReady?.(tiltGroup);

                // Notify callbacks
                playerLoadCallbacks.forEach((cb) => cb(tiltGroup, rocketModel));

                console.log('🚀 Rocket GLB model loaded successfully!');
                resolve(tiltGroup);
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
            },
            (error) => {
                console.error('Error loading rocket GLB model:', error);
                const fallbackPlayer = createPlaceholderPlayer(targetScene, options?.onReady);
                console.warn('Using placeholder rocket due to loading error');
                resolve(fallbackPlayer);
            }
        );
    });
}
