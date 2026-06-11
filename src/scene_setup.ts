import * as THREE from 'three';

import {
    TouchControlsManager,
    detectTouchDevice
} from './touch_controls';
import {
    createTouchSettingsButton,
    loadTouchSettings
} from './touch_settings';
import { ButterflySwarmSystem } from './butterfly_swarm';
import { CONFIG, showError } from './game_config';
import { createGameRenderer, type GameRenderer, type RendererBackend } from './renderer_mode';

// --- Scene Setup ---
export const canvas = document.querySelector('#glCanvas') as HTMLCanvasElement;
export const scene = new THREE.Scene();
export const butterflySwarmSystem = new ButterflySwarmSystem(scene);
scene.background = new THREE.Color(CONFIG.colors.background);
scene.fog = new THREE.Fog(CONFIG.colors.background, 20, 80);

export let renderer: GameRenderer;
export let rendererBackend: RendererBackend = 'webgpu';
export let requestedRendererBackend: RendererBackend = 'webgpu';
export let rendererFallbackReason = '';
export const aspect = window.innerWidth / window.innerHeight;
export const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
export const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
export const rimLight = new THREE.DirectionalLight(0x6699ff, 0.4);
export const accentLight1 = new THREE.PointLight(0xff8844, 0.6, 50);
export const accentLight2 = new THREE.PointLight(0x44ff88, 0.5, 50);
export const ambientLight = new THREE.AmbientLight(0x404060, 0.5);

// --- Touch Controls ---
export let touchControls: TouchControlsManager | null = null;
export let touchSettingsBtn: HTMLElement | null = null;

// Renderer / scene initialization
try {
    // Camera (Side-view, follows player on X axis)
    camera.position.set(0, CONFIG.cameraHeight, CONFIG.cameraDistance);
    camera.lookAt(0, CONFIG.cameraHeight, 0);

    // Renderer
    const rendererInit = createGameRenderer(canvas, { antialias: true });
    renderer = rendererInit.renderer;
    rendererBackend = rendererInit.backend;
    requestedRendererBackend = rendererInit.requestedBackend;
    rendererFallbackReason = rendererInit.fallbackReason || '';

    // Touch Controls Initialization
    touchControls = new TouchControlsManager();
    touchControls.initialize(canvas);

    // Load saved settings and apply
    const savedSettings = loadTouchSettings();
    touchControls.setMode(savedSettings.mode);

    // Add settings button (only on touch devices)
    if (detectTouchDevice()) {
        touchSettingsBtn = createTouchSettingsButton(touchControls);
        document.body.appendChild(touchSettingsBtn);
    }

    // Lighting (Moody, atmospheric)
    scene.add(ambientLight);

    // Environment Map (for metallic reflections) — inlined to avoid circular imports
    const envMapCanvas = document.createElement('canvas');
    envMapCanvas.width = 1024;
    envMapCanvas.height = 512;
    const envMapCtx = envMapCanvas.getContext('2d');
    if (envMapCtx) {
        const gradient = envMapCtx.createLinearGradient(0, 0, 0, envMapCanvas.height);
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.5, '#05051a');
        gradient.addColorStop(1, '#110522');
        envMapCtx.fillStyle = gradient;
        envMapCtx.fillRect(0, 0, envMapCanvas.width, envMapCanvas.height);
        for (let i = 0; i < 500; i++) {
            const sx = Math.random() * envMapCanvas.width;
            const sy = Math.random() * envMapCanvas.height;
            const radius = Math.random() * 1.5;
            envMapCtx.beginPath();
            envMapCtx.arc(sx, sy, radius, 0, Math.PI * 2);
            envMapCtx.fillStyle = `rgba(255, 255, 255, ${Math.random()})`;
            envMapCtx.fill();
        }
    }
    const envMapTexture = new THREE.CanvasTexture(envMapCanvas);
    envMapTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envMapTexture;

    // Main directional light (from the side for dramatic shadows)
    mainLight.position.set(-5, 10, 10);
    mainLight.castShadow = true;
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

    // Rim light from behind (cinematic depth) - enhanced
    rimLight.position.set(5, 5, -10);
    scene.add(rimLight);

    // Add accent lights for more depth
    accentLight1.position.set(0, 5, 5);
    scene.add(accentLight1);

    accentLight2.position.set(0, 3, -5);
    scene.add(accentLight2);

} catch (err: any) {
    showError('Initialization Error', err.message || 'Unknown error occurred during startup.');
    throw err;
}

// --- Materials ---
export const materials = {
    ground: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.ground,
        roughness: 0.9,
        metalness: 0.1
    }),
    platform: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.platform,
        roughness: 0.7,
        metalness: 0.2
    }),
    player: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.player,
        roughness: 0.4,
        metalness: 0.1,
        emissive: CONFIG.colors.player,
        emissiveIntensity: 0.1
    }),
    background: new THREE.MeshStandardMaterial({
        color: CONFIG.colors.accent,
        roughness: 1.0,
        metalness: 0.0
    })
};

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
