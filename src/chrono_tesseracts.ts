import * as THREE from 'three';
import { time, vec2, vec3, color, positionLocal, uv, distance, sin, smoothstep, float, mix, varying, abs } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export type ChronoTesseractsConfig = {
    density?: number;
    speed?: number;
    color1?: number;
    color2?: number;
};

const MAX_TESSERACTS = 20;
const BUDGET_ID = 'chronoTesseracts';
const SPREAD_X = 6000;
const SPREAD_Y = 3000;
const SPREAD_Z = 2000;
const BASE_SCROLL = 2;

type TesseractData = {
    x: number;
    y: number;
    z: number;
    scale: number;
    rotationAxis: THREE.Vector3;
    rotationSpeed: number;
    colorOffset: number;
};

export class ChronoTesseractsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 0;
    speedMultiplier: number = 1.0;

    private dummy = new THREE.Object3D();
    private dummyMat = new THREE.Matrix4();
    private data: TesseractData[] = [];
    private color1 = new THREE.Color(0x88ffff);
    private color2 = new THREE.Color(0xff88ff);

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Creating a wireframe-like material by evaluating edge distance in TSL using UV coordinates
        // For BoxGeometry, we map edges. A standard wireframe geometry is not strictly required if we fake it.
        // Actually, let's use a BoxGeometry and a TSL material that glows at the edges using uv.

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        const vUv = varying(uv());
        const uTime = time;

        // Create an edge glow effect (distance from the center of each face)
        const distX = abs(vUv.x.sub(0.5)).mul(2.0); // 0 at center, 1 at edges
        const distY = abs(vUv.y.sub(0.5)).mul(2.0); // 0 at center, 1 at edges

        // Combine them to get edges. We want it bright near the edges.
        const maxDist = distX.max(distY);
        const edgeAlpha = smoothstep(0.85, 1.0, maxDist).add(0.1); // Base alpha + bright edges

        // Add some procedural pulsing
        const pulse = sin(uTime.mul(2.0).add(vUv.x.mul(10.0))).mul(0.2).add(0.8);
        const finalAlpha = edgeAlpha.mul(pulse);

        // Mix colors based on time and uv
        const mixRatio = sin(uTime.add(vUv.y.mul(5.0))).mul(0.5).add(0.5);
        const finalColor = mix(color(this.color1), color(this.color2), mixRatio);

        material.colorNode = finalColor;
        material.opacityNode = finalAlpha;

        this.mesh = new THREE.InstancedMesh(geometry, material, MAX_TESSERACTS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -3; // deep background

        for (let i = 0; i < MAX_TESSERACTS; i++) {
            this.data.push({
                x: (Math.random() - 0.5) * SPREAD_X,
                y: (Math.random() - 0.5) * SPREAD_Y,
                z: -1000 - Math.random() * SPREAD_Z,
                scale: 100 + Math.random() * 300,
                rotationAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
                rotationSpeed: (0.1 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1),
                colorOffset: Math.random() * Math.PI * 2
            });
            this.dummyMat.identity();
            this.dummyMat.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);
            this.dummy.scale.set(0,0,0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

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
                this.count = Math.floor(config.density * MAX_TESSERACTS);
            } else {
                this.count = MAX_TESSERACTS;
            }
            if (config.speed !== undefined) this.speedMultiplier = config.speed;
        } else {
            this.count = MAX_TESSERACTS;
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
            const data = this.data[i];

            // Parallax scroll
            const scrollAmount = BASE_SCROLL * this.speedMultiplier * (speed / 10);

            // Re-center around camera
            let currentX = data.x - cameraX * 0.2; // 0.2 parallax factor

            // Wrap logic
            const halfSpread = SPREAD_X / 2;
            const relativeX = currentX - cameraX;
            if (relativeX < -halfSpread) {
                data.x += SPREAD_X;
            } else if (relativeX > halfSpread) {
                data.x -= SPREAD_X;
            }

            currentX = data.x - cameraX * 0.2;

            // Setup rotation based on time (delta)
            this.dummyMat.identity();

            this.dummy.position.set(currentX, data.y, data.z);
            this.dummy.scale.set(data.scale, data.scale, data.scale);

            // Increment rotation
            const totalRotation = performance.now() * 0.001 * data.rotationSpeed * this.speedMultiplier;
            this.dummy.quaternion.setFromAxisAngle(data.rotationAxis, totalRotation);

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
