import * as THREE from 'three';

import { CONFIG } from './game_config';
import { getGpuChores } from './gpu_chores';
import {
    createGameRenderer,
    type GameRenderer,
    type RendererBackend,
    hasDebugUrlFlag
} from './renderer_mode';
import {
    parsePixelRatioPreset,
    pixelRatioForPreset
} from './pixel_ratio';
import {
    TouchControlsManager,
    detectTouchDevice
} from './touch_controls';
import {
    createTouchSettingsButton,
    loadTouchSettings
} from './touch_settings';

// =============================================================================
// SINGLE SOURCE OF TRUTH: Scene / Camera / Core Objects
// =============================================================================
// Scene, fog, camera, and lights are constructed during initializeSceneAndRenderer()
// (or createSceneObjects() in headless composition), never at module import time.
// scene_setup.ts is gutted and re-exports from here for compat.

export const canvas = (
    typeof document !== 'undefined' ? document.querySelector('#glCanvas') : null
) as HTMLCanvasElement;

export const aspect =
    typeof window !== 'undefined' && window.innerHeight > 0
        ? window.innerWidth / window.innerHeight
        : 16 / 9;

export let scene!: THREE.Scene;
export let camera!: THREE.PerspectiveCamera;

// Lights (created in createSceneObjects / initializeSceneAndRenderer; .add() calls happen in startup)
export let mainLight!: THREE.DirectionalLight;
export let rimLight!: THREE.DirectionalLight;
export let accentLight1!: THREE.PointLight;
export let accentLight2!: THREE.PointLight;
export let ambientLight!: THREE.AmbientLight;

// Renderer state (populated during bootstrap init)
export let renderer: GameRenderer;
export let rendererBackend: RendererBackend = 'webgpu';
export let requestedRendererBackend: RendererBackend = 'webgpu';
export let rendererFallbackReason = '';

// Touch controls (populated during bootstrap init)
export let touchControls: TouchControlsManager | null = null;
export let touchSettingsBtn: HTMLElement | null = null;

export type SceneObjects = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    mainLight: THREE.DirectionalLight;
    rimLight: THREE.DirectionalLight;
    accentLight1: THREE.PointLight;
    accentLight2: THREE.PointLight;
    ambientLight: THREE.AmbientLight;
};

/**
 * Construct a fresh scene, fog, camera, and core light set.
 * Called by initializeSceneAndRenderer() and headless composeGameContext().
 */
export function createSceneObjects(): SceneObjects {
    const currentAspect =
        typeof window !== 'undefined' && window.innerHeight > 0
            ? window.innerWidth / window.innerHeight
            : aspect;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.background);
    scene.fog = new THREE.Fog(CONFIG.colors.background, 20, 80);

    camera = new THREE.PerspectiveCamera(50, currentAspect, 0.1, 200);

    mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight = new THREE.DirectionalLight(0x6699ff, 0.4);
    accentLight1 = new THREE.PointLight(0xff8844, 0.6, 50);
    accentLight2 = new THREE.PointLight(0x44ff88, 0.5, 50);
    ambientLight = new THREE.AmbientLight(0x404060, 0.5);

    return {
        scene,
        camera,
        mainLight,
        rimLight,
        accentLight1,
        accentLight2,
        ambientLight
    };
}

// One-time init of scene, renderer, camera, touch, and lights attachment.
// Called from bootstrap after import. This prevents any import-time scene/renderer construction.
export async function initializeSceneAndRenderer(options?: { basePixelRatio?: number }): Promise<void> {
    createSceneObjects();

    // Camera (Side-view, follows player on X axis)
    camera.position.set(0, CONFIG.cameraHeight, CONFIG.cameraDistance);
    camera.lookAt(0, CONFIG.cameraHeight, 0);

    const preset = parsePixelRatioPreset(
        typeof window !== 'undefined' ? window.location.search : '',
        'default'
    );
    const basePixelRatio = options?.basePixelRatio ?? pixelRatioForPreset(preset);
    const rendererInit = await createGameRenderer(canvas, { antialias: true, basePixelRatio });
    renderer = rendererInit.renderer;
    rendererBackend = rendererInit.backend;
    requestedRendererBackend = rendererInit.requestedBackend;
    rendererFallbackReason = rendererInit.fallbackReason || '';

    if (hasDebugUrlFlag('shadows')) {
        configureMainLightShadows(true);
        renderer.shadowMap.enabled = true;
    }

    // Adopt the renderer's device for GPU chores (visual helper compute only).
    // Never requests a device of its own — if renderer boot produced no WebGPU
    // device, chores stay on the AssemblyScript/JS tiers.
    getGpuChores().attachRenderer(renderer);

    // Touch Controls
    touchControls = new TouchControlsManager();
    touchControls.initialize(canvas);

    const savedSettings = loadTouchSettings();
    touchControls.setMode(savedSettings.mode);

    if (detectTouchDevice()) {
        touchSettingsBtn = createTouchSettingsButton(touchControls);
        document.body.appendChild(touchSettingsBtn);
    }
}

// Attach core lights and environment map (envMap passed in).
// Keeps attachment order/logic in startup but uses shared objects.
export function attachLightsAndEnv(envMap: THREE.Texture) {
    scene.add(ambientLight);

    scene.environment = envMap;

    mainLight.position.set(-5, 10, 10);
    // Shadow camera is configured only by configureMainLightShadows / ?shadows.
    scene.add(mainLight);
    scene.add(mainLight.target);

    rimLight.position.set(5, 5, -10);
    scene.add(rimLight);

    accentLight1.position.set(0, 5, 5);
    scene.add(accentLight1);

    accentLight2.position.set(0, 3, -5);
    scene.add(accentLight2);
}

export function configureMainLightShadows(enabled: boolean): void {
    mainLight.castShadow = enabled;
    if (!enabled) return;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -30;
    mainLight.shadow.camera.right = 30;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -10;
    mainLight.shadow.bias = -0.0001;
}

// Resize is handled in main/resize.ts (single handler). This module does not attach listeners.
