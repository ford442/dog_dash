import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, uniform, mix, float, step, fract, uv, sin } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface CosmicWebFilamentsConfig {
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_FILAMENTS = 15; // Max buffer size
const DEFAULT_FILAMENTS = 8;

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createFilamentMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // Create scrolling energy effect along the length (y-axis)
    const scrollUv = vec2(baseUv.x, baseUv.y.add(time.mul(0.3)));

    // Noise to create organic pulses
    const noiseVal = fbm(vec3(scrollUv.x.mul(5.0), scrollUv.y.mul(2.0), time.mul(0.1)));

    // Thin glowing core
    const coreDist = float(0.5).sub(baseUv.x).abs();
    const coreGlow = float(1.0).sub(coreDist.mul(4.0)).max(0.0);

    // Energy pulses based on noise
    const energyPulse = sin(scrollUv.y.mul(10.0).add(noiseVal.mul(5.0))).mul(0.5).add(0.5);

    // Fade at top and bottom ends
    const fadeY = baseUv.y.mul(float(1.0).sub(baseUv.y)).mul(4.0);

    // Combine core glow, energy pulse and noise
    const intensity = coreGlow.mul(energyPulse.add(noiseVal)).mul(fadeY).mul(0.8);

    // Mix colors based on position
    const mixFactor = sin(baseUv.y.mul(3.0).add(time.mul(0.2))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    mat.colorNode = vec4(baseColor, intensity);

    return mat;
}

export class CosmicWebFilamentsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    filamentCount: number = DEFAULT_FILAMENTS;
    width: number = 3000;
    height: number = 2000;
    depth: number = 800;
    speedMultiplier: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Use long, thin planes for the filaments
        const geo = new THREE.PlaneGeometry(100, 2000, 1, 1);
        // Default colors: deep space cyan and purple/blue
        const mat = createFilamentMaterial(0x00aaff, 0x5500ff);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_FILAMENTS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -20; // Deep background

        for (let i = 0; i < MAX_FILAMENTS; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                -400 - Math.random() * this.depth
            );

            // Randomly angle the filaments to look like a web
            dummyObj.rotation.set(
                0,
                0,
                (Math.random() - 0.5) * Math.PI
            );

            // Vary thickness and length
            const scaleX = 0.5 + Math.random() * 1.5;
            const scaleY = 0.8 + Math.random() * 1.5;
            dummyObj.scale.set(scaleX, scaleY, 1);
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('cosmicWebFilaments', {
            label: 'Cosmic Web Filaments',
            category: 'background3d',
            maxActive: this.filamentCount
        });

        this.deactivate();
    }

    activate(config?: CosmicWebFilamentsConfig) {
        if (this.active) return;
        this.active = true;
        this.filamentCount = Math.min(MAX_FILAMENTS, Math.floor(DEFAULT_FILAMENTS * (config?.density ?? 1.0)));
        this.mesh.count = this.filamentCount;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createFilamentMaterial(config.color1 ?? 0x00aaff, config.color2 ?? 0x5500ff);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('cosmicWebFilaments', this.filamentCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('cosmicWebFilaments', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const margin = 1000;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.filamentCount; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            // Calculate parallax based on depth (z)
            // Filaments are at z between -400 and -1200
            const parallaxFactor = 100.0 / Math.abs(dummyObj.position.z);

            // Base drift plus player-induced parallax
            const driftSpeed = 2.0 * this.speedMultiplier;
            const totalSpeed = driftSpeed + (playerSpeed * parallaxFactor);

            dummyObj.position.x -= delta * totalSpeed;

            // Slow rotation for web-like dynamics
            dummyObj.rotation.z += delta * 0.05 * (i % 2 === 0 ? 1 : -1);

            if (dummyObj.position.x < limitBack) {
                dummyObj.position.x += this.width + margin * 2;
                dummyObj.position.y = (Math.random() - 0.5) * this.height;
                // Re-randomize angle when wrapping
                dummyObj.rotation.z = (Math.random() - 0.5) * Math.PI;
            } else if (dummyObj.position.x > limitFront) {
                dummyObj.position.x -= this.width + margin * 2;
                dummyObj.position.y = (Math.random() - 0.5) * this.height;
                dummyObj.rotation.z = (Math.random() - 0.5) * Math.PI;
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
        decorationBudget.syncCount('cosmicWebFilaments', 0);
    }
}
