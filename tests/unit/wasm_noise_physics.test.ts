import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

// Verifies the two algorithms ported from cpp/src/noise.cpp and
// cpp/src/physics.cpp (assembly/noise.ts, assembly/physics.ts) actually ship
// in the default AssemblyScript build — see docs/WASM_BACKENDS.md acceptance:
// "biome_noise uses real fractal noise in a default `npm run build`" and
// "Jelly-Moss soft-body runs in the default build".

interface NoisePhysicsExports {
    memory: WebAssembly.Memory;
    simplexNoise2D(x: number, y: number): number;
    simplexNoise3D(x: number, y: number, z: number): number;
    fractalNoise2D(x: number, y: number, octaves: number, lacunarity: number, gain: number): number;
    fractalNoise3D(x: number, y: number, z: number, octaves: number, lacunarity: number, gain: number): number;
    allocPhysicsBodies(count: number): number;
    stepPhysics(count: number, dt: number, gravity: number): void;
    getBodyPositionX(index: number): number;
    getBodyPositionY(index: number): number;
    setBodyPosition(index: number, x: number, y: number): void;
    addBodyAcceleration(index: number, ax: number, ay: number): void;
    getBodyRadius(index: number): number;
}

async function loadWasm(): Promise<NoisePhysicsExports> {
    const bytes = await readFile(new URL('../../public/build/optimized.wasm', import.meta.url));
    const { instance } = await WebAssembly.instantiate(bytes, {
        env: { abort: () => { throw new Error('wasm abort'); } }
    });
    return instance.exports as unknown as NoisePhysicsExports;
}

test('default AssemblyScript build exports fractal noise (no VITE_CPP_WASM needed)', async () => {
    const e = await loadWasm();
    assert.equal(typeof e.simplexNoise2D, 'function');
    assert.equal(typeof e.simplexNoise3D, 'function');
    assert.equal(typeof e.fractalNoise2D, 'function');
    assert.equal(typeof e.fractalNoise3D, 'function');
});

test('fractalNoise2D is deterministic, varies with input, and stays in range', async () => {
    const e = await loadWasm();
    const a = e.fractalNoise2D(1.234, 5.678, 4, 2.0, 0.5);
    const b = e.fractalNoise2D(1.234, 5.678, 4, 2.0, 0.5);
    const c = e.fractalNoise2D(50.0, 5.678, 4, 2.0, 0.5);

    assert.equal(a, b, 'same inputs must produce the same sample');
    assert.notEqual(a, c, 'different inputs must diverge');
    assert.ok(a >= -1.01 && a <= 1.01, `fractalNoise2D out of range: ${a}`);
    assert.ok(c >= -1.01 && c <= 1.01, `fractalNoise2D out of range: ${c}`);
});

test('fractalNoise3D is deterministic and stays in range', async () => {
    const e = await loadWasm();
    const a = e.fractalNoise3D(0.1, 0.2, 0.3, 4, 2.0, 0.5);
    const b = e.fractalNoise3D(0.1, 0.2, 0.3, 4, 2.0, 0.5);
    assert.equal(a, b);
    assert.ok(a >= -1.01 && a <= 1.01, `fractalNoise3D out of range: ${a}`);
});

test('default AssemblyScript build exports Verlet soft-body physics (no VITE_CPP_WASM needed)', async () => {
    const e = await loadWasm();
    assert.equal(typeof e.allocPhysicsBodies, 'function');
    assert.equal(typeof e.stepPhysics, 'function');
    assert.equal(typeof e.getBodyPositionX, 'function');
    assert.equal(typeof e.getBodyPositionY, 'function');
    assert.equal(typeof e.setBodyPosition, 'function');
    assert.equal(typeof e.addBodyAcceleration, 'function');
});

test('stepPhysics moves a body under an applied impulse (Verlet integration)', async () => {
    const e = await loadWasm();
    const count = 6;
    e.allocPhysicsBodies(count);

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        e.setBodyPosition(i, Math.cos(angle), Math.sin(angle));
    }

    e.addBodyAcceleration(0, 40, -15);
    e.stepPhysics(count, 1 / 60, 0);

    const x0 = e.getBodyPositionX(0);
    const y0 = e.getBodyPositionY(0);
    assert.ok(Number.isFinite(x0) && Number.isFinite(y0), 'body position must stay finite');
    assert.ok(x0 !== 1 || y0 !== 0, 'body 0 should move away from rest after impulse + step');

    // Untouched body stays at rest (no acceleration applied, Verlet holds it still).
    const x1 = e.getBodyPositionX(1);
    const y1 = e.getBodyPositionY(1);
    assert.ok(Math.abs(x1 - Math.cos(Math.PI * 2 / count)) < 1e-5);
    assert.ok(Math.abs(y1 - Math.sin(Math.PI * 2 / count)) < 1e-5);
});
