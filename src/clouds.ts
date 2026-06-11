import * as THREE from 'three';
import {
    MeshBasicNodeMaterial,
    MeshStandardNodeMaterial
} from 'three/webgpu';
import {
    time,
    Loop,
    Loop,
    positionLocal,
    positionWorld,
    uv,
    vec2,
    vec3,
    vec4,
    color,
    uniform,
    mix,
    sin,
    cos,
    float,
    length,
    smoothstep,
    dot,
    fract,
    max,
    distance,
    UniformNode
} from 'three/tsl';

// --- TSL Noise Functions ---

const random2D = (v: any) => {
    return sin(dot(v, vec2(12.9898, 78.233))).mul(43758.5453).fract();
};

const valueNoise = (v: any) => {
    const i = v.floor();
    const f = v.fract();

    // Four corners
    const a = random2D(i);
    const b = random2D(i.add(vec2(1.0, 0.0)));
    const c = random2D(i.add(vec2(0.0, 1.0)));
    const d = random2D(i.add(vec2(1.0, 1.0)));

    // Smooth interpolation curve
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

    return mix(a, b, u.x).add(
        (c.sub(a).mul(u.y).mul(float(1.0).sub(u.x))).add(
        (d.sub(b).mul(u.x).mul(u.y)))
    );
};

const fbm = (v: any) => {
    let total = float(0.0);
    let amplitude = float(0.5);
    let frequency = float(1.0);

    // 3 Octaves
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);

    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);

    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));

    return total;
};

/**
 * Creates a TSL material for cloud sprites (billboards).
 * Features:
 * - Procedural shape (Soft circle + Noise erosion)
 * - Billowing animation (Time-based noise offset)
 * - Internal lighting/shading simulation via noise density
 * - Volumetric Lightning Flash (Distance-based)
 */
function createCloudSpriteMaterial(uBaseColor: UniformNode<THREE.Color>, uOpacity: UniformNode<number>, detail: number = 1.0, weaponLights?: any, uPlayerPos?: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.FrontSide, // Sprites face camera
        depthWrite: false, // Soft blending
        blending: THREE.NormalBlending // Standard alpha blending
    });

    const uTime = time;
    const uBillowSpeed = uniform(0.2);
    const uFlash = uniform(0.0);
    const uDetail = uniform(detail);

    // Volumetric Lightning Uniforms
    const uLightningPos = uniform(new THREE.Vector3(0, 0, 0));
    const uLightningRadius = uniform(50.0);
    const uLightningColor = uniform(new THREE.Color(0xffffff));

    // --- Fragment Shader ---
    const vUv = uv();

    // Center UVs to -0.5 to 0.5 for radial calculations
    const centeredUv = vUv.sub(0.5);
    const dist = length(centeredUv).mul(2.0); // 0 at center, 1 at edge

    // 1. Base Shape (Soft Circle)
    const core = float(1.0).sub(dist); // 1 at center, 0 at edge
    const softShape = smoothstep(0.0, 0.2, core); // Soft edge fade

    // 2. Procedural Noise (Texture)
    // Scale UVs for noise
    const noiseUv = vUv.mul(3.0).mul(uDetail);

    // Animate noise for billowing effect
    // We scroll the noise domain slightly and evolve z-slice (if 3d) or just offset
    const scroll = vec2(uTime.mul(uBillowSpeed).mul(0.5), uTime.mul(uBillowSpeed).mul(0.2));
    const noiseVal = fbm(noiseUv.add(scroll));

    // 3. Erode shape with noise
    // Combine shape and noise.
    // Edges get more eroded. Center stays denser.
    const density = softShape.mul(noiseVal.add(0.2));

    // Sharpen alpha slightly to define puff
    const alpha = smoothstep(0.1, 0.6, density).mul(uOpacity);

    // 4. Color & Lighting
    const baseColor = color(uBaseColor);

    // internal shadows: darker where noise is low (crevices)
    const shadowFactor = noiseVal.mul(0.5).add(0.5);
    const finalColor = baseColor.mul(shadowFactor);

    // 5. Volumetric Lightning Flash
    // Calculate distance from this fragment (in world space) to the lightning strike
    const distToStrike = distance(positionWorld, uLightningPos);

    // Attenuation: 1.0 at center, 0.0 at radius
    const attenuation = smoothstep(uLightningRadius, float(0.0), distToStrike);

    // Fake normal based on UV from center for directional rim lighting
    const fakeNormal = vec3(centeredUv.x, centeredUv.y, 0.5).normalize();
    const lightDir = positionWorld.sub(uLightningPos).normalize();
    const lightIntensity = dot(fakeNormal, lightDir).max(0.0).mul(0.5).add(0.5);

    // Flash adds volumetric emissive boost based on attenuation, noise density and intensity
    const flashColor = color(uLightningColor);

    // Use noiseVal to highlight the cloud's internal structure during flash
    const volumetricHighlight = noiseVal.add(0.5);
    const flashFactor = uFlash.mul(attenuation).mul(volumetricHighlight).mul(lightIntensity);


    const flashedColor = mix(finalColor, flashColor, flashFactor);

    let enhancedColor = flashedColor;

    if (uPlayerPos !== undefined && weaponLights !== undefined) {
        // Player Engine Glow Interaction
        const distToPlayer = length(positionWorld.sub(uPlayerPos));
        const glowIntensity = smoothstep(30.0, 0.0, distToPlayer);
        const uGlowColor = uniform(new THREE.Color(0xff8844)); // Engine glow

        // Weapon Light Interaction
        const weaponGlow = float(0.0).toVar();
        const uWeaponColor = uniform(new THREE.Color(0x00ffff));

        Loop({ start: 0, end: 20 }, ({ i }) => {
            const lightData = weaponLights.element(i);
            const lightPos = lightData.xyz;
            const lightIntensity = lightData.w;

            const distToLight = distance(positionWorld, lightPos);
            const lightRadius = float(25.0);
            const falloff = smoothstep(lightRadius, 0.0, distToLight);

            weaponGlow.addAssign(falloff.mul(lightIntensity));
        });

        enhancedColor = enhancedColor.add(uGlowColor.mul(glowIntensity.mul(0.6))).add(uWeaponColor.mul(weaponGlow.mul(0.8)));
    }

    mat.colorNode = vec4(enhancedColor, alpha);

    // Store uniforms
    if (uPlayerPos !== undefined) {
        mat.userData.uPlayerPos = uPlayerPos;
    }

    mat.userData.uFlash = uFlash;
    mat.userData.uLightningPos = uLightningPos;
    mat.userData.uLightningRadius = uLightningRadius;
    mat.userData.uLightningColor = uLightningColor;

    return mat;
}

export class CloudLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    windSpeed: number; // Independent speed
    width: number;
    baseZ: number;

    // Instance data
    positions: Float32Array;
    scales: Float32Array;

    uColor: UniformNode<THREE.Color>;
    uOpacity: UniformNode<number>;

    constructor(
        scene: THREE.Scene,
        config: {
            count: number,
            z: number,
            zRange: number,
            uColor: UniformNode<THREE.Color>,
            uOpacity: UniformNode<number>,
            scaleMin: number,
            scaleMax: number,
            windSpeed: number, // Speed relative to world (crawling)
            width: number,
            detail?: number,
            weaponLights?: any,
            uPlayerPos?: any,
            weaponLights?: any,
            uPlayerPos?: any
        }
    ) {
        this.count = config.count;
        this.windSpeed = config.windSpeed;
        this.width = config.width;
        this.baseZ = config.z;
        this.uColor = config.uColor;
        this.uOpacity = config.uOpacity;

        // Use PlaneGeometry for Sprites
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = createCloudSpriteMaterial(config.uColor, config.uOpacity, config.detail || 1.0, config.weaponLights, config.uPlayerPos);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false; // Infinite scroll
        this.mesh.renderOrder = config.z < 0 ? -2 : 2; // Background vs Foreground ordering

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.scales = new Float32Array(this.count);

        // Initial Layout
        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * config.width;
            const y = (Math.random() - 0.5) * 30; // Spread vertically
            const z = config.z + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.scales[i] = s;

            this.dummy.position.set(x, y, z);
            this.dummy.scale.set(s * 1.5, s, 1.0); // Wider clouds
            this.dummy.rotation.set(0, 0, (Math.random() - 0.5) * 0.2); // Slight tilt

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
    }

    update(delta: number, cameraX: number) {
        // Parallax & Scrolling Logic
        // We want clouds to "crawl" (windSpeed) AND parallax.
        // Actually, if we move them by windSpeed * delta, they move in world space.
        // The camera movement naturally creates parallax.

        const margin = 30;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;

            // 1. Apply Wind
            this.positions[idx] += this.windSpeed * delta;

            let x = this.positions[idx];

            // 2. Wrap around camera
            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                // Optional: Randomize Y slightly on respawn to vary pattern?
                // this.positions[idx+1] = (Math.random() - 0.5) * 30;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            if (needsUpdate || this.windSpeed !== 0) {
                // Update matrix
                const y = this.positions[idx+1];
                const z = this.positions[idx+2];
                const s = this.scales[i];

                this.dummy.position.set(x, y, z);
                this.dummy.scale.set(s * 1.5, s, 1.0);
                // Keep rotation? We didn't store it, assuming static small tilt is fine or reset it.
                // Let's keep it simple and reset tilt to random deterministic if needed,
                // but here we just zero it or keep previous if we read it back.
                // Optim: Just set it.
                this.dummy.rotation.set(0, 0, 0);

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    flash(position: THREE.Vector3, radius: number, intensity: number, flashColor: THREE.Color = new THREE.Color(0xffffff)) {
        const mat = this.mesh.material as any;
        if (mat.userData) {
            if (mat.userData.uFlash) mat.userData.uFlash.value = intensity;
            if (mat.userData.uLightningPos) mat.userData.uLightningPos.value.copy(position);
            if (mat.userData.uLightningRadius) mat.userData.uLightningRadius.value = radius;
            if (mat.userData.uLightningColor) mat.userData.uLightningColor.value.copy(flashColor);
        }
    }
}

import { LevelConfig } from './level_config';
import { WeaponLightManager } from './lighting';


export class LightningFlashOverlay {
    mesh: THREE.Mesh;
    camera: THREE.Camera | null = null;
    uIntensity: UniformNode<number>;

    constructor() {
        const geo = new THREE.PlaneGeometry(2, 2);
        this.uIntensity = uniform(0.0);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        const vUv = uv();
        const dist = length(vUv.sub(0.5)).mul(1.5);
        const vignette = smoothstep(0.4, 1.2, dist);
        const flashColor = color(0xffffff); // Bright white/blue flash
        // Base flash across screen, stronger at edges
        const alpha = float(0.3).add(vignette.mul(0.7)).mul(this.uIntensity).mul(0.6);

        mat.colorNode = vec4(flashColor, alpha);

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.set(0, 0, -1.02); // Just behind UI
    }

    init(camera: THREE.Camera) {
        this.camera = camera;
        camera.add(this.mesh);
    }

    update(delta: number) {
        if (this.uIntensity.value > 0.0) {
            this.uIntensity.value = Math.max(0, this.uIntensity.value - delta * 4.0);
        }
    }
}

export class CloudSystem {

    scene: THREE.Scene;
    layers: CloudLayer[] = [];
    lightningTimer: number = 0;
    currentCameraX: number = 0;
    weaponLightManager?: WeaponLightManager;
    uPlayerPos: any;
    flashOverlay: LightningFlashOverlay;

    constructor(scene: THREE.Scene, weaponLightManager?: WeaponLightManager) {
        this.scene = scene;
        this.weaponLightManager = weaponLightManager;
        this.uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
        this.flashOverlay = new LightningFlashOverlay();
        this.initLayers();
    }

    setCamera(camera: THREE.Camera) {
        this.flashOverlay.init(camera);
    }

    setLevel(config: LevelConfig) {
        const baseColor = new THREE.Color(config.skyColors.bottom);
        const cloudDensity = config.foliageDensity?.cloud ?? 20;

        // Base opacity multiplier based on density config (20 is baseline)
        const densityFactor = Math.min(1.0, cloudDensity / 20.0);

        if (this.layers.length >= 5) {
            // Layer 1: Deep Background (Slowest, Faint, Huge)
            this.layers[0].uColor.value.copy(baseColor).lerp(new THREE.Color(0x000000), 0.5); // Very dark
            this.layers[0].uOpacity.value = 0.9 * densityFactor;

            // Layer 2: Background (Dark, slightly faster)
            this.layers[1].uColor.value.copy(baseColor).lerp(new THREE.Color(0x000000), 0.3); // Dark
            this.layers[1].uOpacity.value = 0.8 * densityFactor;

            // Layer 3: Mid-Ground (Main cloud layer, semi-transparent)
            this.layers[2].uColor.value.copy(baseColor).lerp(new THREE.Color(0xffffff), 0.1); // Slightly lighter
            this.layers[2].uOpacity.value = 0.6 * densityFactor;

            // Layer 4: Near-Mid (Lighter, faster)
            this.layers[3].uColor.value.copy(baseColor).lerp(new THREE.Color(0xffffff), 0.3); // Lighter
            this.layers[3].uOpacity.value = 0.4 * densityFactor;

            // Layer 5: Foreground (Passes in front/very close, fast, transparent, detailed)
            this.layers[4].uColor.value.copy(baseColor).lerp(new THREE.Color(0xffffff), 0.5); // Lightest
            this.layers[4].uOpacity.value = 0.2 * densityFactor;
        }

        // Handle fully hiding if density is 0
        const visible = cloudDensity > 0;
        this.layers.forEach(layer => layer.mesh.visible = visible);
    }

    initLayers() {
        // "Thunder Force IV" Style - 5 Layers

        // Layer 1: Deep Background (Slowest, Faint, Huge)
        // Crawls slowly to the left (negative speed)
        this.layers.push(new CloudLayer(this.scene, {
            count: 25,
            z: -80,
            zRange: 20,
            uColor: uniform(new THREE.Color(0x0a0a20)), // Very dark blue
            uOpacity: uniform(0.9),
            scaleMin: 40,
            scaleMax: 60,
            windSpeed: -2.0, // Crawl
            width: 400,
            detail: 0.5,
            weaponLights: this.weaponLightManager ? this.weaponLightManager.storageNode : undefined,
            uPlayerPos: this.uPlayerPos
        }));

        // Layer 2: Background (Dark, slightly faster)
        this.layers.push(new CloudLayer(this.scene, {
            count: 30,
            z: -50,
            zRange: 15,
            uColor: uniform(new THREE.Color(0x151530)),
            uOpacity: uniform(0.8),
            scaleMin: 30,
            scaleMax: 45,
            windSpeed: -3.0,
            width: 350,
            detail: 0.8,
            weaponLights: this.weaponLightManager ? this.weaponLightManager.storageNode : undefined,
            uPlayerPos: this.uPlayerPos
        }));

        // Layer 3: Mid-Ground (Main cloud layer, semi-transparent)
        this.layers.push(new CloudLayer(this.scene, {
            count: 40,
            z: -25,
            zRange: 10,
            uColor: uniform(new THREE.Color(0x2a2a50)),
            uOpacity: uniform(0.6),
            scaleMin: 20,
            scaleMax: 30,
            windSpeed: -5.0,
            width: 300,
            detail: 1.0,
            weaponLights: this.weaponLightManager ? this.weaponLightManager.storageNode : undefined,
            uPlayerPos: this.uPlayerPos
        }));

        // Layer 4: Near-Mid (Lighter, faster)
        this.layers.push(new CloudLayer(this.scene, {
            count: 20,
            z: -10,
            zRange: 5,
            uColor: uniform(new THREE.Color(0x444477)),
            uOpacity: uniform(0.4),
            scaleMin: 15,
            scaleMax: 20,
            windSpeed: -8.0,
            width: 250,
            detail: 1.5,
            weaponLights: this.weaponLightManager ? this.weaponLightManager.storageNode : undefined,
            uPlayerPos: this.uPlayerPos
        }));

        // Layer 5: Foreground (Passes in front/very close, fast, transparent, detailed)
        // Z > 0 (Player is at 0)
        this.layers.push(new CloudLayer(this.scene, {
            count: 10,
            z: 8,
            zRange: 4,
            uColor: uniform(new THREE.Color(0x666699)),
            uOpacity: uniform(0.2),
            scaleMin: 8,
            scaleMax: 12,
            windSpeed: -15.0, // Whoosh
            width: 200,
            detail: 2.0,
            weaponLights: this.weaponLightManager ? this.weaponLightManager.storageNode : undefined,
            uPlayerPos: this.uPlayerPos
        }));
    }

    update(delta: number, cameraX: number, playerSpeed: number, playerPos?: THREE.Vector3) {
        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }
        this.currentCameraX = cameraX;
        this.layers.forEach(layer => layer.update(delta, cameraX));

        // Lightning Logic
        // (Lightning logic moved to external trigger)

        // Update full screen flash
        if (this.flashOverlay) {
            this.flashOverlay.update(delta);
        }

        // Update flash decay
        this.layers.forEach(layer => {
            const mat = layer.mesh.material as any;
            if (mat.userData && mat.userData.uFlash) {
                const current = mat.userData.uFlash.value;
                if (current > 0.01) {
                    mat.userData.uFlash.value = current * 0.85;
                } else {
                    mat.userData.uFlash.value = 0;
                }
            }
        });
    }

    triggerLightningAt(strikePos: THREE.Vector3, lightningColor?: THREE.Color) {
        if (this.layers.length === 0) return;

        // Find the closest layer by Z distance to the strike
        let closestLayerIdx = 0;
        let minZDist = Infinity;
        for (let i = 0; i < this.layers.length; i++) {
            const dist = Math.abs(this.layers[i].baseZ - strikePos.z);
            if (dist < minZDist) {
                minZDist = dist;
                closestLayerIdx = i;
            }
        }

        const layer = this.layers[closestLayerIdx];
        const radius = 60.0 + Math.random() * 40.0; // Large radius
        const intensity = 0.8 + Math.random() * 0.4;

        layer.flash(strikePos, radius, intensity, lightningColor);

        // Trigger full screen flash overlay
        if (this.flashOverlay) {
            this.flashOverlay.uIntensity.value = intensity;
        }

        // Chain reaction (flash nearby layers)
        if (Math.random() > 0.5 && closestLayerIdx < this.layers.length - 1) {
            // Flash next layer with slightly different position/intensity
            const nextLayer = this.layers[closestLayerIdx + 1];
            // Slightly offset z for 3D feel
            const nextPos = strikePos.clone();
            nextPos.z = nextLayer.baseZ;

            setTimeout(() => nextLayer.flash(nextPos, radius * 0.8, intensity * 0.5, lightningColor), 100);
        }
    }
}
