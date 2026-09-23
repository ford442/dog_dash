import * as THREE from 'three';
import { time, vec3, vec4, color, uniform, sin, mix, positionLocal, positionWorld, length, smoothstep, abs, normalWorld } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface PrismaticCrystalsConfig {
    enabled: boolean;
    density?: number;
    color1?: number;
    color2?: number;
}

const MAX_CRYSTALS = 25;

function createPrismaticMaterial(color1: number, color2: number, uSpeed: any, uPlayerPos: any) {
    const mat = new MeshStandardNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
        roughness: 0.1,
        metalness: 0.8
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const t = time.mul(uSpeed).add(positionLocal.x.mul(0.01));
    const noiseVal = fbm(normalWorld.xyz.add(t));
    const mixFactor = sin(t.mul(2.0).add(noiseVal.mul(4.0))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const glowIntensity = smoothstep(150.0, 0.0, distToPlayer);
    const finalColor = baseColor.add(color(0xffffff).mul(glowIntensity.mul(0.35)));
    const fade = smoothstep(1.0, 0.2, abs(positionLocal.z).div(20.0));

    mat.colorNode = vec4(finalColor, fade.mul(0.8));
    mat.emissiveNode = finalColor.mul(0.4);

    return mat;
}

export class PrismaticCrystalsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh!: THREE.InstancedMesh;

    crystalCount: number = MAX_CRYSTALS;
    uSpeed = uniform(1.0);
    uPlayerPos = uniform(vec3(0, 0, 0));
    width: number = 1800;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.DodecahedronGeometry(15, 0);
        const mat = createPrismaticMaterial(0x00ffff, 0xff00ff, this.uSpeed, this.uPlayerPos);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.crystalCount);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -10;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.crystalCount; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 120;
            const z = -80 - Math.random() * 80;
            dummy.position.set(x, y, z);

            dummy.rotation.x = Math.random() * Math.PI;
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.rotation.z = Math.random() * Math.PI;

            const scale = 0.5 + Math.random() * 1.5;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('prismatic_crystals', {
            label: 'Prismatic Crystals',
            category: 'background3d',
            maxActive: this.crystalCount
        });

        this.deactivate();
    }

    activate(config?: PrismaticCrystalsConfig) {
        if (this.active) return;
        this.active = true;
        this.crystalCount = Math.floor(MAX_CRYSTALS * (config?.density ?? 1.0));
        this.mesh.count = this.crystalCount;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createPrismaticMaterial(
                config.color1 ?? 0x00ffff,
                config.color2 ?? 0xff00ff,
                this.uSpeed,
                this.uPlayerPos
            );
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('prismatic_crystals', this.crystalCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('prismatic_crystals', 0);
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3, playerSpeed: number = 8) {
        if (!this.active) return;

        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }
        this.uSpeed.value = playerSpeed * 0.1;

        const dummy = new THREE.Object3D();
        const mat4 = new THREE.Matrix4();
        const margin = 200;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.crystalCount; i++) {
            this.mesh.getMatrixAt(i, mat4);
            mat4.decompose(dummy.position, dummy.quaternion, dummy.scale);

            dummy.position.x -= delta * (5.0 + (i % 3) + playerSpeed * 0.05);
            dummy.rotation.x += delta * 0.1;
            dummy.rotation.y += delta * 0.15;

            if (dummy.position.x < limitBack) {
                dummy.position.x += this.width + margin * 2;
                dummy.position.y = (Math.random() - 0.5) * 120;
            } else if (dummy.position.x > limitFront) {
                dummy.position.x -= this.width + margin * 2;
                dummy.position.y = (Math.random() - 0.5) * 120;
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
            this.mesh.material.forEach((m: THREE.Material) => m.dispose());
        } else {
            this.mesh.material.dispose();
        }
        decorationBudget.syncCount('prismatic_crystals', 0);
    }
}
