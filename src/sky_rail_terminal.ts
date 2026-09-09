import * as THREE from 'three';
import { disposeObject } from './utils';
import { time, color, uniform, sin, positionWorld, length, uv, smoothstep } from 'three/tsl';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';

export interface SkyRailConfig {
    density?: number;
    speed?: number;
}

export class SkyRailTerminalSystem {
    scene: THREE.Scene;
    active: boolean = false;
    railMesh!: THREE.InstancedMesh;
    terminalMesh!: THREE.InstancedMesh;
    railCount: number = 60;
    terminalCount: number = 10;
    levelDistance: number = 3000;

    // TSL Uniforms
    uTime: any;
    uPlayerPos: any;
    uInteractionRadius: any;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.uTime = uniform(0);
        this.uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
        this.uInteractionRadius = uniform(40.0);

        this.initRails();
        this.initTerminals();

        this.deactivate();
    }

    private initRails() {
        const geo = new THREE.CylinderGeometry(0.5, 0.5, 30, 8);
        geo.rotateZ(Math.PI / 2);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        // Glowing neon cyan/blue effect
        const baseColor = color(0x00ffff);
        const pulse = sin(this.uTime.mul(2.0).add(positionWorld.x.mul(0.1))).mul(0.5).add(0.5);

        // Player glow interaction
        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        const glowIntensity = smoothstep(this.uInteractionRadius, 0.0, distToPlayer);

        const finalColor = baseColor.mul(pulse.add(0.5)).add(color(0xffffff).mul(glowIntensity));
        mat.colorNode = finalColor;

        this.railMesh = new THREE.InstancedMesh(geo, mat, this.railCount);
        this.railMesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.railCount; i++) {
            const x = (Math.random() - 0.5) * 400;
            const y = (Math.random() - 0.5) * 40;
            const z = -20 - Math.random() * 80;

            dummy.position.set(x, y, z);
            // Slightly angled rails
            dummy.rotation.z = (Math.random() - 0.5) * 0.2;
            dummy.scale.set(1 + Math.random() * 2, 1, 1);
            dummy.updateMatrix();
            this.railMesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(this.railMesh);
    }

    private initTerminals() {
        const geo = new THREE.BoxGeometry(10, 20, 10);

        const mat = new MeshStandardNodeMaterial({
            roughness: 0.2,
            metalness: 0.8,
            transparent: true,
            opacity: 0.8,
            depthWrite: true
        });

        const baseColor = color(0x222244);

        // Player light interaction
        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        const lightIntensity = smoothstep(this.uInteractionRadius.mul(1.5), 0.0, distToPlayer);

        mat.colorNode = baseColor.add(color(0x00ffff).mul(lightIntensity.mul(0.5)));
        // Add neon strips to the terminals using UVs
        const vUv = uv();
        const strip = smoothstep(0.45, 0.5, vUv.y).sub(smoothstep(0.5, 0.55, vUv.y));
        mat.emissiveNode = color(0x00ffff).mul(strip).mul(sin(this.uTime.mul(4.0)).mul(0.5).add(0.5));

        this.terminalMesh = new THREE.InstancedMesh(geo, mat, this.terminalCount);
        this.terminalMesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.terminalCount; i++) {
            const x = (Math.random() - 0.5) * 400;
            const y = -10 + (Math.random() - 0.5) * 30;
            const z = -40 - Math.random() * 60;

            dummy.position.set(x, y, z);
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.scale.setScalar(1 + Math.random());
            dummy.updateMatrix();
            this.terminalMesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(this.terminalMesh);
    }

    activate(config?: SkyRailConfig) {
        if (this.active) return;
        this.active = true;
        this.railMesh.visible = true;
        this.terminalMesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.railMesh.visible = false;
        this.terminalMesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        this.uTime.value += delta;
        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        const width = 400;
        const margin = 50;
        const limitBack = cameraX - (width / 2) - margin;
        const limitFront = cameraX + (width / 2) + margin;

        const dummy = new THREE.Object3D();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();

        // Parallax and wrap for rails
        for (let i = 0; i < this.railCount; i++) {
            this.railMesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(position, quaternion, scale);

            // Parallax effect based on Z depth
            const speed = 1.0 + (position.z / 100);
            position.x -= delta * 50 * speed;

            if (position.x < limitBack) {
                position.x += width + margin * 2;
                position.y = (Math.random() - 0.5) * 40;
            }

            dummy.position.copy(position);
            dummy.quaternion.copy(quaternion);
            dummy.scale.copy(scale);
            dummy.updateMatrix();
            this.railMesh.setMatrixAt(i, dummy.matrix);
        }
        this.railMesh.instanceMatrix.needsUpdate = true;

        // Parallax and wrap for terminals
        for (let i = 0; i < this.terminalCount; i++) {
            this.terminalMesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(position, quaternion, scale);

            const speed = 1.0 + (position.z / 100);
            position.x -= delta * 20 * speed;

            if (position.x < limitBack) {
                position.x += width + margin * 2;
                position.y = -10 + (Math.random() - 0.5) * 30;
            }

            dummy.position.copy(position);
            dummy.quaternion.copy(quaternion);
            dummy.scale.copy(scale);
            dummy.updateMatrix();
            this.terminalMesh.setMatrixAt(i, dummy.matrix);
        }
        this.terminalMesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        if (this.railMesh) {
            this.scene.remove(this.railMesh);
            disposeObject(this.railMesh);
        }
        if (this.terminalMesh) {
            this.scene.remove(this.terminalMesh);
            disposeObject(this.terminalMesh);
        }
    }
}
