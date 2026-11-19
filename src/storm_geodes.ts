import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    time,
    color,
    sin,
    float,
    max,
    attribute,
    vertexColor,
    faceDirection,
    instancedDynamicBufferAttribute
} from 'three/tsl';
import type { Node } from 'three/src/nodes/Nodes.js';
import { getGeodeGeometry } from './scenery_art/geodes';
import { playerState } from './game_config';
import { gameplayRandom } from './run_seed';

export type StormGeodeFxDeps = {
    playHit?: () => void;
    onBoltStrike?: ((pos: THREE.Vector3, color: THREE.Color) => void) | null;
};

/**
 * Storm geode material (shared with the gallery). Dark stone boulder; the
 * needle shards (`aMask` = 1) and the inside of the zig-zag crack (back
 * faces) carry the electric glow. `flash` (0..1, per instance in game) spikes
 * when that geode throws an arc, so you can see which one struck.
 */
export function createStormGeodeMaterial(flash: Node = float(0), emissiveColorHex = 0x4488ff) {
    const mat = new MeshStandardNodeMaterial({
        roughness: 0.8,
        metalness: 0.3,
        flatShading: true,
        side: THREE.DoubleSide
    });

    const uTime = time;
    const crystal = attribute('aMask', 'float');
    const inside = faceDirection.mul(-0.5).add(0.5); // 1 on back faces
    const charged = max(crystal, inside.mul(0.8));

    const pulse = sin(uTime.mul(2.0)).add(1.0).mul(0.5); // 0..1
    const fastPulse = sin(uTime.mul(10.0)).mul(0.1);
    const glowIntensity = pulse.add(fastPulse).clamp(0.0, 1.0).mul(0.8);

    mat.colorNode = vertexColor();
    mat.emissiveNode = color(emissiveColorHex).mul(charged).mul(glowIntensity.add(flash.mul(2.5)))
        .add(color(0xffffff).mul(crystal.mul(flash).mul(0.8)));
    return mat;
}

/** Arc flash fall-off per second (the merged geode is unit radius, like the old icosphere). */
const STORM_FLASH_DECAY = 4.0;

export class StormGeodeSystem {
    scene: THREE.Scene;
    private readonly fx: StormGeodeFxDeps;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;

    count: number = 0;
    maxCount: number = 200;

    positions: Float32Array;
    scales: Float32Array;
    rotations: Float32Array;
    timers: Float32Array; // Timer for lightning arcs
    /** Per-instance arc flash (1 on a strike, decays). */
    private flashAttr: THREE.InstancedBufferAttribute;
    private elapsed = 0;

    constructor(scene: THREE.Scene, fx: StormGeodeFxDeps = {}) {
        this.scene = scene;
        this.fx = fx;

        // Flat angular boulder split by a zig-zag crack, needle shards bursting out (shared merged geometry).
        const geo = getGeodeGeometry('storm');
        this.flashAttr = new THREE.InstancedBufferAttribute(new Float32Array(this.maxCount), 1);
        this.flashAttr.setUsage(THREE.DynamicDrawUsage);
        const mat = createStormGeodeMaterial(instancedDynamicBufferAttribute(this.flashAttr, 'float'));

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
        const xOffset = initial ? (gameplayRandom('geology') * 400 - 100) : (100 + gameplayRandom('geology') * 200);
        this.positions[index * 3] = cameraX + xOffset;
        this.positions[index * 3 + 1] = (gameplayRandom('geology') - 0.5) * 80;
        this.positions[index * 3 + 2] = -40 + gameplayRandom('geology') * 80;

        this.scales[index] = 2.0 + gameplayRandom('geology') * 3.0;

        // Crack roughly toward the camera so the shards read; the update rocks it.
        this.rotations[index * 3] = (Math.random() - 0.5) * 0.5; // visual-only
        this.rotations[index * 3 + 1] = (Math.random() - 0.5) * 1.0; // visual-only
        this.rotations[index * 3 + 2] = (Math.random() - 0.5) * 0.8; // visual-only
        this.flashAttr.setX(index, 0);

        this.timers[index] = gameplayRandom('geology') * 3.0; // Randomize start phase

        this.updateInstance(index);
    }

    updateInstance(index: number) {
        this.dummy.position.set(
            this.positions[index * 3],
            this.positions[index * 3 + 1],
            this.positions[index * 3 + 2]
        );

        this.dummy.scale.setScalar(this.scales[index]);

        const rock = Math.sin(this.elapsed * 0.5 + index * 2.1);
        this.dummy.rotation.set(
            this.rotations[index * 3],
            this.rotations[index * 3 + 1] + rock * 0.3,
            this.rotations[index * 3 + 2] + rock * 0.1
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
        this.elapsed += delta;
        const flashDecay = Math.exp(-delta * STORM_FLASH_DECAY);

        for (let i = 0; i < this.count; i++) {
            // Very slow drift (the rocking lives in updateInstance)
            this.positions[i * 3] -= delta * 5.0;
            this.flashAttr.setX(i, this.flashAttr.getX(i) * flashDecay);

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
                this.timers[i] = 2.5 + gameplayRandom('geology') * 1.0; // Arc roughly every 3s

                const pos = new THREE.Vector3(
                    this.positions[i * 3],
                    this.positions[i * 3 + 1],
                    this.positions[i * 3 + 2]
                );

                // Only arc if near the player
                if (pos.distanceTo(new THREE.Vector3(cameraX, 0, 0)) < 150) {
                    this.flashAttr.setX(i, 1);
                    // Decide where to strike. If player is close enough, chain to player!
                    let strikePos = pos.clone();
                    if (playerPos && pos.distanceTo(playerPos) < 40) {
                        strikePos = playerPos.clone();
                        // Optional: Damage player if chained? Let's just do visual for now or use existing mechanic
                    } else {
                        // Random arc to nearby space
                        strikePos.add(new THREE.Vector3(
                            (Math.random() - 0.5) * 30, // visual-only
                            (Math.random() - 0.5) * 30, // visual-only
                            (Math.random() - 0.5) * 30 // visual-only
                        ));
                    }

                    if (this.fx.onBoltStrike) {
                         // Play a sound (if near)
                         if (pos.distanceTo(new THREE.Vector3(cameraX, 0, 0)) < 80) {
                             this.fx.playHit?.();
                         }

                         // Temporarily change bolt origin to the geode
                         // But LightningBoltSystem generates full V shapes in screen space
                         // Actually, we can just trigger a general strike near the geode
                         this.fx.onBoltStrike(pos, new THREE.Color(0x4488ff));
                    }
                }
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
        this.flashAttr.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        // Geometry is shared (scenery_art/geodes.ts); only the material is ours.
        if (this.mesh.material && (this.mesh.material as any).dispose) {
            (this.mesh.material as any).dispose();
        }
    }
}
