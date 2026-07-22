/**
 * Playwright smoke: Phase A resource inventory + Resource Pop HUD.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(ARTIFACTS, { recursive: true });

async function main() {
    const browser = await chromium.launch({
        executablePath: '/usr/local/bin/google-chrome',
        headless: true,
        args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            '--no-sandbox'
        ]
    });

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.warn('PAGE ERROR', err.message));

    await page.goto('http://127.0.0.1:5173/?renderer=webgl', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.mouse.click(640, 400);
    await page.waitForTimeout(800);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);

    // Wait until game runtime + harvester are wired
    await page.waitForFunction(async () => {
        try {
            const { game } = await import('/src/game_runtime.ts');
            return !!(game && game.resourceHarvester && game.hudManager);
        } catch {
            return false;
        }
    }, { timeout: 30000 });

    const result = await page.evaluate(async () => {
        const { game } = await import('/src/game_runtime.ts');
        const { getMaterialDisplayName } = await import('/src/resource_inventory.ts');

        const before = game.saveManager.getMaterialCount('taintedExtract');
        const dustBefore = game.saveManager.getMaterialCount('luminousDust');

        const grants = game.resourceHarvester.harvest(
            'nebulaJellyMoss',
            'destroy',
            undefined,
            { precision: false }
        );

        // Allow HUD animation to start
        await new Promise((r) => setTimeout(r, 100));

        const after = game.saveManager.getMaterialCount('taintedExtract');
        const dustAfter = game.saveManager.getMaterialCount('luminousDust');
        const raw = localStorage.getItem('dog_dash_save_v1');
        const parsed = raw ? JSON.parse(raw) : null;

        const last = document.getElementById('hud-last-material');
        const pop = document.getElementById('hud-resource-pop');

        return {
            usingWebGL: window.usingWebGL === true,
            grants,
            before,
            after,
            dustBefore,
            dustAfter,
            persistedTainted: parsed?.resources?.taintedExtract ?? null,
            persistedDust: parsed?.resources?.luminousDust ?? null,
            hasLast: !!last,
            hasPop: !!pop,
            lastText: last?.textContent ?? '',
            popText: pop?.textContent ?? '',
            lastOpacity: last ? getComputedStyle(last).opacity : null,
            grantNames: grants.map((g) => getMaterialDisplayName(g.id))
        };
    });

    console.log(JSON.stringify(result, null, 2));

    await page.waitForTimeout(500);
    const shot = path.join(ARTIFACTS, 'resource-pop-phase-a.png');
    await page.screenshot({ path: shot, fullPage: false });
    console.log('screenshot', shot);

    if (!result.grants?.length) throw new Error('Expected destroy to grant materials');
    if (result.after + result.dustAfter <= result.before + result.dustBefore) {
        throw new Error('Inventory totals did not increase');
    }
    if (result.persistedTainted !== result.after) {
        throw new Error(`taintedExtract persist mismatch ${result.persistedTainted} vs ${result.after}`);
    }
    if (!result.hasLast || !result.hasPop) throw new Error('HUD Resource Pop elements missing');
    if (!result.lastText || result.lastText === '') throw new Error('Last material label empty');
    if (!result.popText || result.popText === '') throw new Error('Resource Pop text empty');

    console.log('ACCEPTANCE OK');
    await browser.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
