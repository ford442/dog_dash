/**
 * Crystal Chime Clusters — tall thin crystal rods with glowing nodes.
 *
 * Active object budget (per runtime):
 * - ≤12 clusters
 * - ≤84 rod instances (12 × 7 rods) — 1 InstancedMesh draw call
 * - ≤12 glow nodes — 1 InstancedMesh draw call
 * - Particles: 10–16 sparkle burst only on proximity trigger (no continuous emit)
 * - Audio: 3–5 short arpeggiated bell voices, reverb send
 * - Collision: distance-only soft push (no WASM / physics bodies)
 */

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time,
    sin,
    float,
    attribute,
    vec4,
    vec3,
    mix
} from 'three/tsl';
import { ParticleSystem } from './particles';
import { DEPTH_LAYERS, randomZInRange } from './depth_layers';
import { createIridescentCrystal } from './candy_materials';
import type { AudioPort } from './ports';
import { decorationBudget } from './decoration_budget';

const MAX_CLUSTERS = 12;
const MAX_RODS_PER_CLUSTER = 7;
const MAX_ROD_INSTANCES = MAX_CLUSTERS * MAX_RODS_PER_CLUSTER;
const UNITS_PER_SLICE = 400;
const MAX_CLUSTERS_PER_SLICE = 12;
const TRIGGER_RADIUS_MIN = 18;
const TRIGGER_RADIUS_MAX = 25;

const NOTE_SETS: readonly (readonly number[])[] = [
    [523.25, 659.25, 783.99, 987.77],
    [392.0, 493.88, 587.33, 739.99],
    [440.0, 554.37, 659.25, 880.0],
    [349.23, 440.0, 523.25, 659.25],
    [587.33, 739.99, 880.0, 1108.73],
    [329.63, 415.3, 493.88, 622.25]
];

const CRYSTAL_COLORS = [0x88ccff, 0xaa88ff, 0x66eeff, 0xcc99ff, 0xaaddff];

export interface ChimeInteraction {
    type: 'ring' | 'star_bonus' | 'soft_push';
    position: THREE.Vector3;
    force?: THREE.Vector3;
    scoreBonus?: number;
}

interface RodSlot {
    localX: number;
    localZ: number;
    height: number;
    phase: number;
}

interface ChimeCluster {
    x: number;
    y: number;
    z: number;
    rodCount: number;
    rodStart: number;
    rods: RodSlot[];
    noteSet: number;
    phase: number;
    maxHeight: number;
    triggerRadius: number;
    cooldown: number;
    nodePulse: number;
}

const _dummy = new THREE.Object3D();
const _pos = new THREE.Vector3();
const _force = new THREE.Vector3();

const ROD_GEOMETRY = (() => {
    const geo = new THREE.CylinderGeometry(0.05, 0.11, 1, 5);
    geo.translate(0, 0.5, 0);
    return geo;
})();

const NODE_GEOMETRY = new THREE.OctahedronGeometry(0.28, 0);

function createRodMaterial(): THREE.Material {
    return createIridescentCrystal(0x88ccff, 1.2, {
        opacity: 0.82,
        instanceTintAttribute: 'aRodTint',
        instancePhaseAttribute: 'aRodPhase',
        cacheKey: 'chime_rod'
    });
}

function createNodeMaterial(): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const aTint = attribute('aNodeTint', 'vec3');
    const aPhase = attribute('aNodePhase', 'float');
    const pulse = sin(time.mul(2.6).add(aPhase)).mul(0.5).add(0.5);

    mat.colorNode = aTint.mul(pulse.mul(0.55).add(0.65));
    mat.opacityNode = float(0.55).add(pulse.mul(0.35));

    return mat;
}

export class CrystalChimeManager {
    private scene: THREE.Scene;
    private particles: ParticleSystem | null;
    private audio: AudioPort | null;
    private clusters: ChimeCluster[] = [];

    private rodMesh: THREE.InstancedMesh;
    private nodeMesh: THREE.InstancedMesh;
    private rodPhases: Float32Array;
    private rodTints: Float32Array;
    private nodePhases: Float32Array;
    private nodeTints: Float32Array;
    private activeRods = 0;
    private elapsed = 0;

    constructor(
        scene: THREE.Scene,
        particles: ParticleSystem | null = null,
        audio: AudioPort | null = null
    ) {
        this.scene = scene;
        this.particles = particles;
        this.audio = audio;

        const rodMat = createRodMaterial();
        this.rodMesh = new THREE.InstancedMesh(ROD_GEOMETRY, rodMat, MAX_ROD_INSTANCES);
        this.rodMesh.frustumCulled = false;
        this.rodMesh.count = 0;

        this.rodPhases = new Float32Array(MAX_ROD_INSTANCES);
        this.rodTints = new Float32Array(MAX_ROD_INSTANCES * 3);

        const nodeMat = createNodeMaterial();
        this.nodeMesh = new THREE.InstancedMesh(NODE_GEOMETRY, nodeMat, MAX_CLUSTERS);
        this.nodeMesh.frustumCulled = false;
        this.nodeMesh.count = 0;

        this.nodePhases = new Float32Array(MAX_CLUSTERS);
        this.nodeTints = new Float32Array(MAX_CLUSTERS * 3);

        this.rodMesh.geometry.setAttribute(
            'aRodPhase',
            new THREE.InstancedBufferAttribute(this.rodPhases, 1)
        );
        this.rodMesh.geometry.setAttribute(
            'aRodTint',
            new THREE.InstancedBufferAttribute(this.rodTints, 3)
        );
        this.nodeMesh.geometry.setAttribute(
            'aNodePhase',
            new THREE.InstancedBufferAttribute(this.nodePhases, 1)
        );
        this.nodeMesh.geometry.setAttribute(
            'aNodeTint',
            new THREE.InstancedBufferAttribute(this.nodeTints, 3)
        );

        this.scene.add(this.rodMesh);
        this.scene.add(this.nodeMesh);
    }

    /** Spawn clusters for a world chunk (8–12 per 400 units at max density). */
    streamChunk(
        startX: number,
        width: number,
        density: number,
        yRange: [number, number] = [-16, 16]
    ): void {
        if (density <= 0 || width <= 0 || this.clusters.length >= MAX_CLUSTERS) return;

        const sliceFactor = width / UNITS_PER_SLICE;
        const requested = Math.floor(density * sliceFactor * 1.1);
        const room = MAX_CLUSTERS - this.clusters.length;
        const count = Math.min(room, Math.min(MAX_CLUSTERS_PER_SLICE, Math.max(1, requested)));

        const zRange: [number, number] = [
            DEPTH_LAYERS.MIDGROUND.min,
            DEPTH_LAYERS.NEAR.max
        ];

        for (let i = 0; i < count; i++) {
            const x = startX + 30 + Math.random() * Math.max(40, width - 60);
            const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
            const z = randomZInRange(zRange);
            this.spawnCluster(x, y, z);
        }
    }

    spawnCluster(x: number, y: number, z: number): boolean {
        if (this.clusters.length >= MAX_CLUSTERS) return false;
        if (!decorationBudget.canSpawn('crystal_chimes')) return false;

        const rodCount = 3 + Math.floor(Math.random() * 5);
        if (this.activeRods + rodCount > MAX_ROD_INSTANCES) return false;
        if (!decorationBudget.reportSpawn('crystal_chimes')) return false;

        const rodStart = this.activeRods;
        const colorHex = CRYSTAL_COLORS[Math.floor(Math.random() * CRYSTAL_COLORS.length)];
        const tint = new THREE.Color(colorHex);
        const rods: RodSlot[] = [];
        let maxHeight = 0;

        for (let r = 0; r < rodCount; r++) {
            const angle = (r / rodCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const radius = 0.25 + Math.random() * 0.55;
            const height = 3.5 + Math.random() * 5.5;
            maxHeight = Math.max(maxHeight, height);

            const idx = rodStart + r;
            this.rodPhases[idx] = Math.random() * Math.PI * 2;
            this.rodTints[idx * 3] = tint.r;
            this.rodTints[idx * 3 + 1] = tint.g;
            this.rodTints[idx * 3 + 2] = tint.b;

            rods.push({
                localX: Math.cos(angle) * radius,
                localZ: Math.sin(angle) * radius,
                height,
                phase: Math.random() * Math.PI * 2
            });
        }

        this.activeRods += rodCount;

        const clusterIdx = this.clusters.length;
        this.nodePhases[clusterIdx] = Math.random() * Math.PI * 2;
        this.nodeTints[clusterIdx * 3] = tint.r;
        this.nodeTints[clusterIdx * 3 + 1] = tint.g;
        this.nodeTints[clusterIdx * 3 + 2] = tint.b;

        this.clusters.push({
            x,
            y,
            z,
            rodCount,
            rodStart,
            rods,
            noteSet: Math.floor(Math.random() * NOTE_SETS.length),
            phase: Math.random() * Math.PI * 2,
            maxHeight,
            triggerRadius: TRIGGER_RADIUS_MIN + Math.random() * (TRIGGER_RADIUS_MAX - TRIGGER_RADIUS_MIN),
            cooldown: 0,
            nodePulse: 0
        });

        this._rebuildMatrices(0);
        return true;
    }

    update(
        dt: number,
        time: number,
        playerPos?: THREE.Vector3,
        playerVel?: THREE.Vector3
    ): ChimeInteraction[] {
        this.elapsed += dt;
        const results: ChimeInteraction[] = [];

        for (const cluster of this.clusters) {
            cluster.cooldown = Math.max(0, cluster.cooldown - dt);
            cluster.nodePulse = Math.max(0, cluster.nodePulse - dt);
        }

        this._rebuildMatrices(time);

        if (!playerPos) return results;

        const speed = playerVel?.length() ?? 0;
        const heightShift = playerPos.y * 0.002;
        const speedShift = speed * 0.008;
        const pitchShift = 1 + heightShift + speedShift;

        for (const cluster of this.clusters) {
            _pos.set(cluster.x, cluster.y + cluster.maxHeight * 0.92, cluster.z);
            const dist = _pos.distanceTo(playerPos);

            if (dist < cluster.triggerRadius && cluster.cooldown <= 0) {
                cluster.cooldown = 2.8;
                cluster.nodePulse = 1.2;

                const notes = NOTE_SETS[cluster.noteSet];
                const noteCount = Math.min(notes.length, cluster.rodCount);
                const picked = notes.slice(0, noteCount);

                if (this.audio) {
                    if (typeof this.audio.playCrystalChime === 'function') {
                        this.audio.playCrystalChime(picked as number[], 0.34, pitchShift);
                    } else {
                        this.audio.play('wind_chime', 0.34);
                    }
                }

                if (this.particles) {
                    const sparkleColor = CRYSTAL_COLORS[cluster.noteSet % CRYSTAL_COLORS.length];
                    for (let s = 0; s < 12; s++) {
                        const angle = (s / 12) * Math.PI * 2;
                        const burstPos = _pos.clone();
                        burstPos.x += Math.cos(angle) * 0.4;
                        burstPos.z += Math.sin(angle) * 0.4;
                        this.particles.emit(burstPos, sparkleColor, 1, 2.8, 0.35, 0.9);
                    }
                    this.particles.emit(_pos, 0xffffff, 6, 3.5, 0.25, 1.1);
                }

                results.push({ type: 'ring', position: _pos.clone() });

                if (Math.random() < 0.14) {
                    results.push({
                        type: 'star_bonus',
                        position: _pos.clone(),
                        scoreBonus: 5
                    });
                }
            }

            const push = this._checkSoftPush(cluster, playerPos);
            if (push) results.push(push);
        }

        return results;
    }

    private _checkSoftPush(cluster: ChimeCluster, playerPos: THREE.Vector3): ChimeInteraction | null {
        const dx = playerPos.x - cluster.x;
        const dy = playerPos.y - cluster.y;
        const dz = playerPos.z - cluster.z;
        const planar = Math.sqrt(dx * dx + dz * dz);
        const radius = 1.8;

        if (Math.abs(dy) > cluster.maxHeight + 1 || planar > radius) return null;

        _force.set(-dx * 0.6, 0.4, -dz * 0.6);
        return {
            type: 'soft_push',
            position: playerPos.clone(),
            force: _force.clone()
        };
    }

    private _rebuildMatrices(time: number): void {
        let rodIdx = 0;
        let nodeIdx = 0;

        for (const cluster of this.clusters) {
            const sway = Math.sin(time * 0.85 + cluster.phase) * 0.06;
            const swayZ = Math.cos(time * 0.7 + cluster.phase) * 0.04;
            const nodeY = cluster.y + cluster.maxHeight * 0.92
                + Math.sin(time * 1.2 + cluster.phase) * 0.08;

            _dummy.position.set(cluster.x, nodeY, cluster.z);
            _dummy.rotation.set(sway, cluster.phase, swayZ);
            const nodeScale = 0.85 + cluster.nodePulse * 0.35
                + Math.sin(time * 2.4 + cluster.phase) * 0.08;
            _dummy.scale.setScalar(nodeScale);
            _dummy.updateMatrix();
            this.nodeMesh.setMatrixAt(nodeIdx++, _dummy.matrix);

            for (let r = 0; r < cluster.rodCount; r++) {
                const rod = cluster.rods[r];
                const rodSway = Math.sin(time * 1.1 + rod.phase) * 0.05;

                _dummy.position.set(
                    cluster.x + rod.localX,
                    cluster.y,
                    cluster.z + rod.localZ
                );
                _dummy.rotation.set(rodSway + sway * 0.5, cluster.phase, swayZ);
                _dummy.scale.set(1, rod.height, 1);
                _dummy.updateMatrix();
                this.rodMesh.setMatrixAt(rodIdx++, _dummy.matrix);
            }
        }

        this.rodMesh.count = rodIdx;
        this.nodeMesh.count = nodeIdx;
        this.activeRods = rodIdx;

        (this.rodMesh.geometry.attributes.aRodPhase as THREE.InstancedBufferAttribute).needsUpdate = true;
        (this.rodMesh.geometry.attributes.aRodTint as THREE.InstancedBufferAttribute).needsUpdate = true;
        (this.nodeMesh.geometry.attributes.aNodePhase as THREE.InstancedBufferAttribute).needsUpdate = true;
        (this.nodeMesh.geometry.attributes.aNodeTint as THREE.InstancedBufferAttribute).needsUpdate = true;
        this.rodMesh.instanceMatrix.needsUpdate = true;
        this.nodeMesh.instanceMatrix.needsUpdate = true;
    }

    cleanupFarBehind(playerX: number, buffer = 110): void {
        for (let i = this.clusters.length - 1; i >= 0; i--) {
            if (this.clusters[i].x < playerX - buffer) {
                this.clusters.splice(i, 1);
                decorationBudget.reportDestroy('crystal_chimes');
            }
        }
        this._compactRodIndices();
        this._rebuildMatrices(this.elapsed);
    }

    private _compactRodIndices(): void {
        let cursor = 0;
        for (let c = 0; c < this.clusters.length; c++) {
            const cluster = this.clusters[c];
            for (let r = 0; r < cluster.rodCount; r++) {
                const oldIdx = cluster.rodStart + r;
                const newIdx = cursor + r;
                if (oldIdx !== newIdx) {
                    this.rodPhases[newIdx] = this.rodPhases[oldIdx];
                    this.rodTints[newIdx * 3] = this.rodTints[oldIdx * 3];
                    this.rodTints[newIdx * 3 + 1] = this.rodTints[oldIdx * 3 + 1];
                    this.rodTints[newIdx * 3 + 2] = this.rodTints[oldIdx * 3 + 2];
                    cluster.rods[r] = { ...cluster.rods[r] };
                }
            }
            cluster.rodStart = cursor;
            cursor += cluster.rodCount;

            this.nodePhases[c] = this.nodePhases[c];
            this.nodeTints[c * 3] = this.nodeTints[c * 3];
            this.nodeTints[c * 3 + 1] = this.nodeTints[c * 3 + 1];
            this.nodeTints[c * 3 + 2] = this.nodeTints[c * 3 + 2];
        }
        this.activeRods = cursor;
    }

    clear(): void {
        const removed = this.clusters.length;
        this.clusters = [];
        this.activeRods = 0;
        this.rodMesh.count = 0;
        this.nodeMesh.count = 0;
        if (removed > 0) decorationBudget.reportDestroy('crystal_chimes', removed);
    }

    getCount(): number {
        return this.clusters.length;
    }

    dispose(): void {
        this.scene.remove(this.rodMesh);
        this.scene.remove(this.nodeMesh);
        (this.rodMesh.material as THREE.Material).dispose?.();
        (this.nodeMesh.material as THREE.Material).dispose?.();
    }
}
