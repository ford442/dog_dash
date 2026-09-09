import * as THREE from 'three';
import { time, vec3, vec4, color, positionLocal, length, uv, smoothstep, mix, sin, positionWorld, uniform, float } from 'three/tsl';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';

export type AerialGuardPatrolConfig = {
    zones: { x: number; y: number; z: number; width: number; searchRadius: number }[];
};

export class AerialGuardPatrolSystem {
    scene: THREE.Scene;
    active: boolean = false;

    droneMesh: THREE.InstancedMesh;
    lightMesh: THREE.InstancedMesh;

    zones: { x: number; y: number; z: number; width: number; searchRadius: number }[] = [];
    private dummy = new THREE.Object3D();

    uPlayerPos: any;
    uDetectionLevel: any;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.uPlayerPos = uniform(new THREE.Vector3(9999, 9999, 9999));
        this.uDetectionLevel = uniform(0.0);

        // Drone Body
        const droneGeo = new THREE.CapsuleGeometry(1.5, 1, 4, 8);
        droneGeo.rotateZ(Math.PI / 2);

        const droneMat = new MeshStandardNodeMaterial({
            roughness: 0.2,
            metalness: 0.9,
        });

        const baseColor = color(0x555555);
        const alertColor = color(0xff3300);

        // Pulse red if detected
        droneMat.colorNode = mix(baseColor, alertColor, this.uDetectionLevel);
        droneMat.emissiveNode = alertColor.mul(this.uDetectionLevel).mul(sin(time.mul(10.0)).mul(0.5).add(0.5));

        this.droneMesh = new THREE.InstancedMesh(droneGeo, droneMat, 20);
        this.droneMesh.count = 0;
        this.droneMesh.frustumCulled = false;

        // Searchlight Cone
        const lightGeo = new THREE.ConeGeometry(4, 15, 16, 1, true);
        lightGeo.translate(0, -7.5, 0); // Origin at top tip

        const lightMat = new MeshBasicNodeMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const vUv = uv();
        const dist = length(vUv.sub(0.5));
        const fadeEdge = smoothstep(0.5, 0.0, dist);
        const fadeBottom = smoothstep(0.0, 0.8, vUv.y);

        const safeLightColor = color(0x44aaff);
        const alertLightColor = color(0xff2200);

        const currentLightColor = mix(safeLightColor, alertLightColor, this.uDetectionLevel);

        const alpha = fadeEdge.mul(fadeBottom).mul(0.4);
        lightMat.colorNode = vec4(currentLightColor, alpha);

        // Wobbly light
        const sway = sin(time.mul(2.0).add(positionWorld.x)).mul(0.2);
        lightMat.positionNode = positionLocal.add(vec3(sway, 0, 0));

        this.lightMesh = new THREE.InstancedMesh(lightGeo, lightMat, 20);
        this.lightMesh.count = 0;
        this.lightMesh.frustumCulled = false;

        this.scene.add(this.droneMesh);
        this.scene.add(this.lightMesh);
        this.deactivate();
    }

    activate(config?: AerialGuardPatrolConfig) {
        if (this.active) return;
        this.active = true;
        this.droneMesh.visible = true;
        this.lightMesh.visible = true;

        if (config && config.zones) {
            this.zones = config.zones;
        } else {
            this.zones = [];
        }

        if (this.zones.length > this.droneMesh.instanceMatrix.count) {
            // Reallocate meshes if needed
            const oldDrone = this.droneMesh;
            const oldLight = this.lightMesh;

            this.droneMesh = new THREE.InstancedMesh(oldDrone.geometry, oldDrone.material as THREE.Material, this.zones.length + 10);
            this.lightMesh = new THREE.InstancedMesh(oldLight.geometry, oldLight.material as THREE.Material, this.zones.length + 10);
            this.droneMesh.frustumCulled = false;
            this.lightMesh.frustumCulled = false;

            this.scene.remove(oldDrone);
            this.scene.remove(oldLight);
            this.scene.add(this.droneMesh);
            this.scene.add(this.lightMesh);

            oldDrone.dispose();
            oldLight.dispose();
        }

        this.droneMesh.count = this.zones.length;
        this.lightMesh.count = this.zones.length;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.droneMesh.visible = false;
        this.lightMesh.visible = false;
    }

    private detectionLevelRaw = 0;

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        const timeNow = Date.now() * 0.001;
        let isPlayerDetected = false;

        for (let i = 0; i < this.zones.length; i++) {
            const zone = this.zones[i];

            // Patrol movement (Z-axis sweep or hovering)
            const patrolOffsetZ = Math.sin(timeNow * 1.5 + i * 2.0) * (zone.width / 2);
            const patrolOffsetX = Math.cos(timeNow * 1.0 + i) * 10;
            const droneX = zone.x + patrolOffsetX;
            const droneY = zone.y + Math.sin(timeNow * 2.0 + i) * 1.5;
            const droneZ = zone.z + patrolOffsetZ;

            this.dummy.position.set(droneX, droneY, droneZ);
            this.dummy.rotation.set(0, 0, 0); // Face forward or patrol dir
            this.dummy.scale.set(1, 1, 1);
            this.dummy.updateMatrix();
            this.droneMesh.setMatrixAt(i, this.dummy.matrix);

            // Searchlight slightly delayed or pointing at patrol direction
            const tiltX = Math.sin(timeNow * 1.5 + i) * 0.2;
            const tiltZ = Math.cos(timeNow * 2.0 + i) * 0.2;
            this.dummy.rotation.set(tiltX, 0, tiltZ);
            this.dummy.scale.set(zone.searchRadius / 4, 1, zone.searchRadius / 4); // Scale cone width based on radius
            this.dummy.updateMatrix();
            this.lightMesh.setMatrixAt(i, this.dummy.matrix);

            // Check detection
            if (playerPos) {
                const dy = droneY - playerPos.y;
                const dx = droneX - playerPos.x;
                const dz = droneZ - playerPos.z;

                // If player is below drone and within radius horizontally
                if (dy > 0 && dy < 15) {
                    const distSq = dx * dx + dz * dz;
                    if (distSq < zone.searchRadius * zone.searchRadius) {
                        isPlayerDetected = true;
                    }
                }
            }
        }

        if (isPlayerDetected) {
            this.detectionLevelRaw = Math.min(1.0, this.detectionLevelRaw + delta * 3.0);
        } else {
            this.detectionLevelRaw = Math.max(0.0, this.detectionLevelRaw - delta * 2.0);
        }

        this.uDetectionLevel.value = this.detectionLevelRaw;

        if (this.zones.length > 0) {
            this.droneMesh.instanceMatrix.needsUpdate = true;
            this.lightMesh.instanceMatrix.needsUpdate = true;
        }
    }

    checkDetection(playerPos: THREE.Vector3): number {
        return this.active ? this.detectionLevelRaw : 0;
    }

    cleanup() {
        this.scene.remove(this.droneMesh);
        this.scene.remove(this.lightMesh);
        this.droneMesh.geometry.dispose();
        this.lightMesh.geometry.dispose();
        (this.droneMesh.material as THREE.Material).dispose();
        (this.lightMesh.material as THREE.Material).dispose();
    }
}
