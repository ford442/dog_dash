import * as THREE from 'three';
import { time, color, uniform, sin, positionWorld, length, vec3 } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

export interface ComboCorridorConfig {
    density?: number;
    speed?: number;
}

export class ComboCorridorSystem {
    scene: THREE.Scene;
    active: boolean = false;
    ringMesh!: THREE.InstancedMesh;
    ringCount: number = 40;

    uTime: any;
    uPlayerPos: any;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.uTime = uniform(0);
        this.uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));

        this.initRings();
        this.deactivate();
    }

    private initRings() {
        // Neon rings
        const geo = new THREE.TorusGeometry(30, 1.5, 8, 32);
        geo.rotateY(Math.PI / 2); // Face the camera

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        // Pulsing neon pink/cyan effect
        const pulse = sin(this.uTime.mul(4.0).add(positionWorld.x.mul(0.05))).mul(0.5).add(0.5);
        const baseColor = color(0xff00ff).mul(pulse).add(color(0x00ffff).mul(pulse.sub(1.0).mul(-1.0)));

        mat.colorNode = baseColor;

        this.ringMesh = new THREE.InstancedMesh(geo, mat, this.ringCount);
        this.ringMesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.ringCount; i++) {
            const x = (Math.random() - 0.5) * 800; // Wide spread along X (corridor length)
            const y = (Math.random() - 0.5) * 20;  // Slightly offset vertically
            const z = (Math.random() - 0.5) * 20;  // Slightly offset in depth

            dummy.position.set(x, y, z);
            dummy.scale.setScalar(0.5 + Math.random() * 1.5);
            dummy.updateMatrix();
            this.ringMesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(this.ringMesh);
    }

    activate(config?: ComboCorridorConfig) {
        if (this.active) return;
        this.active = true;
        this.ringMesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.ringMesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;
        this.uTime.value += delta;

        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        const width = 800;
        const margin = 100;
        const limitBack = cameraX - (width / 2) - margin;

        const dummy = new THREE.Object3D();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();

        for (let i = 0; i < this.ringCount; i++) {
            this.ringMesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(position, quaternion, scale);

            // Parallax based on scale/depth
            const speed = 1.0 + scale.x * 0.5;
            position.x -= delta * 150 * speed;

            // Wrap around
            if (position.x < limitBack) {
                position.x += width + margin * 2;
                position.y = (Math.random() - 0.5) * 20;
                position.z = (Math.random() - 0.5) * 20;
            }

            dummy.position.copy(position);
            dummy.quaternion.copy(quaternion);
            dummy.scale.copy(scale);
            dummy.updateMatrix();
            this.ringMesh.setMatrixAt(i, dummy.matrix);
        }
        this.ringMesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        if (this.ringMesh) {
            this.scene.remove(this.ringMesh);
            this.ringMesh.geometry.dispose();
            (this.ringMesh.material as any).dispose?.();
        }
    }
}