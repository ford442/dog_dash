import { test, expect } from '@playwright/test';

test('production build serves start screen and canvas', async ({ page }) => {
    const response = await page.goto('/?renderer=webgl');
    expect(response?.ok()).toBeTruthy();

    await expect(page.locator('#instructions h1')).toHaveText('SPACE DASH');
    await expect(page.locator('#glCanvas')).toBeAttached();

    const canvas = page.locator('#glCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
});
