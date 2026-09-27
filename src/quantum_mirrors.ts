import * as THREE from 'three';
import { time, vec3, color, float, positionLocal, normalLocal, sin, cos, mix } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export type QuantumMirrorsConfig = {
    density?: number;
    speed?: number;
};

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

export class QuantumMirrorsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    baseCount: number = 30; // Small cap as requested
    count: number = 0;
    width: number = 1200;
    height: number = 400;
    depth: number = 400;
    speedMultiplier: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Use Icosahedron for jagged crystal/mirror shard look
        const geo = new THREE.IcosahedronGeometry(2, 0);

        // One-time vertex displacement for jaggedness
        const posAttr = geo.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i);
            const noise = (Math.random() - 0.5) * 1.5;
            v.add(v.clone().normalize().multiplyScalar(noise));
            posAttr.setXYZ(i, v.x, v.y, v.z);
        }
        geo.computeVertexNormals();

        const mat = new MeshStandardNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            metalness: 0.9,
            roughness: 0.1
        });

        const uTime = time;
        // Prism-like chromatic shift based on time and position
        const pulse = sin(uTime.mul(1.5).add(positionLocal.x).add(positionLocal.y)).mul(0.5).add(0.5);
        const mirrorColor = mix(color(0x00ffff), color(0xff00ff), pulse);

        // Add a subtle shimmering glow
        const shimmer = cos(uTime.mul(3.0).add(normalLocal.x.mul(5.0))).mul(0.2).add(0.8);

        mat.colorNode = mirrorColor;
        mat.emissiveNode = mirrorColor.mul(pulse.add(0.2)).mul(shimmer);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.baseCount);
        this.mesh.frustumCulled = false;
        // Draw slightly behind main obstacles
        this.mesh.renderOrder = -5;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.baseCount; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                (Math.random() - 0.5) * this.depth - 150
            );
            dummy.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            // Uniform or near-uniform scale as requested
            const scale = 0.8 + Math.random() * 0.4;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(this.mesh);

        decorationBudget.register('quantumMirrors', {
            label: 'Quantum Mirrors',
            category: 'background3d',
            maxActive: this.baseCount
        });

        this.deactivate();
    }

    activate(config?: QuantumMirrorsConfig) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        const density = config?.density ?? 1.0;
        this.count = Math.floor(this.baseCount * density);
        this.mesh.count = this.count;
        this.speedMultiplier = config?.speed ?? 1.0;

        decorationBudget.syncCount('quantumMirrors', this.count);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('quantumMirrors', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 10) {
        if (!this.active) return;


        // Base drift speed plus parallax from player speed
        const speed = (5 * this.speedMultiplier) + (playerSpeed * 0.5);

        for (let i = 0; i < this.count; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            dummyObj.position.x -= speed * delta;

            // Complex rotation to simulate tumbling shards
            dummyObj.rotation.x += delta * 0.8 * (i % 2 === 0 ? 1 : -1);
            dummyObj.rotation.y += delta * 0.4 * (i % 3 === 0 ? 1 : -1);
            dummyObj.rotation.z += delta * 0.6;

            const margin = 200;
            const limitBack = cameraX - (this.width / 2) - margin;
            if (dummyObj.position.x < limitBack) {
                // Ensure particles snap correctly to camera region
                while (dummyObj.position.x < limitBack) {
                    dummyObj.position.x += this.width + margin * 2;
                }
                dummyObj.position.y = (Math.random() - 0.5) * this.height;
                dummyObj.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
            }

            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as any).dispose?.();
        decorationBudget.syncCount('quantumMirrors', 0);
    }
}
