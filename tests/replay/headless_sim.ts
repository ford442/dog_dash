/**
 * Headless chapter replay: boots the real composition root in Node (no
 * WebGPURenderer, no DOM — see headless_env.ts) and drives the real
 * `stepSimulation` from a recorded per-step input trace.
 *
 * Module state (the GameContext, player, obstacle lists) is process-global,
 * so one process runs exactly one replay. `replay.test.ts` spawns a child
 * process per run via `run_replay.ts`.
 */
import { installHeadlessEnv } from './headless_env';
import type { RunSeed } from '../../src/run_seed/types';
import type { StoredGhostRecording } from '../../src/ghost_run/types';
import type { JourneyLayout } from '../../src/journey_layout';

export const REPLAY_FIXTURE_VERSION = 1;

/** One committed chapter replay (tests/fixtures/replays/*.json). */
export interface ReplayFixture {
    version: typeof REPLAY_FIXTURE_VERSION;
    name: string;
    description: string;
    chapter: number;
    /** Fixed sim steps to run (== decoded input trace length). */
    steps: number;
    /** The run exactly as the in-game ghost recorder stores it: seed, start chapter, compressed 25 Hz frames and the RLE input trace. */
    recording: StoredGhostRecording;
    /** Coarse trajectory, one entry every CHECKPOINT_INTERVAL steps. */
    checkpoints: ReplayCheckpoint[];
    expect: ReplaySnapshot;
}

export const CHECKPOINT_INTERVAL = 60;

/** Endless chapters whose chunks are loaded before the first step (more than a fixture flies). */
const ENDLESS_PRELOAD_CHAPTERS = 6;

export type ReplayCheckpoint = [step: number, x: number, y: number, health: number, score: number];

export interface ReplaySnapshot {
    steps: number;
    x: number;
    y: number;
    health: number;
    cores: number;
    grenadeAmmo: number;
    score: number;
    level: number;
    objectivesCompleted: number[];
    bossSpawned: boolean;
    bossHealth: number | null;
    bossDefeated: boolean;
    hasWon: boolean;
    gameOver: boolean;
}

export interface ReplayRunOptions {
    seed: RunSeed;
    chapter: number;
    steps: number;
    /** Per-step input mask source. Called with the step index, before the step. */
    inputFor: (step: number, sim: HeadlessHandles) => number;
    /**
     * Display refresh rate to emulate. Frame deltas of 1/frameHz go through
     * the real fixed-step accumulator, so 30 / 60 / 144 Hz must all land on
     * the same per-step sequence. Omit to step the sim directly.
     */
    frameHz?: number;
    /**
     * Replace Math.random with a salted PRNG. Two runs with different salts
     * must produce identical gameplay — any divergence means an unseeded
     * Math.random() is still on a gameplay path.
     */
    mathRandomSalt?: number;
    /** Optional early stop (fixture generation: "chapter finished"). Checked after each step. */
    stopWhen?: (sim: HeadlessHandles) => boolean;
    /** Fly this journey instead of the seed's (Endless coverage smoke runs). */
    layout?: JourneyLayout;
    /** Endless chapters to preload before the first step (default ENDLESS_PRELOAD_CHAPTERS). */
    endlessPreload?: number;
    /**
     * Smoke runs only: refill health before every step and never stop on
     * game over, so a run reaches every chapter. Not a replay — outcomes
     * are meaningless, only "no exception" is.
     */
    keepAlive?: boolean;
}

export interface ReplayRunResult {
    snapshot: ReplaySnapshot;
    checkpoints: ReplayCheckpoint[];
    recording: StoredGhostRecording | null;
}

/** Handles a reactive input bot (fixture generation only) may look at. */
export interface HeadlessHandles {
    step: number;
    level: number;
    playerX: number;
    playerY: number;
    obstacles: ReadonlyArray<{ x: number; y: number; radius: number }>;
}

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function round(n: number, digits = 4): number {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

export async function runReplay(options: ReplayRunOptions): Promise<ReplayRunResult> {
    installHeadlessEnv();
    if (options.mathRandomSalt !== undefined) {
        Math.random = mulberry32(options.mathRandomSalt);
    }

    // Quiet the boot chatter and the known headless-only noise (no
    // AudioContext, no rocket.glb); anything else still surfaces.
    const { log, warn, error } = console;
    const expected = /Audio not supported|rocket GLB|placeholder rocket|"atan2" is overloaded/;
    const filtered = (sink: (...a: unknown[]) => void) => (...args: unknown[]) => {
        if (!expected.test(args.map(String).join(' '))) sink(...args);
    };
    console.log = () => {};
    console.warn = filtered(warn);
    console.error = filtered(error);
    try {
        return await runReplayInner(options);
    } finally {
        console.log = log;
        console.warn = warn;
        console.error = error;
    }
}

async function runReplayInner(options: ReplayRunOptions): Promise<ReplayRunResult> {
    const { composeGameContext } = await import('../../src/main/startup');
    const { startRun } = await import('../../src/main/input_bindings');
    const { stepSimulation } = await import('../../src/main/sim_step');
    const { applySimInput } = await import('../../src/main/sim_input');
    const { advanceAccumulator } = await import('../../src/main/fixed_timestep');
    const { ensureLevelSystemsForLevel, ensureSlingableSystems } = await import('../../src/level_systems_loader');
    const { onPlayerLoaded } = await import('../../src/player_loader');
    const playerModule = await import('../../src/player_loader');
    const { playerState, setGameStarted } = await import('../../src/game_config');
    // Namespace import: `game` is a live `export let` binding installed by composeGameContext.
    const runtime = await import('../../src/game_runtime');
    const { ghostRunRecorder, toStored } = await import('../../src/ghost_run');
    const { getJourneyLayout } = await import('../../src/journey_layout');

    await composeGameContext({ headless: true });
    const game = runtime.game;
    await new Promise<void>((resolve) => onPlayerLoaded(() => resolve()));

    // Fresh in-memory save: unlock the requested chapter, and preload every
    // chapter chunk so level transitions start synchronously on a fixed step.
    // (Endless fixtures start at chapter 101+, past the six campaign chapters.)
    for (let level = 1; level <= Math.min(options.chapter, 6); level++) game.saveManager.unlockLevel(level);
    for (let level = options.chapter; level <= 6; level++) await ensureLevelSystemsForLevel(level);
    await ensureSlingableSystems();

    // A run is lost at 0 health. Checked directly rather than by hooking
    // handleGameOver: the obstacle system holds its own reference to it, and
    // a few hazard paths (void-root bleed, magma globs) reach 0 without
    // calling it at all.
    let gameOver = false;

    await startRun(options.seed, options.chapter, { loadGhost: false, layout: options.layout });
    // Endless chapters come from the seed, so their chunks can only be
    // preloaded once startRun has installed the run's layout.
    const layout = getJourneyLayout();
    if (layout.mode === 'endless') {
        let level: number | null = layout.firstChapter;
        const preload = options.endlessPreload ?? ENDLESS_PRELOAD_CHAPTERS;
        for (let i = 0; i < preload && level !== null; i++) {
            await ensureLevelSystemsForLevel(level);
            level = layout.next(level);
        }
    }
    setGameStarted(true);

    const player = playerModule.player;
    if (!player) throw new Error('[replay] player failed to load');

    const handles: HeadlessHandles = {
        get step() { return step; },
        get level() { return game.levelManager.currentLevel; },
        get playerX() { return player.position.x; },
        get playerY() { return player.position.y; },
        get obstacles() {
            const threats = game.obstacleSystem.getObstacles().map((o) => ({
                x: o.position.x,
                y: o.position.y,
                radius: (o.userData.radius as number | undefined) ?? 1
            }));
            for (const squid of game.obstacleSystem.getSquids()) {
                const p = squid.getPosition();
                threats.push({ x: p.x, y: p.y, radius: squid.getRadius() });
            }
            return threats;
        }
    };

    let step = 0;
    let stopped = false;
    const checkpoints: ReplayCheckpoint[] = [];
    const runOneStep = (): void => {
        if (options.keepAlive) playerState.health = playerState.maxHealth;
        applySimInput(options.inputFor(step, handles));
        stepSimulation();
        step++;
        if (step % CHECKPOINT_INTERVAL === 0) {
            checkpoints.push([
                step,
                round(player.position.x),
                round(player.position.y),
                playerState.health,
                game.hudManager.getScore()
            ]);
        }
        if (playerState.health <= 0 && !options.keepAlive) gameOver = true;
        if (options.stopWhen?.(handles)) stopped = true;
    };
    const done = (): boolean => step >= options.steps || gameOver || stopped;

    if (options.frameHz) {
        const frameDelta = 1 / options.frameHz;
        let accumulator = 0;
        while (!done()) {
            const { steps, remainder } = advanceAccumulator(accumulator, frameDelta);
            accumulator = remainder;
            for (let i = 0; i < steps && !done(); i++) runOneStep();
        }
    } else {
        while (!done()) runOneStep();
    }

    const boss = game.bossManager.getBoss();
    const bossPhase = (boss as { phase?: string } | null)?.phase;
    const snapshot: ReplaySnapshot = {
        steps: step,
        x: player.position.x,
        y: player.position.y,
        health: playerState.health,
        cores: playerState.cores,
        grenadeAmmo: game.grenadeAmmo,
        score: game.hudManager.getScore(),
        level: game.levelManager.currentLevel,
        objectivesCompleted: [...game.completedChaptersThisRun].sort((a, b) => a - b),
        bossSpawned: boss !== null,
        bossHealth: boss ? boss.health : null,
        bossDefeated: boss ? (bossPhase === 'defeated' || boss.health <= 0) : false,
        hasWon: playerState.hasWon,
        gameOver
    };

    const recorded = ghostRunRecorder.stop();
    return { snapshot, checkpoints, recording: recorded ? toStored(recorded) : null };
}
