import * as THREE from 'three';
import { time, color, uv, sin, smoothstep, float, mix } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export interface RadiantHalosConfig {
    enabled?: boolean | undefined;
    density?: number;
    speed?: number;
    color1?: number;
    color2?: number;
}

const MAX_HALOS = 15;
const DEFAULT_HALOS = 5;
const BUDGET_ID = 'radiantHalos';

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createHaloMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // Pulse effect
    const pulse = sin(time.mul(2.0).add(baseUv.x.mul(10.0))).mul(0.5).add(0.5);

    // Color gradient
    const mixFactor = sin(baseUv.x.mul(3.0).add(time.mul(0.5))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    // Edges fade
    const fadeY = smoothstep(0.5, 0.2, float(0.5).sub(baseUv.y).abs());

    // Overall opacity
    const finalAlpha = fadeY.mul(pulse.mul(0.5).add(0.5));

    mat.colorNode = baseColor;
    mat.opacityNode = finalAlpha;

    return mat;
}

export class RadiantHalosSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    count: number = DEFAULT_HALOS;
    width: number = 6000;
    height: number = 3000;
    depth: number = 2000;
    speedMultiplier: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // TorusGeometry: radius, tube, radialSegments, tubularSegments
        const geo = new THREE.TorusGeometry(800, 40, 16, 128);

        const mat = createHaloMaterial(0xffaa00, 0xffffff);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_HALOS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -20; // Deep background

        for (let i = 0; i < MAX_HALOS; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                -500 + Math.random() * 1000,
                -1000 - Math.random() * this.depth
            );

            dummyObj.rotation.set(
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 0.5
            );

            const scale = 0.5 + Math.random() * 1.5;
            dummyObj.scale.set(scale, scale, scale);
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register(BUDGET_ID, {
            label: 'Radiant Halos',
            category: 'background3d',
            maxActive: this.count
        });

        this.deactivate();
    }

    activate(config?: RadiantHalosConfig) {
        if (this.active) return;
        this.active = true;
        this.count = Math.min(MAX_HALOS, Math.floor(DEFAULT_HALOS * (config?.density ?? 1.0)));
        this.mesh.count = this.count;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createHaloMaterial(config.color1 ?? 0xffaa00, config.color2 ?? 0xffffff);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount(BUDGET_ID, this.count);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount(BUDGET_ID, 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const margin = 2000;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.count; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            // Parallax factor based on depth
            const parallaxFactor = 50.0 / Math.abs(dummyObj.position.z);

            // Slow rotation
            dummyObj.rotation.x += delta * 0.05 * this.speedMultiplier;
            dummyObj.rotation.y += delta * 0.02 * this.speedMultiplier;
            dummyObj.rotation.z += delta * 0.03 * this.speedMultiplier;

            // Slow natural drift + player parallax
            const driftSpeed = 0.5 * this.speedMultiplier;
            const totalSpeed = driftSpeed + (playerSpeed * parallaxFactor);

            dummyObj.position.x -= delta * totalSpeed;

            if (dummyObj.position.x < limitBack) {
                dummyObj.position.x += this.width + margin * 2;
                dummyObj.position.y = -500 + Math.random() * 1000;
            } else if (dummyObj.position.x > limitFront) {
                dummyObj.position.x -= this.width + margin * 2;
                dummyObj.position.y = -500 + Math.random() * 1000;
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
