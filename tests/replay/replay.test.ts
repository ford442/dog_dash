/**
 * Headless chapter replays — the gameplay regression suite.
 *
 * Each fixture in tests/fixtures/replays/ is a seed + start chapter + per-step
 * input trace recorded by `npm run replay:record`. Replaying it through the
 * real composition root and `stepSimulation` (no GPU) must reproduce the
 * committed end-of-run snapshot and trajectory. A physics, spawn-density or
 * LEVEL_CONFIG change that alters a chapter fails here; if the change is
 * intentional, re-record and commit the new `expect` (the PR diff shows it).
 *
 * Two extra properties are checked on every fixture:
 *   - determinism: a replay under an unrelated Math.random() stream must
 *     match too (any unseeded gameplay roll shows up as a divergence — run
 *     tests/replay/taint_math_random.ts to find the file);
 *   - refresh-rate independence: 30 / 60 / 144 Hz frame deltas fed through
 *     the real fixed-step accumulator land on the identical pose.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { ReplayCheckpoint, ReplayFixture, ReplaySnapshot } from './headless_sim';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURE_DIR = fileURLToPath(new URL('../fixtures/replays/', import.meta.url));
const RUNNER = fileURLToPath(new URL('./run_replay.ts', import.meta.url));
/** Steps for the 30/60/144 Hz comparison — long enough to cross obstacles and pickups. */
const FRAME_RATE_STEPS = 1200;
/**
 * Floats in the committed snapshot are compared to this tolerance so a V8
 * libm ulp difference between Node releases doesn't fail CI. Runs inside one
 * process tree are compared exactly.
 */
const POSE_EPSILON = 1e-6;

type RunOutput = { snapshot: ReplaySnapshot; checkpoints: ReplayCheckpoint[] };

const fixtures = readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ path: join(FIXTURE_DIR, f), data: JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8')) as ReplayFixture }));

// Bounded process pool: every replay is a separate Node process (module state is global).
const MAX_JOBS = Math.max(1, Math.min(cpus().length, 6));
let running = 0;
const queue: Array<() => void> = [];
function withSlot<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const go = () => {
            running++;
            fn().then(resolve, reject).finally(() => {
                running--;
                queue.shift()?.();
            });
        };
        if (running < MAX_JOBS) go();
        else queue.push(go);
    });
}

function replay(fixturePath: string, extra: string[] = []): Promise<RunOutput> {
    return withSlot(() => new Promise<RunOutput>((resolve, reject) => {
        const proc = spawn(process.execPath, ['--import', 'tsx', RUNNER, fixturePath, ...extra], {
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
                resolve(JSON.parse(last) as RunOutput);
            } catch {
                reject(new Error(`replay ${fixturePath} ${extra.join(' ')} exited ${code}\n${err.slice(-2000)}`));
            }
        });
    }));
}

function assertSnapshotMatches(actual: ReplaySnapshot, expected: ReplaySnapshot, label: string): void {
    const { x, y, ...rest } = actual;
    const { x: ex, y: ey, ...expectedRest } = expected;
    assert.deepEqual(rest, expectedRest, `${label}: end-of-run state`);
    assert.ok(Math.abs(x - ex) < POSE_EPSILON, `${label}: end X ${x} vs ${ex}`);
    assert.ok(Math.abs(y - ey) < POSE_EPSILON, `${label}: end Y ${y} vs ${ey}`);
}

function firstDivergence(a: ReplayCheckpoint[], b: ReplayCheckpoint[]): string | null {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
            return `checkpoint ${i}: ${JSON.stringify(a[i])} vs ${JSON.stringify(b[i])}`;
        }
    }
    return null;
}

test('replay fixtures exist for chapters 1, 4 and 6', () => {
    const chapters = new Set(fixtures.map((f) => f.data.chapter));
    for (const required of [1, 4, 6]) {
        assert.ok(chapters.has(required), `missing replay fixture for chapter ${required}`);
    }
});

// Replays are independent processes; let them overlap (the pool caps it).
describe('chapter replays', { concurrency: true }, () => {
    for (const fixture of fixtures) {
        const { name } = fixture.data;

        test(`${name}: replay reproduces the committed snapshot`, async () => {
            const run = await replay(fixture.path);
            assertSnapshotMatches(run.snapshot, fixture.data.expect, name);
            const drift = firstDivergence(run.checkpoints, fixture.data.checkpoints);
            assert.equal(drift, null, `${name}: trajectory drifted at ${drift}`);
        });

        // The plain run above uses V8's native Math.random(); this one swaps in an
        // unrelated seeded stream. Both matching the fixture means no unseeded
        // roll reaches gameplay on this chapter's path.
        test(`${name}: gameplay is independent of Math.random()`, async () => {
            const run = await replay(fixture.path, ['--salt', '1']);
            const drift = firstDivergence(run.checkpoints, fixture.data.checkpoints);
            assert.equal(drift, null, `${name}: unseeded Math.random() reaches gameplay (${drift}). Find it with: node --import tsx tests/replay/taint_math_random.ts ${fixture.path}`);
            assertSnapshotMatches(run.snapshot, fixture.data.expect, `${name} (salted Math.random)`);
        });

        test(`${name}: identical pose at 30 / 60 / 144 Hz display rates`, async () => {
            const steps = String(Math.min(FRAME_RATE_STEPS, fixture.data.steps));
            const [r30, r60, r144] = await Promise.all(
                ['30', '60', '144'].map((hz) => replay(fixture.path, ['--frame-hz', hz, '--steps', steps]))
            );
            assert.deepEqual(r30.snapshot, r60.snapshot, `${name}: 30 Hz vs 60 Hz`);
            assert.deepEqual(r144.snapshot, r60.snapshot, `${name}: 144 Hz vs 60 Hz`);
            assert.equal(r60.snapshot.steps, Number(steps));
        });
    }
});
