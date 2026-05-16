import * as THREE from 'three';
import {
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    time,
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
    smoothstep,
    positionLocal,
    distance
} from 'three/tsl';

export type GodRayConfig = {
    enabled: boolean;
    density: number;        // 0-1
    baseIntensity: number;
    color: number;
    speedMultiplier: number;
};

/**
 * Creates a TSL material for a God Ray (Light Shaft).
 * Additive blending, fading at edges, procedural drifting.
 */
function createGodRayMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const uTime = time;
    const uColor = uniform(new THREE.Color(0xffffff));
    const uIntensity = uniform(1.0);
    const vUv = uv();

    // 1. Core Shape (Soft edges on X, fade out on Y)
    // UV x goes 0 -> 1 across the width
    // UV y goes 0 -> 1 along the length (0 is top/source, 1 is bottom/fade)

    // Fade edges horizontally (bell curve)
    const distToCenter = float(0.5).sub(vUv.x).abs().mul(2.0); // 0 at center, 1 at edge
    const xFade = float(1.0).sub(distToCenter); // 1 at center, 0 at edge
    const softX = smoothstep(0.0, 1.0, xFade);

    // Fade out vertically (fade out at the bottom where UV.y -> 0)
    const softY = smoothstep(0.0, 0.8, vUv.y);

    const baseShape = softX.mul(softY);

    // 2. Procedural Animation (Swaying and Pulsing)
    // Add subtle wave over time to make it feel "alive" or dusty
    const noiseSpeed = uTime.mul(0.5);
    const sway = sin(vUv.y.mul(5.0).add(noiseSpeed)).mul(0.1);
    // (Sway is calculated for potential future vertex displacement, but currently unused to keep instance matrix simple)

    // We can't easily move vertices here without breaking the instance matrix simplicity,
    // so we'll just animate the brightness for a "shimmer" effect
    const shimmer = sin(vUv.y.mul(10.0).sub(uTime.mul(2.0))).mul(0.2).add(0.8);

    const finalAlpha = baseShape.mul(shimmer).mul(uIntensity);

    mat.colorNode = vec4(uColor, finalAlpha);

    mat.userData.uColor = uColor;
    mat.userData.uIntensity = uIntensity;

    return mat;
}

export class GodRaySystem {
    scene: THREE.Scene;
    active: boolean = false;

    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    maxCount: number = 20;

    positions: Float32Array;
    scales: Float32Array;
    baseIntensities: Float32Array;

    currentConfig: GodRayConfig | null = null;
    globalIntensity: number = 0.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Long soft quad geometry
        const geo = new THREE.PlaneGeometry(5, 50, 1, 1);

        // Move pivot to the top of the quad (y = 25)
        geo.translate(0, -25, 0);

        const mat = createGodRayMaterial();

        this.mesh = new THREE.InstancedMesh(geo, mat, this.maxCount);
        this.mesh.frustumCulled = false;

        // Render between background clouds and foreground
        this.mesh.renderOrder = -1;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.maxCount * 3);
        this.scales = new Float32Array(this.maxCount);
        this.baseIntensities = new Float32Array(this.maxCount);

        for (let i = 0; i < this.maxCount; i++) {
            this.baseIntensities[i] = 0.3 + Math.random() * 0.7;
            this.scales[i] = 0.5 + Math.random() * 1.5;

            // Randomly position far ahead initially
            this.positions[i*3] = (Math.random() - 0.5) * 400;
            this.positions[i*3+1] = 40 + Math.random() * 20; // High up
            this.positions[i*3+2] = -40 + Math.random() * 60; // Spread in Z
        }

        scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: GodRayConfig) {
        if (config) {
            this.currentConfig = config;

            // Apply color
            const mat = this.mesh.material as any;
            if (mat.userData && mat.userData.uColor) {
                mat.userData.uColor.value.setHex(config.color);
            }

            // Set active instances based on density
            this.mesh.count = Math.floor(this.maxCount * config.density);
        }

        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
        this.globalIntensity = 0.0; // Fade in
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        // Don't hide immediately, let update() fade it out
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8.0) {
        // Handle Fading
        const targetIntensity = this.active && this.currentConfig ? this.currentConfig.baseIntensity : 0.0;

        if (Math.abs(this.globalIntensity - targetIntensity) > 0.01) {
            this.globalIntensity += (targetIntensity - this.globalIntensity) * delta * 2.0;
        } else {
            this.globalIntensity = targetIntensity;
            if (!this.active && this.globalIntensity <= 0.01) {
                this.mesh.visible = false;
                return;
            }
        }

        if (this.globalIntensity <= 0.01 && !this.active) return;

        // Speed reactivity: Dashing increases intensity
        const speedBoost = Math.max(0, (playerSpeed - 10.0) / 10.0); // > 10 adds intensity
        const finalIntensity = this.globalIntensity * (1.0 + speedBoost * 0.5);

        const mat = this.mesh.material as any;
        if (mat.userData && mat.userData.uIntensity) {
            mat.userData.uIntensity.value = finalIntensity;
        }

        // Parallax and Wrapping
        const margin = 100;
        const width = 400;
        const limitBack = cameraX - (width / 2) - margin;
        const limitFront = cameraX + (width / 2) + margin;

        let needsUpdate = false;

        for (let i = 0; i < this.mesh.count; i++) {
            const idx = i * 3;
            let x = this.positions[idx];

            // Wrap
            if (x < limitBack) {
                x += width + margin * 2;
                this.positions[idx] = x;

                // Randomize a bit on wrap
                this.positions[idx+2] = -40 + Math.random() * 60;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            // Animate angle slightly (Drifting light)
            const angle = Math.PI / 8 + Math.sin(Date.now() * 0.001 + i) * 0.1;

            this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
            this.dummy.rotation.set(0, 0, -angle); // Slant right

            const s = this.scales[i];
            this.dummy.scale.set(s, s, 1.0);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true; // Always update for rotation if active
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}
