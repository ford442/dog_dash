import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    time,
    positionWorld,
    vec3,
    mix,
    sin,
    float,
    cos,
    max,
    attribute,
    vertexColor,
    faceDirection,
    instancedDynamicBufferAttribute
} from 'three/tsl';
import type { Node } from 'three/src/nodes/Nodes.js';
import { getGeodeGeometry } from './scenery_art/geodes';
import type { AudioPort } from './ports';
import type { ParticleSystem } from './particles';
import { decorationBudget } from './decoration_budget';
import { gameplayRandom } from './run_seed';

/**
 * Singing geode material (shared with the gallery). The merged geometry
 * (`scenery_art/geodes.ts`) carries `aMask` = 1 on the crystal pipes; the
 * shell is double-sided and its back faces (the inside, seen through the
 * mouth) are the druzy lining. Crystals and lining pulse through pastel
 * rainbow ("singing"); `sing` (0..1, per instance in game) flares them when
 * the geode sings to the player. The rock shell itself stays stone.
 */
export function createSingingGeodeMaterial(sing: Node = float(0)) {
    const mat = new MeshStandardNodeMaterial({
        roughness: 0.35,
        metalness: 0.1,
        flatShading: true,
        side: THREE.DoubleSide
    });

    const uTime = time;
    const crystal = attribute('aMask', 'float');
    const inside = faceDirection.mul(-0.5).add(0.5); // 1 on back faces
    const glowing = max(crystal, inside.mul(0.6));

    // A slow, gentle pulse for the "breathing/singing" effect
    const pulse = sin(uTime.mul(1.5)).add(1.0).mul(0.5);
    const secondaryPulse = cos(uTime.mul(2.2).add(positionWorld.x.mul(0.05))).mul(0.2).add(0.2);
    const glowIntensity = pulse.add(secondaryPulse).clamp(0.0, 1.0);

    // Iridescent/Rainbow colour shift based on position and time
    const hueTime = uTime.mul(0.3);
    const posOffset = positionWorld.y.mul(0.1).add(positionWorld.x.mul(0.05));
    const r = sin(hueTime.add(posOffset)).add(1.0).mul(0.5);
    const g = sin(hueTime.add(posOffset).add(2.09)).add(1.0).mul(0.5); // 2.09 ~ 2PI/3
    const b = sin(hueTime.add(posOffset).add(4.18)).add(1.0).mul(0.5); // 4.18 ~ 4PI/3
    const iridescentColor = vec3(r, g, b).add(vec3(0.5, 0.5, 0.5)).clamp(0.0, 1.0); // Pastel-ize it

    mat.colorNode = mix(vertexColor(), vec3(0.85, 0.75, 1.0), inside.mul(float(1).sub(crystal)));
    mat.emissiveNode = iridescentColor.mul(glowing).mul(glowIntensity.mul(0.7).add(sing.mul(1.6)));
    return mat;
}

/** The merged geode is unit radius; the old icosphere was 1.5. */
const GEODE_UNIT_SCALE = 1.5;

export class SingingGeodeSystem {
    scene: THREE.Scene;
    audioSystem: AudioPort | null;
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
    /** Per-instance sing flare (1 when it sings to the player, decays). */
    private singAttr: THREE.InstancedBufferAttribute;
    private elapsed = 0;

    constructor(scene: THREE.Scene, audioSystem: AudioPort | null = null, particleSystem: ParticleSystem | null = null) {
        this.scene = scene;
        this.audioSystem = audioSystem;
        this.particleSystem = particleSystem;

        decorationBudget.register('singing_geodes', {
            label: 'Singing crystal geodes',
            category: 'background3d',
            maxActive: 80 // pool maxCount, not active count — actual count is density-driven (level configs use 15, 20)
        });

        // Round rock bowl with a ragged mouth and a crown of crystal pipes (one shared merged geometry).
        // Scaled to the old 1.5-radius icosphere footprint.
        const geo = getGeodeGeometry('singing');
        this.singAttr = new THREE.InstancedBufferAttribute(new Float32Array(this.maxCount), 1);
        this.singAttr.setUsage(THREE.DynamicDrawUsage);
        const mat = createSingingGeodeMaterial(instancedDynamicBufferAttribute(this.singAttr, 'float'));

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
        decorationBudget.syncCount('singing_geodes', this.count);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('singing_geodes', 0);
    }

    resetGeode(index: number, cameraX: number, initial: boolean = false) {
        const xOffset = initial ? (gameplayRandom('geology') * 500 - 100) : (300 + gameplayRandom('geology') * 200);
        this.positions[index * 3] = cameraX + xOffset;

        // Spread them around vertically and in depth to give an organic feel
        this.positions[index * 3 + 1] = (gameplayRandom('geology') - 0.5) * 60;
        this.positions[index * 3 + 2] = -50 + gameplayRandom('geology') * 90;

        // Sizes vary from somewhat small to quite large
        this.scales[index] = 1.8 + gameplayRandom('geology') * 3.5;

        // Mouth roughly toward the camera so the crystal crown reads; the update sways it.
        this.rotations[index * 3] = (Math.random() - 0.5) * 0.5; // visual-only
        this.rotations[index * 3 + 1] = (Math.random() - 0.5) * 0.9; // visual-only
        this.rotations[index * 3 + 2] = (Math.random() - 0.5) * 0.6; // visual-only

        this.triggered[index] = false;
        this.singAttr.setX(index, 0);

        this.updateInstance(index);
    }

    updateInstance(index: number) {
        this.dummy.position.set(
            this.positions[index * 3],
            this.positions[index * 3 + 1],
            this.positions[index * 3 + 2]
        );

        this.dummy.scale.setScalar(this.scales[index] * GEODE_UNIT_SCALE);

        const sway = Math.sin(this.elapsed * 0.4 + index * 1.3);
        this.dummy.rotation.set(
            this.rotations[index * 3] + sway * 0.08,
            this.rotations[index * 3 + 1] + sway * 0.25,
            this.rotations[index * 3 + 2]
        );

        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(index, this.dummy.matrix);
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        let needsUpdate = false;
        this.elapsed += delta;
        const singDecay = Math.exp(-delta * 1.2);

        for (let i = 0; i < this.count; i++) {
            // Gentle drift (the sway lives in updateInstance)
            this.positions[i * 3] -= delta * 3.0; // Parallax drift
            this.singAttr.setX(i, this.singAttr.getX(i) * singDecay);

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
                    this.singAttr.setX(i, 1);

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
        this.singAttr.needsUpdate = true;
    }

    cleanup() {
        decorationBudget.syncCount('singing_geodes', 0);
        this.scene.remove(this.mesh);
        // Geometry is shared (scenery_art/geodes.ts); only the material is ours.
        if (this.mesh.material && (this.mesh.material as any).dispose) {
            (this.mesh.material as any).dispose();
        }
    }
}
