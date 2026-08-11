import * as THREE from 'three';
import { time, vec3, color, uniform, sin, float, mod, positionLocal } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

export type WindZoneConfig = {
    x: number;
    y: number;
    width: number;
    height: number;
    forceX: number;
    forceY: number;
};

export type WindCurrentsConfig = {
    zones: WindZoneConfig[];
};

export class WindCurrentsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    private zones: WindZoneConfig[] = [];
    private meshes: THREE.InstancedMesh[] = [];
    private baseVector = new THREE.Vector3();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.deactivate();
    }

    activate(config?: WindCurrentsConfig) {
        if (this.active) return;
        this.active = true;

        if (config && config.zones) {
            this.zones = config.zones;
            this.buildMeshes();
        }

        this.meshes.forEach(mesh => {
            mesh.visible = true;
        });
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;

        this.meshes.forEach(mesh => {
            mesh.visible = false;
        });
    }

    private buildMeshes() {
        this.cleanup();

        // Single geometry for wind streaks
        const geo = new THREE.PlaneGeometry(2, 0.1);

        for (const zone of this.zones) {
            // Count streaks based on volume of zone
            const count = Math.max(10, Math.floor((zone.width * zone.height) / 10));

            // Material customized per zone direction
            const mat = new MeshBasicNodeMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            });

            mat.colorNode = color(0xaaddff).mul(0.6);

            // Basic animation: streaks move along X and fade in/out based on time and instance ID
            // Here we just make them pulse slightly to show motion
            const alphaOscillation = sin(time.mul(2.0).add(positionLocal.x.mul(10.0))).add(1.0).mul(0.5);
            mat.opacityNode = alphaOscillation.mul(0.4);

            const mesh = new THREE.InstancedMesh(geo, mat, count);
            mesh.frustumCulled = false;

            const dummy = new THREE.Object3D();

            const dir = new THREE.Vector3(zone.forceX, zone.forceY, 0).normalize();
            const angle = Math.atan2(dir.y, dir.x);

            for (let i = 0; i < count; i++) {
                // Random position within zone bounds
                const x = zone.x - zone.width/2 + Math.random() * zone.width;
                const y = zone.y - zone.height/2 + Math.random() * zone.height;
                const z = -5 - Math.random() * 15; // deep background to near background

                dummy.position.set(x, y, z);
                dummy.rotation.z = angle;

                // Random scale
                const scaleX = 0.5 + Math.random() * 2.0;
                dummy.scale.set(scaleX, 1, 1);

                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }

            mesh.instanceMatrix.needsUpdate = true;
            this.scene.add(mesh);
            this.meshes.push(mesh);
        }
    }

    getWindForce(playerPosition: THREE.Vector3): THREE.Vector3 {
        this.baseVector.set(0, 0, 0);
        if (!this.active) return this.baseVector;

        for (const zone of this.zones) {
            const halfW = zone.width / 2;
            const halfH = zone.height / 2;

            if (playerPosition.x >= zone.x - halfW && playerPosition.x <= zone.x + halfW &&
                playerPosition.y >= zone.y - halfH && playerPosition.y <= zone.y + halfH) {
                this.baseVector.set(zone.forceX, zone.forceY, 0);
                return this.baseVector; // Apply first matched zone
            }
        }

        return this.baseVector;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;
        // The material TSL animation handles the visual flowing effect
    }

    cleanup() {
        for (const mesh of this.meshes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as any).dispose?.();
        }
        this.meshes = [];
    }
}
