import * as THREE from 'three';
import {
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    time,
    uv,
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
    positionWorld,
    length
} from 'three/tsl';
import { WeaponLightManager } from './lighting';

export type AuroraConfig = {
    enabled: boolean;
    color1: number;
    color2: number;
    speed: number;
    density: number;
};

/**
 * Creates a TSL material for an Aurora Borealis ribbon.
 * Features procedural sine-wave distortion and color blending.
 */
function createAuroraMaterial(weaponLights?: any, uPlayerPos?: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const uTime = time;
    const uColor1 = uniform(new THREE.Color(0x00ffff));
    const uColor2 = uniform(new THREE.Color(0xff00ff));
    const uIntensity = uniform(1.0);
    const uSpeed = uniform(1.0);

    const vUv = uv();

    // 1. Procedural Shape and Wiggle
    const t = uTime.mul(uSpeed);

    // Wave pattern for alpha and color mixing
    const wave1 = sin(vUv.x.mul(10.0).add(t));
    const wave2 = cos(vUv.x.mul(20.0).sub(t.mul(1.5)));
    const wave3 = sin(vUv.y.mul(5.0).add(t.mul(0.5)));

    const combinedWave = wave1.add(wave2).mul(0.5).add(wave3).mul(0.5);

    // 2. Vertical Fading (Fade out at top and bottom)
    const fadeY = smoothstep(0.0, 0.3, vUv.y).mul(smoothstep(1.0, 0.7, vUv.y));

    // 3. Horizontal Fading (Fade out at edges)
    const fadeX = smoothstep(0.0, 0.1, vUv.x).mul(smoothstep(1.0, 0.9, vUv.x));

    // Calculate final alpha
    const baseAlpha = combinedWave.add(1.0).mul(0.25); // Map to ~0.0-0.5
    const finalAlpha = baseAlpha.mul(fadeY).mul(fadeX).mul(uIntensity);

    // Color mixing based on wave and vertical position
    const colorMix = sin(vUv.x.mul(5.0).add(t)).mul(0.5).add(0.5);
    const finalColor = mix(color(uColor1), color(uColor2), colorMix);


    // 4. Dynamic Lighting Interaction
    let finalColorWithInteraction = finalColor;

    // Player Engine Glow Interaction
    if (uPlayerPos) {
        const distToPlayer = length(positionWorld.sub(uPlayerPos));
        // Add a subtle brightening when player is nearby
        const playerGlow = smoothstep(150.0, 0.0, distToPlayer).mul(0.3);
        finalColorWithInteraction = finalColorWithInteraction.add(vec3(0.5, 0.8, 1.0).mul(playerGlow));
    }

    // Weapon Projectile Interactions
    if (weaponLights) {
        for (let i = 0; i < 10; i++) {
            const lightPos = weaponLights.positions[i];
            const lightColor = weaponLights.colors[i];
            const dist = length(positionWorld.sub(lightPos));

            // Plasma storm reacts intensely to nearby projectiles
            const lightFactor = smoothstep(80.0, 0.0, dist).mul(1.5);
            finalColorWithInteraction = finalColorWithInteraction.add(lightColor.mul(lightFactor));
        }
    }

    mat.colorNode = vec4(finalColorWithInteraction, finalAlpha);


    // Procedural geometry distortion (waving ribbons)
    const zOffset = sin(positionLocal.x.mul(0.05).add(t)).mul(10.0);
    const yOffset = cos(positionLocal.x.mul(0.02).add(t.mul(0.8))).mul(5.0);

    mat.positionNode = vec3(positionLocal.x, positionLocal.y.add(yOffset), positionLocal.z.add(zOffset));

    mat.userData.uColor1 = uColor1;
    mat.userData.uColor2 = uColor2;
    mat.userData.uIntensity = uIntensity;
    mat.userData.uSpeed = uSpeed;

    return mat;
}

export class AuroraSystem {
    weaponLightManager?: WeaponLightManager;
    uPlayerPos: any;
    scene: THREE.Scene;
    active: boolean = false;

    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    maxCount: number = 10; // Number of overlapping ribbons

    positions: Float32Array;
    scales: Float32Array;

    currentConfig: AuroraConfig | null = null;
    globalIntensity: number = 0.0;

    constructor(scene: THREE.Scene, weaponLightManager?: WeaponLightManager) {
        this.weaponLightManager = weaponLightManager;
        this.uPlayerPos = uniform(new THREE.Vector3(9999, 9999, 9999));
        this.scene = scene;

        // Long, curved ribbon base geometry
        const geo = new THREE.PlaneGeometry(800, 100, 64, 8);
        const weaponLights = this.weaponLightManager ? this.weaponLightManager.getUniforms() : undefined;
        const mat = createAuroraMaterial(weaponLights, this.uPlayerPos);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.maxCount);
        this.mesh.frustumCulled = false;

        // Deep background
        this.mesh.renderOrder = -2;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.maxCount * 3);
        this.scales = new Float32Array(this.maxCount);

        for (let i = 0; i < this.maxCount; i++) {
            this.scales[i] = 0.8 + Math.random() * 0.4;

            // Distribute ribbons in Z and slightly in Y
            this.positions[i*3] = (Math.random() - 0.5) * 400; // X offset
            this.positions[i*3+1] = 60 + Math.random() * 40; // High up in the sky
            this.positions[i*3+2] = -150 - Math.random() * 100; // Deep Z
        }

        scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: AuroraConfig) {
        if (config) {
            this.currentConfig = config;

            const mat = this.mesh.material as any;
            if (mat.userData) {
                if (mat.userData.uColor1) mat.userData.uColor1.value.setHex(config.color1);
                if (mat.userData.uColor2) mat.userData.uColor2.value.setHex(config.color2);
            }

            this.mesh.count = Math.max(1, Math.floor(this.maxCount * config.density));
        }

        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
        this.globalIntensity = 0.0; // Fade in
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        // Let update() fade it out
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8.0, playerPos?: THREE.Vector3) {
        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }
        const targetIntensity = this.active && this.currentConfig ? 1.0 : 0.0;

        if (Math.abs(this.globalIntensity - targetIntensity) > 0.01) {
            this.globalIntensity += (targetIntensity - this.globalIntensity) * delta;
        } else {
            this.globalIntensity = targetIntensity;
            if (!this.active && this.globalIntensity <= 0.01) {
                this.mesh.visible = false;
                return;
            }
        }

        if (this.globalIntensity <= 0.01 && !this.active) return;

        const mat = this.mesh.material as any;
        if (mat.userData) {
            if (mat.userData.uIntensity) mat.userData.uIntensity.value = this.globalIntensity;

            // Speed up the wave animation when the player is moving fast
            const baseSpeed = this.currentConfig ? this.currentConfig.speed : 1.0;
            const speedBoost = Math.max(0, (playerSpeed - 10.0) / 10.0);
            if (mat.userData.uSpeed) mat.userData.uSpeed.value = baseSpeed + speedBoost * 0.5;
        }

        // Infinite wrapping and parallax
        const margin = 400;
        const width = 800; // Match geometry width
        const limitBack = cameraX - margin;
        const limitFront = cameraX + margin;

        let needsUpdate = false;

        for (let i = 0; i < this.mesh.count; i++) {
            const idx = i * 3;
            let baseX = this.positions[idx];

            if (baseX < limitBack) {
                baseX += width + margin;
                this.positions[idx] = baseX;
                needsUpdate = true;
            } else if (baseX > limitFront) {
                baseX -= (width + margin);
                this.positions[idx] = baseX;
                needsUpdate = true;
            }

            // Parallax based on Z depth
            const zDist = Math.abs(this.positions[idx+2]);
            const parallaxFactor = Math.min(1.0, zDist / 300.0);
            let x = baseX + (cameraX - baseX) * parallaxFactor;

            this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);

            // Give each ribbon a slight different tilt
            this.dummy.rotation.z = Math.sin(i * 1.5) * 0.1;

            const s = this.scales[i];
            this.dummy.scale.set(s, s, 1.0);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true;
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}
