import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, mix, float, step, fract, uv, sin, length, smoothstep, positionLocal } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface QuantumSingularityCoreConfig {
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_INSTANCES = 5;
const DEFAULT_INSTANCES = 1;
const BUDGET_ID = 'quantumSingularityCore';

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createSingularityMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    const centeredUv = baseUv.sub(vec2(0.5, 0.5));
    const dist = length(centeredUv);

    // Event Horizon
    const eventHorizon = smoothstep(0.1, 0.12, dist);

    // Accretion Disk (Extreme Centrifugal Textures)
    const angle = positionLocal.x; // Simplified polar angle proxy
    const scrollUv = vec2(dist, angle.add(time.mul(2.0)));
    const noiseVal = fbm(vec3(scrollUv.x.mul(10.0), scrollUv.y.mul(5.0), time.mul(0.5)));

    // Lensing Distortion
    const lensingDistortion = fbm(vec3(centeredUv.x.mul(5.0), centeredUv.y.mul(5.0), time.mul(0.2))).sub(0.5).mul(0.1);
    const distortedDist = dist.add(lensingDistortion);

    const diskGlow = smoothstep(0.4, 0.15, distortedDist).mul(noiseVal).mul(1.5);
    const innerGlow = smoothstep(0.2, 0.1, distortedDist).mul(2.0);

    const intensity = diskGlow.add(innerGlow).mul(eventHorizon);

    // Color mixing based on radius and time
    const mixFactor = sin(dist.mul(10.0).sub(time)).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    mat.colorNode = vec4(baseColor, intensity);

    return mat;
}

export class QuantumSingularityCoreSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    instanceCount: number = DEFAULT_INSTANCES;
    width: number = 10000;
    height: number = 5000;
    depth: number = 4000;
    speedMultiplier: number = 1.0;

    private data: { speedOffset: number, scaleOffset: number, rotSpeedZ: number }[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Use a PlaneGeometry to represent the accretion disk and lensing effects
        // It uses TSL math to draw a sphere within it.
        const geo = new THREE.PlaneGeometry(1500, 1500, 4, 4);

        // Colors: Deep Blue and Fiery Orange
        const mat = createSingularityMaterial(0x0022ff, 0xff5500);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_INSTANCES);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -20; // Deep background

        for (let i = 0; i < MAX_INSTANCES; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                -2000 - Math.random() * this.depth
            );

            dummyObj.rotation.set(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                Math.random() * Math.PI * 2
            );

            const scale = 1.0 + Math.random() * 2.0;
            dummyObj.scale.set(scale, scale, scale);
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);

            this.data.push({
                speedOffset: 0.2 + Math.random() * 0.3, // Moves very slow due to massive scale
                scaleOffset: scale,
                rotSpeedZ: (Math.random() - 0.5) * 0.1,
            });
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register(BUDGET_ID, {
            label: 'Quantum Singularity Core',
            category: 'background3d',
            maxActive: MAX_INSTANCES
        });

        this.deactivate();
    }

    activate(config?: QuantumSingularityCoreConfig) {
        if (this.active) return;
        this.active = true;
        this.instanceCount = Math.min(MAX_INSTANCES, Math.max(1, Math.floor(DEFAULT_INSTANCES * (config?.density ?? 1.0))));
        this.mesh.count = this.instanceCount;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createSingularityMaterial(config.color1 ?? 0x0022ff, config.color2 ?? 0xff5500);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount(BUDGET_ID, this.instanceCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount(BUDGET_ID, 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const margin = 3000;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.instanceCount; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            const d = this.data[i];
            const parallaxFactor = 100.0 / Math.abs(dummyObj.position.z);

            const driftSpeed = 1.0 * this.speedMultiplier * d.speedOffset;
            const totalSpeed = driftSpeed + (playerSpeed * parallaxFactor);

            dummyObj.position.x -= delta * totalSpeed;

            // Slow rotation
            dummyObj.rotation.z += d.rotSpeedZ * delta * this.speedMultiplier;

            if (dummyObj.position.x < limitBack) {
                dummyObj.position.x += this.width + margin * 2;
                dummyObj.position.y = (Math.random() - 0.5) * this.height;
            } else if (dummyObj.position.x > limitFront) {
                dummyObj.position.x -= this.width + margin * 2;
                dummyObj.position.y = (Math.random() - 0.5) * this.height;
            }

            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if (Array.isArray(this.mesh.material)) {
            this.mesh.material.forEach(m => m.dispose());
        } else {
            this.mesh.material.dispose();
        }
        decorationBudget.syncCount(BUDGET_ID, 0);
    }
}
