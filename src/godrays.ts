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
    distance,
    normalView,
    length,
    add,
    mul,
    positionWorld
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
    const uPlayerPos = uniform(new THREE.Vector3(9999, 9999, 9999));
    const uDashIntensity = uniform(0.0);
    const uWeaponFireTime = uniform(0.0);
    const uFireDir = uniform(new THREE.Vector3(0, 0, -1));
    const vUv = uv();

    const viewZ = normalView.z.abs();
    const softX = smoothstep(0.0, 0.5, viewZ);
    const softY = smoothstep(0.0, 0.8, vUv.y);
    const baseShape = softX.mul(softY);

    // Multi-layer noise
    // Fallback pseudo-noise if 'noise' is not available
    const shimmer = sin(vUv.y.mul(10.0).sub(uTime.mul(2.0))).mul(0.2).add(0.8);
    const shimmer2 = cos(vUv.x.mul(Math.PI * 2.0).add(uTime)).mul(0.1).add(0.9);
    const layeredNoise = shimmer.mul(shimmer2);

    const sway = sin(uTime.mul(2).add(positionLocal.x)).mul(0.015).mul(uDashIntensity.add(0.3));


    // Weapon fire boost
    const depthAttenuation = positionWorld.z.mul(-0.01).clamp(0, 1);

    const fireBurst = uWeaponFireTime.mul(uWeaponFireTime).mul(1.8);

    // Dynamic Player Interaction
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlow = float(1.0).sub(smoothstep(0.0, 20.0, distToPlayer)).mul(0.5);

    // Final color + alpha
    const rayColor = vec3(uColor).mul(float(0.6).add(fireBurst.mul(0.8)));

    // Combining the fireBurst, dash, and existing logic
    const baseAlpha = baseShape.mul(layeredNoise).mul(uIntensity.add(playerGlow));

    const enhancedAlpha = layeredNoise.mul(0.4)
      .add(fireBurst.mul(0.6))
      // .mul(depthAttenuation)
      .mul(float(0.7).add(uDashIntensity.mul(0.3)));

    const finalAlpha = baseAlpha.mul(enhancedAlpha).clamp(0, 1);

    mat.colorNode = vec4(rayColor, finalAlpha);

    mat.positionNode = vec3(positionLocal.x.add(sway.mul(15.0)), positionLocal.y, positionLocal.z);

    mat.userData.uColor = uColor;
    mat.userData.uIntensity = uIntensity;
    mat.userData.uPlayerPos = uPlayerPos;
    mat.userData.uDashIntensity = uDashIntensity;
    mat.userData.uWeaponFireTime = uWeaponFireTime;
    mat.userData.uFireDir = uFireDir;

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
    lightningSpike: number = 0.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Long soft quad geometry
        const geo = new THREE.CylinderGeometry(1.5, 6, 50, 16, 1, true);

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

    triggerLightningFlash(intensity: number = 1.0) {
        if (this.active) {
            this.lightningSpike = intensity;
        }
    }

    private weaponFireTime = 0;
    private dashIntensity = 0;

    update(delta: number, cameraX: number, playerSpeed: number = 8.0, playerPos?: THREE.Vector3, isFiring: boolean = false, fireDirection?: THREE.Vector3) {

        this.weaponFireTime = isFiring ? 1.0 : Math.max(0, this.weaponFireTime - delta * 2.0);
        const playerVelLength = Math.abs(playerSpeed);
        this.dashIntensity = Math.max(this.dashIntensity - delta * 1.5, playerVelLength > 15 ? 0.8 : 0);

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

        // Lightning reactivity
        const activeLightningSpike = this.lightningSpike;
        this.lightningSpike = Math.max(0, this.lightningSpike - delta * 3.0);

        const finalIntensity = this.globalIntensity * (1.0 + speedBoost * 0.5) + activeLightningSpike * 0.5;

        const mat = this.mesh.material as any;
        if (mat.userData && mat.userData.uIntensity) {
            mat.userData.uIntensity.value = finalIntensity;
        }


        if (playerPos && mat && mat.userData && mat.userData.uPlayerPos) {
            mat.userData.uPlayerPos.value.copy(playerPos);
        }

        if (mat && mat.userData) {
            if (mat.userData.uDashIntensity) mat.userData.uDashIntensity.value = this.dashIntensity;
            if (mat.userData.uWeaponFireTime) mat.userData.uWeaponFireTime.value = this.weaponFireTime;
            if (mat.userData.uFireDir && fireDirection) mat.userData.uFireDir.value.copy(fireDirection);
        }


        // Parallax and Wrapping
        const margin = 100;
        const width = 400;
        const limitBack = cameraX - (width / 2) - margin;
        const limitFront = cameraX + (width / 2) + margin;

        let needsUpdate = false;

        for (let i = 0; i < this.mesh.count; i++) {
            const idx = i * 3;
            let baseX = this.positions[idx];

            // Wrap base position
            if (baseX < limitBack) {
                baseX += width + margin * 2;
                this.positions[idx] = baseX;

                // Randomize a bit on wrap
                this.positions[idx+2] = -40 + Math.random() * 60;
                needsUpdate = true;
            } else if (baseX > limitFront) {
                baseX -= (width + margin * 2);
                this.positions[idx] = baseX;
                needsUpdate = true;
            }

            // Calculate parallax-adjusted X position
            // Farther back (more negative Z) means it scrolls slower relative to the camera
            const zDist = Math.abs(this.positions[idx+2]);
            const parallaxFactor = Math.min(1.0, zDist / 200.0);
            let x = baseX + (cameraX - baseX) * parallaxFactor;

            // Animate angle dynamically relative to camera (simulate distant light source)
            const angle = Math.PI / 8 + Math.sin(Date.now() * 0.001 + i) * 0.1 + (x - cameraX) * 0.002;

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
