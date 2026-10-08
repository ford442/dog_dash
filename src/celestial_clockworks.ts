import * as THREE from 'three';
import { vec2, color, uv, sin, smoothstep, float, varying, atan2, length, abs } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import type { TSLNode } from './tsl_types';

const MAX_GEARS = 15;
const dummy = new THREE.Object3D();
const dummyMat = new THREE.Matrix4();

export class CelestialClockworksSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 0;

    private gearData: {
        x: number;
        y: number;
        z: number;
        scale: number;
        rotationSpeed: number;
        teethCount: number;
        active: boolean;
    }[];

    private color1 = new THREE.Color(0xd4af37); // Gold
    private color2 = new THREE.Color(0xc0c0c0); // Silver
    private speedMultiplier = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        // TSL Shader
        const vUv = varying(uv());
        const center = vec2(0.5, 0.5);
        const centeredUv = vUv.sub(center);

        // Polar coordinates
        const r = length(centeredUv).mul(2.0); // 0 to 1 at edge
        const theta = atan2(centeredUv.y, centeredUv.x); // -PI to PI

        // Use instance ID for unique gear variations? We can't easily pass it without custom attributes.
        // For simplicity we will have a universal gear shape, or use a varying based on instanceMatrix if possible.
        // We'll just make a complex looking gear that works for all.

        const numTeeth = float(12.0);

        // Base circle
        const gearRadius = float(0.8);

        // Teeth shape using sine wave on theta
        const teeth = sin(theta.mul(numTeeth)).mul(0.1);
        const outerShape = gearRadius.add(teeth);

        // Spokes
        const numSpokes = float(6.0);
        const spokes = abs(sin(theta.mul(numSpokes))).pow(10.0).mul(0.5);

        // Inner hole
        const innerHole = float(0.2);

        // Combine shapes
        let alphaNode: TSLNode = smoothstep(outerShape.add(0.02), outerShape, r);

        // Cut out space between spokes (but leave an inner ring)
        const innerRing = smoothstep(0.4, 0.42, r).sub(smoothstep(0.48, 0.5, r));
        const spokeCutout = smoothstep(0.1, 0.0, spokes).mul(smoothstep(0.3, 0.32, r)).mul(smoothstep(0.8, 0.78, r));

        // Cut out inner hole
        const holeCutout = smoothstep(innerHole, innerHole.add(0.02), r);

        // Final alpha
        // Start with solid disc
        let finalAlpha: TSLNode = smoothstep(outerShape.add(0.02), outerShape, r);
        // Cut out middle except for spokes and inner ring
        finalAlpha = finalAlpha.sub(spokeCutout);
        // Add inner ring back in
        finalAlpha = finalAlpha.add(innerRing).clamp(0.0, 1.0);
        // Cut out absolute center
        finalAlpha = finalAlpha.mul(holeCutout);

        mat.colorNode = color(this.color1);
        mat.opacityNode = finalAlpha.mul(0.6); // Slightly transparent

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_GEARS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -6; // very deep background

        this.gearData = Array.from({ length: MAX_GEARS }, () => ({
            x: 0,
            y: 0,
            z: 0,
            scale: 1,
            rotationSpeed: 0,
            teethCount: 12,
            active: false
        }));

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: { density?: number, speed?: number, color1?: number, color2?: number }) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        const density = config?.density ?? 1.0;
        this.speedMultiplier = config?.speed ?? 1.0;

        if (config?.color1 !== undefined) this.color1.setHex(config.color1);
        if (config?.color2 !== undefined) this.color2.setHex(config.color2);

        const targetCount = Math.floor(MAX_GEARS * Math.min(1.0, density));
        this.count = targetCount;
        decorationBudget.syncCount('celestial_clockworks', this.count);
        this.mesh.count = this.count;

        // Initialize gear positions
        for (let i = 0; i < MAX_GEARS; i++) {
            if (i < this.count) {
                this.gearData[i].active = true;
                // Spread them far out in the background
                this.gearData[i].x = (Math.random() * 8000) - 4000;
                this.gearData[i].y = (Math.random() * 2000) - 1000;
                this.gearData[i].z = -1500 - Math.random() * 2000;
                this.gearData[i].scale = 200 + Math.random() * 600;
                this.gearData[i].rotationSpeed = (Math.random() * 0.2 - 0.1) * this.speedMultiplier;

                // Ensure it's not zero
                if (Math.abs(this.gearData[i].rotationSpeed) < 0.02) {
                    this.gearData[i].rotationSpeed = 0.05 * Math.sign(this.gearData[i].rotationSpeed || 1);
                }
            } else {
                this.gearData[i].active = false;
                dummyMat.identity();
                dummyMat.decompose(dummy.position, dummy.quaternion, dummy.scale);
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                this.mesh.setMatrixAt(i, dummy.matrix);
            }
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        this.count = 0;
        decorationBudget.syncCount('celestial_clockworks', 0);
    }

    update(delta: number, cameraX: number, speed: number = 8) {
        if (!this.active) return;

        let needsUpdate = false;
        for (let i = 0; i < this.count; i++) {
            const r = this.gearData[i];
            if (r.active) {
                // Parallax scrolling
                // Speed varies slightly by z depth
                const depthFactor = Math.abs(r.z) / 1000;
                r.x -= delta * speed * 0.1 / depthFactor; // Slow parallax

                // Wrap around
                if (r.x < cameraX - 4000) {
                    r.x += 8000;
                    r.y = cameraX * 0.05 + (Math.random() * 2000) - 1000; // Drift vertically slightly with camera
                } else if (r.x > cameraX + 4000) {
                    r.x -= 8000;
                }

                // Calculate rotation based on absolute time or just integrate delta
                const currentRot = (Date.now() / 1000) * r.rotationSpeed;

                dummyMat.identity();
                dummyMat.makeTranslation(r.x, r.y, r.z);

                // Add some tilt so they aren't all perfectly flat facing camera
                const tiltX = Math.sin(i * 1.23) * 0.3;
                const tiltY = Math.cos(i * 2.34) * 0.3;

                const euler = new THREE.Euler(tiltX, tiltY, currentRot, 'XYZ');
                const quat = new THREE.Quaternion().setFromEuler(euler);

                dummyMat.makeRotationFromQuaternion(quat);
                dummyMat.setPosition(r.x, r.y, r.z);

                dummy.position.set(r.x, r.y, r.z);
                dummy.quaternion.setFromEuler(euler);
                dummy.scale.set(r.scale, r.scale, 1);
                dummy.scale.set(r.scale, r.scale, 1);
                dummy.updateMatrix();

                this.mesh.setMatrixAt(i, dummy.matrix);
                needsUpdate = true;
            }
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
        decorationBudget.syncCount('celestial_clockworks', 0);
    }
}
