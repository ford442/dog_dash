import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, uniform, mix, float, step, fract, uv, sin } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface AscendantMonolithsConfig {
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_MONOLITHS = 10;
const DEFAULT_MONOLITHS = 5;

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createMonolithMaterial(color1: number, color2: number) {
    const mat = new MeshStandardNodeMaterial({
        color: 0x111111,
        roughness: 0.9,
        metalness: 0.1,
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // Scroll vertically for runes
    const scrollUv = vec2(baseUv.x, baseUv.y.add(time.mul(0.2)));

    // Runic noise pattern using high frequency FBM and stepping to create sharp shapes
    const noiseVal = fbm(vec3(scrollUv.x.mul(20.0), scrollUv.y.mul(20.0), time.mul(0.05)));
    const runicPattern = step(0.65, fract(noiseVal.mul(5.0)));

    // Grid lines for structure
    const gridX = step(0.95, fract(baseUv.x.mul(20.0)));
    const gridY = step(0.95, fract(baseUv.y.mul(4.0)));
    const grid = gridX.add(gridY).clamp(0.0, 1.0);

    // Combine runes with subtle grid
    const structureDetails = runicPattern.add(grid.mul(0.2));

    // Mix colors over time and position
    const mixFactor = sin(baseUv.y.mul(5.0).add(time.mul(0.5))).mul(0.5).add(0.5);
    const glowColor = mix(c1, c2, mixFactor);

    mat.emissiveNode = glowColor.mul(structureDetails).mul(2.0);

    return mat;
}

export class AscendantMonolithsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    monolithCount: number = DEFAULT_MONOLITHS;
    width: number = 6000;
    height: number = 3000;
    depth: number = 2000;
    speedMultiplier: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // BoxGeometry for massive rectangular monoliths
        const geo = new THREE.BoxGeometry(400, 2000, 200);

        // Default colors: mysterious alien green and deep purple
        const mat = createMonolithMaterial(0x00ff44, 0x8800ff);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_MONOLITHS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -20; // Deep background

        for (let i = 0; i < MAX_MONOLITHS; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                -500 + Math.random() * 1000,
                -1000 - Math.random() * this.depth
            );

            // Angle them slightly but mostly upright
            dummyObj.rotation.set(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.2
            );

            const scaleX = 0.5 + Math.random();
            const scaleY = 0.8 + Math.random() * 1.5;
            const scaleZ = 0.5 + Math.random();
            dummyObj.scale.set(scaleX, scaleY, scaleZ);
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('ascendantMonoliths', {
            label: 'Ascendant Monoliths',
            category: 'background3d',
            maxActive: this.monolithCount
        });

        this.deactivate();
    }

    activate(config?: AscendantMonolithsConfig) {
        if (this.active) return;
        this.active = true;
        this.monolithCount = Math.min(MAX_MONOLITHS, Math.floor(DEFAULT_MONOLITHS * (config?.density ?? 1.0)));
        this.mesh.count = this.monolithCount;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createMonolithMaterial(config.color1 ?? 0x00ff44, config.color2 ?? 0x8800ff);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('ascendantMonoliths', this.monolithCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('ascendantMonoliths', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const margin = 1000;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.monolithCount; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            // Very slow parallax factor based on immense depth
            const parallaxFactor = 50.0 / Math.abs(dummyObj.position.z);

            // Very slow drift
            dummyObj.position.y += delta * 2.0;
            dummyObj.rotation.y += delta * 0.05;

            // Slow natural drift + player parallax
            const driftSpeed = 0.2 * this.speedMultiplier;
            const totalSpeed = driftSpeed + (playerSpeed * parallaxFactor);

            dummyObj.position.x -= delta * totalSpeed;

            if (dummyObj.position.x < limitBack) {
                dummyObj.position.x += this.width + margin * 2;
                dummyObj.position.y = -1000 - Math.random() * 500; // Reset height to bottom
            } else if (dummyObj.position.x > limitFront) {
                dummyObj.position.x -= this.width + margin * 2;
                dummyObj.position.y = -1000 - Math.random() * 500;
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
        decorationBudget.syncCount('ascendantMonoliths', 0);
    }
}
