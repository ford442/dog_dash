import * as THREE from 'three';
import { time, vec2, vec3, color, positionLocal, uv, distance, sin, smoothstep, float, mix, varying, positionWorld, normalWorld, cameraPosition } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export type QuantumFoamBubblesConfig = {
    density?: number;
    speed?: number;
    color1?: number;
    color2?: number;
};

const MAX_BUBBLES = 50;
const BUDGET_ID = 'quantumFoamBubbles';
const SPREAD_X = 5000;
const SPREAD_Y = 1500;
const WORLD_SCROLL = 5;

type Bubble = {
    x: number;
    y: number;
    z: number;
    scale: number;
    wobbleSpeed: number;
    driftSpeed: number;
    driftOffset: number;
    phase: number;
};

export class QuantumFoamBubblesSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 0;
    speedMultiplier: number = 1.0;

    private dummy = new THREE.Object3D();
    private color1 = new THREE.Color(0x00ffff);
    private color2 = new THREE.Color(0xff00ff);
    private bubbleData: Bubble[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geometry = new THREE.IcosahedronGeometry(1, 4);

        const material = new MeshStandardNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.FrontSide,
            roughness: 0.1,
            metalness: 0.8
        });

        // Iridescent bubble effect using view angle and normal
        const viewDir = vec3(cameraPosition).sub(positionWorld).normalize();
        const fresnel = float(1.0).sub(viewDir.dot(normalWorld)).clamp(0.0, 1.0);

        // Time-based shifting
        const t = time.mul(0.5);
        const shift = sin(fresnel.mul(10.0).add(t)).mul(0.5).add(0.5);

        // Base color mixing with iridescence
        const baseColor1 = color(this.color1);
        const baseColor2 = color(this.color2);

        material.colorNode = mix(baseColor1, baseColor2, shift);
        material.opacityNode = mix(0.1, 0.8, fresnel);

        this.mesh = new THREE.InstancedMesh(geometry, material, MAX_BUBBLES);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -1; // Render behind closer transparent objects

        for (let i = 0; i < MAX_BUBBLES; i++) {
            this.bubbleData.push({
                x: (Math.random() - 0.5) * SPREAD_X,
                y: (Math.random() - 0.5) * SPREAD_Y,
                z: -50 - Math.random() * 200, // Parallax depth
                scale: 5 + Math.random() * 15,
                wobbleSpeed: 0.5 + Math.random() * 1.5,
                driftSpeed: 2 + Math.random() * 5,
                driftOffset: Math.random() * Math.PI * 2,
                phase: Math.random() * Math.PI * 2
            });
        }

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: QuantumFoamBubblesConfig) {
        if (this.active) return;
        this.active = true;

        if (config) {
            this.speedMultiplier = config.speed ?? 1.0;
            if (config.color1) this.color1.setHex(config.color1);
            if (config.color2) this.color2.setHex(config.color2);

            const density = config.density ?? 1.0;
            this.count = Math.floor(MAX_BUBBLES * density);
        } else {
            this.count = MAX_BUBBLES;
        }

        this.mesh.count = this.count;
        this.mesh.visible = true;
        decorationBudget.syncCount(BUDGET_ID, this.count);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount(BUDGET_ID, 0);
    }

    update(delta: number, cameraX: number, speed?: number) {
        if (!this.active) return;

        const effectiveSpeed = (speed ?? 1.0) * this.speedMultiplier;
        const timeVal = performance.now() / 1000;

        for (let i = 0; i < this.count; i++) {
            const b = this.bubbleData[i];

            // Slowly drift upwards and sideways (wobble)
            b.y += b.driftSpeed * effectiveSpeed * delta;

            // Scrolling and wrapping
            b.x -= WORLD_SCROLL * effectiveSpeed * delta;

            const limitBack = cameraX - SPREAD_X / 2 - 100;
            const limitFront = cameraX + SPREAD_X / 2 + 100;
            if (b.x < limitBack) b.x += SPREAD_X + 200;
            if (b.x > limitFront) b.x -= SPREAD_X + 200;

            if (b.y > SPREAD_Y / 2) b.y -= SPREAD_Y;

            // Wobble effect
            const wobbleX = Math.sin(timeVal * b.wobbleSpeed + b.phase) * 20;

            this.dummy.position.set(b.x + wobbleX, b.y, b.z);

            // Slightly warp scale based on wobble to look squishy
            const squish = 1.0 + Math.sin(timeVal * b.wobbleSpeed * 2 + b.phase) * 0.1;
            this.dummy.scale.set(b.scale, b.scale * squish, b.scale);

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
