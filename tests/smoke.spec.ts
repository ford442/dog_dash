import { test, expect, type Page } from '@playwright/test';

const WEBGL_URL = '/?renderer=webgl';

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

test.describe('WebGL smoke', () => {
    test('production build initializes WebGL, renders, and starts gameplay HUD', async ({ page }) => {
        const response = await page.goto(WEBGL_URL);
        expect(response?.ok()).toBeTruthy();

        await expect(page.locator('#instructions h1')).toHaveText('SPACE DASH');
        await expect(page.locator('#glCanvas')).toBeAttached();

        await waitForWebGLRenderer(page);
        await expect.poll(async () => page.evaluate(() => window.usingWebGL)).toBe(true);
        await expect.poll(async () => page.evaluate(() => window.rendererType)).toBe('webgl');

        await waitForCanvasInitialized(page);

        await dismissTitleScreen(page);

        await expect(page.locator('#health-display')).toBeVisible();
        await expect(page.locator('#hud-hearts-row')).toBeVisible();
        await expect(page.locator('#hud-distance-value')).toBeVisible();
    });

    test('game loop updates FPS overlay after debug toggle', async ({ page }) => {
        await page.goto(WEBGL_URL);
        await waitForWebGLRenderer(page);
        await waitForCanvasInitialized(page);
        await dismissTitleScreen(page);

        await page.waitForTimeout(2_000);
        await page.keyboard.press('Backquote');

        const fpsOverlay = page.getByText(/^FPS:/);
        await expect(fpsOverlay).toBeVisible();
        await expect(fpsOverlay).toContainText(/FPS:\s*\d+/);
        await expect(fpsOverlay).toContainText('renderer: webgl');
    });
});
