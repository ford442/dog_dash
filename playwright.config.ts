import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

const SWIFT_SHADER_ARGS = [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
];

function resolveChromeExecutable(): string | undefined {
    const candidates = [
        process.env.PLAYWRIGHT_CHROME_PATH,
        '/usr/local/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/opt/google/chrome/google-chrome',
    ].filter((value): value is string => Boolean(value));

    return candidates.find((candidate) => fs.existsSync(candidate));
}

const chromePath = resolveChromeExecutable();

export default defineConfig({
    testDir: './tests',
    timeout: 60_000,
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: 'http://127.0.0.1:4173',
        browserName: 'chromium',
        launchOptions: {
            ...(chromePath ? { executablePath: chromePath } : {}),
            args: SWIFT_SHADER_ARGS,
        },
    },
    webServer: {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
