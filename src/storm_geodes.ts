import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    time,
    positionWorld,
    positionLocal,
    uv,
    vec3,
    vec4,
    color,
    uniform,
    mix,
    sin,
    float,
    smoothstep,
    length,
    distance,
    Loop,
    normalView,
    normalLocal,
    dot
} from 'three/tsl';
import { lightningBoltSystem, audioSystem } from './game_systems';
import { playerState } from './game_config';

/**
 * Creates a TSL material for Storm Geodes.
 * Features: Time-based pulsing, noise-based internal glow.
 */
function createStormGeodeMaterial(baseColorHex: number, emissiveColorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        roughness: 0.8,
        metalness: 0.3,
        flatShading: true,
        transparent: false,
        depthWrite: true
    });

    const uTime = time;

    const pulse = sin(uTime.mul(2.0)).add(1.0).mul(0.5); // 0..1
    const fastPulse = sin(uTime.mul(10.0)).mul(0.1);

    const glowIntensity = pulse.add(fastPulse).clamp(0.0, 1.0).mul(0.8);

    // Base emissive color
    const baseEmissive = color(emissiveColorHex);

    mat.emissiveNode = baseEmissive.mul(glowIntensity);

    return mat;
}

export class StormGeodeSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;

    count: number = 0;
    maxCount: number = 200;

    positions: Float32Array;
    scales: Float32Array;
    rotations: Float32Array;
    timers: Float32Array; // Timer for lightning arcs

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.IcosahedronGeometry(1, 1);
        const mat = createStormGeodeMaterial(0x222233, 0x4488ff);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.maxCount);
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.maxCount * 3);
        this.scales = new Float32Array(this.maxCount);
        this.rotations = new Float32Array(this.maxCount * 3);
        this.timers = new Float32Array(this.maxCount);

        for (let i = 0; i < this.maxCount; i++) {
            // Hide initially
            this.dummy.scale.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(density: number = 10) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        this.count = Math.min(density, this.maxCount);

        for (let i = 0; i < this.count; i++) {
            this.resetGeode(i, 0, true);
        }

        // Hide unused instances
        for (let i = this.count; i < this.maxCount; i++) {
            this.dummy.scale.setScalar(0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    resetGeode(index: number, cameraX: number, initial: boolean = false) {
        const xOffset = initial ? (Math.random() * 400 - 100) : (100 + Math.random() * 200);
        this.positions[index * 3] = cameraX + xOffset;
        this.positions[index * 3 + 1] = (Math.random() - 0.5) * 80;
        this.positions[index * 3 + 2] = -40 + Math.random() * 80;

        this.scales[index] = 2.0 + Math.random() * 3.0;

        this.rotations[index * 3] = Math.random() * Math.PI;
        this.rotations[index * 3 + 1] = Math.random() * Math.PI;
        this.rotations[index * 3 + 2] = Math.random() * Math.PI;

        this.timers[index] = Math.random() * 3.0; // Randomize start phase

        this.updateInstance(index);
    }

    updateInstance(index: number) {
        this.dummy.position.set(
            this.positions[index * 3],
            this.positions[index * 3 + 1],
            this.positions[index * 3 + 2]
        );

        this.dummy.scale.setScalar(this.scales[index]);

        this.dummy.rotation.set(
            this.rotations[index * 3],
            this.rotations[index * 3 + 1],
            this.rotations[index * 3 + 2]
        );

        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(index, this.dummy.matrix);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            // Very slow drift
            this.positions[i * 3] -= delta * 5.0;
            this.rotations[i * 3] += delta * 0.2;
            this.rotations[i * 3 + 1] += delta * 0.3;

            // Re-wrap
            if (this.positions[i * 3] < cameraX - 100) {
                this.resetGeode(i, cameraX);
                needsUpdate = true;
            } else {
                this.updateInstance(i);
                needsUpdate = true;
            }

            // Lightning timer
            this.timers[i] -= delta;
            if (this.timers[i] <= 0) {
                this.timers[i] = 2.5 + Math.random() * 1.0; // Arc roughly every 3s

                const pos = new THREE.Vector3(
                    this.positions[i * 3],
                    this.positions[i * 3 + 1],
                    this.positions[i * 3 + 2]
                );

                // Only arc if near the player
                if (pos.distanceTo(new THREE.Vector3(cameraX, 0, 0)) < 150) {
                    // Decide where to strike. If player is close enough, chain to player!
                    let strikePos = pos.clone();
                    if (playerPos && pos.distanceTo(playerPos) < 40) {
                        strikePos = playerPos.clone();
                        // Optional: Damage player if chained? Let's just do visual for now or use existing mechanic
                    } else {
                        // Random arc to nearby space
                        strikePos.add(new THREE.Vector3(
                            (Math.random() - 0.5) * 30,
                            (Math.random() - 0.5) * 30,
                            (Math.random() - 0.5) * 30
                        ));
                    }

                    if (lightningBoltSystem && lightningBoltSystem.onBoltStrike) {
                         // Play a sound (if near)
                         if (pos.distanceTo(new THREE.Vector3(cameraX, 0, 0)) < 80) {
                             audioSystem.play('hit'); // Reuse hit sound or lightning sound if available
                         }

                         // Temporarily change bolt origin to the geode
                         // But LightningBoltSystem generates full V shapes in screen space
                         // Actually, we can just trigger a general strike near the geode
                         lightningBoltSystem.onBoltStrike(pos, new THREE.Color(0x4488ff));
                    }
                }
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if (this.mesh.material && (this.mesh.material as any).dispose) {
            (this.mesh.material as any).dispose();
        }
    }
}
