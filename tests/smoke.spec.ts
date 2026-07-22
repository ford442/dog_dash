import { test, expect, type Page } from '@playwright/test';

const WEBGL_URL = '/?renderer=webgl';

type RendererBreadcrumbs = {
    rendererType?: string;
    usingWebGPU?: boolean;
    usingWebGL?: boolean;
    rendererFallbackReason?: string;
};

function attachPageErrorCollector(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
        errors.push(error.message);
    });
    return errors;
}

function expectNoPageErrors(errors: string[]): void {
    expect(errors, errors.join('\n')).toEqual([]);
}

async function readRendererBreadcrumbs(page: Page): Promise<RendererBreadcrumbs> {
    return page.evaluate(() => ({
        rendererType: window.rendererType,
        usingWebGPU: window.usingWebGPU,
        usingWebGL: window.usingWebGL,
        rendererFallbackReason: window.rendererFallbackReason,
    }));
}

async function waitForWebGLRenderer(page: Page): Promise<void> {
    await page.waitForFunction(() => window.usingWebGL === true, undefined, {
        timeout: 30_000,
    });
}

async function waitForCanvasInitialized(page: Page): Promise<void> {
    await page.waitForFunction(() => {
        const canvas = document.getElementById('glCanvas') as HTMLCanvasElement | null;
        return Boolean(canvas && canvas.width > 300 && canvas.height > 150);
    }, undefined, { timeout: 15_000 });
}

async function dismissTitleScreen(page: Page): Promise<void> {
    await expect(page.locator('#instructions')).toBeVisible();
    await page.locator('#instructions').click();
    await expect(page.locator('#instructions')).toBeHidden();
}

async function expectWebGLBreadcrumbs(page: Page): Promise<void> {
    const breadcrumbs = await readRendererBreadcrumbs(page);
    expect(breadcrumbs.usingWebGL).toBe(true);
    expect(breadcrumbs.usingWebGPU).toBe(false);
    expect(breadcrumbs.rendererType).toBe('webgl');
    expect(typeof breadcrumbs.rendererFallbackReason).toBe('string');
}

test.describe('WebGL smoke', () => {
    test('production build initializes WebGL, renders, and starts gameplay HUD', async ({ page }) => {
        const bootstrapErrors = attachPageErrorCollector(page);

        const response = await page.goto(WEBGL_URL);
        expect(response?.ok()).toBeTruthy();

        await expect(page.locator('#instructions h1')).toHaveText('SPACE DASH');
        await expect(page.locator('#glCanvas')).toBeAttached();

        await waitForWebGLRenderer(page);
        await expectWebGLBreadcrumbs(page);
        await waitForCanvasInitialized(page);

        // Bootstrap/renderer init must not throw before gameplay starts.
        expectNoPageErrors(bootstrapErrors);

        await dismissTitleScreen(page);

        await expect(page.locator('#health-display')).toBeVisible();
        await expect(page.locator('#hud-hearts-row')).toBeVisible();
        await expect(page.locator('#hud-distance-value')).toBeVisible();

        await page.waitForTimeout(2_000);
        await expectWebGLBreadcrumbs(page);
    });

    test('game loop updates FPS overlay after debug toggle', async ({ page }) => {
        await page.goto(WEBGL_URL);
        await waitForWebGLRenderer(page);
        await waitForCanvasInitialized(page);
        await dismissTitleScreen(page);

        await page.waitForTimeout(2_000);
        await expectWebGLBreadcrumbs(page);

        await page.keyboard.press('Backquote');

        const fpsOverlay = page.getByText(/^FPS:/);
        await expect(fpsOverlay).toBeVisible();
        await expect(fpsOverlay).toContainText(/FPS:\s*\d+/);
        await expect(fpsOverlay).toContainText('renderer: webgl');
    });
});
