import * as THREE from 'three';
import { time, vec3, color, positionLocal, distance, mix, smoothstep, uniform } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

export type ComboCorridorEnvironmentConfig = {
    density?: number;
};

export class ComboCorridorSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    private count = 50; // default count
    private uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
    private spacing = 40; // spacing between rings
    private width: number;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.width = this.count * this.spacing;

        const geo = new THREE.TorusGeometry(12, 0.4, 8, 32);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });

        // TSL Shader
        const distToPlayer = distance(positionLocal, this.uPlayerPos);
        const glowIntensity = smoothstep(50.0, 5.0, distToPlayer);

        const baseColor = color(0x004488);
        const highlightColor = color(0x00ffff);

        // Add some breathing animation
        const pulse = mix(0.8, 1.0, time.mul(2.0).sin().add(1.0).mul(0.5));

        mat.colorNode = mix(baseColor, highlightColor, glowIntensity).mul(pulse);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            dummy.position.set(i * this.spacing, 0, -10); // positioned in the background
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: ComboCorridorEnvironmentConfig) {
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

        // Parallax wrap
        const dummy = new THREE.Object3D();
        let position = new THREE.Vector3();
        let quaternion = new THREE.Quaternion();
        let scale = new THREE.Vector3();

        for (let i = 0; i < this.count; i++) {
            this.mesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(position, quaternion, scale);

            const margin = this.spacing;
            const limitBack = cameraX - margin;
            const limitFront = cameraX + this.width - margin;

            if (position.x < limitBack) {
                position.x += this.width;
            } else if (position.x > limitFront) {
                position.x -= this.width;
            }

            dummy.position.copy(position);
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
