/**
 * CLI: run one headless replay and print the result as JSON on the last
 * stdout line. One process per replay (module state is global).
 *
 *   node --import tsx tests/replay/run_replay.ts <fixture.json> [--frame-hz 144] [--salt 7] [--steps N]
 */
import { readFileSync } from 'node:fs';
import { decodeInputTrace } from '../../src/ghost_run/input_trace';
import { runReplay, type ReplayFixture } from './headless_sim';

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

const fixturePath = process.argv[2];
if (!fixturePath) {
    console.error('usage: run_replay.ts <fixture.json> [--frame-hz N] [--salt N] [--steps N]');
    process.exit(2);
}

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ReplayFixture;
const inputs = decodeInputTrace(fixture.recording.inputs ?? []);
const stepsArg = arg('--steps');
const frameHz = arg('--frame-hz');
const salt = arg('--salt');

const result = await runReplay({
    seed: fixture.recording.seed,
    chapter: fixture.chapter,
    steps: stepsArg ? Math.min(Number(stepsArg), inputs.length) : inputs.length,
    inputFor: (step) => inputs[step] ?? 0,
    frameHz: frameHz ? Number(frameHz) : undefined,
    mathRandomSalt: salt ? Number(salt) : undefined
});

// Deferred systems may leave timers behind, so exit explicitly — but only
// once the result has flushed (a piped stdout is async).
process.stdout.write('\n' + JSON.stringify({ snapshot: result.snapshot, checkpoints: result.checkpoints }) + '\n', () => process.exit(0));
