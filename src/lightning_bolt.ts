import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time,
    positionLocal,
    uv,
    vec3,
    vec4,
    color,
    uniform,
    mix,
    sin,
    cos,
    float,
    step,
    abs,
    normalView,
    positionWorld,
    length,
    distance,
    Loop,
    smoothstep
} from 'three/tsl';
import { WeaponLightManager } from './lighting';

/**
 * Creates a TSL material for jagged lightning bolts.
 */

function createLightningMaterial(uColor: any, weaponLights?: any, uPlayerPos?: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const vUv = uv();

    const y = vUv.y;
    const x = vUv.x;

    const uTime = time;

    // Advanced procedural jagged offset for volumetric core
    const wave1 = sin(y.mul(20.0).add(uTime.mul(50.0))).mul(2.0);
    const wave2 = sin(y.mul(45.0).sub(uTime.mul(35.0))).mul(1.5);
    const wave3 = sin(y.mul(120.0).add(uTime.mul(90.0))).mul(0.6);
    const totalOffsetX = wave1.add(wave2).add(wave3);

    const waveZ1 = sin(y.mul(25.0).add(uTime.mul(45.0))).mul(2.0);
    const waveZ2 = sin(y.mul(35.0).sub(uTime.mul(25.0))).mul(1.2);
    const waveZ3 = sin(y.mul(110.0).sub(uTime.mul(85.0))).mul(0.5);
    const totalOffsetZ = waveZ1.add(waveZ2).add(waveZ3);

    // Chaotic branching
    const branchWave1 = abs(sin(y.mul(30.0).add(uTime.mul(40.0)))).mul(3.5).mul(y);
    const branchWave2 = abs(sin(y.mul(65.0).sub(uTime.mul(70.0)))).mul(2.0).mul(y);
    const branchWave3 = abs(cos(y.mul(90.0).add(uTime.mul(100.0)))).mul(1.0).mul(y);

    const sideFactorX = sin(x.mul(Math.PI * 2.0));
    const sideFactorZ = sin(x.mul(Math.PI * 2.0).add(Math.PI * 0.5));

    const branchX = branchWave1.add(branchWave3).mul(sideFactorX);
    const branchZ = branchWave2.add(branchWave3).mul(sideFactorZ);

    mat.positionNode = vec3(
        positionLocal.x.add(totalOffsetX).add(branchX),
        positionLocal.y,
        positionLocal.z.add(totalOffsetZ).add(branchZ)
    );

    // Volumetric ray-marched approximation based on distance from core
    const distFromCenter = abs(x.sub(0.5)).mul(2.0); // 0 at center, 1 at edges
    const coreDensity = float(1.0).sub(distFromCenter); // 1 at center, 0 at edges
    const viewDot = normalView.z.abs();

    // Combine view normal and center distance for volumetric falloff
    const volumetricFalloff = coreDensity.mul(viewDot);

    // High-frequency energy crackle
    const flashPulse = sin(uTime.mul(60.0)).mul(0.4).add(0.6);
    const crackleNoise = sin(y.mul(150.0).add(uTime.mul(120.0))).mul(0.2).add(0.8);
    const glowIntensity = flashPulse.mul(crackleNoise);

    const coreColor = color(0xffffff);
    const edgeColor = color(uColor);

    // Color gradient based on volumetric density
    let colorMix: any = mix(edgeColor, coreColor, volumetricFalloff.pow(2.0));

    // Dynamic Lighting Interaction
    if (uPlayerPos) {
        const distToPlayer = length(positionWorld.sub(uPlayerPos));
        const playerGlow = smoothstep(0.0, 120.0, distToPlayer).oneMinus().mul(0.6);
        colorMix = colorMix.add(vec3(0.5, 0.8, 1.0).mul(playerGlow));
    }

    if (weaponLights) {
        const weaponGlow = float(0.0).toVar();
        Loop({ start: 0, end: 20 }, ({ i }) => {
            const lightData = weaponLights.element(i);
            const lightPos = lightData.xyz;
            const lightIntensity = lightData.w;
            const distToLight = distance(positionWorld, lightPos);
            const lightFactor = smoothstep(0.0, 100.0, distToLight).oneMinus().mul(lightIntensity).mul(1.8);
            weaponGlow.addAssign(lightFactor);
        });
        colorMix = colorMix.add(vec3(0.0, 1.0, 1.0).mul(weaponGlow));
    }

    // Advanced alpha blending for volumetric scattering
    // Soft core fading exponentially, combined with energy fluctuations
    const alpha = volumetricFalloff.pow(1.5).mul(glowIntensity).mul(1.2).clamp(0.0, 1.0);

    mat.colorNode = vec4(colorMix, alpha);

    return mat;
}


export class LightningBoltSystem {
    weaponLightManager?: WeaponLightManager;
    uPlayerPos: any = uniform(new THREE.Vector3(0,0,0));
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number = 10;

    positions: Float32Array;
    timers: Float32Array;
    baseScaleX: Float32Array;
    baseScaleY: Float32Array;
    onBoltStrike?: (position: THREE.Vector3, color: THREE.Color) => void;
    currentDensity: number = 1.0;

    constructor(scene: THREE.Scene, weaponLightManager?: WeaponLightManager) {
        this.scene = scene;
        this.weaponLightManager = weaponLightManager;

        // Use a wide plane to allow the jagged line to draw within it
        const geo = new THREE.CylinderGeometry(0.5, 0.5, 40, 8, 32);
        const uColor = uniform(new THREE.Color(0x88bbff));
        const weaponLights = this.weaponLightManager ? this.weaponLightManager.storageNode : undefined;
        const mat = createLightningMaterial(uColor, weaponLights, this.uPlayerPos) as any;
        mat.userData = mat.userData || {};
        mat.userData.uColor = uColor;

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;
        // Background order but above deep clouds
        this.mesh.renderOrder = -1;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.timers = new Float32Array(this.count);
        this.baseScaleX = new Float32Array(this.count);
        this.baseScaleY = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            this.positions[i * 3] = 0;
            this.positions[i * 3 + 1] = 0;
            this.positions[i * 3 + 2] = 0;
            this.timers[i] = 0; // 0 means inactive

            // Hide initially by scaling to 0
            this.dummy.scale.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: { color?: number, density?: number }) {
        if (config && config.color !== undefined) {
            const mat = this.mesh.material as any;
            if (mat.userData && mat.userData.uColor) {
                mat.userData.uColor.value.setHex(config.color);
            }
        } else {
            const mat = this.mesh.material as any;
            if (mat.userData && mat.userData.uColor) {
                mat.userData.uColor.value.setHex(0x88bbff); // Default blue
            }
        }
        this.currentDensity = config?.density ?? 1.0;
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8.0, playerPos?: THREE.Vector3) {
        if (playerPos) this.uPlayerPos.value.copy(playerPos);
        if (!this.active) return;

        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            if (this.timers[i] > 0) {
                this.timers[i] -= delta;

                if (this.timers[i] <= 0) {
                    this.timers[i] = 0;
                    this.dummy.scale.set(0, 0, 0);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                } else {
                    // Volumetric fade out
                    const fade = Math.min(1.0, this.timers[i] * 3.0);
                    this.mesh.getMatrixAt(i, this.dummy.matrix);
                    this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);
                    this.dummy.scale.set(this.baseScaleX[i] * fade, this.baseScaleY[i], 1.0);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                }
            } else {
                const speedBoost = Math.max(0, (playerSpeed - 10) * 0.1);
                if (Math.random() < 0.005 * this.currentDensity * (1.0 + speedBoost)) {
                    this.timers[i] = 0.2 + Math.random() * 0.3; // Visible for 0.2-0.5s

                    const x = cameraX + (Math.random() - 0.5) * 200;
                    const y = (Math.random() - 0.5) * 20 + 10; // High up
                    const z = -30 + (Math.random() - 0.5) * 20; // Background

                    if (this.onBoltStrike) {
                        const mat = this.mesh.material as any;
                        const strikeColor = mat.userData && mat.userData.uColor ? mat.userData.uColor.value : new THREE.Color(0x88bbff);
                        this.onBoltStrike(new THREE.Vector3(x, y, z), strikeColor);
                    }

                    this.positions[i * 3] = x;
                    this.positions[i * 3 + 1] = y;
                    this.positions[i * 3 + 2] = z;

                    this.dummy.position.set(x, y, z);

                    const scaleX = 1.0 + Math.random() * 2.5;
                    const scaleY = 1.0 + Math.random() * 2.0;
                    this.baseScaleX[i] = scaleX;
                    this.baseScaleY[i] = scaleY;
                    this.dummy.scale.set(scaleX, scaleY, 1.0);

                    this.dummy.rotation.set(0, 0, (Math.random() - 0.5) * 0.5);

                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                }
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as any).dispose?.();
    }
}
