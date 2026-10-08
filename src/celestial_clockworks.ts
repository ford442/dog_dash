import * as THREE from 'three';
import { vec2, color, uv, sin, smoothstep, float, varying, atan2, length, abs, time, mix } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export type CelestialClockworksConfig = {
    density?: number;
    speed?: number;
    color1?: number;
    color2?: number;
};

const MAX_GEARS = 15;
const BUDGET_ID = 'celestial_clockworks';
const SPREAD_X = 8000;
const WORLD_SCROLL = 8;

type Gear = {
    x: number;
    y: number;
    z: number;
    scale: number;
    rotationSpeed: number;
    rotation: number;
    tiltX: number;
    tiltY: number;
};

export class CelestialClockworksSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 0;
    speedMultiplier: number = 1.0;

    private dummy = new THREE.Object3D();
    private color1 = new THREE.Color(0xd4af37);
    private color2 = new THREE.Color(0xc0c0c0);
    private gearData: Gear[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const vUv = varying(uv());
        const centeredUv = vUv.sub(vec2(0.5, 0.5));
        const r = length(centeredUv).mul(2.0);
        const theta = atan2(centeredUv.y, centeredUv.x);

        const teeth = sin(theta.mul(12.0)).mul(0.1);
        const outerShape = float(0.8).add(teeth);
        const spokes = abs(sin(theta.mul(6.0))).pow(10.0).mul(0.5);
        const spokeCutout = smoothstep(0.1, 0.0, spokes)
            .mul(smoothstep(0.3, 0.32, r))
            .mul(smoothstep(0.8, 0.78, r));
        const innerRing = smoothstep(0.4, 0.42, r).sub(smoothstep(0.48, 0.5, r));
        const holeCutout = smoothstep(0.2, 0.22, r);

        const finalAlpha = smoothstep(outerShape.add(0.02), outerShape, r)
            .sub(spokeCutout)
            .add(innerRing)
            .clamp(0.0, 1.0)
            .mul(holeCutout);

        const pulse = sin(time.mul(2.0).add(r.mul(8.0))).mul(0.5).add(0.5);
        const metal = mix(color(this.color1), color(this.color2), sin(theta).mul(0.5).add(0.5));
        mat.colorNode = mix(metal, color(0xffffff), pulse.mul(0.35));
        mat.opacityNode = finalAlpha.mul(0.6);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_GEARS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -6;
        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: CelestialClockworksConfig) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        const density = Math.min(1.0, config?.density ?? 1.0);
        this.speedMultiplier = config?.speed ?? 1.0;
        if (config?.color1 !== undefined) this.color1.setHex(config.color1);
        if (config?.color2 !== undefined) this.color2.setHex(config.color2);

        this.count = Math.max(0, Math.min(MAX_GEARS, Math.floor(MAX_GEARS * density)));
        this.mesh.count = this.count;
        decorationBudget.syncCount(BUDGET_ID, this.count);
        this.gearData = [];

        for (let i = 0; i < this.count; i++) {
            const rotationSpeed = (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.1);
            const gear: Gear = {
                x: (Math.random() * SPREAD_X) - SPREAD_X / 2,
                y: (Math.random() * 2000) - 1000,
                z: -1500 - Math.random() * 2000,
                scale: 200 + Math.random() * 600,
                rotationSpeed,
                rotation: Math.random() * Math.PI * 2,
                tiltX: Math.sin(i * 1.23) * 0.3,
                tiltY: Math.cos(i * 2.34) * 0.3
            };
            this.gearData.push(gear);
            this.writeInstance(i, gear);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        this.count = 0;
        decorationBudget.syncCount(BUDGET_ID, 0);
    }

    update(delta: number, cameraX: number, _playerPos?: THREE.Vector3) {
        if (!this.active) return;

        const halfSpread = SPREAD_X / 2;
        for (let i = 0; i < this.count; i++) {
            const gear = this.gearData[i];
            const depthFactor = Math.max(0.4, Math.abs(gear.z) / 1000);
            gear.x -= delta * WORLD_SCROLL * 0.1 * this.speedMultiplier / depthFactor;
            gear.rotation += gear.rotationSpeed * delta * this.speedMultiplier;

            if (gear.x < cameraX - halfSpread) {
                gear.x += SPREAD_X;
                gear.y = (Math.random() * 2000) - 1000;
            } else if (gear.x > cameraX + halfSpread) {
                gear.x -= SPREAD_X;
                gear.y = (Math.random() * 2000) - 1000;
            }
            this.writeInstance(i, gear);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            (this.mesh.material as { dispose?: () => void }).dispose?.();
        }
        this.count = 0;
        decorationBudget.syncCount(BUDGET_ID, 0);
    }

    private writeInstance(index: number, gear: Gear) {
        this.dummy.position.set(gear.x, gear.y, gear.z);
        this.dummy.rotation.set(gear.tiltX, gear.tiltY, gear.rotation);
        this.dummy.scale.set(gear.scale, gear.scale, 1);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(index, this.dummy.matrix);
    }
}