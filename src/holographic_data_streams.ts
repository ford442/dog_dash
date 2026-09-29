import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, uniform, mix, float, step, fract, uv } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface HolographicDataStreamsConfig {
    enabled: boolean;
    density?: number;
    color1?: number;
    color2?: number;
}

const MAX_STREAMS = 40; // Max buffer size
const DEFAULT_STREAMS = 20;

function createDataStreamMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // Create scrolling grid effect
    const scrollUv = vec2(baseUv.x, baseUv.y.add(time.mul(0.5)));

    // Noise to create gaps in the stream
    const noiseVal = fbm(vec3(scrollUv.x.mul(10.0), scrollUv.y.mul(2.0), time.mul(0.1)));

    // Blocky glitchy pattern
    const blockyUv = vec2(
        step(0.5, fract(baseUv.x.mul(20.0))),
        step(0.5, fract(scrollUv.y.mul(40.0)))
    );

    const isData = blockyUv.x.mul(blockyUv.y).mul(step(0.4, noiseVal));

    const mixFactor = fract(baseUv.y.add(time.mul(0.2)));
    const baseColor = mix(c1, c2, mixFactor);

    // Fade top and bottom
    const fadeY = baseUv.y.mul(float(1.0).sub(baseUv.y)).mul(4.0);

    mat.colorNode = vec4(baseColor, isData.mul(fadeY).mul(0.6));

    return mat;
}

export class HolographicDataStreamsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh!: THREE.InstancedMesh;

    streamCount: number = DEFAULT_STREAMS;
    width: number = 2000;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.PlaneGeometry(100, 600, 1, 1);
        // Default colors: neon cyan and purple
        const mat = createDataStreamMaterial(0x00ffff, 0xff00ff);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_STREAMS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -15;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < MAX_STREAMS; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 600;
            const z = -200 - Math.random() * 300;
            dummy.position.set(x, y, z);

            const scaleX = 0.5 + Math.random();
            const scaleY = 0.5 + Math.random() * 1.5;
            dummy.scale.set(scaleX, scaleY, 1);
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
        this.streamCount = Math.min(MAX_STREAMS, Math.floor(DEFAULT_STREAMS * (config?.density ?? 1.0)));
        this.mesh.count = this.streamCount;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createDataStreamMaterial(config.color1 ?? 0x00ffff, config.color2 ?? 0xff00ff);
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

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const dummy = new THREE.Object3D();
        const mat4 = new THREE.Matrix4();
        const margin = 500;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.streamCount; i++) {
            this.mesh.getMatrixAt(i, mat4);
            mat4.decompose(dummy.position, dummy.quaternion, dummy.scale);

            const parallaxSpeed = 30.0 / Math.abs(dummy.position.z);
            dummy.position.x -= delta * playerSpeed * parallaxSpeed;

            if (dummy.position.x < limitBack) {
                dummy.position.x += this.width + margin * 2;
                dummy.position.y = (Math.random() - 0.5) * 600;
            } else if (dummy.position.x > limitFront) {
                dummy.position.x -= this.width + margin * 2;
                dummy.position.y = (Math.random() - 0.5) * 600;
            }

            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
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
