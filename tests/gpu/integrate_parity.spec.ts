import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import { expect, test } from '@playwright/test';

import { compareSnapshots, type Snapshot } from '../gpu_integrate/compare';

/**
 * Runs the real WGSL integrate (src/gpu_integrate/kernels.ts) on a WebGPU
 * adapter and checks it against the JS golden fixture. In CI and locally
 * that adapter is SwiftShader (see playwright.gpu.config.ts).
 *
 * Run with: npm run test:gpu-parity
 */

/**
 * Translation (the integrated position) is plain f32 mul-add: held to 5e-5
 * (observed ~8e-6 after 120 steps).
 *
 * The rotation·scale basis goes through GPU sin/cos, which WGSL allows an
 * absolute error of 2^-11 (≈4.9e-4) on [-pi, pi]. Quaternion components carry
 * ~2 of those, the matrix diagonal ~2 quaternion terms, so the spec permits
 * ≈2e-3 per entry at scale 1. SwiftShader sits near that (observed 1.8e-3);
 * hardware GPUs are usually ~1e-6. 5e-3 leaves headroom without hiding real
 * bugs: a wrong axis, formula or slot order is O(0.1–1) (checked by mutation).
 */
const WGSL_TOL = { translation: 5e-5, basis: 5e-3 };

const golden = JSON.parse(
    readFileSync(new URL('../fixtures/gpu_integrate/golden.json', import.meta.url), 'utf8')
) as { snapshots: Snapshot[] };

type ParityRun = {
    skipped?: string;
    adapter?: string;
    backends?: string[];
    failed?: Array<string | null>;
    uncaptured?: string[];
    snapshots?: Snapshot[];
};

test('WGSL integrate matches the JS golden fixture', async ({ page }) => {
    const bundle = await build({
        entryPoints: [fileURLToPath(new URL('./integrate_entry.ts', import.meta.url))],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        write: false,
        logLevel: 'silent'
    });
    const script = bundle.outputFiles[0]!.text;

    // A localhost origin is a secure context, so navigator.gpu is exposed.
    await page.route('http://localhost/parity', route => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><meta charset="utf-8"><title>gpu integrate parity</title>'
    }));
    await page.goto('http://localhost/parity');
    await page.addScriptTag({ content: script });

    const run = await page.evaluate(() => window.runGpuIntegrateParity!()) as ParityRun;
    test.skip(Boolean(run.skipped), run.skipped ?? '');

    console.log(`[gpu-parity] adapter: ${run.adapter}`);
    expect(run.backends).toEqual(['webgpu', 'webgpu']);
    expect(run.failed).toEqual([null, null]);
    expect(run.uncaptured).toEqual([]);
    expect(compareSnapshots(run.snapshots!, golden.snapshots, WGSL_TOL)).toEqual([]);
});
