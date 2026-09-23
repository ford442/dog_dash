import * as THREE from 'three';
import { time, vec3, color, uniform, sin, mix, positionWorld, normalLocal, normalView, cameraPosition, length, smoothstep, max } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export interface PrismaticCrystalsConfig {
    density?: number;
    color1?: number;
    color2?: number;
}

const MAX_CRYSTALS = 80;

function createCrystalMaterial(color1: number, color2: number, uPlayerPos: any) {
    const mat = new MeshStandardNodeMaterial({
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const c1 = color(color1);
    const c2 = color(color2);

    // Iridescence/Prismatic effect based on normal and view
    const viewDir = vec3(0, 0, 1); // Simple view dir for instanced
    const fresnel = max(0.0, vec3(1.0).sub(normalView).dot(viewDir));
    const prismaticColor = mix(c1, c2, sin(fresnel.mul(10.0).add(time.mul(2.0))).mul(0.5).add(0.5));

    // Player interaction glow
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const glowIntensity = smoothstep(150.0, 0.0, distToPlayer);
    const finalColor = prismaticColor.add(color(0xffffff).mul(glowIntensity.mul(0.5)));

    mat.colorNode = finalColor;
    mat.emissiveNode = finalColor.mul(0.2);

    return mat;
}

export class PrismaticCrystalsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh!: THREE.InstancedMesh;

    crystalCount: number = MAX_CRYSTALS;
    width: number = 2000;
    uPlayerPos = uniform(vec3(0, 0, 0));

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Use Octahedron for crystal shape
        const geo = new THREE.OctahedronGeometry(4, 0);
        // Elongate it to look more like a crystal
        geo.scale(0.5, 1.5, 0.5);

        const mat = createCrystalMaterial(0x00ffff, 0xff00ff, this.uPlayerPos);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.crystalCount);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -5;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.crystalCount; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 120;
            const z = -20 - Math.random() * 80;
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
            const mat = createCrystalMaterial(config.color1 ?? 0x00ffff, config.color2 ?? 0xff00ff, this.uPlayerPos);
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

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        const dummy = new THREE.Object3D();
        const mat4 = new THREE.Matrix4();
        const margin = 200;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.crystalCount; i++) {
            this.mesh.getMatrixAt(i, mat4);
            mat4.decompose(dummy.position, dummy.quaternion, dummy.scale);

            // Drift slowly left and spin
            dummy.position.x -= delta * 15.0 * (1.0 / dummy.scale.x); // parallax based on size

            // Spin
            dummy.rotation.x += delta * 0.2;
            dummy.rotation.y += delta * 0.3;

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
            this.mesh.material.forEach(m => m.dispose());
        } else {
            this.mesh.material.dispose();
        }
        decorationBudget.syncCount('prismatic_crystals', 0);
    }
}
