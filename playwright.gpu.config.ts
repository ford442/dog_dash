import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

/**
 * GPU compute parity (npm run test:gpu-parity). Separate from the boot-probe
 * smoke config on purpose: that suite asserts the probe *fails* headlessly,
 * this one needs a WebGPU adapter, so it enables SwiftShader's WebGPU.
 * No web server — the spec bundles its own entry and serves a blank page.
 */
const WEBGPU_SWIFTSHADER_ARGS = [
    '--enable-unsafe-webgpu',
    '--use-webgpu-adapter=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
];

const chromePath = [
    process.env.PLAYWRIGHT_CHROME_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/opt/google/chrome/google-chrome',
].filter((value): value is string => Boolean(value)).find((candidate) => fs.existsSync(candidate));

export default defineConfig({
    testDir: './tests/gpu',
    timeout: 120_000,
    retries: 0,
    use: chromePath
        ? { browserName: 'chromium', launchOptions: { executablePath: chromePath, args: WEBGPU_SWIFTSHADER_ARGS } }
        : { channel: 'chrome', launchOptions: { args: WEBGPU_SWIFTSHADER_ARGS } },
});
