import * as THREE from 'three';
import { vec2, color, uv, sin, smoothstep, time, mix, length, vec3, abs } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export type ChronoTesseractsConfig = {
    density?: number;
    speed?: number;
    color1?: number;
    color2?: number;
};

const MAX_CUBES = 25;
const BUDGET_ID = 'chronoTesseracts';
const SPREAD_X = 6000;
const SPREAD_Y = 1500;
const WORLD_SCROLL = 5;

type Tesseract = {
    x: number;
    y: number;
    z: number;
    scale: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
    rotSpeedX: number;
    rotSpeedY: number;
    rotSpeedZ: number;
    speedOffset: number;
    pulseOffset: number;
};

export class ChronoTesseractsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 0;
    speedMultiplier: number = 1.0;

    private dummy = new THREE.Object3D();
    private color1 = new THREE.Color(0x00ffff);
    private color2 = new THREE.Color(0xff00ff);
    private cubeData: Tesseract[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geometry = new THREE.BoxGeometry(1, 1, 1);

        const material = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            wireframe: true
        });

        const vUv = uv();
        const uTime = time;

        const pulse = sin(uTime.mul(2.0)).mul(0.5).add(0.5);

        // Color mix
        const mixRatio = sin(uTime.mul(1.5)).mul(0.5).add(0.5);
        const finalColor = mix(color(this.color1), color(this.color2), mixRatio);

        material.colorNode = finalColor;
        material.opacityNode = pulse.mul(0.8).add(0.2);

        this.mesh = new THREE.InstancedMesh(geometry, material, MAX_CUBES);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -1;

        for (let i = 0; i < MAX_CUBES; i++) {
            this.cubeData.push({
                x: (Math.random() - 0.5) * SPREAD_X,
                y: (Math.random() - 0.5) * SPREAD_Y,
                z: -300 - Math.random() * 800,
                scale: 50 + Math.random() * 150,
                rotationX: Math.random() * Math.PI * 2,
                rotationY: Math.random() * Math.PI * 2,
                rotationZ: Math.random() * Math.PI * 2,
                rotSpeedX: (Math.random() - 0.5) * 0.5,
                rotSpeedY: (Math.random() - 0.5) * 0.5,
                rotSpeedZ: (Math.random() - 0.5) * 0.5,
                speedOffset: 0.2 + Math.random() * 1.5,
                pulseOffset: Math.random() * Math.PI * 2
            });
            this.dummy.position.set(0, 0, 0);
            this.dummy.scale.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        this.deactivate();
    }

    activate(config?: ChronoTesseractsConfig) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        if (config) {
            if (config.color1 !== undefined) this.color1.setHex(config.color1);
            if (config.color2 !== undefined) this.color2.setHex(config.color2);
            if (config.density !== undefined) {
                this.count = Math.floor(config.density * MAX_CUBES);
            } else {
                this.count = MAX_CUBES;
            }
            if (config.speed !== undefined) this.speedMultiplier = config.speed;
        } else {
            this.count = MAX_CUBES;
        }

        this.mesh.count = this.count;
        decorationBudget.syncCount(BUDGET_ID, this.count);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount(BUDGET_ID, 0);
    }

    update(delta: number, cameraX: number, speed: number = 10) {
        if (!this.active) return;

        for (let i = 0; i < this.count; i++) {
            const data = this.cubeData[i];

            // Slow parallax scroll
            const scrollAmount = WORLD_SCROLL * this.speedMultiplier * (speed / 10) * data.speedOffset;

            data.rotationX += data.rotSpeedX * delta;
            data.rotationY += data.rotSpeedY * delta;
            data.rotationZ += data.rotSpeedZ * delta;

            // Re-center around camera
            let currentX = data.x - cameraX * (0.1 + (0.5 * data.speedOffset));

            // Wrap logic
            const halfSpread = SPREAD_X / 2;
            const relativeX = currentX - cameraX;
            if (relativeX < -halfSpread) {
                data.x += SPREAD_X;
            } else if (relativeX > halfSpread) {
                data.x -= SPREAD_X;
            }

            currentX = data.x - cameraX * (0.1 + (0.5 * data.speedOffset));

            this.dummy.position.set(currentX, data.y, data.z);
            this.dummy.rotation.set(data.rotationX, data.rotationY, data.rotationZ);
            this.dummy.scale.set(data.scale, data.scale, data.scale);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.deactivate();
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as any).dispose?.();
    }
}
