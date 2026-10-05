import * as THREE from 'three';
import { time, vec3, color, float, positionLocal, normalLocal, sin, mix } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';

export type BioluminescentSporesConfig = {
    density?: number;
    speed?: number;
};

export class BioluminescentSporesSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    baseCount: number = 200;
    count: number = 0;
    width: number = 800;
    height: number = 100;
    depth: number = 200;
    speedMultiplier: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.DodecahedronGeometry(0.8, 1);

        const mat = new MeshStandardNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const uTime = time;
        const pulse = sin(uTime.mul(2.0).add(positionLocal.x)).mul(0.5).add(0.5);
        const bioColor = mix(color(0x00ffaa), color(0x00aaff), pulse);

        mat.colorNode = bioColor;
        mat.emissiveNode = bioColor.mul(pulse.add(0.5));

        this.mesh = new THREE.InstancedMesh(geo, mat, this.baseCount);
        this.mesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.baseCount; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                (Math.random() - 0.5) * this.depth - 100
            );
            dummy.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            const scale = 0.5 + Math.random() * 1.5;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: BioluminescentSporesConfig) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        const density = config?.density ?? 1.0;
        this.count = Math.floor(this.baseCount * density);
        this.mesh.count = this.count;
        this.speedMultiplier = config?.speed ?? 1.0;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        const dummy = new THREE.Object3D();
        const mat4 = new THREE.Matrix4();
        const speed = 10 * this.speedMultiplier;

        for (let i = 0; i < this.count; i++) {
            this.mesh.getMatrixAt(i, mat4);
            mat4.decompose(dummy.position, dummy.quaternion, dummy.scale);

            dummy.position.x -= speed * delta;

            // Drift vertically and randomly
            dummy.position.y += Math.sin(Date.now() * 0.001 + i) * delta * 2;

            dummy.rotation.x += delta * 0.5;
            dummy.rotation.y += delta * 0.3;

            const margin = 100;
            const limitBack = cameraX - (this.width / 2) - margin;
            if (dummy.position.x < limitBack) {
                dummy.position.x += this.width + margin * 2;
                dummy.position.y = (Math.random() - 0.5) * this.height;
            }

            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as any).dispose?.();
    }
}
