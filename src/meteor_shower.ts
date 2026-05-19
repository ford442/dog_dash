import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { time, vec4, color, mix, sin, positionLocal } from 'three/tsl';

function createMeteorMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const uTime = time;

    // A fiery gradient from front to tail
    const coreColor = color(0xffffff); // white hot leading edge
    const midColor = color(0xffaa00);  // orange mid
    const tailColor = color(0xff2200); // red tail

    // Assuming BoxGeometry(0.5, 0.5, 20), z goes from -10 to 10
    // Normalize z to 0..1: (z / 20) + 0.5
    const normalizedZ = positionLocal.z.div(20.0).add(0.5);

    // Fluctuation based on time
    const flicker = sin(uTime.mul(20.0).add(positionLocal.z.mul(5.0))).mul(0.1).add(0.9);

    // Mix colors based on normalizedZ
    const colorMix1 = mix(tailColor, midColor, normalizedZ.mul(2.0));
    const finalColor = mix(colorMix1, coreColor, normalizedZ.mul(2.0).sub(1.0).clamp(0.0, 1.0));

    // Opacity fades out towards the tail
    const alpha = normalizedZ.mul(flicker);

    mat.colorNode = vec4(finalColor, alpha);

    return mat;
}

export class MeteorShowerSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number = 40;

    positions: Float32Array;
    velocities: Float32Array;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // A long stretched box for the meteor streak
        const geo = new THREE.BoxGeometry(0.5, 0.5, 20);
        const mat = createMeteorMaterial();

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false; // Wrap manually

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.velocities = new Float32Array(this.count * 3);

        for (let i = 0; i < this.count; i++) {
            this.resetMeteor(i, 0, true);
        }

        this.scene.add(this.mesh);
        this.deactivate();
    }

    resetMeteor(index: number, cameraX: number, initial: boolean = false) {
        // Spawn ahead of the camera, or randomly around if initial
        const xOffset = initial ? (Math.random() * 400 - 100) : (100 + Math.random() * 200);
        this.positions[index * 3] = cameraX + xOffset;
        this.positions[index * 3 + 1] = (Math.random() - 0.5) * 150; // Y range
        this.positions[index * 3 + 2] = -50 - Math.random() * 100;   // Deep background Z range

        // Fast speeds moving leftwards (negative X), downwards (negative Y)
        this.velocities[index * 3] = -150 - Math.random() * 100;     // X velocity
        this.velocities[index * 3 + 1] = -50 - Math.random() * 50;   // Y velocity
        this.velocities[index * 3 + 2] = 0;                          // Z velocity

        this.updateInstance(index);
    }

    updateInstance(index: number) {
        this.dummy.position.set(
            this.positions[index * 3],
            this.positions[index * 3 + 1],
            this.positions[index * 3 + 2]
        );

        // Orient the meteor to face its velocity
        const vx = this.velocities[index * 3];
        const vy = this.velocities[index * 3 + 1];
        const vz = this.velocities[index * 3 + 2];

        const target = new THREE.Vector3(
            this.dummy.position.x + vx,
            this.dummy.position.y + vy,
            this.dummy.position.z + vz
        );
        this.dummy.lookAt(target);

        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(index, this.dummy.matrix);
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

    update(delta: number, cameraX: number) {
        if (!this.active) return;

        for (let i = 0; i < this.count; i++) {
            this.positions[i * 3] += this.velocities[i * 3] * delta;
            this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * delta;

            // If it falls behind camera or too low, reset
            if (this.positions[i * 3] < cameraX - 100 || this.positions[i * 3 + 1] < -100) {
                this.resetMeteor(i, cameraX);
            } else {
                this.updateInstance(i);
            }
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if (this.mesh.material && (this.mesh.material as any).dispose) {
            (this.mesh.material as any).dispose();
        }
    }
}
