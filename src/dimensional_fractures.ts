import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, mix, float, step, fract, uv, sin, length, smoothstep } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface DimensionalFracturesConfig {
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_FRACTURES = 15;
const DEFAULT_FRACTURES = 5;
const BUDGET_ID = 'dimensionalFractures';

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createFractureMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // Distance to center to create a rift shape (fading out at edges)
    const centeredUv = baseUv.sub(vec2(0.5, 0.5));
    // Elliptical distance to make it long and narrow
    const riftDist = length(vec2(centeredUv.x.mul(2.0), centeredUv.y.mul(0.5)));
    const edgeFade = smoothstep(0.5, 0.2, riftDist);

    // Scrolling energy inside the rift
    const scrollUv = vec2(baseUv.x, baseUv.y.add(time.mul(0.5)));

    // Distort the UVs with noise for jagged edges
    const distortion = fbm(vec3(baseUv.x.mul(5.0), baseUv.y.mul(5.0), time.mul(0.2))).sub(0.5).mul(0.2);
    const distortedDist = riftDist.add(distortion);

    const jaggedEdgeFade = smoothstep(0.4, 0.2, distortedDist);

    const noiseVal = fbm(vec3(scrollUv.x.mul(10.0), scrollUv.y.mul(4.0), time.mul(0.3)));

    // Core glow
    const core = smoothstep(0.2, 0.0, distortedDist).mul(1.5);

    // Pulse effect
    const pulse = sin(time.mul(2.0).add(baseUv.y.mul(10.0))).mul(0.5).add(0.5);

    const intensity = jaggedEdgeFade.mul(noiseVal.add(0.2)).mul(pulse.add(0.5)).add(core);

    // Color shifting
    const mixFactor = sin(baseUv.y.mul(3.0).add(time.mul(0.5))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    mat.colorNode = vec4(baseColor, intensity.mul(0.9));

    return mat;
}

export class DimensionalFracturesSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    fractureCount: number = DEFAULT_FRACTURES;
    width: number = 8000;
    height: number = 4000;
    depth: number = 3000;
    speedMultiplier: number = 1.0;

    private data: { speedOffset: number, scaleOffset: number, rotSpeedZ: number }[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Use Icosahedron geometry, but we will scale it flat in Z to make a plane-like rift
        const geo = new THREE.IcosahedronGeometry(600, 2);

        // Colors: Neon Cyan and Electric Purple
        const mat = createFractureMaterial(0x00ffff, 0xff00ff);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_FRACTURES);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -18; // Deep background

        for (let i = 0; i < MAX_FRACTURES; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                -1500 - Math.random() * this.depth
            );

            // Rifts mainly point towards the player, with some random Z rotation
            dummyObj.rotation.set(
                (Math.random() - 0.5) * 0.2, // Slight tilt X
                (Math.random() - 0.5) * 0.2, // Slight tilt Y
                Math.random() * Math.PI * 2  // Random orientation
            );

            // Scale flat in Z to make a "rip" in space
            const scale = 0.5 + Math.random() * 2.0;
            // Stretch it long in Y and thin in X
            dummyObj.scale.set(scale * 0.3, scale * 1.5, scale * 0.01);
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);

            this.data.push({
                speedOffset: 0.5 + Math.random(),
                scaleOffset: scale,
                rotSpeedZ: (Math.random() - 0.5) * 0.05,
            });
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register(BUDGET_ID, {
            label: 'Dimensional Fractures',
            category: 'background3d',
            maxActive: MAX_FRACTURES
        });

        this.deactivate();
    }

    activate(config?: DimensionalFracturesConfig) {
        if (this.active) return;
        this.active = true;
        this.fractureCount = Math.min(MAX_FRACTURES, Math.floor(DEFAULT_FRACTURES * (config?.density ?? 1.0)));
        this.mesh.count = this.fractureCount;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createFractureMaterial(config.color1 ?? 0x00ffff, config.color2 ?? 0xff00ff);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount(BUDGET_ID, this.fractureCount);
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

        const timeNow = performance.now() * 0.001;

        for (let i = 0; i < this.fractureCount; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            const d = this.data[i];
            const parallaxFactor = 150.0 / Math.abs(dummyObj.position.z);

            const driftSpeed = 3.0 * this.speedMultiplier * d.speedOffset;
            const totalSpeed = driftSpeed + (playerSpeed * parallaxFactor);

            dummyObj.position.x -= delta * totalSpeed;

            // Slow rotation
            dummyObj.rotation.z += d.rotSpeedZ * delta * this.speedMultiplier;

            // Breathing effect
            const pulse = 1.0 + Math.sin(timeNow * 1.5 + i) * 0.05;

            // Reapply flattened scale
            dummyObj.scale.set(d.scaleOffset * 0.3 * pulse, d.scaleOffset * 1.5 * pulse, d.scaleOffset * 0.01);

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
