import * as THREE from 'three';
import { time, color, sin, mix, float, instanceIndex, hash, fract } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';

export class GhostDebrisSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh!: THREE.InstancedMesh;
    count: number = 100;

    private dummy: THREE.Object3D;
    private velocities!: THREE.Vector3[];
    private rotations!: THREE.Vector3[];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.dummy = new THREE.Object3D();
        this._initMesh();
        this.deactivate();
    }

    private _initMesh() {
        // Irregular rocky shape: icosahedron + random extrusion
        const geometry = new THREE.IcosahedronGeometry(1.2, 0);

        // Slight random extrusion for organic look
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const vx = positions.getX(i);
            const vy = positions.getY(i);
            const vz = positions.getZ(i);

            // Random scaling factor between 1.0 and 1.3
            const scaleX = 1 + Math.random() * 0.3;
            const scaleY = 1 + Math.random() * 0.3;
            const scaleZ = 1 + Math.random() * 0.3;

            positions.setXYZ(i, vx * scaleX, vy * scaleY, vz * scaleZ);
        }
        geometry.computeVertexNormals();

        // TSL Material for Phase Shifting
        const material = new MeshStandardNodeMaterial({
            color: 0xaaaaaa,
            metalness: 0.3,
            roughness: 0.7,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        // Unique offset per instance
        const offset = hash(instanceIndex);

        // Phase cycle from 0 to 1 based on time and offset
        const phase = fract(time.mul(0.2).add(offset));

        // Smoothly interpolate between 4 states:
        // 0.0 - 0.25 : Solid (opacity 1.0, emissive 0.6)
        // 0.25 - 0.50 : Fading (opacity 0.4, emissive 0.3)
        // 0.50 - 0.75 : Ethereal (opacity 0.15, emissive 1.2)
        // 0.75 - 1.0 : Reforming (opacity 0.6, emissive 0.9)

        // Calculate the opacity using sine waves blended over the phase
        // The exact math isn't perfectly linear across 4 states with just a mix,
        // but we can simulate the pulsing effect nicely with a combination of sines.
        // A full cycle is time * 2PI.

        const cycle = time.mul(2.0).add(offset.mul(Math.PI * 2));

        // Base sine pulse [-1, 1]
        const pulse = sin(cycle);

        // Map pulse to opacity [0.15, 1.0]
        const opacityVal = pulse.mul(0.425).add(0.575);
        material.opacityNode = opacityVal;

        // Map pulse to emissive intensity. Ethereal (lowest opacity) has highest emissive.
        // Inverse relationship: when pulse is -1 (opacity 0.15), intensity should be 1.2.
        // when pulse is 1 (opacity 1.0), intensity should be 0.6.
        const emissiveIntensity = pulse.mul(-0.3).add(0.9);

        const baseColor = color(0x4488ff);
        material.emissiveNode = baseColor.mul(emissiveIntensity);

        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.frustumCulled = false;

        this.velocities = [];
        this.rotations = [];

        // Distribute instances
        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * 400; // Wide X spread
            const y = (Math.random() - 0.5) * 100; // Y spread
            const z = -20 - Math.random() * 80;    // Deep Z spread

            this.dummy.position.set(x, y, z);

            // Random initial rotation
            this.dummy.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            // Random scale (sizes vary)
            const scale = 0.5 + Math.random() * 1.5;
            this.dummy.scale.set(scale, scale, scale);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);

            // Store velocities and rotations for update loop
            this.velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 12
            ));

            this.rotations.push(new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ));
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);
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
            this.mesh.getMatrixAt(i, this.dummy.matrix);

            // Decompose to manipulate transform
            this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);

            // Apply velocities
            const vel = this.velocities[i];
            this.dummy.position.addScaledVector(vel, delta * 0.8);

            // Add subtle organic floating based on X position and time
            // We use Date.now() / 1000 since we don't track total time, or we can just ignore time
            // and use a constant drift, but let's just let velocity do the work.

            // Apply rotations
            const rot = this.rotations[i];
            this.dummy.rotation.x += rot.x * delta;
            this.dummy.rotation.y += rot.y * delta;
            this.dummy.rotation.z += rot.z * delta;

            // Wrapping logic to keep debris visible around the camera
            const margin = 200;
            const limitBack = cameraX - margin;
            const limitFront = cameraX + margin;

            if (this.dummy.position.x < limitBack) {
                this.dummy.position.x += margin * 2;
                // Randomize Y and Z slightly on respawn
                this.dummy.position.y = (Math.random() - 0.5) * 100;
                this.dummy.position.z = -20 - Math.random() * 80;
            } else if (this.dummy.position.x > limitFront) {
                this.dummy.position.x -= margin * 2;
                this.dummy.position.y = (Math.random() - 0.5) * 100;
                this.dummy.position.z = -20 - Math.random() * 80;
            }

            // Recompose and set
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if (this.mesh.material) {
            (this.mesh.material as any).dispose?.();
        }
    }
}
