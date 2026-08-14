import * as THREE from 'three';
import { time, vec3, vec4, color, sin, float, positionLocal } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

export type TimeShiftZoneConfig = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type TimeShiftZonesEnvironmentConfig = {
    zones: TimeShiftZoneConfig[];
};

export class TimeShiftZonesSystem {
    scene: THREE.Scene;
    active: boolean = false;
    private zones: TimeShiftZoneConfig[] = [];
    private mesh!: THREE.InstancedMesh;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.deactivate();
    }

    activate(config?: TimeShiftZonesEnvironmentConfig) {
        if (this.active) return;
        this.active = true;

        if (config && config.zones && config.zones.length > 0) {
            this.zones = config.zones;
            this.buildMesh();
            this.mesh.visible = true;
        } else {
            this.zones = [];
        }
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;

        if (this.mesh) {
            this.mesh.visible = false;
        }
    }

    private buildMesh() {
        this.cleanup();

        if (this.zones.length === 0) return;

        const count = this.zones.length;
        const geo = new THREE.PlaneGeometry(1, 1);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });

        // TSL Shader: pulsing blue tint
        const baseColor = color(0x4488ff);
        const pulse = sin(time.mul(3.0).add(positionLocal.x)).mul(0.15).add(0.35);
        mat.colorNode = vec4(baseColor, pulse);

        this.mesh = new THREE.InstancedMesh(geo, mat, count);
        this.mesh.frustumCulled = false;

        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            const zone = this.zones[i];
            dummy.position.set(zone.x, zone.y, -2); // Background/midground plane
            dummy.scale.set(zone.width, zone.height, 1);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);
    }

    getTimeScaleModifier(playerPosition: THREE.Vector3): number {
        if (!this.active || this.zones.length === 0) return 1.0;

        for (let i = 0; i < this.zones.length; i++) {
            const zone = this.zones[i];
            const halfW = zone.width / 2;
            const halfH = zone.height / 2;

            if (playerPosition.x >= zone.x - halfW && playerPosition.x <= zone.x + halfW &&
                playerPosition.y >= zone.y - halfH && playerPosition.y <= zone.y + halfH) {
                return 0.5; // Half speed inside time-shift zone
            }
        }
        return 1.0;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;
        // Animation is handled by TSL
    }

    cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            (this.mesh.material as any).dispose?.();
            this.mesh = undefined as any;
        }
    }
}
