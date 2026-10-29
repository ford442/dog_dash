import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, mix, float, step, fract, uv, sin, length, smoothstep } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface CosmicStringHorizonsConfig {
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_STRINGS = 10;
const DEFAULT_STRINGS = 3;
const BUDGET_ID = 'cosmicStringHorizons';

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createStringMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // Distance to center to create a string shape (fading out at edges horizontally)
    // baseUv.x goes from 0 to 1 across the width of the cylinder/plane
    // We want the center (0.5) to be brightest
    const distToCenter = length(baseUv.x.sub(0.5));
    const edgeFade = smoothstep(0.4, 0.0, distToCenter);

    // High frequency vibration using sine waves and time
    const vibration = sin(baseUv.y.mul(50.0).add(time.mul(20.0))).mul(0.05);
    const stringDist = distToCenter.add(vibration);
    const coreGlow = smoothstep(0.1, 0.0, stringDist).mul(2.0);

    // Energy spikes traveling along the string
    const scrollUv = vec2(baseUv.x, baseUv.y.add(time.mul(1.5)));
    const energyNoise = fbm(vec3(scrollUv.x.mul(10.0), scrollUv.y.mul(5.0), time.mul(0.5)));
    // Isolate bright spots
    const energySpikes = smoothstep(0.6, 0.8, energyNoise).mul(1.5);

    const intensity = edgeFade.mul(0.5).add(coreGlow).add(energySpikes);

    // Chromatic edge shift
    const colorMixFactor = sin(baseUv.y.mul(10.0).add(time)).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, colorMixFactor);

    mat.colorNode = vec4(baseColor, intensity.mul(0.8));

    return mat;
}

export class CosmicStringHorizonsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    stringCount: number = DEFAULT_STRINGS;
    width: number = 8000;
    height: number = 6000;
    depth: number = 4000;
    speedMultiplier: number = 1.0;

    private data: { speedOffset: number, scaleOffset: number, rotSpeedZ: number }[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Thin, long cylinder for the string
        const geo = new THREE.CylinderGeometry(10, 10, 6000, 8, 1);

        // Colors: Intense Magenta and Electric Blue
        const mat = createStringMaterial(0xff00ff, 0x00ffff);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_STRINGS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -19; // Deep background

        for (let i = 0; i < MAX_STRINGS; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                -2000 - Math.random() * this.depth
            );

            // Rotate mostly horizontal or vertical with some randomness
            dummyObj.rotation.set(
                0,
                0,
                (Math.random() - 0.5) * Math.PI
            );

            const scale = 0.5 + Math.random() * 2.5;
            dummyObj.scale.set(scale, 1.0, scale); // Scale radius, keep length
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);

            this.data.push({
                speedOffset: 0.1 + Math.random() * 0.4, // Move slowly
                scaleOffset: scale,
                rotSpeedZ: (Math.random() - 0.5) * 0.02, // Very slow rotation
            });
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register(BUDGET_ID, {
            label: 'Cosmic String Horizons',
            category: 'background3d',
            maxActive: MAX_STRINGS
        });

        this.deactivate();
    }

    activate(config?: CosmicStringHorizonsConfig) {
        if (this.active) return;
        this.active = true;
        this.stringCount = Math.min(MAX_STRINGS, Math.max(1, Math.floor(DEFAULT_STRINGS * (config?.density ?? 1.0))));
        this.mesh.count = this.stringCount;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createStringMaterial(config.color1 ?? 0xff00ff, config.color2 ?? 0x00ffff);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount(BUDGET_ID, this.stringCount);
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

        const timeNow = performance.now() * 0.001;

        for (let i = 0; i < this.stringCount; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            const d = this.data[i];
            const parallaxFactor = 100.0 / Math.abs(dummyObj.position.z);

            const driftSpeed = 2.0 * this.speedMultiplier * d.speedOffset;
            const totalSpeed = driftSpeed + (playerSpeed * parallaxFactor);

            dummyObj.position.x -= delta * totalSpeed;

            // Slow rotation
            dummyObj.rotation.z += d.rotSpeedZ * delta * this.speedMultiplier;

            // Subtle pulsing thickness
            const pulse = 1.0 + Math.sin(timeNow * 2.0 + i) * 0.1;
            dummyObj.scale.set(d.scaleOffset * pulse, 1.0, d.scaleOffset * pulse);

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
