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
    dot,
    cos
} from 'three/tsl';
import type { AudioSystem } from './audio_system';
import type { ParticleSystem } from './particles';

/**
 * Creates a TSL material for Singing Crystal Geodes.
 * Features: Time-based pulsing, rainbow iridescent glow, smooth undulating light.
 */
function createSingingGeodeMaterial() {
    const mat = new MeshStandardNodeMaterial({
        color: 0xaa88ff,
        roughness: 0.3,
        metalness: 0.1,
        flatShading: true,
        transparent: false,
        depthWrite: true
    });

    const uTime = time;

    // A slow, gentle pulse for the "breathing/singing" effect
    const pulse = sin(uTime.mul(1.5)).add(1.0).mul(0.5);
    const secondaryPulse = cos(uTime.mul(2.2).add(positionWorld.x.mul(0.05))).mul(0.2).add(0.2);

    const glowIntensity = pulse.add(secondaryPulse).clamp(0.0, 1.0);

    // Iridescent/Rainbow color shift based on position and time
    const hueTime = uTime.mul(0.3);
    const posOffset = positionWorld.y.mul(0.1).add(positionWorld.x.mul(0.05));

    // We can simulate a rainbow by blending between some pastel TSL colors
    const r = sin(hueTime.add(posOffset)).add(1.0).mul(0.5);
    const g = sin(hueTime.add(posOffset).add(2.09)).add(1.0).mul(0.5); // 2.09 ~ 2PI/3
    const b = sin(hueTime.add(posOffset).add(4.18)).add(1.0).mul(0.5); // 4.18 ~ 4PI/3

    const iridescentColor = vec3(r, g, b).add(vec3(0.5, 0.5, 0.5)).clamp(0.0, 1.0); // Pastel-ize it

    mat.emissiveNode = iridescentColor.mul(glowIntensity).mul(0.8);

    return mat;
}

export class SingingGeodeSystem {
    scene: THREE.Scene;
    audioSystem: AudioSystem | null;
    particleSystem: ParticleSystem | null;

    active: boolean = false;
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;

    count: number = 0;
    maxCount: number = 80;

    positions: Float32Array;
    scales: Float32Array;
    rotations: Float32Array;
    triggered: boolean[]; // Keep track of whether it has "sung" recently to the player

    constructor(scene: THREE.Scene, audioSystem: AudioSystem | null = null, particleSystem: ParticleSystem | null = null) {
        this.scene = scene;
        this.audioSystem = audioSystem;
        this.particleSystem = particleSystem;

        // Geodes are typically icosahedrons for a low-poly crystal look
        const geo = new THREE.IcosahedronGeometry(1.5, 2);
        const mat = createSingingGeodeMaterial();

        this.mesh = new THREE.InstancedMesh(geo, mat, this.maxCount);
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.maxCount * 3);
        this.scales = new Float32Array(this.maxCount);
        this.rotations = new Float32Array(this.maxCount * 3);
        this.triggered = new Array(this.maxCount).fill(false);

        for (let i = 0; i < this.maxCount; i++) {
            this.dummy.scale.setScalar(0);
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

        for (let i = this.count; i < this.maxCount; i++) {
            this.dummy.scale.setScalar(0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    resetGeode(index: number, cameraX: number, initial: boolean = false) {
        const xOffset = initial ? (Math.random() * 500 - 100) : (300 + Math.random() * 200);
        this.positions[index * 3] = cameraX + xOffset;

        // Spread them around vertically and in depth to give an organic feel
        this.positions[index * 3 + 1] = (Math.random() - 0.5) * 60;
        this.positions[index * 3 + 2] = -50 + Math.random() * 90;

        // Sizes vary from somewhat small to quite large
        this.scales[index] = 1.8 + Math.random() * 3.5;

        this.rotations[index * 3] = Math.random() * Math.PI;
        this.rotations[index * 3 + 1] = Math.random() * Math.PI;
        this.rotations[index * 3 + 2] = Math.random() * Math.PI;

        this.triggered[index] = false;

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

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            // Gentle drift and rotation
            this.positions[i * 3] -= delta * 3.0; // Parallax drift
            this.rotations[i * 3] += delta * 0.1;
            this.rotations[i * 3 + 1] += delta * 0.15;

            // Re-wrap
            if (this.positions[i * 3] < cameraX - 100) {
                this.resetGeode(i, cameraX);
                needsUpdate = true;
            } else {
                this.updateInstance(i);
                needsUpdate = true;
            }

            // Proximity interaction (Singing & Sparkles)
            if (playerPos && !this.triggered[i]) {
                const px = this.positions[i * 3];
                const py = this.positions[i * 3 + 1];
                const pz = this.positions[i * 3 + 2];

                const dx = px - playerPos.x;
                const dy = py - playerPos.y;
                const dz = pz - playerPos.z;
                const distSq = dx * dx + dy * dy + dz * dz;

                // Trigger radius ~ 25 units
                if (distSq < 25 * 25) {
                    this.triggered[i] = true;

                    // Trigger sound
                    if (this.audioSystem) {
                        // Play a pleasant chime/lullaby note
                        this.audioSystem.play('wind_chime', 0.5);
                    }

                    // Trigger particles
                    if (this.particleSystem) {
                        const burstPos = new THREE.Vector3(px, py, pz);
                        // Emit a rainbow/pastel burst (color hex 0xffaaff for pinkish)
                        this.particleSystem.emit(burstPos, 0xffaaff, 15, 4, 0.8, 1.2);
                        this.particleSystem.emit(burstPos, 0x88ffff, 10, 5, 0.6, 1.5);
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
