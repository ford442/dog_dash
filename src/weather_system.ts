import * as THREE from 'three';
import { time, vec3, color, uniform, sin, cos, positionLocal, positionWorld, length, smoothstep } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

export class WeatherSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 2000;
    width: number = 400;
    height: number = 200;
    depth: number = 100;
    uPlayerPos = uniform(vec3(0, 0, 0));

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // A small vertical dash for rain/snow
        const geo = new THREE.PlaneGeometry(0.2, 2.0);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        const baseColor = color(0xddddff);

        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        // Simple glow if near player
        const interactGlow = smoothstep(30.0, 0.0, distToPlayer);

        mat.colorNode = baseColor.add(color(0xaaaaff).mul(interactGlow));

        // TSL-based swaying (wind effect)
        const t = time.mul(3.0).add(positionWorld.x);
        mat.positionNode = positionLocal.add(vec3(sin(t).mul(0.5), 0, cos(t.mul(0.8)).mul(0.5)));

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                (Math.random() - 0.5) * this.depth - 20
            );

            // Random slight tilt
            dummy.rotation.z = (Math.random() - 0.5) * 0.2;

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

            // Rain falls fast
            pos.y -= delta * (60.0 + (i % 3) * 10.0);
            pos.x -= delta * 20.0; // Wind blows left

            if (pos.x < limitBack) {
                pos.x += this.width + margin * 2;
                pos.y = this.height / 2 + Math.random() * 20;
            }
            if (pos.x > limitFront) {
                pos.x -= this.width + margin * 2;
                pos.y = this.height / 2 + Math.random() * 20;
            }

            if (pos.y < -this.height / 2) {
                pos.y = this.height / 2 + Math.random() * 20;
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
