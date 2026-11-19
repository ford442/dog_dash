/**
 * Lost Sector headless flight: queues a sector run seed exactly as the hub
 * tab does (`lostSectorRunSeed`), flies it through the real composition root
 * and `stepSimulation` to the finish line, and logs obstacle spawns, the
 * Kraken gate and where the seeded buoys landed.
 *
 * Health is refilled every step (keepAlive) so the run always reaches the
 * finish; spawn streams do not read health.
 *
 *   node --import tsx tests/replay/lost_sector_run.ts <sector-id> [--rng N] [--frame-hz N] [--salt N]
 *
 * Prints one JSON line (LostSectorRunResult) as the last stdout line.
 */
import { installHeadlessEnv } from './headless_env';
import { runReplay, type ReplayCheckpoint, type ReplaySnapshot } from './headless_sim';

export interface LostSectorRunResult {
    runSeed: string;
    spanEndX: number;
    snapshot: ReplaySnapshot;
    checkpoints: ReplayCheckpoint[];
    /** [step, x, y] for every obstacle the first step it exists. */
    obstacleSpawns: [number, number, number][];
    /** [x, y] of each buoy as spawned (seeded jitter around the authored spot). */
    buoys: [number, number][];
    /** Step the Kraken gate's squid first appeared, or null. */
    krakenAt: number | null;
    persistence: {
        lastRunCampaignId: string | null;
        unlockedLevels: number[];
        lostSectorsCompleted: string[];
        bankedCores: number;
    };
}

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

const sectorId = process.argv[2];
const rng = Number(arg('--rng') ?? 0x105c7012);
const frameHz = arg('--frame-hz');
const salt = arg('--salt');

installHeadlessEnv();
const { isLostSectorId, LOST_SECTOR_LEVEL_INDEX } = await import('../../src/lost_sector/constants');
const { lostSectorRunSeed } = await import('../../src/lost_sector/run');
if (!isLostSectorId(sectorId)) {
    console.error('usage: lost_sector_run.ts <lost-garden|lost-kelp> [--rng N] [--frame-hz N] [--salt N]');
    process.exit(2);
}
const { GhostAction } = await import('../../src/ghost_run/types');
const { serializeRunSeed, parseRunSeed } = await import('../../src/run_seed');
const runtime = await import('../../src/game_runtime');
const { playerState } = await import('../../src/game_config');
const { getJourneyLayout } = await import('../../src/journey_layout');

const run = lostSectorRunSeed(sectorId, rng);
const chapter = LOST_SECTOR_LEVEL_INDEX[sectorId];

function round(n: number, digits = 3): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

const seenObstacles = new WeakSet<object>();
const obstacleSpawns: LostSectorRunResult['obstacleSpawns'] = [];
let buoys: LostSectorRunResult['buoys'] | null = null;
let krakenAt: number | null = null;

const result = await runReplay({
    seed: run,
    chapter,
    steps: 40000,
    keepAlive: true,
    frameHz: frameHz ? Number(frameHz) : undefined,
    mathRandomSalt: salt ? Number(salt) : undefined,
    inputFor: (step) => {
        const game = runtime.game;
        if (buoys === null) {
            buoys = game.derelictBuoyManager.getBuoys().map((g) => [round(g.position.x), round(g.position.y)]);
        }
        for (const o of game.obstacleSystem.getObstacles()) {
            if (seenObstacles.has(o)) continue;
            seenObstacles.add(o);
            obstacleSpawns.push([step, round(o.position.x), round(o.position.y)]);
        }
        if (krakenAt === null && game.obstacleSystem.squids.length > 0) krakenAt = step;
        // Stay clear of the buoy docks (a hack pauses the sim), weave, fire on a cadence.
        const weave = Math.floor(step / 45) % 2 === 0 ? GhostAction.UP : GhostAction.DOWN;
        return weave | (step % 10 === 0 ? GhostAction.FIRE : 0);
    },
    stopWhen: () => playerState.hasWon
});

const { SaveManager } = await import('../../src/save_manager');
const reloaded = new SaveManager();
const lastRun = reloaded.getLastRun();

const output: LostSectorRunResult = {
    runSeed: serializeRunSeed(run),
    spanEndX: getJourneyLayout().span(chapter).endX,
    snapshot: result.snapshot,
    checkpoints: result.checkpoints,
    obstacleSpawns,
    buoys: buoys ?? [],
    krakenAt,
    persistence: {
        lastRunCampaignId: lastRun ? parseRunSeed(lastRun.seed)?.campaignId ?? null : null,
        unlockedLevels: reloaded.getUnlockedLevels().sort((a, b) => a - b),
        lostSectorsCompleted: reloaded.getCompletedLostSectors(),
        bankedCores: reloaded.getCores()
    }
};
process.stdout.write('\n' + JSON.stringify(output) + '\n', () => process.exit(0));
