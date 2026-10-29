import * as THREE from 'three';
import { vec2, color, uv, sin, smoothstep, float, varying, time, mix, length, vec3, abs } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export type GalacticLeylinesConfig = {
    density?: number;
    speed?: number;
    color1?: number;
    color2?: number;
};

const MAX_LINES = 30;
const BUDGET_ID = 'galacticLeylines';
const SPREAD_X = 8000;
const SPREAD_Y = 2000;
const WORLD_SCROLL = 5;

type Leyline = {
    x: number;
    y: number;
    z: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    speedOffset: number;
    pulseOffset: number;
};

export class GalacticLeylinesSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 0;
    speedMultiplier: number = 1.0;

    private dummy = new THREE.Object3D();
    private color1 = new THREE.Color(0x00ffff);
    private color2 = new THREE.Color(0xff00ff);
    private lineData: Leyline[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geometry = new THREE.PlaneGeometry(1, 1);

        const material = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        const vUv = varying(uv());
        const uTime = time;

        // Pulse effect along the length (X axis)
        const scrollOffset = uTime.mul(2.0);
        const pulse = sin(vUv.x.mul(10.0).add(scrollOffset)).mul(0.5).add(0.5);

        // Edge fade on Y axis
        const distY = abs(vUv.y.sub(0.5)).mul(2.0);
        const edgeAlpha = smoothstep(1.0, 0.0, distY);

        // Edge fade on X axis
        const distX = abs(vUv.x.sub(0.5)).mul(2.0);
        const endsAlpha = smoothstep(1.0, 0.8, distX);

        const finalAlpha = pulse.mul(edgeAlpha).mul(endsAlpha);

        // Color mix
        const mixRatio = sin(vUv.x.mul(5.0).add(uTime)).mul(0.5).add(0.5);
        const finalColor = mix(color(this.color1), color(this.color2), mixRatio);

        material.colorNode = finalColor;
        material.opacityNode = finalAlpha;

        this.mesh = new THREE.InstancedMesh(geometry, material, MAX_LINES);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -1;

        for (let i = 0; i < MAX_LINES; i++) {
            this.lineData.push({
                x: (Math.random() - 0.5) * SPREAD_X,
                y: (Math.random() - 0.5) * SPREAD_Y,
                z: -500 - Math.random() * 500,
                scaleX: 500 + Math.random() * 1000,
                scaleY: 10 + Math.random() * 30,
                rotation: (Math.random() - 0.5) * Math.PI * 0.5, // Angle slightly
                speedOffset: 0.5 + Math.random() * 1.5,
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

    activate(config?: GalacticLeylinesConfig) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        if (config) {
            if (config.color1 !== undefined) this.color1.setHex(config.color1);
            if (config.color2 !== undefined) this.color2.setHex(config.color2);
            if (config.density !== undefined) {
                this.count = Math.floor(config.density * MAX_LINES);
            } else {
                this.count = MAX_LINES;
            }
            if (config.speed !== undefined) this.speedMultiplier = config.speed;
        } else {
            this.count = MAX_LINES;
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
            const data = this.lineData[i];

            // Slow parallax scroll
            const scrollAmount = WORLD_SCROLL * this.speedMultiplier * (speed / 10) * data.speedOffset;

            // Re-center around camera
            let currentX = data.x - cameraX * 0.1;

            // Wrap logic
            const halfSpread = SPREAD_X / 2;
            const relativeX = currentX - cameraX;
            if (relativeX < -halfSpread) {
                data.x += SPREAD_X;
            } else if (relativeX > halfSpread) {
                data.x -= SPREAD_X;
            }

            currentX = data.x - cameraX * 0.1;

            this.dummy.position.set(currentX, data.y, data.z);
            this.dummy.rotation.set(0, 0, data.rotation);
            this.dummy.scale.set(data.scaleX, data.scaleY, 1);
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
