import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, uniform, mix, float, step, fract, uv, sin } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface OrbitalMegastructuresConfig {
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_STRUCTURES = 10;
const DEFAULT_STRUCTURES = 5;

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createMegastructureMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // Scroll along the structure length
    const scrollUv = vec2(baseUv.x.add(time.mul(0.1)), baseUv.y);

    // Flowing circuitry noise
    const noiseVal = fbm(vec3(scrollUv.x.mul(12.0), scrollUv.y.mul(2.0), time.mul(0.05)));

    // Grid lines for scale
    const gridX = step(0.9, fract(baseUv.x.mul(50.0)));
    const gridY = step(0.9, fract(baseUv.y.mul(10.0)));
    const grid = gridX.add(gridY).clamp(0.0, 1.0);

    // Edge fading along the structure's thickness
    const coreDist = float(0.5).sub(baseUv.y).abs();
    const coreGlow = float(1.0).sub(coreDist.mul(2.0)).max(0.0);

    // Fade ends of the structure
    const fadeEnd = baseUv.x.mul(float(1.0).sub(baseUv.x)).mul(4.0);

    // Combine circuitry with structural grid
    const structureDetails = noiseVal.add(grid.mul(0.5)).mul(coreGlow);
    const intensity = structureDetails.mul(fadeEnd).mul(0.8);

    // Mix colors over time and position
    const mixFactor = sin(baseUv.x.mul(3.0).add(time.mul(0.2))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    mat.colorNode = vec4(baseColor, intensity);

    return mat;
}

export class OrbitalMegastructuresSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    structureCount: number = DEFAULT_STRUCTURES;
    width: number = 6000;
    height: number = 3000;
    depth: number = 2000;
    speedMultiplier: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // TorusGeometry for massive orbital rings
        // radius, tube, radialSegments, tubularSegments, arc
        const geo = new THREE.TorusGeometry(800, 100, 16, 128, Math.PI * 1.5);

        // Default colors: tech cyan and deep blue
        const mat = createMegastructureMaterial(0x00ffff, 0x0000ff);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_STRUCTURES);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -25; // Very deep background

        for (let i = 0; i < MAX_STRUCTURES; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                -500 + Math.random() * 1000,
                -1000 - Math.random() * this.depth
            );

            // Angle them to look like broken orbital rings
            dummyObj.rotation.set(
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 0.5
            );

            const scale = 1.0 + Math.random() * 3.0;
            dummyObj.scale.set(scale, scale, scale);
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('orbitalMegastructures', {
            label: 'Orbital Megastructures',
            category: 'background3d',
            maxActive: this.structureCount
        });

        this.deactivate();
    }

    activate(config?: OrbitalMegastructuresConfig) {
        if (this.active) return;
        this.active = true;
        this.structureCount = Math.min(MAX_STRUCTURES, Math.floor(DEFAULT_STRUCTURES * (config?.density ?? 1.0)));
        this.mesh.count = this.structureCount;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createMegastructureMaterial(config.color1 ?? 0x00ffff, config.color2 ?? 0x0000ff);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('orbitalMegastructures', this.structureCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('orbitalMegastructures', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const margin = 2000;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.structureCount; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            // Very slow parallax factor based on immense depth
            const parallaxFactor = 50.0 / Math.abs(dummyObj.position.z);

            // Very slow rotation
            dummyObj.rotation.z += delta * 0.02;

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
        decorationBudget.syncCount('orbitalMegastructures', 0);
    }
}
