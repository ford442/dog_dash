import * as THREE from 'three';
import { time, vec3, color, uniform, sin, mix, positionWorld, length, smoothstep } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { disposeObject } from './utils';

export interface ComboCorridorConfig {
    density?: number;
}

export class ComboCorridorSystem {
    scene: THREE.Scene;
    active: boolean = false;
    private mesh!: THREE.InstancedMesh;
    private ringCount: number = 40;

    // TSL Uniforms
    private uTime = uniform(0.0);
    private uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
    private uInteractionRadius = uniform(30.0);

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initRings();
        this.deactivate();
    }

    private initRings() {
        const geo = new THREE.TorusGeometry(8, 0.4, 8, 24);
        geo.rotateY(Math.PI / 2); // Face forward/backward

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        const baseColor = color(0xff00ff); // Neon magenta
        const pulse = sin(this.uTime.mul(4.0).add(positionWorld.x.mul(0.05))).mul(0.5).add(0.5);

        // Player proximity glow
        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        const glowIntensity = smoothstep(this.uInteractionRadius, 0.0, distToPlayer);

        const finalColor = baseColor.mul(pulse.add(0.3)).add(color(0x00ffff).mul(glowIntensity));
        mat.colorNode = finalColor;

        this.mesh = new THREE.InstancedMesh(geo, mat, this.ringCount);
        this.mesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.ringCount; i++) {
            const x = (Math.random() - 0.5) * 400;
            const y = (Math.random() - 0.5) * 60;
            const z = -10 - Math.random() * 80;

            dummy.position.set(x, y, z);
            // Slight tilt
            dummy.rotation.x = (Math.random() - 0.5) * 0.2;
            dummy.rotation.z = (Math.random() - 0.5) * 0.2;

            const s = 1 + Math.random() * 1.5;
            dummy.scale.setScalar(s);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(this.mesh);
    }

    activate(config?: ComboCorridorConfig) {
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

        this.uTime.value += delta;
        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        const width = 400;
        const margin = 50;
        const limitBack = cameraX - (width / 2) - margin;
        const limitFront = cameraX + (width / 2) + margin;

        const dummy = new THREE.Object3D();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();

        for (let i = 0; i < this.ringCount; i++) {
            this.mesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(position, quaternion, scale);

            // Parallax effect
            const speed = 1.0 + (position.z / 100);
            position.x -= delta * 30 * speed;

            if (position.x < limitBack) {
                position.x += width + margin * 2;
                position.y = (Math.random() - 0.5) * 60;
            } else if (position.x > limitFront) {
                position.x -= width + margin * 2;
                position.y = (Math.random() - 0.5) * 60;
            }

            dummy.position.copy(position);
            dummy.quaternion.copy(quaternion);
            dummy.scale.copy(scale);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            disposeObject(this.mesh);
        }
    }
}
