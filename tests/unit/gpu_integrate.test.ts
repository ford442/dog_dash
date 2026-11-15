import { strict as assert } from 'node:assert';
import { test, beforeEach } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';

import * as THREE from 'three';

import {
    compareSnapshots,
    runScenario,
    type Snapshot
} from '../gpu_integrate/scenario';
import {
    createF32ReferenceKernel,
    GpuIntegrateManager,
    readGpuIntegratePreference,
    type IntegrateKernel,
    type IntegrateResult
} from '../../src/gpu_integrate';
import { composeMatrixF32 } from '../../src/gpu_integrate/f32_reference';
import { ParticleSystem } from '../../src/particles';
import { resetWebGpuProbeForTests } from '../../src/webgpu_probe';

const golden = JSON.parse(
    readFileSync(new URL('../fixtures/gpu_integrate/golden.json', import.meta.url), 'utf8')
) as { snapshots: Snapshot[] };

/** JS integrate vs its own recording: only fixture rounding (1e-6) separates them. */
const JS_TOL = 1e-6;
/** f32 kernel vs f64-then-rounded JS: a few ulp per step, accumulated over 120 steps. */
const KERNEL_TOL = 1e-4;

beforeEach(() => {
    resetWebGpuProbeForTests();
    (globalThis as { window?: unknown }).window = { location: { search: '' } };
});

test('the JS integrate still reproduces the golden fixture', async () => {
    const problems = compareSnapshots(await runScenario(), golden.snapshots, JS_TOL);
    assert.deepEqual(problems, []);
});

test('GPU-mode pipeline on the f32 reference kernel matches the JS golden', async () => {
    const problems = compareSnapshots(await runScenario({
        attach(particles, debris) {
            particles.setIntegrateKernel(createF32ReferenceKernel('particles', particles.maxParticles));
            debris.setIntegrateKernel(createF32ReferenceKernel('debris', debris.maxParticles));
            assert.equal(particles.integrateBackend, 'f32-reference');
            assert.equal(debris.integrateBackend, 'f32-reference');
        }
    }), golden.snapshots, KERNEL_TOL);
    assert.deepEqual(problems, []);
});

test('composeMatrixF32 matches Object3D.updateMatrix', () => {
    const o = new THREE.Object3D();
    const out = new Float32Array(16);
    const cases: Array<[number, number, number, number, number, number, number]> = [
        [0, 0, 0, 0, 0, 0, 1],
        [1.5, -2, 3, 0.3, 1.2, -0.7, 0.8],
        [-4, 0.25, 9, 6.0, 0, 6.0, 0.05],
        [0, 0, 0, 2.9, 2.9, 0.4, 1.3]
    ];
    for (const [px, py, pz, ex, ey, ez, s] of cases) {
        o.position.set(px, py, pz);
        o.rotation.set(ex, ey, ez);
        o.scale.setScalar(s);
        o.updateMatrix();
        composeMatrixF32(out, 0, px, py, pz, ex, ey, ez, s);
        for (let i = 0; i < 16; i++) {
            assert.ok(Math.abs(out[i]! - o.matrix.elements[i]!) < 1e-6, `element ${i}: ${out[i]} vs ${o.matrix.elements[i]}`);
        }
    }
});

test('preference: off by default, ?gpu_integrate opts in, ?no_gpu_compute always wins', () => {
    assert.equal(readGpuIntegratePreference(''), 'off');
    assert.equal(readGpuIntegratePreference('?gpu_integrate'), 'on');
    assert.equal(readGpuIntegratePreference('?gpu_integrate=1'), 'on');
    assert.equal(readGpuIntegratePreference('?gpu_integrate=0'), 'off');
    assert.equal(readGpuIntegratePreference('?gpu_integrate&no_gpu_compute'), 'off');
    assert.equal(readGpuIntegratePreference('?no_gpu_compute'), 'off');
});

test('?no_gpu_compute keeps the CPU integrate even with a WebGPU renderer', () => {
    const manager = new GpuIntegrateManager(readGpuIntegratePreference('?gpu_integrate&no_gpu_compute'));
    const particles = new ParticleSystem(new THREE.Scene(), 16);
    manager.register(particles);
    let touched = false;
    manager.attachRenderer({ get backend() { touched = true; return { device: {} }; } });
    assert.equal(touched, false, 'an off preference must not even look at the renderer device');
    assert.equal(particles.integrateBackend, 'js');
});

test('detach (device lost) returns systems to JS and drops in-flight particles', () => {
    const manager = new GpuIntegrateManager('on');
    const particles = new ParticleSystem(new THREE.Scene(), 64);
    manager.register(particles);
    particles.setIntegrateKernel(createF32ReferenceKernel('particles', 64));

    particles.emit(new THREE.Vector3(), 0xffffff, 12, 2, 1, 0.5);
    particles.update(1 / 60);
    assert.ok(particles.count > 0);

    manager.detach('WebGPU device lost (unknown)');
    assert.equal(particles.integrateBackend, 'js');
    assert.equal(particles.count, 0, 'GPU-owned kinematics cannot be read back from a lost device');
    assert.equal(particles.mesh.count, 0);

    particles.emit(new THREE.Vector3(), 0xffffff, 5, 2, 1, 0.5);
    particles.update(1 / 60);
    assert.equal(particles.count, 5, 'JS integrate carries on after the fallback');
    assert.equal(particles.mesh.count, 5);
});

test('a kernel that fails mid-run falls back to JS on the next step', () => {
    const particles = new ParticleSystem(new THREE.Scene(), 64);
    const kernel = createF32ReferenceKernel('particles', 64);
    particles.setIntegrateKernel(kernel);
    particles.emit(new THREE.Vector3(), 0xffffff, 8, 2, 1, 0.5);
    particles.update(1 / 60);

    kernel.fail('validation: test');
    particles.emit(new THREE.Vector3(), 0xffffff, 3, 2, 1, 0.5);
    particles.update(1 / 60);
    assert.equal(particles.integrateBackend, 'js');
    assert.equal(particles.count, 0, 'in-flight particles, including unsynced emits, are dropped');
});

/**
 * Wraps a reference kernel but holds its results back, releasing them on
 * demand and in any order — a stand-in for late / out-of-order mapAsync.
 */
function delayedKernel(inner: IntegrateKernel) {
    const held: IntegrateResult[] = [];
    let ready: IntegrateResult | null = null;
    let newest = 0;
    const kernel: IntegrateKernel = {
        ...inner,
        get failed() { return inner.failed; },
        step(...args) {
            const ticket = inner.step(...args);
            const r = inner.takeLatest();
            if (r) held.push(r);
            return ticket;
        },
        takeLatest() { const r = ready; ready = null; return r; }
    };
    return {
        kernel,
        held,
        release(index: number) {
            const [r] = held.splice(index, 1);
            if (r && r.seq > newest) { newest = r.seq; ready = r; }
        }
    };
}

test('late readback draws last-good and never applies a stale result', () => {
    const particles = new ParticleSystem(new THREE.Scene(), 64);
    const delayed = delayedKernel(createF32ReferenceKernel('particles', 64));
    particles.setIntegrateKernel(delayed.kernel);

    particles.emit(new THREE.Vector3(), 0xff0000, 6, 2, 1, 0.2);
    particles.update(1 / 60); // seq 1
    assert.equal(particles.mesh.count, 0, 'nothing drawn before the first readback lands');

    particles.update(1 / 60); // seq 2
    particles.update(1 / 60); // seq 3
    const matrix = particles.mesh.instanceMatrix.array as Float32Array;

    delayed.release(2); // seq 3 lands first
    particles.syncIntegrateDraw();
    assert.equal(particles.mesh.count, 6);
    const afterNewest = Array.from(matrix.subarray(0, 16));

    delayed.release(0); // seq 1 lands late — must be ignored
    particles.syncIntegrateDraw();
    assert.deepEqual(Array.from(matrix.subarray(0, 16)), afterNewest, 'stale readback overwrote newer matrices');

    // The sim kept advancing the whole time: CPU lifecycle is never gated on readback.
    assert.equal(particles.count, 6);
});

test('gpu_integrate never imports gameplay modules', () => {
    const dir = new URL('../../src/gpu_integrate/', import.meta.url);
    // Built from a string: tools/check_braces.cjs does not parse regex literals.
    const forbidden = new RegExp("from '\\.\\./(spatial_index|spatial_fill|obstacle_system|run_seed|sim_clock|collectibles|save_manager|main/)");
    for (const file of readdirSync(dir)) {
        const text = readFileSync(new URL(file, dir), 'utf8');
        assert.ok(!forbidden.test(text), `${file} imports a gameplay module`);
        assert.ok(!/requestAdapter|requestDevice\(/.test(text.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')),
            `${file} must not request an adapter or device`);
    }
});
