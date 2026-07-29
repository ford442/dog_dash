/**
 * One-off smoke: VITE_CPP_WASM build reports cpp backend + soft-body after gameplay start.
 * Run against vite preview on :4173 with game_cpp.wasm present.
 */
import { chromium } from '@playwright/test';

const url = 'http://127.0.0.1:4173/?renderer=webgl';
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH || '/usr/local/bin/google-chrome';

const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
    ],
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.usingWebGL === true, null, { timeout: 30000 });

// Wait for wasm load breadcrumb
await page.waitForFunction(() => window.wasmBackend === 'cpp' || window.wasmBackend === 'assemblyscript', null, {
    timeout: 15000,
});

const before = await page.evaluate(() => ({
    wasmBackend: window.wasmBackend,
    softActive: window.jellyMossSoftBodyActive,
    heroes: window.jellyMossSoftBodyHeroCount,
}));

await page.locator('#instructions').click();
await page.waitForTimeout(2500);

const after = await page.evaluate(() => ({
    wasmBackend: window.wasmBackend,
    softActive: window.jellyMossSoftBodyActive,
    heroes: window.jellyMossSoftBodyHeroCount,
}));

console.log('before gameplay:', before);
console.log('after gameplay:', after);
console.log('page errors:', errors);

if (after.wasmBackend !== 'cpp') {
    console.error('FAIL: expected wasmBackend=cpp');
    process.exit(1);
}
if (!after.softActive || (after.heroes ?? 0) < 1) {
    console.error('FAIL: expected soft-body active with ≥1 hero after deferred spawn');
    process.exit(1);
}
if (errors.length) {
    console.error('FAIL: page errors');
    process.exit(1);
}

console.log('✅ VITE_CPP_WASM soft-body path OK');
await browser.close();
