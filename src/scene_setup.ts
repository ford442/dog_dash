import * as THREE from 'three';
import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js';
import { WebGPURenderer } from 'three/webgpu';
import { generateEnvironment } from './environment';
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

// --- Scene Setup ---
export const canvas = document.querySelector('#glCanvas') as HTMLCanvasElement;
export const scene = new THREE.Scene();
export const butterflySwarmSystem = new ButterflySwarmSystem(scene);
scene.background = new THREE.Color(CONFIG.colors.background);
scene.fog = new THREE.Fog(CONFIG.colors.background, 20, 80);

export let renderer: WebGPURenderer;
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

// Check WebGPU & Initialize
try {
    if (!WebGPU.isAvailable()) {
        const warning = WebGPU.getErrorMessage();
        const msg = warning.textContent || 'WebGPU is not supported by your browser/device.';
        showError('WebGPU Not Supported', msg);
        throw new Error('WebGPU not supported');
    }

    if (!window.isSecureContext) {
        showError('Insecure Context', 'WebGPU requires a secure context (HTTPS or localhost). Please check your connection.');
        throw new Error('Insecure Context');
    }

    // Camera (Side-view, follows player on X axis)
    camera.position.set(0, CONFIG.cameraHeight, CONFIG.cameraDistance);
    camera.lookAt(0, CONFIG.cameraHeight, 0);

    // Renderer
    renderer = new WebGPURenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

    // Environment Map (for metallic reflections)
    const envMap = generateEnvironment();
    scene.environment = envMap;

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
