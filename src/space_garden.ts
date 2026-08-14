import * as THREE from 'three';
import { time, vec3, color, positionLocal, positionWorld } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

export class SpaceGardenSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 80;
    width: number = 300;
    uPlayerPos = new THREE.Vector3();

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.SphereGeometry(1.5, 8, 8);
        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const baseColor = color(0x55ff88);
        const pulse = time.mul(2.0).add(positionWorld.x.mul(0.1));
        mat.colorNode = baseColor.mul(pulse.sin().mul(0.5).add(0.5));

        mat.positionNode = positionLocal.add(vec3(0, time.mul(1.5).add(positionWorld.x).sin().mul(0.5), 0));

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * this.width,
                Math.random() * 20 + 5,
                (Math.random() - 0.5) * 50 - 40
            );
            const scale = 0.5 + Math.random() * 1.5;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;
        if (playerPos) {
            this.uPlayerPos.copy(playerPos);
        }

        const margin = 50;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();

        for (let i = 0; i < this.count; i++) {
            this.mesh.getMatrixAt(i, matrix);
            pos.setFromMatrixPosition(matrix);

            pos.x -= delta * 5.0;

            if (pos.x < limitBack) {
                pos.x += this.width + margin * 2;
                pos.y = Math.random() * 20 + 5;
            }
            if (pos.x > limitFront) {
                pos.x -= this.width + margin * 2;
                pos.y = Math.random() * 20 + 5;
            }

            matrix.setPosition(pos);
            this.mesh.setMatrixAt(i, matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as any).dispose?.();
    }
}
