import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, uniform, mix, sin, positionLocal, float, smoothstep, fract, abs, uv, step, length } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface HolographicDataStreamsConfig {
    enabled: boolean;
    density?: number;
    color1?: number;
    color2?: number;
}

const MAX_STREAMS = 50;

function createHolographicMaterial(color1: number, color2: number, uSpeed: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    // Scroll data vertically
    const scroll = time.mul(uSpeed).mul(0.8);

    // Create matrix-like data blocks using stepped noise
    const gridUv = uv().mul(vec2(10.0, 40.0)).add(vec2(0.0, scroll));

    const noiseVal = fbm(gridUv);
    const steppedNoise = step(0.6, fract(noiseVal.mul(10.0)));

    const mixFactor = sin(time.mul(1.5).add(uv().x.mul(5.0))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    // Fade edges (shape it like a vertical ribbon)
    const fadeX = smoothstep(0.5, 0.0, abs(uv().x.sub(0.5)));
    const fadeY = smoothstep(0.5, 0.2, abs(uv().y.sub(0.5)));

    // Combine noise blocks with edges
    const alpha = steppedNoise.mul(fadeX).mul(fadeY).mul(0.8);

    mat.colorNode = vec4(baseColor, alpha);

    return mat;
}

export class HolographicDataStreamsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh!: THREE.InstancedMesh;

    streamCount: number = MAX_STREAMS;
    uSpeed = uniform(1.0);
    width: number = 2000;

    dummy = new THREE.Object3D();
    mat4 = new THREE.Matrix4();

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.PlaneGeometry(8, 60);
        const mat = createHolographicMaterial(0x00ffcc, 0x0044ff, this.uSpeed);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.streamCount);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -8; // Mid-background

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.streamCount; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 100;
            const z = -20 - Math.random() * 60;
            dummy.position.set(x, y, z);

            // Randomly tilt some ribbons slightly, keep others vertical
            dummy.rotation.x = (Math.random() - 0.5) * 0.1;
            dummy.rotation.y = (Math.random() - 0.5) * 0.1;
            dummy.rotation.z = (Math.random() - 0.5) * 0.1;

            const scaleY = 0.5 + Math.random();
            const scaleX = 0.5 + Math.random() * 1.5;
            dummy.scale.set(scaleX, scaleY, 1.0);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('holographic_data_streams', {
            label: 'Holographic Data Streams',
            category: 'background3d',
            maxActive: this.streamCount
        });

        this.deactivate();
    }

    activate(config?: HolographicDataStreamsConfig) {
        if (this.active) return;
        this.active = true;
        this.streamCount = Math.min(Math.floor(MAX_STREAMS * (config?.density ?? 1.0)), MAX_STREAMS);
        this.mesh.count = this.streamCount;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createHolographicMaterial(config.color1 ?? 0x00ffcc, config.color2 ?? 0x0044ff, this.uSpeed);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('holographic_data_streams', this.streamCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('holographic_data_streams', 0);
    }

    update(delta: number, cameraX: number, speed: number = 8) {
        if (!this.active) return;

        this.uSpeed.value = 1.0 + speed * 0.05;

        const margin = 200;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.streamCount; i++) {
            this.mesh.getMatrixAt(i, this.mat4);
            this.mat4.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);

            // Drift slowly left to create parallax
            this.dummy.position.x -= delta * (10.0 + this.dummy.position.z * 0.1);

            if (this.dummy.position.x < limitBack) {
                this.dummy.position.x += this.width + margin * 2;
                this.dummy.position.y = (Math.random() - 0.5) * 100;
            } else if (this.dummy.position.x > limitFront) {
                this.dummy.position.x -= this.width + margin * 2;
                this.dummy.position.y = (Math.random() - 0.5) * 100;
            }

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
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
        decorationBudget.syncCount('holographic_data_streams', 0);
    }
}
