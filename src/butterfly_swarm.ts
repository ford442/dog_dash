import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time,
    uv,
    vec3,
    vec4,
    sin,
    float,
    smoothstep,
    pow,
    positionLocal,
    attribute
} from 'three/tsl';
import type { ParticleSystem } from './particles';
import type { AudioSystem } from './audio_system';
import { decorationBudget } from './decoration_budget';

/**
 * Butterfly Swarm System for Dog Dash
 * Creates a magical swarm of glowing, flapping butterflies
 * Perfect for a dreamy 7-year-old girl aesthetic! 🦋✨🌈
 *
 * Render budgets (kept separate):
 * - Background swarm: 100 InstancedMesh butterflies (ambient joy)
 * - Friendly escort: ≤20 InstancedMesh butterflies (2 groups × ≤10), own mesh
 */

// --- Background swarm budget ---
const BACKGROUND_SWARM_COUNT = 100;

// --- Escort budget (separate from background) ---
const MAX_ESCORT_GROUPS = 2;
const MAX_ESCORT_PER_GROUP = 10;
const MAX_ESCORT_INSTANCES = MAX_ESCORT_GROUPS * MAX_ESCORT_PER_GROUP;

const ESCORT_DURATION_MIN = 12;
const ESCORT_DURATION_MAX = 20;
const ESCORT_SPAWN_COOLDOWN = 38;

export interface ButterflySwarmUpdateContext {
    grazeCombo?: number;
    slingCombo?: number;
    /** Seconds since the player last took damage (for clean-flying bonus). */
    cleanFlightTime?: number;
}

interface EscortSlot {
    phase: number;
    orbitOffset: number;
    ring: number;
    scale: number;
    color: THREE.Color;
}

interface EscortGroup {
    instanceStart: number;
    count: number;
    slots: EscortSlot[];
    timeLeft: number;
    orbitPhase: number;
    hasShield: boolean;
    dispersing: boolean;
    disperseTimer: number;
}

type JuiceLike = {
    showFloatingText: (text: string, pos: THREE.Vector3, color: string, size?: number) => void;
    spawnSparkles: (pos: THREE.Vector3, color: THREE.Color, count?: number) => void;
    burstMagic: (pos: THREE.Vector3) => void;
};

function createButterflyMaterial(): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const uTime = time;
    const vUv = uv();
    const aPhase = attribute('aPhase', 'float');
    const aColor = attribute('aColor', 'vec3');

    const xDist = vUv.x.sub(0.5).abs().mul(2.0);
    const yDist = vUv.y.sub(0.5).abs().mul(2.0);
    const wingShape = float(1.0).sub(pow(xDist, 2.0).add(pow(yDist, 2.0)));
    const isCenter = smoothstep(0.0, 0.1, vUv.x.sub(0.5).abs());
    const alpha = smoothstep(0.0, 0.3, wingShape).mul(isCenter);

    const flapSpeed = float(15.0);
    const flapAmount = float(0.8);
    const flapAngle = sin(uTime.mul(flapSpeed).add(aPhase)).mul(flapAmount);
    const bendFactor = vUv.x.sub(0.5).abs().mul(2.0);
    const zOffset = bendFactor.mul(flapAngle);
    mat.positionNode = positionLocal.add(vec3(0.0, 0.0, zOffset));

    const shimmer = sin(uTime.mul(5.0).add(vUv.y.mul(10.0)).add(aPhase))
        .add(1.0).mul(0.5).mul(0.3);
    const finalColor = aColor.add(vec3(shimmer));
    const glowAlpha = alpha.mul(0.8).add(shimmer);
    mat.colorNode = vec4(finalColor, glowAlpha);

    return mat;
}

function initButterflyInstances(
    mesh: THREE.InstancedMesh,
    count: number,
    palette: number[],
    positionSpread: { x: number; y: number; z: number },
    dummy: THREE.Object3D
): Float32Array {
    const instanceData = new Float32Array(count * 4);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * positionSpread.x;
        const y = (Math.random() - 0.5) * positionSpread.y;
        const z = (Math.random() - 0.5) * positionSpread.z - 20;
        const phase = Math.random() * Math.PI * 2;

        instanceData[i * 4] = x;
        instanceData[i * 4 + 1] = y;
        instanceData[i * 4 + 2] = z;
        instanceData[i * 4 + 3] = phase;

        dummy.position.set(x, y, z);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const scale = 0.5 + Math.random() * 0.8;
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        phases[i] = phase;
        const colorHex = palette[Math.floor(Math.random() * palette.length)];
        const colorObj = new THREE.Color(colorHex);
        colors[i * 3] = colorObj.r;
        colors[i * 3 + 1] = colorObj.g;
        colors[i * 3 + 2] = colorObj.b;
    }

    mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    mesh.geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    mesh.instanceMatrix.needsUpdate = true;

    return instanceData;
}

export class ButterflySwarmSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = BACKGROUND_SWARM_COUNT;

    baseColor1: number = 0xFFB6C1;
    baseColor2: number = 0xB6FFE6;
    baseColor3: number = 0xE6B6FF;

    private dummy = new THREE.Object3D();
    private instanceData: Float32Array;

    /** Escort layer — separate InstancedMesh, ≤20 instances. */
    private escortMesh: THREE.InstancedMesh;
    private escortPhases: Float32Array;
    private escortColors: Float32Array;
    private escortGroups: EscortGroup[] = [];
    private escortSpawnCooldown = 0;
    private escortTime = 0;

    private particles: ParticleSystem | null = null;
    private juice: JuiceLike | null = null;
    private audio: AudioSystem | null = null;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geometry = new THREE.PlaneGeometry(1.5, 1.5, 4, 1);
        const mat = createButterflyMaterial();

        this.mesh = new THREE.InstancedMesh(geometry, mat, this.count);
        this.mesh.frustumCulled = false;

        const palette = [this.baseColor1, this.baseColor2, this.baseColor3];
        this.instanceData = initButterflyInstances(
            this.mesh,
            this.count,
            palette,
            { x: 60, y: 40, z: 40 },
            this.dummy
        );

        this.scene.add(this.mesh);

        // Escort mesh — shares geometry + material recipe (second draw call, tiny budget)
        const escortGeo = geometry.clone();
        const escortMat = createButterflyMaterial();
        this.escortMesh = new THREE.InstancedMesh(escortGeo, escortMat, MAX_ESCORT_INSTANCES);
        this.escortMesh.frustumCulled = false;
        this.escortMesh.count = 0;
        this.escortMesh.visible = false;

        this.escortPhases = new Float32Array(MAX_ESCORT_INSTANCES);
        this.escortColors = new Float32Array(MAX_ESCORT_INSTANCES * 3);
        escortGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(this.escortPhases, 1));
        escortGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(this.escortColors, 3));

        for (let i = 0; i < MAX_ESCORT_INSTANCES; i++) {
            this._hideEscortInstance(i);
        }
        this.escortMesh.instanceMatrix.needsUpdate = true;

        this.scene.add(this.escortMesh);
        decorationBudget.syncCount('butterfly_swarm', this.count);
        this.deactivate();
    }

    /** Re-sync fixed-pool budget counters after decorationBudget.resetCounts(). */
    resyncBudgetCounts(): void {
        decorationBudget.syncCount('butterfly_swarm', this.count);
        let escortLive = 0;
        for (const group of this.escortGroups) escortLive += group.count;
        decorationBudget.syncCount('butterfly_escort', escortLive);
    }

    /** Wire juice / particles / audio for escort moments (call once from main). */
    bindEffects(
        particles: ParticleSystem | null,
        juice: JuiceLike | null,
        audio: AudioSystem | null
    ): void {
        this.particles = particles;
        this.juice = juice;
        this.audio = audio;
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        this._clearEscorts();
        this.escortMesh.visible = false;
    }

    /**
     * Friendly escort absorbs one small asteroid bump or light hit.
     * Returns true if a hit was blocked (escort sacrifices itself in sparkles).
     */
    tryAbsorbHit(hitPos: THREE.Vector3, hitRadius = 1.5): boolean {
        for (const group of this.escortGroups) {
            if (!group.hasShield || group.dispersing) continue;

            group.hasShield = false;
            group.dispersing = true;
            group.disperseTimer = 1.4;
            group.timeLeft = Math.min(group.timeLeft, 1.6);

            const sparklePos = hitPos.clone();
            if (this.particles) {
                this.particles.emit(sparklePos, 0xffb6c1, 14, 5.5, 0.7, 0.55);
                this.particles.emit(sparklePos, 0xffffff, 8, 4.0, 0.5, 0.4);
            }
            if (this.juice) {
                this.juice.showFloatingText('Butterfly friends!', sparklePos, '#ffb6e6', 22);
                this.juice.spawnSparkles(sparklePos, new THREE.Color(0xffb6c1), 10);
            }
            if (this.audio) {
                this.audio.play('twinkle', 0.55);
            }

            // Only block small bumps (asteroids / light grazes)
            return hitRadius <= 2.2;
        }
        return false;
    }

    hasActiveEscort(): boolean {
        return this.escortGroups.some(g => !g.dispersing && g.hasShield);
    }

    update(
        delta: number,
        cameraX: number,
        playerPos?: THREE.Vector3,
        context: ButterflySwarmUpdateContext = {}
    ) {
        if (!this.active) return;

        this.escortTime += delta;
        this.escortSpawnCooldown = Math.max(0, this.escortSpawnCooldown - delta);

        const targetPos = playerPos || new THREE.Vector3(cameraX, 0, 0);
        const timeVal = this.escortTime;

        for (let i = 0; i < this.count; i++) {
            let x = this.instanceData[i * 4];
            let y = this.instanceData[i * 4 + 1];
            let z = this.instanceData[i * 4 + 2];
            const phase = this.instanceData[i * 4 + 3];

            x += delta * 5.0;

            const swirlRadius = 15;
            const targetX = targetPos.x + Math.sin(timeVal * 0.5 + phase) * swirlRadius;
            const targetY = targetPos.y + Math.cos(timeVal * 0.7 + phase) * swirlRadius;
            const targetZ = targetPos.z - 10 + Math.sin(timeVal * 0.3 + phase) * swirlRadius;

            x += (targetX - x) * delta * 0.5;
            y += (targetY - y) * delta * 0.5;
            z += (targetZ - z) * delta * 0.5;

            if (x < cameraX - 40) {
                x = cameraX + 60 + Math.random() * 20;
                y = targetPos.y + (Math.random() - 0.5) * 40;
                z = targetPos.z + (Math.random() - 0.5) * 40;
            }
            if (x > cameraX + 80) {
                x = cameraX - 20;
            }

            this.instanceData[i * 4] = x;
            this.instanceData[i * 4 + 1] = y;
            this.instanceData[i * 4 + 2] = z;

            this.dummy.position.set(x, y, z);
            const dirX = targetX - x;
            const dirY = targetY - y;
            const dirZ = targetZ - z;
            this.dummy.rotation.x = dirY * 0.1;
            this.dummy.rotation.y = Math.atan2(dirX, dirZ) + Math.PI / 2;
            this.dummy.rotation.z = dirX * 0.05 + Math.sin(timeVal * 2 + phase) * 0.2;
            const scale = 0.5 + (phase % 1.0) * 0.8;
            this.dummy.scale.setScalar(scale);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;

        if (playerPos) {
            this._updateEscorts(delta, timeVal, playerPos);
            this._trySpawnEscort(playerPos, context);
        }
    }

    private _trySpawnEscort(playerPos: THREE.Vector3, context: ButterflySwarmUpdateContext): void {
        if (this.escortGroups.length >= MAX_ESCORT_GROUPS) return;
        if (this.escortSpawnCooldown > 0) return;
        if (this._allocatedEscortSlots() >= MAX_ESCORT_INSTANCES) return;
        if (!decorationBudget.canSpawn('butterfly_escort', MAX_ESCORT_PER_GROUP)) return;

        const grazeCombo = context.grazeCombo ?? 0;
        const slingCombo = context.slingCombo ?? 0;
        const cleanFlight = context.cleanFlightTime ?? 0;

        // Near a dense swarm pocket?
        let nearSwarm = false;
        for (let i = 0; i < this.count; i += 7) {
            const dx = this.instanceData[i * 4] - playerPos.x;
            const dy = this.instanceData[i * 4 + 1] - playerPos.y;
            const dz = this.instanceData[i * 4 + 2] - playerPos.z;
            if (dx * dx + dy * dy + dz * dz < 22 * 22) {
                nearSwarm = true;
                break;
            }
        }

        let chance = 0;
        if (nearSwarm) chance += 0.00035;
        if (grazeCombo >= 4) chance += 0.0005;
        if (slingCombo >= 3) chance += 0.00045;
        if (cleanFlight > 18) chance += 0.00025;

        if (Math.random() >= chance) return;

        const count = 6 + Math.floor(Math.random() * 5);
        this._spawnEscortGroup(playerPos, count);
        this.escortSpawnCooldown = ESCORT_SPAWN_COOLDOWN;

        if (this.juice) {
            this.juice.showFloatingText('🦋 Friends!', playerPos.clone(), '#ffb6e6', 20);
        }
        if (this.audio) {
            this.audio.play('wind_chime', 0.28);
        }
    }

    private _spawnEscortGroup(playerPos: THREE.Vector3, count: number): void {
        const start = this._allocatedEscortSlots();
        if (start + count > MAX_ESCORT_INSTANCES) return;
        if (!decorationBudget.reportSpawn('butterfly_escort', count)) return;

        const palette = [this.baseColor1, this.baseColor2, this.baseColor3];
        const slots: EscortSlot[] = [];

        for (let i = 0; i < count; i++) {
            const idx = start + i;
            const phase = Math.random() * Math.PI * 2;
            const colorHex = palette[Math.floor(Math.random() * palette.length)];
            const color = new THREE.Color(colorHex);

            slots.push({
                phase,
                orbitOffset: (i / count) * Math.PI * 2,
                ring: 1.8 + (i % 3) * 0.55,
                scale: 0.65 + Math.random() * 0.35,
                color
            });

            this.escortPhases[idx] = phase;
            this.escortColors[idx * 3] = color.r;
            this.escortColors[idx * 3 + 1] = color.g;
            this.escortColors[idx * 3 + 2] = color.b;
        }

        this.escortGroups.push({
            instanceStart: start,
            count,
            slots,
            timeLeft: ESCORT_DURATION_MIN + Math.random() * (ESCORT_DURATION_MAX - ESCORT_DURATION_MIN),
            orbitPhase: Math.random() * Math.PI * 2,
            hasShield: true,
            dispersing: false,
            disperseTimer: 0
        });

        this.escortMesh.count = Math.max(this.escortMesh.count, start + count);
        this.escortMesh.visible = true;
        (this.escortMesh.geometry.attributes.aPhase as THREE.InstancedBufferAttribute).needsUpdate = true;
        (this.escortMesh.geometry.attributes.aColor as THREE.InstancedBufferAttribute).needsUpdate = true;

        if (this.particles) {
            this.particles.emit(playerPos.clone(), 0xffb6c1, 10, 3.5, 0.45, 0.45);
        }
    }

    private _updateEscorts(delta: number, timeVal: number, playerPos: THREE.Vector3): void {
        for (let g = this.escortGroups.length - 1; g >= 0; g--) {
            const group = this.escortGroups[g];

            if (group.dispersing) {
                group.disperseTimer -= delta;
            } else {
                group.timeLeft -= delta;
            }

            const disperseT = group.dispersing
                ? Math.max(0, group.disperseTimer / 1.4)
                : 1;

            if ((group.dispersing && group.disperseTimer <= 0) || (!group.dispersing && group.timeLeft <= 0)) {
                if (!group.dispersing && group.timeLeft <= 0) {
                    this._escortFarewell(playerPos, group);
                }
                for (let i = 0; i < group.count; i++) {
                    this._hideEscortInstance(group.instanceStart + i);
                }
                decorationBudget.reportDestroy('butterfly_escort', group.count);
                this.escortGroups.splice(g, 1);
                continue;
            }

            for (let i = 0; i < group.count; i++) {
                const idx = group.instanceStart + i;
                const slot = group.slots[i];
                const orbitAngle = timeVal * (1.1 + slot.ring * 0.08) + slot.orbitOffset + group.orbitPhase;
                const bob = Math.sin(timeVal * 2.8 + slot.phase) * 0.35;

                let x: number;
                let y: number;
                let z: number;
                let scale = slot.scale;

                if (group.dispersing) {
                    const burst = (1.4 - group.disperseTimer) * 4.5;
                    const angle = slot.orbitOffset + burst;
                    x = playerPos.x + Math.cos(angle) * burst * 1.2;
                    y = playerPos.y + Math.sin(angle) * burst * 0.9 + bob * disperseT;
                    z = playerPos.z + Math.sin(angle * 1.4) * burst * 0.5;
                    scale *= disperseT;
                } else {
                    x = playerPos.x + Math.cos(orbitAngle) * slot.ring;
                    y = playerPos.y + Math.sin(orbitAngle) * slot.ring * 0.65 + bob;
                    z = playerPos.z - 1.2 + Math.sin(orbitAngle * 1.35) * 0.9;
                }

                this.dummy.position.set(x, y, z);
                this.dummy.rotation.x = Math.sin(timeVal * 2 + slot.phase) * 0.15;
                this.dummy.rotation.y = Math.atan2(
                    Math.cos(orbitAngle),
                    Math.sin(orbitAngle)
                ) + Math.PI / 2;
                this.dummy.rotation.z = Math.sin(timeVal * 3 + slot.phase) * 0.18;
                this.dummy.scale.setScalar(scale);
                this.dummy.updateMatrix();
                this.escortMesh.setMatrixAt(idx, this.dummy.matrix);
            }
        }

        if (this.escortGroups.length === 0) {
            this.escortMesh.visible = false;
            this.escortMesh.count = 0;
        }

        this.escortMesh.instanceMatrix.needsUpdate = true;
    }

    private _escortFarewell(playerPos: THREE.Vector3, group: EscortGroup): void {
        if (this.particles) {
            this.particles.emit(playerPos.clone(), 0xe6b6ff, 12, 4.0, 0.55, 0.5);
        }
        if (this.juice) {
            this.juice.burstMagic(playerPos.clone());
        }
        if (this.audio) {
            this.audio.play('sparkle_cascade', 0.25);
        }
    }

    private _allocatedEscortSlots(): number {
        let max = 0;
        for (const group of this.escortGroups) {
            max = Math.max(max, group.instanceStart + group.count);
        }
        return max;
    }

    private _hideEscortInstance(idx: number): void {
        this.dummy.position.set(0, -9999, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.escortMesh.setMatrixAt(idx, this.dummy.matrix);
    }

    private _clearEscorts(): void {
        let escortCount = 0;
        for (const group of this.escortGroups) {
            escortCount += group.count;
            for (let i = 0; i < group.count; i++) {
                this._hideEscortInstance(group.instanceStart + i);
            }
        }
        if (escortCount > 0) {
            decorationBudget.reportDestroy('butterfly_escort', escortCount);
        }
        this.escortGroups = [];
        this.escortMesh.count = 0;
        this.escortMesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this._clearEscorts();
        this.scene.remove(this.mesh);
        this.scene.remove(this.escortMesh);
        this.mesh.geometry.dispose();
        this.escortMesh.geometry.dispose();
        if ((this.mesh.material as THREE.Material).dispose) {
            (this.mesh.material as THREE.Material).dispose();
        }
        if ((this.escortMesh.material as THREE.Material).dispose) {
            (this.escortMesh.material as THREE.Material).dispose();
        }
    }
}
