/**
 * Lost Sectors through the real sim (tests/replay/lost_sector_run.ts).
 *
 * Each flight is its own process booting the composition root from scratch.
 * Both authored sectors must reach their finish line, record the clear and
 * bank cores without unlocking campaign chapters; the same seed must fly the
 * same spawn streams with a different Math.random and display rate; and the
 * buoys must move with the run seed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { LostSectorRunResult } from './lost_sector_run';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RUNNER = fileURLToPath(new URL('./lost_sector_run.ts', import.meta.url));

function fly(sector: string, args: string[] = []): Promise<LostSectorRunResult> {
    return new Promise((resolve, reject) => {
        const proc = spawn(process.execPath, ['--import', 'tsx', RUNNER, sector, ...args], {
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
                resolve(JSON.parse(last) as LostSectorRunResult);
            } catch {
                reject(new Error(`lost sector run exited ${code}\n${err.slice(-2000)}`));
            }
        });
    });
}

function assertFinished(r: LostSectorRunResult, sector: string, level: number): void {
    assert.equal(r.snapshot.level, level);
    assert.ok(r.snapshot.hasWon, `${sector} finished`);
    assert.ok(r.snapshot.x >= r.spanEndX && r.snapshot.x < r.spanEndX + 5, `${sector} finished at ${r.snapshot.x} (span end ${r.spanEndX})`);
    assert.ok(r.obstacleSpawns.length > 50, `${sector} obstacles spawned (${r.obstacleSpawns.length})`);
    assert.equal(r.persistence.lastRunCampaignId, 'lost');
    assert.deepEqual(r.persistence.lostSectorsCompleted, [sector]);
    assert.ok(r.persistence.bankedCores > 0, 'cores banked');
    // The harness unlocks 1–6 itself; a Lost Sector must add nothing (no 7 = campaign complete).
    assert.deepEqual(r.persistence.unlockedLevels, [1, 2, 3, 4, 5, 6]);
}

test('Lost Sectors: both fly to the finish, seeded and display-rate independent', async () => {
    const [kelp, kelpSalted, kelpOtherSeed, garden] = await Promise.all([
        fly('lost-kelp'),
        fly('lost-kelp', ['--salt', '7', '--frame-hz', '144']),
        fly('lost-kelp', ['--rng', '424242']),
        fly('lost-garden')
    ]);

    assertFinished(kelp, 'lost-kelp', 302);
    assertFinished(garden, 'lost-garden', 301);

    // Kelp Cathedral's reused Kraken gate opens past triggerX 1500.
    assert.ok(kelp.krakenAt !== null, 'Kraken gate spawned');
    assert.equal(garden.krakenAt, null, 'the garden has no Kraken');

    assert.equal(kelpSalted.runSeed, kelp.runSeed);
    assert.deepEqual(kelpSalted.obstacleSpawns, kelp.obstacleSpawns, 'obstacle spawn stream');
    assert.deepEqual(kelpSalted.buoys, kelp.buoys, 'buoy layout');
    assert.equal(kelpSalted.krakenAt, kelp.krakenAt, 'Kraken gate step');
    assert.deepEqual(kelpSalted.checkpoints, kelp.checkpoints, 'trajectory');
    assert.deepEqual(kelpSalted.snapshot, kelp.snapshot, 'end snapshot');

    // Buoys drift with the run seed but stay near the authored spot (x 700 ± 40).
    assert.equal(kelp.buoys.length, 1);
    assert.notDeepEqual(kelpOtherSeed.buoys, kelp.buoys, 'buoy moves with the seed');
    for (const [x] of [...kelp.buoys, ...kelpOtherSeed.buoys]) assert.ok(Math.abs(x - 700) <= 40, `buoy x ${x}`);
});
