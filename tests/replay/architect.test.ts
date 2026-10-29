/**
 * Architect Lab playtests through the real sim (tests/replay/architect_run.ts).
 *
 * Each run is its own process that reads and imports the committed course
 * seed (tests/fixtures/architect/course.json) from scratch, so two runs are
 * two independent imports of the same JSON. They must fly identical spawn
 * streams, also with a different Math.random and display rate, reach the
 * finish line, save a ghost the next playtest can race, and never unlock a
 * campaign chapter.
 *
 * Instrumented brushes: candy belt (candy asteroid rolls), spore field, wind
 * corridors, dream door, sky rail and boss gate. The Sling Arena is left
 * out: toy_rockets.ts still places wrecks with Math.random (legacy baseline).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { ArchitectRunResult } from './architect_run';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const RUNNER = fileURLToPath(new URL('./architect_run.ts', import.meta.url));
const COURSE = fileURLToPath(new URL('../fixtures/architect/course.json', import.meta.url));

function fly(args: string[] = []): Promise<ArchitectRunResult> {
    return new Promise((resolve, reject) => {
        const proc = spawn(process.execPath, ['--import', 'tsx', RUNNER, COURSE, ...args], {
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
                resolve(JSON.parse(last) as ArchitectRunResult);
            } catch {
                reject(new Error(`architect run exited ${code}\n${err.slice(-2000)}`));
            }
        });
    });
}

test('Architect course: two imports of the same seed fly the same spawn streams', async () => {
    const a = await fly();
    const b = await fly(['--salt', '7']);
    const c = await fly(['--salt', '11', '--frame-hz', '144']);

    assert.ok(a.obstacleSpawns.length > 50, `obstacles spawned (${a.obstacleSpawns.length})`);
    assert.deepEqual(a.bossSpawns.map(([, kind]) => kind), ['ZephyrBoss'], 'boss gate spawned its boss');

    for (const [label, other] of [['second import, other Math.random', b], ['144 Hz, other Math.random', c]] as const) {
        assert.equal(other.runSeed, a.runSeed, `${label}: same run seed`);
        assert.deepEqual(other.obstacleSpawns, a.obstacleSpawns, `${label}: obstacle spawn stream`);
        assert.deepEqual(other.bossSpawns, a.bossSpawns, `${label}: boss spawn`);
        assert.deepEqual(other.checkpoints, a.checkpoints, `${label}: trajectory`);
        assert.deepEqual(other.snapshot, a.snapshot, `${label}: end snapshot`);
    }

    // The finish line is the end of the sandbox span.
    assert.equal(a.snapshot.level, 200);
    assert.ok(a.snapshot.hasWon, 'course completed');
    assert.ok(a.snapshot.x >= a.spanEndX && a.snapshot.x < a.spanEndX + 5, `finished at ${a.snapshot.x} (span end ${a.spanEndX})`);

    // Ghost overlay: the finish saved a ghost that matches this course.
    assert.equal(a.persistence.lastRunCampaignId, 'architect');
    assert.ok(a.persistence.ghostMatchesCourse, 'ghost saved for the next playtest of this course');
    // The harness unlocks 1–6 itself; a sandbox must add nothing (no 7 = campaign complete).
    assert.deepEqual(a.persistence.unlockedLevels, [1, 2, 3, 4, 5, 6]);
});
