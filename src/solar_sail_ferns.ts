/**
 * Solar Sail Ferns — large translucent fern-like sails that catch solar wind.
 * Instanced blades (single draw call), solar-wind vector fields, gentle clip pushes.
 *
 * Ferns sit folded until the ship (the light) comes near, then unfold; only
 * unfolded ferns project a wind field. `getFieldForces()` hands the sim the
 * per-step field vectors, which `applySailForces` (solar_wind.ts) sums and caps.
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
import { gameplayRandom } from './run_seed';
import { decorationBudget } from './decoration_budget';
import {
    sailFieldForce,
    sailWindAngle,
    SAIL_UNFOLD_ACTIVE,
    type SailForce
} from './solar_wind';

const MAX_FERNS = 12;
const MAX_BLADES_PER_FERN = 8;
const MAX_BLADE_INSTANCES = MAX_FERNS * MAX_BLADES_PER_FERN;

/** Field radius per unit fern scale (XY plane — the lane, not depth). */
const FIELD_RADIUS = 14;
/** Ship within this XY distance unfolds a fern (the ship is the light). */
const UNFOLD_RADIUS = 34;
const UNFOLD_RATE = 1.6;
const FOLD_RATE = 0.6;
/** Sails sit just behind the lane so their field reads as the lane itself. */
const SAIL_Z_RANGE: [number, number] = [-20, -8];
const BUDGET_ID = 'solar_sail_ferns';
/** Lane spacing: `solarSail` density N → N×1.5 sails per 100 world units. */
const SAIL_LANE_UNIT = 66;
/** Pods stay inside the ship's flight band (soft bounds are -10..+15). */
const SAIL_Y_BAND: [number, number] = [-7, 12];

const SAIL_TINTS = [
    new THREE.Color(0x66ddff),
    new THREE.Color(0x9b7bff),
    new THREE.Color(0xffcc66),
    new THREE.Color(0x88eeff),
    new THREE.Color(0xc49bff),
    new THREE.Color(0xffd98a)
];

export interface SolarSailInteraction {
    /** `boost`: entered an unfolded field (juice only); `clip`: brushed the pod. */
    type: 'boost' | 'clip';
    position: THREE.Vector3;
    /** Field acceleration (boost) or vertical push (clip), world units/s. */
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
    /** Blade facing in the XY plane (radians from +X), deterministic per spawn. */
    windAngle: number;
    /** 0 folded → 1 open. Field is live above SAIL_UNFOLD_ACTIVE. */
    unfold: number;
    /** Ship was inside this fern's field last step (for one-shot juice). */
    inField: boolean;
}

const _dummy = new THREE.Object3D();
const _force = new THREE.Vector3();
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
    const aUnfold = attribute('aUnfold', 'float');
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
    // Folded sails are dim; open sails glow so the live field is readable.
    const openGlow = float(0.25).add(aUnfold.mul(0.95));
    mat.emissiveNode = aTint.mul(rim.mul(0.35).add(shimmer.mul(0.15)).add(aUnfold.mul(0.25))).mul(openGlow);

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
    private bladeUnfold: Float32Array;
    private fieldForces: SailForce[] = [];
    /** Fractional sails owed by the lane across small stream chunks. */
    private spawnDebt = 0;
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
        this.bladeUnfold = new Float32Array(MAX_BLADE_INSTANCES);

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
        this.bladeMesh.geometry.setAttribute(
            'aUnfold',
            new THREE.InstancedBufferAttribute(this.bladeUnfold, 1)
        );

        this.scene.add(this.bladeMesh);
        this.scene.add(this.podMesh);
    }

    /**
     * Spawn ferns for a foliage chunk as an even lane: `density` sails per
     * `SAIL_LANE_UNIT` world units, carried fractionally across the small
     * per-frame stream chunks (so a 12-wide chunk does not dump every fern in
     * one clump), and kept inside the flyable band so the field is reachable.
     */
    streamChunk(
        startX: number,
        width: number,
        density: number,
        yRange: [number, number] = [-18, 18]
    ): void {
        if (density <= 0 || width <= 0) return;

        this.spawnDebt = Math.min(MAX_FERNS, this.spawnDebt + (density * width) / SAIL_LANE_UNIT);
        const count = Math.min(MAX_FERNS - this.ferns.length, Math.floor(this.spawnDebt));
        if (count <= 0) return;
        this.spawnDebt -= count;

        const zRange: [number, number] = [
            Math.max(DEPTH_LAYERS.MIDGROUND.min, SAIL_Z_RANGE[0]),
            Math.min(DEPTH_LAYERS.MIDGROUND.max, SAIL_Z_RANGE[1])
        ];
        const yMin = Math.max(yRange[0], SAIL_Y_BAND[0]);
        const yMax = Math.max(yMin, Math.min(yRange[1], SAIL_Y_BAND[1]));

        for (let i = 0; i < count; i++) {
            const x = startX + gameplayRandom('flora') * width;
            const y = yMin + gameplayRandom('flora') * (yMax - yMin);
            const z = randomZInRange(zRange);
            this.spawnFern(x, y, z);
        }
    }

    spawnFern(x: number, y: number, z: number): boolean {
        if (this.ferns.length >= MAX_FERNS) return false;
        if (this.activeBlades + MAX_BLADES_PER_FERN > MAX_BLADE_INSTANCES) return false;
        if (!decorationBudget.canSpawn(BUDGET_ID)) return false;

        const bladeCount = 5 + Math.floor(gameplayRandom('flora') * 4);
        const bladeStart = this.activeBlades;
        const tintIndex = Math.floor(Math.random() * SAIL_TINTS.length); // visual-only
        const tint = SAIL_TINTS[tintIndex];

        for (let b = 0; b < bladeCount; b++) {
            const idx = bladeStart + b;
            this.bladePhases[idx] = Math.random() * Math.PI * 2; // visual-only
            this.bladeTints[idx * 3] = tint.r;
            this.bladeTints[idx * 3 + 1] = tint.g;
            this.bladeTints[idx * 3 + 2] = tint.b;
        }

        this.activeBlades += bladeCount;

        this.ferns.push({
            x,
            y,
            z,
            scale: 0.85 + gameplayRandom('flora') * 0.55,
            yaw: Math.random() * Math.PI * 2, // visual-only
            bladeCount,
            bladeStart,
            phase: Math.random() * Math.PI * 2, // visual-only
            tintIndex,
            boostCooldown: 0,
            clipCooldown: 0,
            windAngle: sailWindAngle(x, y),
            unfold: 0,
            inField: false
        });

        this.activePods = this.ferns.length;
        decorationBudget.syncCount(BUDGET_ID, this.ferns.length);
        this._rebuildInstanceMatrices(0, undefined);
        return true;
    }

    /**
     * Advance unfold, then collect field forces and clip pushes for the ship.
     * Field vectors land in `getFieldForces()`; `boost` interactions are juice
     * only (one per field entry) and carry the field force for display.
     */
    update(
        dt: number,
        time: number,
        playerPos?: THREE.Vector3,
        playerVel?: THREE.Vector3
    ): SolarSailInteraction[] {
        const results: SolarSailInteraction[] = [];
        this.fieldForces.length = 0;

        for (const fern of this.ferns) {
            fern.boostCooldown = Math.max(0, fern.boostCooldown - dt);
            fern.clipCooldown = Math.max(0, fern.clipCooldown - dt);
            const near = playerPos
                ? Math.hypot(playerPos.x - fern.x, playerPos.y - fern.y) < UNFOLD_RADIUS * fern.scale
                : false;
            fern.unfold = near
                ? Math.min(1, fern.unfold + UNFOLD_RATE * dt)
                : Math.max(0, fern.unfold - FOLD_RATE * dt);
        }

        this._rebuildInstanceMatrices(time, playerPos, playerVel);

        if (!playerPos) return results;

        for (const fern of this.ferns) {
            const field = this._fieldForce(fern, playerPos);
            if (field) {
                this.fieldForces.push(field);
                if (!fern.inField && fern.boostCooldown <= 0) {
                    fern.boostCooldown = 1.5;
                    const pos = _fernPos.set(fern.x, fern.y, fern.z).clone();
                    results.push({ type: 'boost', position: pos, force: new THREE.Vector3(field.x, field.y, 0) });
                    if (this.particles) {
                        this.particles.emit(pos, 0x88eeff, 6, 2.5, 0.2, 0.6);
                        this.particles.emit(pos, 0xffcc66, 4, 1.8, 0.12, 0.4);
                    }
                }
            }
            fern.inField = field !== null;

            const clip = this._checkSoftClip(fern, playerPos);
            if (clip) results.push(clip);
        }

        return results;
    }

    /** Field vectors from every unfolded fern containing the ship this step. */
    getFieldForces(): readonly SailForce[] {
        return this.fieldForces;
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

            // Folded: a tight closed bud; open: full fan, leaning along the wind.
            const open = fern.unfold;
            const fanSpread = Math.PI * (0.12 + 0.43 * open);
            const fanStart = -fanSpread * 0.5;
            const openScale = 0.45 + 0.55 * open;
            flowTilt += (1 - open) * 0.5;

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
                _dummy.rotation.z += -fern.windAngle * open;
                _dummy.scale.set(fern.scale * bladeW * openScale, fern.scale * bladeLen * openScale, fern.scale);
                _dummy.updateMatrix();
                this.bladeUnfold[bladeIdx] = open;
                this.bladeMesh.setMatrixAt(bladeIdx++, _dummy.matrix);
            }
        }

        this.bladeMesh.count = bladeIdx;
        this.podMesh.count = podIdx;
        this.activeBlades = bladeIdx;
        this.activePods = podIdx;

        (this.bladeMesh.geometry.attributes.aPhase as THREE.InstancedBufferAttribute).needsUpdate = true;
        (this.bladeMesh.geometry.attributes.aTint as THREE.InstancedBufferAttribute).needsUpdate = true;
        (this.bladeMesh.geometry.attributes.aUnfold as THREE.InstancedBufferAttribute).needsUpdate = true;
        this.bladeMesh.instanceMatrix.needsUpdate = true;
        this.podMesh.instanceMatrix.needsUpdate = true;
    }

    private _fieldForce(fern: FernState, playerPos: THREE.Vector3): SailForce | null {
        const dist = Math.hypot(playerPos.x - fern.x, playerPos.y - fern.y);
        return sailFieldForce(fern.windAngle, fern.unfold, dist, FIELD_RADIUS * fern.scale);
    }

    /** Brushing the pod (XY) gives a gentle vertical nudge off it. */
    private _checkSoftClip(fern: FernState, playerPos: THREE.Vector3): SolarSailInteraction | null {
        if (fern.clipCooldown > 0) return null;

        const dx = playerPos.x - fern.x;
        const dy = playerPos.y - fern.y;
        const radius = 3.2 * fern.scale;

        if (Math.abs(dx) > 3.5 || Math.abs(dy) > radius) return null;

        fern.clipCooldown = 0.4;

        const falloff = 1 - Math.abs(dy) / radius;
        const sign = dy >= 0 ? 1 : -1;
        _force.set(0, sign * 4 * falloff, 0);

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
        decorationBudget.syncCount(BUDGET_ID, this.ferns.length);
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
        this.fieldForces.length = 0;
        this.spawnDebt = 0;
        decorationBudget.syncCount(BUDGET_ID, 0);
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
