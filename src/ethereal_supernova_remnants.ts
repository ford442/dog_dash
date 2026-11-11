import * as THREE from 'three';
import { time, color, uv, sin, mix, PI2, vec2, float, smoothstep } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export interface EtherealSupernovaRemnantsConfig {
    enabled?: boolean | undefined;
    density?: number;
    speed?: number;
    color1?: number;
    color2?: number;
}

const MAX_REMNANTS = 15;
const DEFAULT_REMNANTS = 5;
const BUDGET_ID = 'ethereal_supernova_remnants';

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createRemnantMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // Distance from center for radial fade
    const centeredUv = baseUv.sub(vec2(0.5, 0.5));
    const dist = centeredUv.length();

    // Smooth edge fading
    const edgeFade = smoothstep(0.5, 0.0, dist);

    // Pulse effect
    const pulse = sin(time.mul(1.5).add(dist.mul(10.0))).mul(0.5).add(0.5);

    // Color gradient mixing
    const mixFactor = sin(baseUv.x.mul(3.0).add(time.mul(0.5))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    mat.colorNode = baseColor;
    mat.opacityNode = pulse.mul(edgeFade).mul(0.8);

    return mat;
}

export class EtherealSupernovaRemnantsSystem {
    scene: THREE.Scene;
    mesh!: THREE.InstancedMesh;
    active: boolean = false;
    count: number = DEFAULT_REMNANTS;

    private speeds = new Float32Array(MAX_REMNANTS);
    private positions = new Float32Array(MAX_REMNANTS * 3);
    private scales = new Float32Array(MAX_REMNANTS);
    private rotations = new Float32Array(MAX_REMNANTS);

    private baseColor1: number = 0xff6600;
    private baseColor2: number = 0x6600ff;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.init();
        this.deactivate();
    }

    private init() {
        // Use IcosahedronGeometry for a roughly spherical shape with low poly count
        const geometry = new THREE.IcosahedronGeometry(20, 2);
        const material = createRemnantMaterial(this.baseColor1, this.baseColor2);

        this.mesh = new THREE.InstancedMesh(geometry, material, MAX_REMNANTS);
        this.mesh.frustumCulled = false;

        // Deep background layer
        this.mesh.renderOrder = -15;

        for (let i = 0; i < MAX_REMNANTS; i++) {
            this.speeds[i] = Math.random() * 0.2 + 0.1;

            // X: spread out horizontally, wrapping logic in update
            this.positions[i * 3] = (Math.random() - 0.5) * 800;
            // Y: spread vertically
            this.positions[i * 3 + 1] = (Math.random() - 0.5) * 300;
            // Z: deep background parallax
            this.positions[i * 3 + 2] = -400 - Math.random() * 200;

            this.scales[i] = 1.0 + Math.random() * 2.0;
            this.rotations[i] = Math.random() * Math.PI * 2;
        }

        this.updateMatrices();
        this.scene.add(this.mesh);
    }

    private updateMatrices() {
        for (let i = 0; i < this.count; i++) {
            dummyObj.position.set(
                this.positions[i * 3],
                this.positions[i * 3 + 1],
                this.positions[i * 3 + 2]
            );

            const scale = this.scales[i];
            dummyObj.scale.set(scale, scale, scale);

            dummyObj.rotation.set(0, 0, this.rotations[i]);

            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    activate(config?: EtherealSupernovaRemnantsConfig) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        if (config?.density !== undefined) {
            this.count = Math.min(MAX_REMNANTS, Math.floor(DEFAULT_REMNANTS * config.density));
            this.mesh.count = this.count;
        }

        if (config?.color1 !== undefined) this.baseColor1 = config.color1;
        if (config?.color2 !== undefined) this.baseColor2 = config.color2;

        // Recreate material if colors changed
        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = createRemnantMaterial(this.baseColor1, this.baseColor2);
        }

        decorationBudget.syncCount(BUDGET_ID, this.count);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount(BUDGET_ID, 0);
    }

    update(delta: number, cameraX: number, speed: number = 8) {
        if (!this.active) return;

        let needsUpdate = false;
        const width = 800; // Total width to wrap around

        for (let i = 0; i < this.count; i++) {
            // Parallax scroll logic
            // Move opposite to camera direction
            const parallaxFactor = 0.05 * this.speeds[i];
            this.positions[i * 3] -= speed * delta * parallaxFactor;

            // Slow rotation
            this.rotations[i] += delta * 0.1 * this.speeds[i];

            let x = this.positions[i * 3];

            // Wrap around logic based on camera position
            const margin = 200;
            const limitBack = cameraX - (width / 2) - margin;
            const limitFront = cameraX + (width / 2) + margin;

            if (x < limitBack) {
                x += width + margin * 2;
                this.positions[i * 3] = x;
                this.positions[i * 3 + 1] = (Math.random() - 0.5) * 300; // Reset Y randomly on wrap
            }
            if (x > limitFront) {
                x -= width + margin * 2;
                this.positions[i * 3] = x;
                this.positions[i * 3 + 1] = (Math.random() - 0.5) * 300; // Reset Y randomly on wrap
            }

            // Apply updates
            mat4Obj.identity();
            dummyObj.position.set(x, this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
            dummyObj.rotation.set(0, 0, this.rotations[i]);

            const scale = this.scales[i];
            dummyObj.scale.set(scale, scale, scale);

            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);

            needsUpdate = true;
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if (this.mesh.material) {
            (this.mesh.material as any).dispose?.();
        }
        decorationBudget.syncCount(BUDGET_ID, 0);
    }
}
