import * as THREE from 'three';
import {
    createConveyorMaterial,
    createPulsingConduitMaterial,
    createGearGeometry,
    createPistonGeometry,
    createMechanismMaterial,
    createForegroundMaterial,
    createSimpleIndustrialMaterial,
    createTunnelMaterial
} from './materials';

export class IndustrialLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    baseZ: number;

    // Instance data
    positions: Float32Array;

    constructor(
        scene: THREE.Scene,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        config: {
            count: number,
            z: number,
            zRange: number,
            width: number,
            yRange: number,
            scaleMin: number,
            scaleMax: number,
            rotationMode: 'random' | 'horizontal' | 'vertical'
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.z;

        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false; // Infinite scrolling logic handles visibility

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);

        for(let i=0; i<this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.yRange;
            const z = this.baseZ + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            this.dummy.position.set(x, y, z);

            // Random Scale
            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.dummy.scale.setScalar(s);

            // Orientation
            if (config.rotationMode === 'random') {
                this.dummy.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
            } else if (config.rotationMode === 'vertical') {
                this.dummy.rotation.set(0, 0, 0);
            } else {
                // Default 'horizontal'
                this.dummy.rotation.z = Math.PI / 2;
            }

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
        this.mesh.visible = false;
    }

    update(cameraX: number) {
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        for(let i=0; i<this.count; i++) {
            const idx = i*3;
            let x = this.positions[idx];

            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            if (needsUpdate) {
                this.mesh.getMatrixAt(i, this.dummy.matrix);
                const p = new THREE.Vector3();
                const q = new THREE.Quaternion();
                const s = new THREE.Vector3();
                this.dummy.matrix.decompose(p, q, s);

                this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
                // No rotation update needed here as we want them static in orientation
                this.dummy.scale.copy(s);
                this.dummy.quaternion.copy(q);

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

/**
 * Manages a layer of animated mechanical elements (Gears, Pistons).
 */
export class AnimatedMechanismLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    baseZ: number;
    animationType: 'rotate' | 'piston';

    // Instance data
    positions: Float32Array;
    animationSpeeds: Float32Array;
    phases: Float32Array;

    constructor(
        scene: THREE.Scene,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        config: {
            count: number,
            z: number,
            zRange: number,
            width: number,
            yRange: number,
            scaleMin: number,
            scaleMax: number,
            animationType: 'rotate' | 'piston'
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.z;
        this.animationType = config.animationType;

        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.animationSpeeds = new Float32Array(this.count);
        this.phases = new Float32Array(this.count);

        for(let i=0; i<this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.yRange;
            const z = this.baseZ + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            // Random Scale
            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.dummy.scale.setScalar(s);

            // Initial Rotation (Random)
            this.dummy.rotation.z = Math.random() * Math.PI * 2;

            // Animation Data
            this.animationSpeeds[i] = (0.5 + Math.random() * 1.5) * (Math.random() > 0.5 ? 1 : -1);
            this.phases[i] = Math.random() * Math.PI * 2;

            this.dummy.position.set(x, y, z);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, time: number) {
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        for(let i=0; i<this.count; i++) {
            const idx = i*3;
            let x = this.positions[idx];
            let y = this.positions[idx+1];
            let z = this.positions[idx+2];

            // 1. Parallax / Scrolling
            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            // 2. Animation
            this.mesh.getMatrixAt(i, this.dummy.matrix);
            const p = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            this.dummy.matrix.decompose(p, q, s);

            if (this.animationType === 'rotate') {
                // Spin
                const rotSpeed = this.animationSpeeds[i];
                // We construct rotation from scratch to avoid accumulation error or quaternion drift
                // Z-axis rotation
                const currentRot = (time * rotSpeed) + this.phases[i];
                this.dummy.rotation.set(0, 0, currentRot);

                // Position update
                this.dummy.position.set(x, y, z);

                needsUpdate = true;
            } else if (this.animationType === 'piston') {
                // Move Up/Down
                const speed = this.animationSpeeds[i];
                const offset = Math.sin(time * speed + this.phases[i]) * 2.0; // 2.0 amplitude

                this.dummy.position.set(x, y + offset, z);
                // Keep original rotation (e.g. vertical)?
                // For piston, we might want fixed rotation.
                // Constructor didn't set specific orientation other than random Z.
                // Let's assume vertical pistons.
                this.dummy.rotation.set(0, 0, 0);

                needsUpdate = true;
            }

            this.dummy.scale.copy(s); // Preserve scale
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}
export class TunnelLayer {
    mesh: THREE.Mesh;

    constructor(scene: THREE.Scene, uPlayerPos: any, weaponLights: any) {
        // Radius 60, Length 300, Open-ended
        const geo = new THREE.CylinderGeometry(60, 60, 300, 32, 1, true);
        // Rotate so length is along X axis
        geo.rotateZ(Math.PI / 2);

        const mat = createTunnelMaterial(0, uPlayerPos, weaponLights);
        this.mesh = new THREE.Mesh(geo, mat);
        // Put it far behind
        this.mesh.renderOrder = -10;
        this.mesh.visible = false;

        scene.add(this.mesh);
    }

    update(cameraX: number, tunnelSpeed: number) {
        // Follow camera
        this.mesh.position.x = cameraX;

        // Update shader for infinite scroll texture
        const mat = this.mesh.material as any;
        if (mat.userData && mat.userData.uCameraX) {
            mat.userData.uCameraX.value = cameraX * tunnelSpeed;
        }
    }
}

