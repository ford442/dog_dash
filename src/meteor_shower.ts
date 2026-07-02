import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { time, vec4, color, mix, sin, positionLocal } from 'three/tsl';

function createMeteorMaterial(opacityMultiplier: number = 1.0) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const uTime = time;

    // A fiery gradient from front to tail
    const coreColor = color(0xffffff); // white hot leading edge
    const midColor = color(0xffaa00);  // orange mid
    const tailColor = color(0xff2200); // red tail

    // Assuming BoxGeometry(0.5, 0.5, 20), z goes from -10 to 10
    // Normalize z to 0..1: (z / 20) + 0.5
    const normalizedZ = positionLocal.z.div(20.0).add(0.5);

    // Fluctuation based on time
    const flicker = sin(uTime.mul(20.0).add(positionLocal.z.mul(5.0))).mul(0.1).add(0.9);

    // Mix colors based on normalizedZ
    const colorMix1 = mix(tailColor, midColor, normalizedZ.mul(2.0));
    const finalColor = mix(colorMix1, coreColor, normalizedZ.mul(2.0).sub(1.0).clamp(0.0, 1.0));

    // Opacity fades out towards the tail
    const alpha = normalizedZ.mul(flicker).mul(opacityMultiplier);

    mat.colorNode = vec4(finalColor, alpha);

    return mat;
}

interface MeteorLayer {
    mesh: THREE.InstancedMesh;
    count: number;
    positions: Float32Array;
    velocities: Float32Array;
    zMin: number;
    zMax: number;
    speedMult: number;
    scale: number;
}

export class MeteorShowerSystem {
    scene: THREE.Scene;
    active: boolean = false;
    dummy: THREE.Object3D;

    layers: MeteorLayer[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.dummy = new THREE.Object3D();

        const layerConfigs = [
            { count: 15, zMin: -30, zMax: -80, speedMult: 1.5, scale: 1.2, opacity: 1.0 }, // Foreground
            { count: 30, zMin: -80, zMax: -150, speedMult: 1.0, scale: 0.8, opacity: 0.8 }, // Midground
            { count: 50, zMin: -150, zMax: -300, speedMult: 0.5, scale: 0.5, opacity: 0.5 } // Background
        ];

        for (const config of layerConfigs) {
            const geo = new THREE.BoxGeometry(0.5 * config.scale, 0.5 * config.scale, 20 * config.scale);
            const mat = createMeteorMaterial(config.opacity);

            const mesh = new THREE.InstancedMesh(geo, mat, config.count);
            mesh.frustumCulled = false; // Wrap manually

            const layer: MeteorLayer = {
                mesh,
                count: config.count,
                positions: new Float32Array(config.count * 3),
                velocities: new Float32Array(config.count * 3),
                zMin: config.zMin,
                zMax: config.zMax,
                speedMult: config.speedMult,
                scale: config.scale
            };

            for (let i = 0; i < layer.count; i++) {
                this.resetMeteor(layer, i, 0, true);
            }

            this.scene.add(layer.mesh);
            this.layers.push(layer);
        }

        this.deactivate();
    }

    resetMeteor(layer: MeteorLayer, index: number, cameraX: number, initial: boolean = false) {
        // Spawn ahead of the camera, or randomly around if initial
        const xOffset = initial ? (Math.random() * 400 - 100) : (100 + Math.random() * 200);
        layer.positions[index * 3] = cameraX + xOffset;
        layer.positions[index * 3 + 1] = (Math.random() - 0.5) * 150; // Y range
        layer.positions[index * 3 + 2] = layer.zMax + Math.random() * (layer.zMin - layer.zMax); // Deep background Z range

        // Fast speeds moving leftwards (negative X), downwards (negative Y)
        layer.velocities[index * 3] = (-150 - Math.random() * 100) * layer.speedMult;     // X velocity
        layer.velocities[index * 3 + 1] = (-50 - Math.random() * 50) * layer.speedMult;   // Y velocity
        layer.velocities[index * 3 + 2] = 0;                          // Z velocity

        this.updateInstance(layer, index);
    }

    updateInstance(layer: MeteorLayer, index: number) {
        this.dummy.position.set(
            layer.positions[index * 3],
            layer.positions[index * 3 + 1],
            layer.positions[index * 3 + 2]
        );

        // Orient the meteor to face its velocity
        const vx = layer.velocities[index * 3];
        const vy = layer.velocities[index * 3 + 1];
        const vz = layer.velocities[index * 3 + 2];

        const target = new THREE.Vector3(
            this.dummy.position.x + vx,
            this.dummy.position.y + vy,
            this.dummy.position.z + vz
        );
        this.dummy.lookAt(target);

        this.dummy.updateMatrix();
        layer.mesh.setMatrixAt(index, this.dummy.matrix);
    }

    activate() {
        if (this.active) return;
        this.active = true;
        for (const layer of this.layers) {
            layer.mesh.visible = true;
        }
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        for (const layer of this.layers) {
            layer.mesh.visible = false;
        }
    }

    update(delta: number, cameraX: number) {
        if (!this.active) return;

        for (const layer of this.layers) {
            for (let i = 0; i < layer.count; i++) {
                layer.positions[i * 3] += layer.velocities[i * 3] * delta;
                layer.positions[i * 3 + 1] += layer.velocities[i * 3 + 1] * delta;

                // If it falls behind camera or too low, reset
                if (layer.positions[i * 3] < cameraX - 100 || layer.positions[i * 3 + 1] < -100) {
                    this.resetMeteor(layer, i, cameraX);
                } else {
                    this.updateInstance(layer, i);
                }
            }
            layer.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        for (const layer of this.layers) {
            this.scene.remove(layer.mesh);
            layer.mesh.geometry.dispose();
            if (layer.mesh.material && (layer.mesh.material as any).dispose) {
                (layer.mesh.material as any).dispose();
            }
        }
    }
}
