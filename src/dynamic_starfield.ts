import * as THREE from 'three';
import { time, vec3, vec4, color, uniform, sin, mix, positionWorld, distance, float, smoothstep, length, positionLocal } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

interface StarLayerConfig {
    count: number;
    minSize: number;
    maxSize: number;
    speed: number;
    zRange: [number, number];
    opacity: number;
}

const LAYER_CONFIGS: StarLayerConfig[] = [
    {
        count: 100,
        minSize: 0.5,
        maxSize: 1.2,
        speed: 2,
        zRange: [-100, -80],
        opacity: 0.3
    },
    {
        count: 200,
        minSize: 0.8,
        maxSize: 2.0,
        speed: 6,
        zRange: [-80, -60],
        opacity: 0.5
    },
    {
        count: 300,
        minSize: 1.0,
        maxSize: 2.5,
        speed: 15,
        zRange: [-60, -40],
        opacity: 0.8
    },
    {
        count: 200,
        minSize: 1.5,
        maxSize: 3.5,
        speed: 35,
        zRange: [-40, -20],
        opacity: 1.0
    }
];

export class DynamicStarfieldSystem {
    scene: THREE.Scene;
    active: boolean = false;
    private meshes: THREE.InstancedMesh[] = [];
    private layerConfigs: StarLayerConfig[] = [];
    private layerVelocities: Float32Array[] = [];
    private bounds = { x: 160, y: 80 }; // Area around camera

    // Config values
    private speedScaling: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initLayers();
        this.deactivate();
    }

    private initLayers() {
        // Base geometry for a star
        const geometry = new THREE.PlaneGeometry(1, 1);

        LAYER_CONFIGS.forEach((config, layerIndex) => {
            const material = new MeshBasicNodeMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.FrontSide
            });

            // Set base color and opacity
            material.colorNode = vec4(1.0, 1.0, 1.0, config.opacity);

            const mesh = new THREE.InstancedMesh(geometry, material, config.count);
            mesh.frustumCulled = false;
            mesh.renderOrder = -2; // Render behind everything else, but above deep background

            const dummy = new THREE.Object3D();
            const velocities = new Float32Array(config.count);

            for (let i = 0; i < config.count; i++) {
                // Random position within bounds
                dummy.position.x = (Math.random() - 0.5) * this.bounds.x * 2.0;
                dummy.position.y = (Math.random() - 0.5) * this.bounds.y * 2.0;
                dummy.position.z = config.zRange[0] + Math.random() * (config.zRange[1] - config.zRange[0]);

                // Size variation
                const size = config.minSize + Math.random() * (config.maxSize - config.minSize);
                dummy.scale.set(size, size, 1);

                // Individual velocity variation
                velocities[i] = config.speed * (0.8 + Math.random() * 0.4);

                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }

            mesh.instanceMatrix.needsUpdate = true;

            this.scene.add(mesh);
            this.meshes.push(mesh);
            this.layerConfigs.push(config);
            this.layerVelocities.push(velocities);
        });
    }

    activate(config?: any) {
        if (this.active) return;
        this.active = true;

        if (config && typeof config === 'object') {
            this.speedScaling = config.speedScaling ?? 1.0;
        } else {
            this.speedScaling = 1.0;
        }

        this.meshes.forEach(m => m.visible = true);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.meshes.forEach(m => m.visible = false);
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        const dummy = new THREE.Object3D();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();

        // Calculate a speed multiplier based on player thrust or simple horizontal progress
        // This is a naive implementation: it assumes playerPos.y defines some "speed" or we just use a baseline.
        // If we had access to currentSpeedY directly we could use it.
        // We will just create a dynamic feel by scaling base speeds.
        const speedMultiplier = this.speedScaling;

        this.meshes.forEach((mesh, layerIdx) => {
            const config = this.layerConfigs[layerIdx];
            const velocities = this.layerVelocities[layerIdx];

            // Foreground layers move faster with game speed
            const layerSpeedFactor = 1.0 + (layerIdx * 0.5);
            const effectiveSpeed = speedMultiplier * layerSpeedFactor;

            for (let i = 0; i < config.count; i++) {
                mesh.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(position, quaternion, scale);

                // Move star leftward relative to the camera
                const moveSpeed = velocities[i] * effectiveSpeed;
                position.x -= moveSpeed * delta;

                // Wrap around when off screen (relative to cameraX)
                const relativeX = position.x - cameraX;
                if (relativeX < -this.bounds.x) {
                    position.x += this.bounds.x * 2.0;
                    position.y = (Math.random() - 0.5) * this.bounds.y * 2.0;
                } else if (relativeX > this.bounds.x) {
                    position.x -= this.bounds.x * 2.0;
                    position.y = (Math.random() - 0.5) * this.bounds.y * 2.0;
                }

                dummy.position.copy(position);
                dummy.quaternion.copy(quaternion);
                dummy.scale.copy(scale);
                dummy.updateMatrix();

                mesh.setMatrixAt(i, dummy.matrix);
            }

            mesh.instanceMatrix.needsUpdate = true;
        });
    }

    cleanup() {
        this.meshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material) {
                (mesh.material as any).dispose?.();
            }
        });
        this.meshes = [];
        this.layerVelocities = [];
    }
}
