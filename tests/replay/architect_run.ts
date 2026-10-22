/**
 * Architect Lab headless playtest: imports a course seed exactly as the Lab
 * does (`parseArchitectSeed` → `architectRunSeed`), flies it through the
 * real composition root and `stepSimulation` to the finish line, and logs
 * every obstacle and boss spawn on the way.
 *
 * Health is refilled every step (keepAlive) so the run always reaches the
 * finish; spawn streams do not read health, so the log is still a pure
 * function of seed + input. A boss is cleared a fixed number of steps after
 * it spawns, as in the Endless smoke.
 *
 *   node --import tsx tests/replay/architect_run.ts <course.json> [--frame-hz N] [--salt N]
 *
 * Prints one JSON line (ArchitectRunResult) as the last stdout line.
 */
import { readFileSync } from 'node:fs';
import { installHeadlessEnv } from './headless_env';
import { runReplay, type ReplayCheckpoint, type ReplaySnapshot } from './headless_sim';

export interface ArchitectRunResult {
    runSeed: string;
    spanEndX: number;
    snapshot: ReplaySnapshot;
    checkpoints: ReplayCheckpoint[];
    /** [step, x, y, radius] for every obstacle the first step it exists. */
    obstacleSpawns: [number, number, number, number][];
    /** [step, boss class] for every boss spawn. */
    bossSpawns: [number, string][];
    persistence: {
        lastRunCampaignId: string | null;
        unlockedLevels: number[];
        ghostMatchesCourse: boolean;
    };
}

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

const coursePath = process.argv[2];
if (!coursePath) {
    console.error('usage: architect_run.ts <course.json> [--frame-hz N] [--salt N]');
    process.exit(2);
}
const frameHz = arg('--frame-hz');
const salt = arg('--salt');

/** Steps a spawned boss runs before the harness clears it so the course can finish. */
const BOSS_RUN_STEPS = 240;

installHeadlessEnv();
const { parseArchitectSeed } = await import('../../src/architect/schema');
const { architectRunSeed } = await import('../../src/architect/run');
const { ARCHITECT_LEVEL_INDEX } = await import('../../src/architect/constants');
const { GhostAction } = await import('../../src/ghost_run/types');
const { parseRunSeed, serializeRunSeed } = await import('../../src/run_seed');
const runtime = await import('../../src/game_runtime');
const { playerState } = await import('../../src/game_config');
const { getJourneyLayout } = await import('../../src/journey_layout');

const parsed = parseArchitectSeed(readFileSync(coursePath, 'utf8'));
if (!parsed.ok) {
    console.error(`[architect_run] course rejected: ${parsed.errors.join('; ')}`);
    process.exit(1);
}
const run = architectRunSeed(parsed.seed);

function round(n: number, digits = 3): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

const seenObstacles = new WeakSet<object>();
const obstacleSpawns: ArchitectRunResult['obstacleSpawns'] = [];
const seenBosses = new WeakSet<object>();
const bossSpawns: ArchitectRunResult['bossSpawns'] = [];
let bossSpawnedAt = 0;

const result = await runReplay({
    seed: run,
    chapter: ARCHITECT_LEVEL_INDEX,
    steps: 20000,
    keepAlive: true,
    frameHz: frameHz ? Number(frameHz) : undefined,
    mathRandomSalt: salt ? Number(salt) : undefined,
    inputFor: (step) => {
        const game = runtime.game;
        for (const o of game.obstacleSystem.getObstacles()) {
            if (seenObstacles.has(o)) continue;
            seenObstacles.add(o);
            obstacleSpawns.push([step, round(o.position.x), round(o.position.y), round((o.userData.radius as number | undefined) ?? 1)]);
        }
        const boss = game.bossManager.getBoss();
        if (boss && !seenBosses.has(boss)) {
            seenBosses.add(boss);
            bossSpawns.push([step, boss.constructor.name]);
            bossSpawnedAt = step;
        }
        if (boss?.isActive && step - bossSpawnedAt > BOSS_RUN_STEPS) {
            boss.destroy();
            playerState.bossActive = false;
        }
        // Weave up and down, firing on a cadence.
        const weave = Math.floor(step / 45) % 2 === 0 ? GhostAction.UP : GhostAction.DOWN;
        return weave | (step % 10 === 0 ? GhostAction.FIRE : 0);
    },
    stopWhen: () => playerState.hasWon
});

const { SaveManager } = await import('../../src/save_manager');
const { loadGhostRecording, ghostMatchesSeed } = await import('../../src/ghost_run');
const reloaded = new SaveManager();
const lastRun = reloaded.getLastRun();
const ghost = loadGhostRecording();

const output: ArchitectRunResult = {
    runSeed: serializeRunSeed(run),
    spanEndX: getJourneyLayout().span(ARCHITECT_LEVEL_INDEX).endX,
    snapshot: result.snapshot,
    checkpoints: result.checkpoints,
    obstacleSpawns,
    bossSpawns,
    persistence: {
        lastRunCampaignId: lastRun ? parseRunSeed(lastRun.seed)?.campaignId ?? null : null,
        unlockedLevels: reloaded.getUnlockedLevels().sort((a, b) => a - b),
        ghostMatchesCourse: ghost !== null && ghostMatchesSeed(ghost, run)
    }
};
process.stdout.write('\n' + JSON.stringify(output) + '\n', () => process.exit(0));
