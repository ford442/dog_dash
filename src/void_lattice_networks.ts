import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, uniform, mix, float, step, fract, uv, sin } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export interface VoidLatticeNetworksConfig {
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_STRUCTURES = 15;
const DEFAULT_STRUCTURES = 8;

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createLatticeMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
        wireframe: true
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    const scrollY = fract(baseUv.y.mul(2.0).add(time.mul(0.5)));
    const pulse = sin(scrollY.mul(Math.PI)).max(0.0);

    // Mix colors based on pulse and time
    const mixFactor = sin(time.mul(0.2).add(baseUv.x)).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    // Glowing edges
    const intensity = pulse.mul(0.8).add(0.2);

    mat.colorNode = vec4(baseColor, intensity);

    return mat;
}

export class VoidLatticeNetworksSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    structureCount: number = DEFAULT_STRUCTURES;
    width: number = 8000;
    height: number = 4000;
    depth: number = 3000;
    speedMultiplier: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.OctahedronGeometry(600, 2); // 2 detail levels for a lattice-like sphere
        const mat = createLatticeMaterial(0xff00ff, 0x00ffff);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_STRUCTURES);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -20;

        for (let i = 0; i < MAX_STRUCTURES; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                -1000 - Math.random() * this.depth
            );

            dummyObj.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            const scale = 1.0 + Math.random() * 2.0;
            dummyObj.scale.set(scale, scale, scale);
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('voidLatticeNetworks', {
            label: 'Void Lattice Networks',
            category: 'background3d',
            maxActive: this.structureCount
        });

        this.deactivate();
    }

    activate(config?: VoidLatticeNetworksConfig) {
        if (this.active) return;
        this.active = true;
        this.structureCount = Math.min(MAX_STRUCTURES, Math.floor(DEFAULT_STRUCTURES * (config?.density ?? 1.0)));
        this.mesh.count = this.structureCount;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createLatticeMaterial(config.color1 ?? 0xff00ff, config.color2 ?? 0x00ffff);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('voidLatticeNetworks', this.structureCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('voidLatticeNetworks', 0);
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        const margin = 2000;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.structureCount; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            const parallaxFactor = 30.0 / Math.abs(dummyObj.position.z);

            // Slow rotation for the lattice
            dummyObj.rotation.x += delta * 0.05 * this.speedMultiplier;
            dummyObj.rotation.y += delta * 0.05 * this.speedMultiplier;

            // Slow drift
            const driftSpeed = 10.0 * this.speedMultiplier;

            const totalSpeed = driftSpeed;

            dummyObj.position.x -= delta * totalSpeed;

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
        decorationBudget.syncCount('voidLatticeNetworks', 0);
    }
}
