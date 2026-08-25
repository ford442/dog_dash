import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { time, vec3, color, mix, sin, positionLocal, positionWorld, smoothstep, length, float, uniform } from 'three/tsl';
import type { ParticleSystem } from './particles';

export class ShootingStarsSystem {
    private scene: THREE.Scene;
    private particleSystem: ParticleSystem;
    private active: boolean = false;

    private count = 25;
    private mesh!: THREE.InstancedMesh;
    private dummy = new THREE.Object3D();

    // Position, velocity, and state tracking
    private instanceData = new Float32Array(this.count * 6); // x, y, z, vx, vy, vz
    private bounds = { minX: 0, maxX: 1000, minY: 0, maxY: 60, minZ: -150, maxZ: -80 };

    // Player position uniform for interaction
    private uPlayerPos = uniform(new THREE.Vector3(0, -999, 0));

    constructor(scene: THREE.Scene, particleSystem: ParticleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;

        this.initGeometry();
        this.deactivate();
    }

    private initGeometry() {
        // A long, thin box to represent the shooting star streak
        const geo = new THREE.BoxGeometry(0.2, 0.2, 12);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const uTime = time;

        // Pastel whimsical colors
        const coreColor = color(0xffffff); // white hot leading edge
        const midColor = color(0xffb6c1);  // pastel pink
        const tailColor = color(0xdda0dd); // pastel purple

        const normalizedZ = positionLocal.z.div(12.0).add(0.5);

        // Twinkle flicker
        const flicker = sin(uTime.mul(15.0).add(positionLocal.z.mul(8.0))).mul(0.15).add(0.85);

        const colorMix1 = mix(tailColor, midColor, normalizedZ.mul(2.0));
        let finalColor: any = mix(colorMix1, coreColor, normalizedZ.mul(2.0).sub(1.0).clamp(0.0, 1.0));

        // Taper opacity towards the tail
        const baseAlpha = smoothstep(0.0, 0.3, normalizedZ);

        // Player proximity glow
        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        const playerGlow = smoothstep(40.0, 0.0, distToPlayer).mul(0.5);
        finalColor = finalColor.add(vec3(0.5, 0.8, 1.0).mul(playerGlow));

        mat.colorNode = finalColor;
        mat.opacityNode = baseAlpha.mul(flicker);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -1;

        // Initialize positions off-screen
        for (let i = 0; i < this.count; i++) {
            this.resetStar(i, 0, true);
        }

        this.scene.add(this.mesh);
    }

    private resetStar(index: number, cameraX: number, initial: boolean = false) {
        const startX = cameraX + 300 + Math.random() * 800; // Spawn far ahead
        const startY = 80 + Math.random() * 60; // High up
        const startZ = this.bounds.minZ + Math.random() * (this.bounds.maxZ - this.bounds.minZ);

        // Fast downward diagonal trajectory
        const speed = 120 + Math.random() * 80;
        const angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.2; // roughly 45 degrees down-left

        const vx = -Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed; // Negative because angle is negative
        const vz = (Math.random() - 0.5) * 10;

        // Initial dummy placement offscreen
        const x = initial ? -9999 : startX;
        const y = initial ? -9999 : startY;

        this.instanceData[index * 6] = x;
        this.instanceData[index * 6 + 1] = y;
        this.instanceData[index * 6 + 2] = startZ;
        this.instanceData[index * 6 + 3] = vx;
        this.instanceData[index * 6 + 4] = vy;
        this.instanceData[index * 6 + 5] = vz;

        this.dummy.position.set(x, y, startZ);

        // Align rotation to velocity vector
        this.dummy.rotation.x = Math.atan2(vy, vz);
        this.dummy.rotation.y = Math.atan2(vx, vz);
        // Add a slight roll
        this.dummy.rotation.z = Math.random() * Math.PI;

        // Random scale variation
        const scale = 0.5 + Math.random() * 1.5;
        this.dummy.scale.set(scale, scale, scale);

        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(index, this.dummy.matrix);
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
        // Optionally reset a few stars instantly to start the shower
        for (let i = 0; i < this.count / 2; i++) {
            this.resetStar(i, 0); // Need real cameraX though, will correct in update
        }
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

        for (let i = 0; i < this.count; i++) {
            let x = this.instanceData[i * 6];
            let y = this.instanceData[i * 6 + 1];
            let z = this.instanceData[i * 6 + 2];
            const vx = this.instanceData[i * 6 + 3];
            const vy = this.instanceData[i * 6 + 4];
            const vz = this.instanceData[i * 6 + 5];

            // If it's a hidden/initial star, occasionally spawn it
            if (x === -9999) {
                if (Math.random() < 0.01 * delta * 60) {
                     this.resetStar(i, cameraX);
                }
                continue;
            }

            x += vx * delta;
            y += vy * delta;
            z += vz * delta;

            this.instanceData[i * 6] = x;
            this.instanceData[i * 6 + 1] = y;
            this.instanceData[i * 6 + 2] = z;

            // Retrieve previous matrix to preserve rotation and scale
            this.mesh.getMatrixAt(i, this.dummy.matrix);

            // Extract scale and rotation from current matrix
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            this.dummy.matrix.decompose(position, quaternion, scale);

            // Set new position
            this.dummy.position.set(x, y, z);
            this.dummy.quaternion.copy(quaternion);
            this.dummy.scale.copy(scale);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);

            // Occasionally emit sparkle particles as they fly
            if (Math.random() < 0.05 && this.particleSystem && x > cameraX - 50 && x < cameraX + 300) {
                 this.particleSystem.emit(new THREE.Vector3(x, y, z), 0xffb6c1, 1, 0.5, 0.2, 0.5);
            }

            // Check boundaries - if passed bottom or far left, reset
            if (y < -40 || x < cameraX - 100) {
                // Occasional "drop" effect (simulate collectible spawning context visually)
                if (playerPos && Math.random() < 0.1 && Math.abs(x - playerPos.x) < 150) {
                    this.particleSystem.emit(new THREE.Vector3(x, Math.max(y, 0), z), 0xffd700, 15, 3.0, 0.6, 0.8);
                }

                // Wait randomly before respawning or respawn immediately
                if (Math.random() < 0.5) {
                    this.resetStar(i, cameraX);
                } else {
                    this.instanceData[i * 6] = -9999;
                    this.dummy.position.set(-9999, 0, 0);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                }
            }
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if ((this.mesh.material as THREE.Material).dispose) {
            (this.mesh.material as THREE.Material).dispose();
        }
    }
}
