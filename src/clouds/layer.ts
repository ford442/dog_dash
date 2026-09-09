import * as THREE from 'three';
import { createCloudSpriteMaterial } from './materials';

export class CloudLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    windSpeed: number; // Independent speed
    width: number;
    baseZ: number;

    // Instance data
    positions: Float32Array;
    scales: Float32Array;

    uColor: any;
    uOpacity: any;

    constructor(
        scene: THREE.Scene,
        config: {
            count: number,
            z: number,
            zRange: number,
            uColor: any,
            uOpacity: any,
            scaleMin: number,
            scaleMax: number,
            windSpeed: number, // Speed relative to world (crawling)
            width: number,
            detail?: number,
            weaponLights?: any,
            uPlayerPos?: any
        }
    ) {
        this.count = config.count;
        this.windSpeed = config.windSpeed;
        this.width = config.width;
        this.baseZ = config.z;
        this.uColor = config.uColor;
        this.uOpacity = config.uOpacity;

        // Use PlaneGeometry for Sprites
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = createCloudSpriteMaterial(config.uColor, config.uOpacity, config.detail || 1.0, config.weaponLights, config.uPlayerPos);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false; // Infinite scroll
        this.mesh.renderOrder = config.z < 0 ? -2 : 2; // Background vs Foreground ordering

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.scales = new Float32Array(this.count);

        // Initial Layout
        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * config.width;
            const y = (Math.random() - 0.5) * 30; // Spread vertically
            const z = config.z + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.scales[i] = s;

            this.dummy.position.set(x, y, z);
            this.dummy.scale.set(s * 1.5, s, 1.0); // Wider clouds
            this.dummy.rotation.set(0, 0, (Math.random() - 0.5) * 0.2); // Slight tilt

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
    }

    update(delta: number, cameraX: number) {
        // Parallax & Scrolling Logic
        // We want clouds to "crawl" (windSpeed) AND parallax.
        // Actually, if we move them by windSpeed * delta, they move in world space.
        // The camera movement naturally creates parallax.

        const margin = 30;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;

            // 1. Apply Wind
            this.positions[idx] += this.windSpeed * delta;

            let x = this.positions[idx];

            // 2. Wrap around camera
            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                // Optional: Randomize Y slightly on respawn to vary pattern?
                // this.positions[idx+1] = (Math.random() - 0.5) * 30;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            if (needsUpdate || this.windSpeed !== 0) {
                // Update matrix
                const y = this.positions[idx+1];
                const z = this.positions[idx+2];
                const s = this.scales[i];

                this.dummy.position.set(x, y, z);
                this.dummy.scale.set(s * 1.5, s, 1.0);
                // Keep rotation? We didn't store it, assuming static small tilt is fine or reset it.
                // Let's keep it simple and reset tilt to random deterministic if needed,
                // but here we just zero it or keep previous if we read it back.
                // Optim: Just set it.
                this.dummy.rotation.set(0, 0, 0);

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    flash(position: THREE.Vector3, radius: number, intensity: number, flashColor: THREE.Color = new THREE.Color(0xffffff)) {
        const mat = this.mesh.material as any;
        if (mat.userData) {
            if (mat.userData.uFlash) mat.userData.uFlash.value = intensity;
            if (mat.userData.uLightningPos) mat.userData.uLightningPos.value.copy(position);
            if (mat.userData.uLightningRadius) mat.userData.uLightningRadius.value = radius;
            if (mat.userData.uLightningColor) mat.userData.uLightningColor.value.copy(flashColor);
        }
    }
}
