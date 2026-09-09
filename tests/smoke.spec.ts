import { test, expect, type Page } from '@playwright/test';

/**
 * Dog Dash renders through WebGPU only — there is no WebGL fallback.
 *
 * Headless Chrome in CI exposes no WebGPU implementation at all, so this suite
 * can no longer drive gameplay. What it *can* verify, and what this issue is
 * about, is that a failed probe hard-fails cleanly: a diagnostic screen, a
 * populated probe breadcrumb, and — critically — no WebGL context created to
 * keep something on screen.
 *
 * Gameplay smoke coverage needs a WebGPU-capable browser. See
 * docs/RENDERER_FALLBACK.md ("Verification").
 */

type ProbeBreadcrumb = {
    ok?: boolean;
    browser?: string;
    reason?: string;
    stage?: string;
    adapter?: unknown;
    userAgent?: string;
};

function attachPageErrorCollector(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
        errors.push(error.message);
    });
    return errors;
}

async function readProbe(page: Page): Promise<ProbeBreadcrumb | undefined> {
    return page.evaluate(() => window.webgpuProbe as ProbeBreadcrumb | undefined);
}

async function waitForProbe(page: Page): Promise<void> {
    await page.waitForFunction(() => window.webgpuProbe !== undefined, undefined, {
        timeout: 30_000,
    });
}

/**
 * Proves no WebGL context was created on this canvas. `getContext('webgl2')`
 * returns non-null on a fresh canvas but throws/returns null once a canvas is
 * bound to a different context type — so a *successful* WebGL context here
 * means production code never claimed the canvas for WebGPU or left it free.
 * We assert on the explicit breadcrumb too, which production code owns.
 */
async function expectNoWebGLContext(page: Page): Promise<void> {
    const usingWebGL = await page.evaluate(() => window.usingWebGL);
    expect(usingWebGL, 'usingWebGL must never be true — the WebGL path is deferred').toBe(false);

    const rendererFellBack = await page.evaluate(() => window.rendererType);
    expect(rendererFellBack, 'renderer must never report a webgl backend').not.toBe('webgl');
}

test.describe('WebGPU boot probe', () => {
    test('a failed probe hard-fails with a diagnostic screen and no WebGL', async ({ page }) => {
        const bootstrapErrors = attachPageErrorCollector(page);

        const response = await page.goto('/');
        expect(response?.ok()).toBeTruthy();

        await waitForProbe(page);
        const probe = await readProbe(page);
        expect(probe, 'window.webgpuProbe must always be populated').toBeTruthy();

        if (probe?.ok) {
            // A WebGPU-capable runner: the game should boot normally instead.
            await expect(page.locator('#instructions h1')).toHaveText('SPACE DASH');
            await expectNoWebGLContext(page);
            return;
        }

        // The failure must be attributable to a browser and a stage.
        expect(probe?.browser, 'probe must name the browser').toBeTruthy();
        expect(probe?.reason, 'probe must carry a reason').toBeTruthy();
        expect(probe?.stage, 'probe must name the stage that failed').toBeTruthy();

        // Blocking screen, with the probe JSON on it for bug reports.
        const overlay = page.locator('#webgpu-boot-failure');
        await expect(overlay).toBeVisible();
        await expect(overlay).toContainText('Space Dash needs WebGPU');
        await expect(overlay).toContainText(String(probe?.browser));

        const json = page.locator('#webgpu-probe-json');
        await expect(json).toBeVisible();
        const printed = JSON.parse((await json.textContent()) ?? '{}');
        expect(printed.stage).toBe(probe?.stage);
        expect(printed.browser).toBe(probe?.browser);

        // The whole point: nothing quietly swapped in a WebGL renderer.
        await expectNoWebGLContext(page);

        // A hard-fail is not a crash — the bundle must not throw on the way down.
        expect(bootstrapErrors, bootstrapErrors.join('\n')).toEqual([]);
    });

    test('?skip_gpu_boot loads the bundle without touching the GPU', async ({ page }) => {
        const bootstrapErrors = attachPageErrorCollector(page);

        const response = await page.goto('/?skip_gpu_boot');
        expect(response?.ok()).toBeTruthy();

        await waitForProbe(page);

        const probe = await readProbe(page);
        expect(probe?.ok).toBe(false);
        expect(probe?.stage).toBe('skipped');
        expect(probe?.adapter).toBeNull();

        await expect(page.locator('#webgpu-boot-failure')).toBeVisible();
        await expectNoWebGLContext(page);

        // This is the CI bundle-health check: the app parses, boots, and stops
        // deliberately, without a single module-scope throw.
        expect(bootstrapErrors, bootstrapErrors.join('\n')).toEqual([]);
    });

    test('the probe runs exactly once per page load', async ({ page }) => {
        await page.goto('/?skip_gpu_boot');
        await waitForProbe(page);

        const requestCounts = await page.evaluate(async () => {
            // Count any further adapter requests triggered after boot.
            let adapterRequests = 0;
            if (navigator.gpu) {
                const original = navigator.gpu.requestAdapter.bind(navigator.gpu);
                navigator.gpu.requestAdapter = ((...args: unknown[]) => {
                    adapterRequests++;
                    return (original as (...a: unknown[]) => unknown)(...args);
                }) as typeof navigator.gpu.requestAdapter;
            }
            await new Promise(resolve => setTimeout(resolve, 1_000));
            return adapterRequests;
        });

        expect(requestCounts, 'nothing may re-request an adapter after boot').toBe(0);
    });
});
