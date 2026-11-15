/**
 * Seeded particle/debris scenario shared by:
 *   - the fixture recorder (JS integrate → tests/fixtures/gpu_integrate/golden.json)
 *   - tests/unit/gpu_integrate.test.ts (JS + f32 reference kernel, Node, no GPU)
 *   - tests/gpu/integrate_parity.spec.ts (real WGSL on a WebGPU adapter)
 *
 * Emission uses Math.random inside particles.ts, so the run swaps in a seeded
 * generator for its duration and restores the original afterwards.
 */

import * as THREE from 'three';

import { DebrisSystem, ParticleSystem, resetParticleSpinForTests } from '../../src/particles';

export const SCENARIO = {
    seed: 0x5eed1234,
    steps: 120,
    delta: 1 / 60,
    checkpoints: [20, 45, 80, 119],
    particleCapacity: 256,
    debrisCapacity: 128
} as const;

import type { Snapshot } from './compare';
export type { Snapshot } from './compare';

export interface ScenarioHooks {
    /** Called once after construction, before the first emit. */
    attach?: (particles: ParticleSystem, debris: DebrisSystem) => void | Promise<void>;
    /** Called after every step's updates, before a checkpoint snapshot. */
    afterStep?: (particles: ParticleSystem, debris: DebrisSystem, step: number) => void | Promise<void>;
}

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function snapshot(step: number, system: 'particles' | 'debris', sys: ParticleSystem | DebrisSystem): Snapshot {
    const drawn = sys.mesh.count;
    const matrices = Array.from((sys.mesh.instanceMatrix.array as Float32Array).subarray(0, drawn * 16));
    const snap: Snapshot = { step, system, count: sys.count, drawn, matrices };
    if (system === 'particles' && sys.mesh.instanceColor) {
        snap.colors = Array.from((sys.mesh.instanceColor.array as Float32Array).subarray(0, drawn * 3));
    }
    return snap;
}

export async function runScenario(hooks: ScenarioHooks = {}): Promise<Snapshot[]> {
    const originalRandom = Math.random;
    Math.random = mulberry32(SCENARIO.seed);
    resetParticleSpinForTests();

    try {
        const scene = new THREE.Scene();
        const particles = new ParticleSystem(scene, SCENARIO.particleCapacity);
        const debris = new DebrisSystem(scene, SCENARIO.debrisCapacity);
        await hooks.attach?.(particles, debris);

        const out: Snapshot[] = [];
        const pos = new THREE.Vector3();
        for (let step = 0; step < SCENARIO.steps; step++) {
            if (step % 8 === 0) {
                pos.set(step * 0.1, 1 + Math.sin(step * 0.2), -0.5);
                particles.emit(pos, step % 16 === 0 ? 0xff8844 : 0x44ccff, 10, 3.0, 1.0, 0.5);
            }
            if (step % 30 === 0) {
                pos.set(-step * 0.05, 0.5, 0);
                debris.emit(pos, 7, 5.0, 1.0);
            }

            particles.update(SCENARIO.delta);
            debris.update(SCENARIO.delta);
            await hooks.afterStep?.(particles, debris, step);

            if ((SCENARIO.checkpoints as readonly number[]).includes(step)) {
                out.push(snapshot(step, 'particles', particles), snapshot(step, 'debris', debris));
            }
        }
        return out;
    } finally {
        Math.random = originalRandom;
    }
}

/** Rounds to 1e-6 so the committed fixture stays small and diff-friendly. */
export function roundSnapshots(snaps: Snapshot[]): Snapshot[] {
    const r = (v: number) => Math.round(v * 1e6) / 1e6;
    return snaps.map(s => ({
        ...s,
        matrices: s.matrices.map(r),
        ...(s.colors ? { colors: s.colors.map(r) } : {})
    }));
}

export { compareSnapshots } from './compare';
