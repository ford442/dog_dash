import * as THREE from 'three';
import { time, vec3, color, uniform, sin, cos, positionLocal, positionWorld, length, smoothstep } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

export class WishLanternSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 80;
    width: number = 300;
    uPlayerPos = uniform(vec3(0, 0, 0));

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 8, 1, true);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        const baseColor = color(0xffcc88);
        const yPos = positionLocal.y.add(0.3);
        const glow = smoothstep(0.0, 0.6, yPos);

        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        const interactGlow = smoothstep(20.0, 0.0, distToPlayer);

        const finalColor = baseColor.mul(glow.add(0.5)).add(color(0xffaadd).mul(interactGlow));

        mat.colorNode = finalColor;

        const t = time.mul(2.0).add(positionWorld.x);
        mat.positionNode = positionLocal.add(vec3(sin(t).mul(0.1), cos(t.mul(0.8)).mul(0.1), 0));

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * 20,
                -10 - Math.random() * 40
            );

            dummy.rotation.set(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * Math.PI,
                (Math.random() - 0.5) * 0.2
            );

            const scale = 0.5 + Math.random() * 0.8;
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
            this.uPlayerPos.value.copy(playerPos);
        }

        const margin = 50;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();

        for (let i = 0; i < this.count; i++) {
            this.mesh.getMatrixAt(i, matrix);
            pos.setFromMatrixPosition(matrix);

            pos.y += delta * (0.5 + (i % 3) * 0.2);

            if (pos.x < limitBack) {
                pos.x += this.width + margin * 2;
                pos.y = -15 - Math.random() * 10;
            }
            if (pos.x > limitFront) {
                pos.x -= this.width + margin * 2;
                pos.y = -15 - Math.random() * 10;
            }

            if (pos.y > 20) {
                pos.y = -15 - Math.random() * 10;
                pos.x = cameraX + (Math.random() - 0.5) * this.width;
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
