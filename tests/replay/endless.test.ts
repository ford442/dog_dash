/**
 * Endless Dash coverage smoke (tests/replay/endless_smoke.ts) as a test:
 * a fixed journey that switches on every env-system descriptor key and each
 * boss gate must fly to the end without an exception, and the run must
 * persist resources, bestiary unlocks and Endless records — but never unlock
 * a campaign chapter.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { EndlessSmokeResult } from './endless_smoke';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RUNNER = fileURLToPath(new URL('./endless_smoke.ts', import.meta.url));

function runSmoke(): Promise<EndlessSmokeResult> {
    return new Promise((resolve, reject) => {
        const proc = spawn(process.execPath, ['--import', 'tsx', RUNNER], {
            cwd: ROOT,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let out = '';
        let err = '';
        proc.stdout.on('data', (d) => { out += d; });
        proc.stderr.on('data', (d) => { err += d; });
        proc.on('close', (code) => {
            const last = out.trim().split('\n').pop() ?? '';
            try {
                resolve(JSON.parse(last) as EndlessSmokeResult);
            } catch {
                reject(new Error(`endless smoke exited ${code}\n${err.slice(-2000)}`));
            }
        });
    });
}

test('Endless coverage journey flies every descriptor key and boss gate', async () => {
    const r = await runSmoke();

    assert.equal(r.keysEnabled.length, r.keysTotal, 'every descriptor key is switched on by some chapter');
    assert.equal(r.lastLevelReached, 100 + r.chapters, `reached the last chapter (${r.chapters})`);
    assert.ok(r.krakenGateSpawned, 'Kraken gate squid spawned');
    assert.deepEqual([...r.bossesSpawned].sort(), ['StarEaterBoss', 'ZephyrBoss']);

    const p = r.persistence;
    assert.ok(p.materialPersisted, 'materials granted during Endless persist');
    assert.ok(p.catalogedFromPlay.includes('star_eater'), 'Star-Eater gate catalogs the bestiary entry');
    assert.ok(p.catalogedFromPlay.includes('kraken'));
    assert.ok(p.unlockedLevels.every((l) => l <= 6), `no campaign/endless chapter unlocked: ${p.unlockedLevels}`);
    assert.equal(p.endlessRuns, 1);
    assert.equal(p.endlessBestChapter, r.chapters);
    assert.equal(p.lastRunCampaignId, 'endless');
});
