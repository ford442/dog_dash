import * as THREE from 'three';
import { time, vec3, color, positionLocal, length, uv, smoothstep, mix, sin } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';

export type BouncePadConfig = {
    x: number;
    y: number;
    z?: number;
    bounceStrength?: number;
};

export type BouncePadsEnvironmentConfig = {
    pads: BouncePadConfig[];
};

export class BouncePadsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    pads: BouncePadConfig[] = [];
    private dummy = new THREE.Object3D();

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.CylinderGeometry(2, 2, 0.5, 16);
        geo.translate(0, -0.25, 0); // Origin at top center

        const mat = new MeshStandardNodeMaterial({
            transparent: true,
            roughness: 0.2,
            metalness: 0.8
        });

        const vUv = uv();
        const dist = length(vUv.sub(0.5));
        const ringPattern = smoothstep(0.4, 0.45, dist).sub(smoothstep(0.45, 0.5, dist));

        const pulse = sin(time.mul(4.0)).mul(0.5).add(0.5);
        const baseColor = color(0x334455);
        const glowColor = color(0x00ffaa);

        mat.colorNode = mix(baseColor, glowColor, ringPattern.mul(0.2));
        mat.emissiveNode = glowColor.mul(ringPattern).mul(pulse.add(0.5));

        // Start with a small default count, will be expanded in activate if needed
        this.mesh = new THREE.InstancedMesh(geo, mat, 50);
        this.mesh.count = 0;
        this.mesh.frustumCulled = false; // Always render active pads

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: BouncePadsEnvironmentConfig) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        if (config && config.pads) {
            this.pads = config.pads;
        } else {
            this.pads = [];
        }

        if (this.pads.length > this.mesh.instanceMatrix.count) {
            // Need a larger mesh pool
            const oldMesh = this.mesh;
            this.mesh = new THREE.InstancedMesh(
                oldMesh.geometry,
                oldMesh.material as THREE.Material,
                this.pads.length + 10
            );
            this.mesh.frustumCulled = false;
            this.scene.remove(oldMesh);
            this.scene.add(this.mesh);
            oldMesh.dispose();
        }

        this.mesh.count = this.pads.length;

        for (let i = 0; i < this.pads.length; i++) {
            const pad = this.pads[i];
            this.dummy.position.set(pad.x, pad.y, pad.z ?? 0);
            this.dummy.scale.set(1, 1, 1);
            this.dummy.rotation.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        if (this.pads.length > 0) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        // Minor visual bobbing/scaling could go here if we tracked individual pad states
    }

    checkCollision(playerPos: THREE.Vector3, playerVelocityY: number): number | null {
        if (!this.active || playerVelocityY > 0) return null; // Only bounce if falling or stationary

        const radius = 2.0;
        const padHeight = 0.5;

        for (const pad of this.pads) {
            const dx = playerPos.x - pad.x;
            const dy = playerPos.y - pad.y;
            const dz = playerPos.z - (pad.z ?? 0);

            // Check horizontal bounds (cylinder)
            if (dx * dx + dz * dz <= radius * radius) {
                // Check vertical bounds - player should be hitting the top
                // Assuming playerPos is center, so let's give a generous vertical hit box
                if (dy >= -padHeight && dy <= 1.0) {
                    return pad.bounceStrength ?? 40; // Default strength
                }
            }
        }

        return null;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}
