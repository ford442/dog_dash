/**
 * Solar Sail Ferns — large translucent fern-like sails that catch solar wind.
 * Instanced blades (single draw call), soft boost zones, gentle clip pushes.
 */

import * as THREE from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
    time,
    uv,
    vec3,
    vec4,
    float,
    sin,
    cos,
    mix,
    smoothstep,
    length,
    positionLocal,
    attribute
} from 'three/tsl';
import { ParticleSystem } from './particles';
import { DEPTH_LAYERS, randomZInRange } from './depth_layers';

const MAX_FERNS = 12;
const MAX_BLADES_PER_FERN = 8;
const MAX_BLADE_INSTANCES = MAX_FERNS * MAX_BLADES_PER_FERN;

/** Fixed solar-wind direction (scroll-forward). */
const WIND_DIR = new THREE.Vector3(1, 0, 0);

const SAIL_TINTS = [
    new THREE.Color(0x66ddff),
    new THREE.Color(0x9b7bff),
    new THREE.Color(0xffcc66),
    new THREE.Color(0x88eeff),
    new THREE.Color(0xc49bff),
    new THREE.Color(0xffd98a)
];

export interface SolarSailInteraction {
    type: 'boost' | 'clip';
    position: THREE.Vector3;
    force: THREE.Vector3;
}

interface FernState {
    x: number;
    y: number;
    z: number;
    scale: number;
    yaw: number;
    bladeCount: number;
    bladeStart: number;
    phase: number;
    tintIndex: number;
    boostCooldown: number;
    clipCooldown: number;
}

const _dummy = new THREE.Object3D();
const _force = new THREE.Vector3();
const _velDir = new THREE.Vector3();
const _fernPos = new THREE.Vector3();

/** Shared blade geometry — bottom-anchored, segments along length for ripple. */
const BLADE_GEOMETRY = (() => {
    const geo = new THREE.PlaneGeometry(1.5, 7.5, 2, 10);
    geo.translate(0, 3.75, 0);
    return geo;
})();

const POD_GEOMETRY = new THREE.OctahedronGeometry(0.55, 0);

function createSailBladeMaterial(): MeshPhysicalNodeMaterial {
    const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        opacity: 0.72,
        roughness: 0.08,
        metalness: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
        transmission: 0.55,
        clearcoat: 1.0
    });

    const aPhase = attribute('aPhase', 'float');
    const aTint = attribute('aTint', 'vec3');
    const uTime = time;
    const vUv = uv();

    const ripple = sin(uTime.mul(2.4).add(aPhase).add(vUv.y.mul(9.0)))
        .mul(vUv.y)
        .mul(0.14);
    mat.positionNode = positionLocal.add(vec3(float(0), float(0), ripple));

    mat.iridescence = 1.0;
    mat.iridescenceIOR = 1.55;
    const thicknessNoise = sin(vUv.x.mul(14.0).add(uTime.mul(0.8)))
        .add(cos(vUv.y.mul(12.0).sub(uTime.mul(0.6))))
        .mul(0.5)
        .add(0.5);
    mat.iridescenceThicknessNode = mix(float(220.0), float(680.0), thicknessNoise);

    const rim = smoothstep(float(0.55), float(1.0), length(vUv.sub(0.5)));
    const shimmer = sin(uTime.mul(1.6).add(aPhase)).mul(0.5).add(0.5);
    const goldRim = vec3(1.0, 0.88, 0.55).mul(rim).mul(shimmer);
    const body = mix(aTint, vec3(1.0), float(0.18));
    const lit = body.add(goldRim.mul(0.45));

    mat.colorNode = vec4(lit, float(0.65).add(rim.mul(0.2)));
    mat.emissiveNode = aTint.mul(rim.mul(0.35).add(shimmer.mul(0.15)));

    return mat;
}

const POD_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xaaddff,
    emissive: 0x4466aa,
    emissiveIntensity: 0.45,
    roughness: 0.15,
    metalness: 0.7,
    transparent: true,
    opacity: 0.88
});

export class SolarSailFernManager {
    private scene: THREE.Scene;
    private particles: ParticleSystem | null;
    private ferns: FernState[] = [];

    private bladeMesh: THREE.InstancedMesh;
    private podMesh: THREE.InstancedMesh;
    private bladePhases: Float32Array;
    private bladeTints: Float32Array;
    private activeBlades = 0;
    private activePods = 0;

    constructor(scene: THREE.Scene, particles: ParticleSystem | null = null) {
        this.scene = scene;
        this.particles = particles;

        const bladeMat = createSailBladeMaterial();
        this.bladeMesh = new THREE.InstancedMesh(BLADE_GEOMETRY, bladeMat, MAX_BLADE_INSTANCES);
        this.bladeMesh.frustumCulled = false;
        this.bladeMesh.count = 0;

        this.bladePhases = new Float32Array(MAX_BLADE_INSTANCES);
        this.bladeTints = new Float32Array(MAX_BLADE_INSTANCES * 3);

        this.podMesh = new THREE.InstancedMesh(POD_GEOMETRY, POD_MATERIAL, MAX_FERNS);
        this.podMesh.frustumCulled = false;
        this.podMesh.count = 0;

        this.bladeMesh.geometry.setAttribute(
            'aPhase',
            new THREE.InstancedBufferAttribute(this.bladePhases, 1)
        );
        this.bladeMesh.geometry.setAttribute(
            'aTint',
            new THREE.InstancedBufferAttribute(this.bladeTints, 3)
        );

        this.scene.add(this.bladeMesh);
        this.scene.add(this.podMesh);
    }

    /** Spawn ferns for a foliage chunk (capped at 6–12 per segment). */
    streamChunk(
        startX: number,
        width: number,
        density: number,
        yRange: [number, number] = [-18, 18]
    ): void {
        if (density <= 0 || width <= 0 || this.ferns.length >= MAX_FERNS) return;

        const room = MAX_FERNS - this.ferns.length;
        const requested = Math.max(1, Math.floor(density * Math.min(width, 120) * 0.08));
        const count = Math.min(room, Math.min(12, Math.max(1, requested)));

        const zRange: [number, number] = [
            DEPTH_LAYERS.BACKGROUND.min + 5,
            DEPTH_LAYERS.MIDGROUND.max
        ];

        for (let i = 0; i < count; i++) {
            const x = startX + 20 + Math.random() * Math.max(30, width - 40);
            const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
            const z = randomZInRange(zRange);
            this.spawnFern(x, y, z);
        }
    }

    spawnFern(x: number, y: number, z: number): boolean {
        if (this.ferns.length >= MAX_FERNS) return false;
        if (this.activeBlades + MAX_BLADES_PER_FERN > MAX_BLADE_INSTANCES) return false;

        const bladeCount = 5 + Math.floor(Math.random() * 4);
        const bladeStart = this.activeBlades;
        const tintIndex = Math.floor(Math.random() * SAIL_TINTS.length);
        const tint = SAIL_TINTS[tintIndex];

        for (let b = 0; b < bladeCount; b++) {
            const idx = bladeStart + b;
            this.bladePhases[idx] = Math.random() * Math.PI * 2;
            this.bladeTints[idx * 3] = tint.r;
            this.bladeTints[idx * 3 + 1] = tint.g;
            this.bladeTints[idx * 3 + 2] = tint.b;
        }

        this.activeBlades += bladeCount;

        this.ferns.push({
            x,
            y,
            z,
            scale: 0.85 + Math.random() * 0.55,
            yaw: Math.random() * Math.PI * 2,
            bladeCount,
            bladeStart,
            phase: Math.random() * Math.PI * 2,
            tintIndex,
            boostCooldown: 0,
            clipCooldown: 0
        });

        this.activePods = this.ferns.length;
        this._rebuildInstanceMatrices(0, undefined);
        return true;
    }

    update(
        dt: number,
        time: number,
        playerPos?: THREE.Vector3,
        playerVel?: THREE.Vector3
    ): SolarSailInteraction[] {
        const results: SolarSailInteraction[] = [];

        for (const fern of this.ferns) {
            fern.boostCooldown = Math.max(0, fern.boostCooldown - dt);
            fern.clipCooldown = Math.max(0, fern.clipCooldown - dt);
        }

        this._rebuildInstanceMatrices(time, playerPos, playerVel);

        if (!playerPos || !playerVel) return results;

        for (const fern of this.ferns) {
            _fernPos.set(fern.x, fern.y, fern.z);

            const boost = this._checkBoost(fern, playerPos, playerVel);
            if (boost) {
                results.push(boost);
                if (this.particles && fern.boostCooldown <= 0) {
                    fern.boostCooldown = 0.35;
                    this.particles.emit(boost.position, 0x88eeff, 6, 2.5, 0.2, 0.6);
                    this.particles.emit(boost.position, 0xffcc66, 4, 1.8, 0.12, 0.4);
                }
            }

            const clip = this._checkSoftClip(fern, playerPos);
            if (clip) results.push(clip);
        }

        return results;
    }

    private _rebuildInstanceMatrices(
        time: number,
        playerPos?: THREE.Vector3,
        playerVel?: THREE.Vector3
    ): void {
        let bladeIdx = 0;
        let podIdx = 0;

        for (const fern of this.ferns) {
            let flowTilt = 0.22;
            let swayY = 0;

            if (playerVel) {
                const withGrain = THREE.MathUtils.clamp(playerVel.x / 10, 0, 1);
                flowTilt = 0.18 + withGrain * 0.42;
                swayY = THREE.MathUtils.clamp(playerVel.y * 0.035, -0.2, 0.2);
            }

            if (playerPos) {
                const dx = playerPos.x - fern.x;
                const dist = Math.sqrt(dx * dx + (playerPos.y - fern.y) ** 2 + (playerPos.z - fern.z) ** 2);
                if (dist < 35) {
                    flowTilt += (1 - dist / 35) * 0.15;
                }
            }

            const ripple = Math.sin(time * 0.9 + fern.phase) * 0.04;
            flowTilt += ripple;

            _dummy.position.set(fern.x, fern.y, fern.z);
            _dummy.rotation.set(0, fern.yaw, 0);
            _dummy.scale.setScalar(fern.scale);
            _dummy.updateMatrix();
            this.podMesh.setMatrixAt(podIdx++, _dummy.matrix);

            const fanSpread = Math.PI * 0.55;
            const fanStart = -fanSpread * 0.5;

            for (let b = 0; b < fern.bladeCount; b++) {
                const angle = fanStart + (b / Math.max(1, fern.bladeCount - 1)) * fanSpread;
                const bladeLen = 0.88 + (b / fern.bladeCount) * 0.18;
                const bladeW = 0.75 + Math.sin(fern.phase + b) * 0.1;

                _dummy.position.set(fern.x, fern.y, fern.z);
                _dummy.rotation.set(
                    flowTilt + Math.sin(time * 1.1 + fern.phase + b) * 0.06,
                    fern.yaw + angle + swayY,
                    Math.sin(time * 0.7 + fern.phase + b * 0.5) * 0.08
                );
                _dummy.scale.set(fern.scale * bladeW, fern.scale * bladeLen, fern.scale);
                _dummy.updateMatrix();
                this.bladeMesh.setMatrixAt(bladeIdx++, _dummy.matrix);
            }
        }

        this.bladeMesh.count = bladeIdx;
        this.podMesh.count = podIdx;
        this.activeBlades = bladeIdx;
        this.activePods = podIdx;

        (this.bladeMesh.geometry.attributes.aPhase as THREE.InstancedBufferAttribute).needsUpdate = true;
        (this.bladeMesh.geometry.attributes.aTint as THREE.InstancedBufferAttribute).needsUpdate = true;
        this.bladeMesh.instanceMatrix.needsUpdate = true;
        this.podMesh.instanceMatrix.needsUpdate = true;
    }

    private _checkBoost(
        fern: FernState,
        playerPos: THREE.Vector3,
        playerVel: THREE.Vector3
    ): SolarSailInteraction | null {
        const dx = playerPos.x - fern.x;
        const dy = playerPos.y - fern.y;
        const dz = playerPos.z - fern.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const radius = 14 * fern.scale;

        if (dist > radius || dist < 0.01) return null;

        const speed = playerVel.length();
        if (speed < 1.5) return null;

        _velDir.copy(playerVel).multiplyScalar(1 / speed);
        const alignment = _velDir.dot(WIND_DIR);
        if (alignment < 0.45) return null;

        const falloff = 1 - dist / radius;
        const boostMult = 1.2 + alignment * 0.6;
        const strength = alignment * falloff * 5.5 * boostMult;

        _force.copy(WIND_DIR).multiplyScalar(strength);

        return {
            type: 'boost',
            position: _fernPos.set(fern.x, fern.y, fern.z).clone(),
            force: _force.clone()
        };
    }

    private _checkSoftClip(fern: FernState, playerPos: THREE.Vector3): SolarSailInteraction | null {
        if (fern.clipCooldown > 0) return null;

        const dx = playerPos.x - fern.x;
        const dy = playerPos.y - fern.y;
        const dz = playerPos.z - fern.z;
        const planar = Math.sqrt(dy * dy + dz * dz);
        const radius = 3.2 * fern.scale;

        if (Math.abs(dx) > 3.5 || planar > radius) return null;

        fern.clipCooldown = 0.4;

        const falloff = 1 - planar / radius;
        _force.set(
            -dx * 0.35 * falloff,
            -dy * 1.2 * falloff,
            -dz * 0.9 * falloff
        );

        return {
            type: 'clip',
            position: playerPos.clone(),
            force: _force.clone()
        };
    }

    cleanupFarBehind(playerX: number, buffer = 100): void {
        for (let i = this.ferns.length - 1; i >= 0; i--) {
            if (this.ferns[i].x < playerX - buffer) {
                this.ferns.splice(i, 1);
            }
        }
        this._compactBladeIndices();
        this._rebuildInstanceMatrices(0, undefined);
    }

    private _compactBladeIndices(): void {
        let cursor = 0;
        for (const fern of this.ferns) {
            for (let b = 0; b < fern.bladeCount; b++) {
                const oldIdx = fern.bladeStart + b;
                const newIdx = cursor + b;
                if (oldIdx !== newIdx) {
                    this.bladePhases[newIdx] = this.bladePhases[oldIdx];
                    this.bladeTints[newIdx * 3] = this.bladeTints[oldIdx * 3];
                    this.bladeTints[newIdx * 3 + 1] = this.bladeTints[oldIdx * 3 + 1];
                    this.bladeTints[newIdx * 3 + 2] = this.bladeTints[oldIdx * 3 + 2];
                }
            }
            fern.bladeStart = cursor;
            cursor += fern.bladeCount;
        }
        this.activeBlades = cursor;
        this.activePods = this.ferns.length;
    }

    clear(): void {
        this.ferns = [];
        this.activeBlades = 0;
        this.activePods = 0;
        this.bladeMesh.count = 0;
        this.podMesh.count = 0;
    }

    getCount(): number {
        return this.ferns.length;
    }

    dispose(): void {
        this.scene.remove(this.bladeMesh);
        this.scene.remove(this.podMesh);
        (this.bladeMesh.material as THREE.Material).dispose?.();
    }
}
