import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { time, vec3, color, uniform, sin, mix, positionLocal, positionWorld, float, uv, length, smoothstep } from 'three/tsl';

export class HideAndSeekStarsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 80;
    width: number = 400;

    private dummy = new THREE.Object3D();
    private instanceData: Float32Array;
    private uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.IcosahedronGeometry(0.8, 1);

        // TSL Material setup
        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));

        // Base peek logic: star gets bigger when player is close (peek-a-boo)
        const peekIntensity = smoothstep(60.0, 15.0, distToPlayer);

        // Bobbing and twinkling
        const bob = sin(time.mul(2.0).add(positionWorld.x.mul(0.1))).mul(0.5);

        // Color shifts between pastel yellow and pink
        const baseColor = mix(color(0xffeb99), color(0xffb6c1), sin(time.add(positionWorld.z)).mul(0.5).add(0.5));

        // Intensity
        const intensity = mix(float(0.3), float(1.2), peekIntensity);
        const finalColor = baseColor.mul(intensity);

        const mat = new MeshBasicNodeMaterial({
            colorNode: finalColor,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            side: THREE.FrontSide,
        });

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;

        this.instanceData = new Float32Array(this.count * 4);

        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 60;
            const z = -30 - Math.random() * 50; // Tucked behind flowers
            const phase = Math.random() * Math.PI * 2;

            this.instanceData[i * 4] = x;
            this.instanceData[i * 4 + 1] = y;
            this.instanceData[i * 4 + 2] = z;
            this.instanceData[i * 4 + 3] = phase;

            this.dummy.position.set(x, y, z);

            // Random initial rotation
            this.dummy.rotation.x = Math.random() * Math.PI;
            this.dummy.rotation.y = Math.random() * Math.PI;
            this.dummy.updateMatrix();

            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        this.deactivate();
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.scene.add(this.mesh);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.scene.remove(this.mesh);
    }

    update(delta: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        const cameraX = playerPos ? playerPos.x : 0;

        for (let i = 0; i < this.count; i++) {
            let x = this.instanceData[i * 4];
            let y = this.instanceData[i * 4 + 1];
            let z = this.instanceData[i * 4 + 2];
            const phase = this.instanceData[i * 4 + 3];

            // Wrap around
            if (x < cameraX - this.width / 2) x += this.width;
            if (x > cameraX + this.width / 2) x -= this.width;

            this.instanceData[i * 4] = x;

            this.dummy.position.set(x, y, z);
            this.dummy.rotation.x += delta * 0.5;
            this.dummy.rotation.y += delta * 0.3;

            // Calculate distance for dynamic scaling
            let dist = 100;
            if (playerPos) {
                const dx = x - playerPos.x;
                const dy = y - playerPos.y;
                const dz = z - playerPos.z;
                dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            }

            // Base scale is small, expands when player is near
            let scale = 0.2;
            if (dist < 60) {
                // Smooth interpolation for peek
                const peek = 1.0 - Math.max(0, dist - 15) / 45;
                scale = 0.2 + peek * 0.8;
            }

            // Add a little pulsing
            scale *= 1.0 + Math.sin(Date.now() * 0.003 + phase) * 0.2;

            this.dummy.scale.setScalar(scale);
            this.dummy.updateMatrix();

            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.deactivate();
        this.mesh.geometry.dispose();
        if ((this.mesh.material as THREE.Material).dispose) {
            (this.mesh.material as THREE.Material).dispose();
        }
    }
}
