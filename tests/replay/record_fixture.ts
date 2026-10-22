/**
 * Records a chapter replay fixture by flying the real headless sim with a
 * small deterministic autopilot, then writes the input trace the in-game
 * recorder captured plus the resulting snapshot.
 *
 *   npm run replay:record -- --chapter 4
 *   npm run replay:record -- --chapter 1 --seed 3735928559 --max-steps 9000
 *   npm run replay:record -- --endless              # Endless Dash, default seed
 *   npm run replay:record -- --endless --seed 123 --chapters 3
 *
 * Re-record ONLY when a gameplay change is intentional (physics, density,
 * LEVEL_CONFIG); the diff of `expect` in the PR is the review artefact.
 * One process per fixture — module state is global.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GhostAction } from '../../src/ghost_run/types';
import { inputTraceLength } from '../../src/ghost_run/input_trace';
import { RUN_SEED_SCHEMA_VERSION } from '../../src/run_seed/types';
import { getLevelSpan } from '../../src/depth_layers';
import { ENDLESS_LEVEL_BASE } from '../../src/endless/constants';
import { formatEndlessCode } from '../../src/endless/seed';
import {
    REPLAY_FIXTURE_VERSION,
    runReplay,
    type HeadlessHandles,
    type ReplayFixture
} from './headless_sim';

function arg(name: string, fallback: string): string {
    const i = process.argv.indexOf(name);
    return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const endless = process.argv.includes('--endless');
const chapter = endless ? ENDLESS_LEVEL_BASE + 1 : Number(arg('--chapter', '1'));
/** Endless: boundaries to cross before stopping (each one starts a freshly generated chapter). */
const endlessChapters = Number(arg('--chapters', '2'));
/** Fixed per-chapter default seeds so a re-record without flags is reproducible. */
const DEFAULT_SEEDS: Record<number, number> = {
    // Chapters 4 and 6: seeds the autopilot clears (squid lanes and the
    // final chapter are the hardest dodges in the campaign).
    1: 0xd06d0001, 2: 0xd06d0002, 3: 0xd06d0003, 4: 101, 5: 0xd06d0005, 6: 600
};
/** Endless default: chapter 2 is a Star-Eater gate, so the fixture covers a boundary and a boss fight. */
const DEFAULT_ENDLESS_SEED = 0xd06de002;
const rngSeed = Number(arg('--seed', String(endless ? DEFAULT_ENDLESS_SEED : DEFAULT_SEEDS[chapter] ?? 0xd06d0000))) >>> 0;
const fixtureName = endless ? 'endless' : `chapter${chapter}`;
const maxSteps = Number(arg('--max-steps', endless ? '12000' : '9000'));
/** Keep flying this long into the next chapter so the transition is covered. */
const TAIL_STEPS = 120;
const outPath = arg(
    '--out',
    fileURLToPath(new URL(`../fixtures/replays/${fixtureName}.json`, import.meta.url))
);

/**
 * Deterministic autopilot. Each step it scores candidate altitudes by how
 * much clearance they leave from every obstacle and squid in the next ~30
 * world units (nearer threats weigh more), with a gentle pull toward a slow
 * sine cruise line, and steers toward the best one. It keeps the blaster
 * busy, rolls through anything about to hit, and taps bark / boost on a
 * fixed cadence so those systems are exercised too. It only reads sim
 * state, so its choices are a pure function of the run.
 */
function makeAutopilot(): (step: number, sim: HeadlessHandles) => number {
    let lastRoll = -1000;
    const CANDIDATES: number[] = [];
    for (let y = -12; y <= 14; y += 0.5) CANDIDATES.push(y);

    return (step, sim) => {
        let mask = 0;
        const cruise = Math.sin(step / 240) * 5;
        const ahead = sim.obstacles.filter((o) => {
            const dx = o.x - sim.playerX;
            return dx > -3 && dx < 32;
        });

        let bestY = cruise;
        let bestCost = Infinity;
        for (const y of CANDIDATES) {
            let cost = 0.03 * Math.abs(y - cruise) + 0.04 * Math.abs(y - sim.playerY);
            for (const o of ahead) {
                const dx = Math.max(0, o.x - sim.playerX);
                const overlap = o.radius + 2.5 - Math.abs(y - o.y);
                if (overlap > 0) cost += overlap * (4 / (1 + dx / 6));
            }
            if (cost < bestCost) {
                bestCost = cost;
                bestY = y;
            }
        }

        const imminent = ahead.some((o) => {
            const dx = o.x - sim.playerX;
            return dx > -1 && dx < 5 && Math.abs(o.y - sim.playerY) < o.radius + 1.2;
        });
        if (imminent && step - lastRoll > 150) {
            mask |= GhostAction.ROLL;
            lastRoll = step;
        }

        if (sim.playerY < bestY - 0.4) mask |= GhostAction.UP;
        else if (sim.playerY > bestY + 1.5) mask |= GhostAction.DOWN;

        if (step % 10 === 0) mask |= GhostAction.FIRE;
        if (step % 600 === 300) mask |= GhostAction.BARK;
        if (step % 900 === 450) mask |= GhostAction.BOOST;
        return mask;
    };
}

/**
 * Reviewable JSON: `expect` pretty-printed (its diff is the review artefact),
 * one checkpoint per line, and the bulky recording on compact lines.
 */
function formatFixture(f: ReplayFixture): string {
    const { recording, checkpoints, expect, ...head } = f;
    const { deltas, inputs, ...recHead } = recording;
    const lines = ['{'];
    for (const [k, v] of Object.entries(head)) lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    lines.push(`  "expect": ${JSON.stringify(expect, null, 2).replace(/\n/g, '\n  ')},`);
    lines.push('  "checkpoints": [');
    lines.push(checkpoints.map((c) => `    ${JSON.stringify(c)}`).join(',\n'));
    lines.push('  ],');
    lines.push('  "recording": {');
    for (const [k, v] of Object.entries(recHead)) lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    lines.push(`    "inputs": ${JSON.stringify(inputs)},`);
    lines.push(`    "deltas": ${JSON.stringify(deltas)}`);
    lines.push('  }');
    lines.push('}');
    return lines.join('\n') + '\n';
}

let reachedNextAt: number | null = null;
const result = await runReplay({
    seed: { version: RUN_SEED_SCHEMA_VERSION, campaignId: endless ? 'endless' : 'campaign', rngSeed, modifiers: [] },
    chapter,
    steps: maxSteps,
    inputFor: makeAutopilot(),
    stopWhen: (sim) => {
        // Cleared = next chapter started, or (chapter 6) the end of the journey reached.
        // Endless: `--chapters` boundaries crossed.
        const cleared = endless
            ? sim.level >= chapter + endlessChapters
            : sim.level > chapter || sim.playerX >= getLevelSpan(chapter).endX;
        if (reachedNextAt === null && cleared) {
            reachedNextAt = sim.step;
        }
        return reachedNextAt !== null && sim.step >= reachedNextAt + TAIL_STEPS;
    }
});

if (!result.recording?.inputs) throw new Error('[record] recorder captured no input trace');
const steps = inputTraceLength(result.recording.inputs);
if (steps !== result.snapshot.steps) {
    throw new Error(`[record] trace covers ${steps} steps but the run took ${result.snapshot.steps}`);
}

// Ghost frames are the overlay trail; 3 decimals is far below a pixel.
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const recording = {
    ...result.recording,
    base: { ...result.recording.base, t: r3(result.recording.base.t), x: r3(result.recording.base.x), y: r3(result.recording.base.y) },
    deltas: result.recording.deltas.map((d) => ({ dt: r3(d.dt), dx: r3(d.dx), dy: r3(d.dy), actions: d.actions })),
    duration: r3(result.recording.duration)
};

const outcome = result.snapshot.gameOver
    ? `crashed out at step ${steps}`
    : reachedNextAt !== null
        ? `cleared the chapter at step ${reachedNextAt}`
        : `stopped at the ${maxSteps}-step cap`;
const description = endless
    ? `Endless Dash, seed ${rngSeed} (code ${formatEndlessCode(rngSeed)}), ${endlessChapters} boundary crossing(s): autopilot ${outcome}. Regenerate with \`npm run replay:record -- --endless\`.`
    : `Chapter ${chapter}, seed ${rngSeed}: autopilot ${outcome}. Regenerate with \`npm run replay:record -- --chapter ${chapter}\`.`;
const fixture: ReplayFixture = {
    version: REPLAY_FIXTURE_VERSION,
    name: fixtureName,
    description,
    chapter,
    steps,
    recording,
    checkpoints: result.checkpoints,
    expect: result.snapshot
};

mkdirSync(new URL('../fixtures/replays/', import.meta.url), { recursive: true });
writeFileSync(outPath, formatFixture(fixture));
process.stdout.write(`\n[record] ${outPath}: ${fixture.description}\n`);
process.stdout.write(JSON.stringify(result.snapshot) + '\n', () => process.exit(0));
