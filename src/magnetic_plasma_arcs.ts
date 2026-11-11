import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, uniform, mix, float, step, fract, uv, sin } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface MagneticPlasmaArcsConfig {
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_ARCS = 20;
const DEFAULT_ARCS = 10;

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createPlasmaArcMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // Scroll along the arc length (x-axis for TorusGeometry UVs)
    const scrollUv = vec2(baseUv.x.add(time.mul(0.4)), baseUv.y);

    // Flowing plasma noise
    const noiseVal = fbm(vec3(scrollUv.x.mul(8.0), scrollUv.y.mul(4.0), time.mul(0.2)));

    // Edge fading along the arc's thickness
    const coreDist = float(0.5).sub(baseUv.y).abs();
    const coreGlow = float(1.0).sub(coreDist.mul(3.0)).max(0.0);

    // Fade ends of the arc
    const fadeEnd = baseUv.x.mul(float(1.0).sub(baseUv.x)).mul(4.0);

    const intensity = coreGlow.mul(noiseVal.add(0.2)).mul(fadeEnd).mul(1.5);

    // Mix colors over time and position
    const mixFactor = sin(baseUv.x.mul(5.0).add(time.mul(0.5))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    mat.colorNode = vec4(baseColor, intensity);

    return mat;
}

export class MagneticPlasmaArcsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    arcCount: number = DEFAULT_ARCS;
    width: number = 4000;
    height: number = 2000;
    depth: number = 1000;
    speedMultiplier: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // TorusGeometry for arcs (half circle)
        // radius, tube, radialSegments, tubularSegments, arc
        const geo = new THREE.TorusGeometry(300, 40, 8, 64, Math.PI);

        // Default colors: fiery orange and deep red
        const mat = createPlasmaArcMaterial(0xff5500, 0xff0000);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_ARCS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -18; // Deep background

        for (let i = 0; i < MAX_ARCS; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                -300 + Math.random() * 200, // Erupting from the bottom
                -600 - Math.random() * this.depth
            );

            // Angle them slightly towards/away from camera and random roll
            dummyObj.rotation.set(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.2
            );

            const scale = 0.5 + Math.random() * 2.0;
            dummyObj.scale.set(scale, scale, scale);
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('magneticPlasmaArcs', {
            label: 'Magnetic Plasma Arcs',
            category: 'background3d',
            maxActive: this.arcCount
        });

        this.deactivate();
    }

    activate(config?: MagneticPlasmaArcsConfig) {
        if (this.active) return;
        this.active = true;
        this.arcCount = Math.min(MAX_ARCS, Math.floor(DEFAULT_ARCS * (config?.density ?? 1.0)));
        this.mesh.count = this.arcCount;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createPlasmaArcMaterial(config.color1 ?? 0xff5500, config.color2 ?? 0xff0000);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('magneticPlasmaArcs', this.arcCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('magneticPlasmaArcs', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const margin = 1500;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.arcCount; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            // Parallax factor based on depth
            const parallaxFactor = 150.0 / Math.abs(dummyObj.position.z);

            // Slow natural drift + player parallax
            const driftSpeed = 3.0 * this.speedMultiplier;
            const totalSpeed = driftSpeed + (playerSpeed * parallaxFactor);

            dummyObj.position.x -= delta * totalSpeed;

            if (dummyObj.position.x < limitBack) {
                dummyObj.position.x += this.width + margin * 2;
                dummyObj.position.y = -300 + Math.random() * 200;
            } else if (dummyObj.position.x > limitFront) {
                dummyObj.position.x -= this.width + margin * 2;
                dummyObj.position.y = -300 + Math.random() * 200;
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
        decorationBudget.syncCount('magneticPlasmaArcs', 0);
    }
}
