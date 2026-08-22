import * as THREE from 'three';

import { CONFIG } from './game_config';
import {
    createGameRenderer,
    type GameRenderer,
    type RendererBackend
} from './renderer_mode';
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
// This module creates the ONE THREE.Scene that main.ts renders.
// No other module should do `new THREE.Scene()` or import a parallel scene.
// Renderer + touch + light attachment are orchestrated from main.ts (after import).
// scene_setup.ts is gutted and re-exports from here for compat.

export const canvas = document.querySelector('#glCanvas') as HTMLCanvasElement;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.background);
scene.fog = new THREE.Fog(CONFIG.colors.background, 20, 80);

export const aspect = window.innerWidth / window.innerHeight;
export const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);

// Lights (creation here; .add() calls happen in main.ts setup)
export const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
export const rimLight = new THREE.DirectionalLight(0x6699ff, 0.4);
export const accentLight1 = new THREE.PointLight(0xff8844, 0.6, 50);
export const accentLight2 = new THREE.PointLight(0x44ff88, 0.5, 50);
export const ambientLight = new THREE.AmbientLight(0x404060, 0.5);

// Renderer state (populated during main.ts init)
export let renderer: GameRenderer;
export let rendererBackend: RendererBackend = 'webgpu';
export let requestedRendererBackend: RendererBackend = 'webgpu';
export let rendererFallbackReason = '';

// Touch controls (populated during main.ts init)
export let touchControls: TouchControlsManager | null = null;
export let touchSettingsBtn: HTMLElement | null = null;

// One-time init of renderer, camera, touch, and lights attachment.
// Called exactly once from main.ts. This prevents any duplicate renderer/scene.
export function initializeSceneAndRenderer(options?: { basePixelRatio?: number }) {
    // Camera (Side-view, follows player on X axis)
    camera.position.set(0, CONFIG.cameraHeight, CONFIG.cameraDistance);
    camera.lookAt(0, CONFIG.cameraHeight, 0);

    // Renderer (with perf default)
    const basePixelRatio = options?.basePixelRatio ?? 0.60;
    const rendererInit = createGameRenderer(canvas, { antialias: true, basePixelRatio });
    renderer = rendererInit.renderer;
    rendererBackend = rendererInit.backend;
    requestedRendererBackend = rendererInit.requestedBackend;
    rendererFallbackReason = rendererInit.fallbackReason || '';

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
// Keeps attachment order/logic in main.ts but uses shared objects.
export function attachLightsAndEnv(envMap: THREE.Texture) {
    scene.add(ambientLight);

    scene.environment = envMap;

    mainLight.position.set(-5, 10, 10);
    mainLight.castShadow = false;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -30;
    mainLight.shadow.camera.right = 30;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -10;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);
    scene.add(mainLight.target);

    rimLight.position.set(5, 5, -10);
    scene.add(rimLight);

    accentLight1.position.set(0, 5, 5);
    scene.add(accentLight1);

    accentLight2.position.set(0, 3, -5);
    scene.add(accentLight2);
}

// Resize is handled in main.ts (single handler). This module does not attach listeners.
