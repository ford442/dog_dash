import * as THREE from 'three';
import { time, vec2, vec3, color, float, positionLocal, uv, distance, sin, cos, smoothstep, mix, varying, atan2 } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export type CelestialClockworksConfig = {
    density?: number;
    speed?: number;
};

const MAX_GEARS = 20;

export class CelestialClockworksSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 0;
    speedMultiplier: number = 1.0;

    private dummy = new THREE.Object3D();
    private mat4 = new THREE.Matrix4();
    private gearData: {
        x: number;
        y: number;
        z: number;
        scale: number;
        rotationSpeed: number;
        baseRotation: number;
    }[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        // TSL Shader for a glowing gear
        const vUv = varying(uv());
        const center = vec2(0.5, 0.5);
        const diff = vUv.sub(center);
        const dist = distance(vUv, center);
        const angle = atan2(diff.y, diff.x);

        // Gear teeth logic
        const numTeeth = 12.0;
        const toothWave = sin(angle.mul(numTeeth));
        // map -1 to 1 into a flat outer ridge with bumps
        const ridge = smoothstep(-0.5, 0.5, toothWave);

        // base radius
        const radius = float(0.35);
        const outerEdge = radius.add(ridge.mul(0.08));

        // Create the solid gear shape
        const gearShape = smoothstep(outerEdge.add(0.02), outerEdge, dist);

        // Inner hole
        const hole = smoothstep(0.1, 0.12, dist);

        // Inner ring gap
        const innerRingOut = smoothstep(0.2, 0.22, dist);
        const innerRingIn = smoothstep(0.25, 0.23, dist);
        const cutouts = innerRingOut.mul(innerRingIn).mul(sin(angle.mul(4.0)).add(1.0).mul(0.5));

        const finalAlpha = gearShape.mul(hole).sub(cutouts).max(0.0);

        // Add some glowing noise over time
        const pulse = sin(time.mul(2.0).add(dist.mul(10.0))).mul(0.5).add(0.5);
        const baseColor = color(0xffaa00);
        const glowColor = mix(baseColor, color(0xffffff), pulse.mul(0.5));

        mat.colorNode = glowColor;
        mat.opacityNode = finalAlpha.mul(0.6); // slight transparency

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_GEARS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -4; // background

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: CelestialClockworksConfig) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        const density = config?.density ?? 1.0;
        this.count = Math.max(1, Math.floor(MAX_GEARS * density));
        this.mesh.count = this.count;
        this.speedMultiplier = config?.speed ?? 1.0;

        decorationBudget.syncCount('celestialClockworks', this.count);

        this.gearData = [];
        for (let i = 0; i < this.count; i++) {
            const z = -400 - Math.random() * 800; // Deep background
            // Spread them widely
            const x = (Math.random() - 0.5) * 4000;
            const y = (Math.random() - 0.5) * 2000;

            const scale = 300 + Math.random() * 500;
            const rotationSpeed = (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.1);

            this.gearData.push({
                x, y, z, scale, rotationSpeed, baseRotation: Math.random() * Math.PI * 2
            });

            this.mat4.identity();
            this.mat4.makeTranslation(x, y, z);
            this.mat4.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);
            this.dummy.scale.set(scale, scale, 1);
            this.dummy.rotation.z = this.gearData[i].baseRotation;
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        this.count = 0;
        decorationBudget.syncCount('celestialClockworks', 0);
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        let needsUpdate = false;
        for (let i = 0; i < this.count; i++) {
            const data = this.gearData[i];
            data.baseRotation += data.rotationSpeed * delta * this.speedMultiplier;

            // Parallax wrap around
            const margin = 1000;
            const width = 4000;
            const limitBack = cameraX - (width / 2) - margin;
            const limitFront = cameraX + (width / 2) + margin;

            if (data.x < limitBack) {
                data.x += width + margin * 2;
                data.y = (Math.random() - 0.5) * 2000;
            } else if (data.x > limitFront) {
                data.x -= width + margin * 2;
                data.y = (Math.random() - 0.5) * 2000;
            }

            this.mat4.identity();
            this.mat4.makeTranslation(data.x, data.y, data.z);
            this.mat4.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);
            this.dummy.scale.set(data.scale, data.scale, 1);
            this.dummy.rotation.z = data.baseRotation;
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true;
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            (this.mesh.material as any).dispose?.();
        }
        this.count = 0;
        decorationBudget.syncCount('celestialClockworks', 0);
    }
}