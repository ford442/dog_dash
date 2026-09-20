import * as THREE from 'three';
import { time, vec3, vec4, color, uniform, sin, mix, positionLocal, float, smoothstep, fract, abs, uv, step, length } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface EnergyRiftsConfig {
    enabled: boolean;
    density?: number;
    color1?: number;
    color2?: number;
}

const MAX_RIFTS = 30;

function createRiftMaterial(color1: number, color2: number, uSpeed: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const scroll = time.mul(uSpeed).mul(0.5);
    const noiseUv = uv().mul(4.0);
    // fbm gives a noise value
    const noiseVal = fbm(noiseUv.add(scroll));

    const mixFactor = sin(time.mul(2.0).add(noiseVal.mul(4.0))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    // Fade edges (shape it like a vertical rift)
    const fadeX = smoothstep(0.5, 0.0, abs(uv().x.sub(0.5)).add(noiseVal.mul(0.2)));
    const fadeY = smoothstep(0.5, 0.3, abs(uv().y.sub(0.5)));

    mat.colorNode = vec4(baseColor, fadeX.mul(fadeY).mul(0.9));

    return mat;
}

export class EnergyRiftsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh!: THREE.InstancedMesh;

    riftCount: number = MAX_RIFTS;
    uSpeed = uniform(1.0);
    width: number = 1600;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.PlaneGeometry(10, 40);
        const mat = createRiftMaterial(0x00ffff, 0xff00ff, this.uSpeed);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.riftCount);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -12; // Far background

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.riftCount; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 80;
            const z = -50 - Math.random() * 50;
            dummy.position.set(x, y, z);
            // Slight tilt
            dummy.rotation.z = (Math.random() - 0.5) * 0.2;
            const scale = 0.5 + Math.random();
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('energy_rifts', {
            label: 'Energy Rifts',
            category: 'background3d',
            maxActive: this.riftCount
        });

        this.deactivate();
    }

    activate(config?: EnergyRiftsConfig) {
        if (this.active) return;
        this.active = true;
        this.riftCount = Math.floor(MAX_RIFTS * (config?.density ?? 1.0));
        this.mesh.count = this.riftCount;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createRiftMaterial(config.color1 ?? 0x00ffff, config.color2 ?? 0xff00ff, this.uSpeed);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('energy_rifts', this.riftCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('energy_rifts', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        this.uSpeed.value = playerSpeed * 0.1;

        const dummy = new THREE.Object3D();
        const mat4 = new THREE.Matrix4();
        const margin = 200;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.riftCount; i++) {
            this.mesh.getMatrixAt(i, mat4);
            mat4.decompose(dummy.position, dummy.quaternion, dummy.scale);

            // Drift slowly left
            dummy.position.x -= delta * 5.0;

            if (dummy.position.x < limitBack) {
                dummy.position.x += this.width + margin * 2;
                dummy.position.y = (Math.random() - 0.5) * 80;
            } else if (dummy.position.x > limitFront) {
                dummy.position.x -= this.width + margin * 2;
                dummy.position.y = (Math.random() - 0.5) * 80;
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
        decorationBudget.syncCount('energy_rifts', 0);
    }
}
