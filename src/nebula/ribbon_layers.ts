import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { createRibbonVeilMaterial } from './materials_butterfly_ribbon';

export interface NebulaRibbonLayerConfig {
    count: number;
    width: number;
    height: number;
    baseZ: number;
    zSpread: number;
    ribbonWidth: number;
    ribbonHeight: number;
    opacity: number;
    parallaxFactor: number;
    driftSpeed: number;
    topColor: number;
    bottomColor: number;
    uvPhase: number;
}

/**
 * One instanced ribbon layer — long semi-transparent sheets at a fixed depth band.
 * Background only — ignore for collision and interaction systems.
 */
export class NebulaRibbonLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    readonly count: number;
    readonly width: number;
    readonly baseZ: number;
    readonly parallaxFactor: number;
    readonly driftSpeed: number;
    private positions: Float32Array;
    private phases: Float32Array;
    private scales: Float32Array;

    constructor(scene: THREE.Scene, config: NebulaRibbonLayerConfig) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.baseZ;
        this.parallaxFactor = config.parallaxFactor;
        this.driftSpeed = config.driftSpeed;

        const geo = new THREE.PlaneGeometry(1, 1, 1, 2);
        const mat = createRibbonVeilMaterial(
            config.topColor,
            config.bottomColor,
            config.opacity,
            config.uvPhase
        );

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -6;
        this.mesh.userData.backgroundOnly = true;
        this.mesh.userData.skipCollision = true;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.phases = new Float32Array(this.count);
        this.scales = new Float32Array(this.count * 2);

        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.height;
            const z = config.baseZ + (Math.random() - 0.5) * config.zSpread;
            const w = config.ribbonWidth * (0.75 + Math.random() * 0.5);
            const h = config.ribbonHeight * (0.7 + Math.random() * 0.6);

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;
            this.phases[i] = Math.random() * Math.PI * 2;
            this.scales[i * 2] = w;
            this.scales[i * 2 + 1] = h;

            this.dummy.position.set(x, y, z);
            this.dummy.scale.set(w, h, 1);
            this.dummy.rotation.set(
                (Math.random() - 0.5) * 0.35,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.25
            );
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        scene.add(this.mesh);
    }

    setSkyColors(topHex: number, bottomHex: number): void {
        const mat = this.mesh.material as MeshBasicNodeMaterial & { userData: Record<string, unknown> };
        (mat.userData.uTop as { value: THREE.Color }).value.setHex(topHex);
        (mat.userData.uBottom as { value: THREE.Color }).value.setHex(bottomHex);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8): void {
        const margin = 60;
        const limitBack = cameraX - this.width / 2 - margin;
        const limitFront = cameraX + this.width / 2 + margin;
        const scroll = delta * (this.driftSpeed + playerSpeed * this.parallaxFactor * 0.06);
        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;
            let x = this.positions[idx] - scroll;
            const phase = this.phases[i];

            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx + 1] = (Math.random() - 0.5) * 50;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= this.width + margin * 2;
                this.positions[idx + 1] = (Math.random() - 0.5) * 50;
                needsUpdate = true;
            }

            this.positions[idx] = x;
            const y = this.positions[idx + 1] + Math.sin(phase + cameraX * 0.004) * 1.8;
            const z = this.positions[idx + 2];

            this.dummy.position.set(x, y, z);
            this.dummy.scale.set(this.scales[i * 2], this.scales[i * 2 + 1], 1);
            this.dummy.rotation.z = Math.sin(phase + cameraX * 0.002) * 0.08;
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true;
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}
