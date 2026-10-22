/**
 * Endless Dash coverage smoke: flies a fixed journey whose chapters switch on
 * every env-system descriptor key, then each boss gate (Kraken, Zephyr,
 * Star-Eater), through the real composition root and `stepSimulation`.
 *
 * The campaign never turns on several systems Endless can (grapple isles,
 * day/night cycle, pastel nebula, wish lanterns, ...), so their activate /
 * update / level-start cleanup paths only run here. Any exception fails the
 * process. Not a replay: health is refilled every step, so only "it ran" and
 * "it reached every chapter" mean anything.
 *
 * Afterwards it checks what an Endless run must persist (resources, bestiary,
 * Endless records) and must not (campaign chapter unlocks).
 *
 *   node --import tsx tests/replay/endless_smoke.ts
 *
 * Prints one JSON line (EndlessSmokeResult) as the last stdout line.
 */
import { installHeadlessEnv } from './headless_env';
import { runReplay } from './headless_sim';
import type { EnvDescriptorKey } from '../../src/env_system_descriptors';
import type { EndlessChapter } from '../../src/endless/generator';
import type { ChapterRecipe } from '../../src/endless/recipe';
import type { BossEncounterKind } from '../../src/level_config';

export interface EndlessSmokeResult {
    chapters: number;
    lastLevelReached: number;
    steps: number;
    /** Descriptor keys some chapter of the journey had switched on. */
    keysEnabled: string[];
    keysTotal: number;
    bossesSpawned: string[];
    krakenGateSpawned: boolean;
    persistence: {
        unlockedLevels: number[];
        materialPersisted: boolean;
        catalogedFromPlay: string[];
        endlessRuns: number;
        endlessBestChapter: number;
        lastRunCampaignId: string | null;
    };
}

/** Coverage chapters fly fast: only "every system ran" matters here. */
const SMOKE_SPEED = 30;
const SYSTEM_CHAPTER_LENGTH = 150;
const BOSS_CHAPTER_LENGTH = 300;
/** Steps a spawned boss is left to run before the smoke clears it for the next gate. */
const BOSS_RUN_STEPS = 120;

installHeadlessEnv();
const { ENV_SYSTEM_DESCRIPTORS } = await import('../../src/env_system_descriptors');
const { descriptorsForRole, isSystemEnabledIn } = await import('../../src/endless/catalog');
const { buildChapterConfig } = await import('../../src/endless/generator');
const { ENDLESS_LEVEL_BASE } = await import('../../src/endless/constants');
const { fixedChapterSource, layoutFromSource } = await import('../../src/endless/layout');
const { endlessRunSeed } = await import('../../src/endless/seed');
const { SeededRng } = await import('../../src/run_seed/rng');
const { LEVEL_CONFIG } = await import('../../src/level_config');
const { parseRunSeed } = await import('../../src/run_seed');
const runtime = await import('../../src/game_runtime');
const { playerState } = await import('../../src/game_config');

const SEED = 0xd06d5e0e;

function coverageRecipes(): ChapterRecipe[] {
    const keys = (role: Parameters<typeof descriptorsForRole>[0]) => descriptorsForRole(role).map((d) => d.key);
    const backdrops = keys('backdrop');
    const traversals = keys('traversal');
    const hazards = keys('hazard');
    const flavors = keys('flavor');
    const count = Math.max(Math.ceil(backdrops.length / 3), traversals.length, hazards.length, Math.ceil(flavors.length / 3));
    const recipes: ChapterRecipe[] = [];
    for (let i = 0; i < count; i++) {
        const backdrop = backdrops[(3 * i) % backdrops.length];
        const layers = [backdrops[(3 * i + 1) % backdrops.length], backdrops[(3 * i + 2) % backdrops.length]]
            .filter((k) => k !== backdrop);
        const flavor = [0, 1, 2].map((j) => flavors[(3 * i + j) % flavors.length]);
        // Koi only spawn beside a biological / nebula / aquatic backdrop.
        if (flavor.includes('starlightKoi')) layers.push('nebula');
        recipes.push({
            biome: ENV_SYSTEM_DESCRIPTORS[backdrop].biomes[0],
            backdrop,
            layers: [...new Set(layers)],
            traversal: traversals[i % traversals.length],
            hazard: hazards[i % hazards.length],
            flavor: [...new Set(flavor)],
            distance: SYSTEM_CHAPTER_LENGTH,
            difficultyBudget: 99
        });
    }
    const bossKinds: BossEncounterKind[] = ['kraken', 'zephyr', 'starEater'];
    for (const bossKind of bossKinds) {
        recipes.push({
            biome: 'nebula',
            backdrop: 'dynamicStarfield',
            layers: [],
            traversal: 'airTokens',
            hazard: 'lightning',
            flavor: ['butterflySwarm'],
            boss: 'boss',
            bossKind,
            distance: BOSS_CHAPTER_LENGTH,
            difficultyBudget: 99
        });
    }
    return recipes;
}

function coverageChapters(): EndlessChapter[] {
    const chapters: EndlessChapter[] = [];
    let startX = 0;
    coverageRecipes().forEach((recipe, i) => {
        const ordinal = i + 1;
        const twinChapter = (i % 6) + 1;
        const span = { startX, endX: startX + recipe.distance, length: recipe.distance };
        const config = buildChapterConfig(recipe, {
            ordinal,
            span,
            twin: LEVEL_CONFIG[twinChapter],
            rng: new SeededRng(SEED + ordinal, 'smoke'),
            objectiveRoll: 0.75
        });
        config.speed = SMOKE_SPEED;
        chapters.push({ ordinal, levelIndex: ENDLESS_LEVEL_BASE + ordinal, twinChapter, recipe, config, span });
        startX = span.endX;
    });
    return chapters;
}

const chapters = coverageChapters();
const lastChapter = chapters[chapters.length - 1];
const keysEnabled = new Set<EnvDescriptorKey>();
for (const chapter of chapters) {
    for (const key of Object.keys(ENV_SYSTEM_DESCRIPTORS) as EnvDescriptorKey[]) {
        if (isSystemEnabledIn(key, chapter.config)) keysEnabled.add(key);
    }
}

const bossesSpawned: string[] = [];
const seenBosses = new Set<object>();
let bossSpawnedAt = 0;
let krakenGateSpawned = false;

const result = await runReplay({
    seed: endlessRunSeed(SEED),
    chapter: ENDLESS_LEVEL_BASE + 1,
    steps: 40000,
    layout: layoutFromSource(fixedChapterSource(chapters)),
    endlessPreload: chapters.length,
    keepAlive: true,
    inputFor: (step) => {
        const game = runtime.game;
        // Bosses slow the scroll to a crawl until beaten; this run only needs
        // each gate to spawn and update, so give it a moment, then clear it.
        const boss = game.bossManager.getBoss();
        if (boss && !seenBosses.has(boss)) {
            seenBosses.add(boss);
            bossesSpawned.push(boss.constructor.name);
            bossSpawnedAt = step;
        }
        if (boss?.isActive && step - bossSpawnedAt > BOSS_RUN_STEPS) {
            boss.destroy();
            playerState.bossActive = false;
        }
        if (game.obstacleSystem.getKrakenGateSquid()) krakenGateSpawned = true;
        const cfg = game.levelManager.config[game.levelManager.currentLevel];
        if (cfg) playerState.autoScrollSpeed = cfg.speed;
        return step % 10 === 0 ? 1 << 4 : 0; // fire on a cadence
    },
    stopWhen: (sim) => sim.level === lastChapter.levelIndex && sim.playerX >= lastChapter.span.endX - 20
});

// --- What an Endless run must persist -----------------------------------
const game = runtime.game;
game.resourceHarvester.grant('luminousDust', 2, 'scan');
game.creatureCatalogManager.catalog('kraken');
const { handleGameOver } = await import('../../src/main/obstacle_setup');
handleGameOver();

const { SaveManager } = await import('../../src/save_manager');
const reloaded = new SaveManager();
const lastRun = reloaded.getLastRun();
const endless = reloaded.getEndlessRecords();
const output: EndlessSmokeResult = {
    chapters: chapters.length,
    lastLevelReached: result.snapshot.level,
    steps: result.snapshot.steps,
    keysEnabled: [...keysEnabled].sort(),
    keysTotal: Object.keys(ENV_SYSTEM_DESCRIPTORS).length,
    bossesSpawned,
    krakenGateSpawned,
    persistence: {
        unlockedLevels: reloaded.getUnlockedLevels().sort((a, b) => a - b),
        materialPersisted: reloaded.getMaterialCount('luminousDust') >= 2,
        catalogedFromPlay: reloaded.getCatalogedCreatures().sort(),
        endlessRuns: endless.runs,
        endlessBestChapter: endless.bestChapter,
        lastRunCampaignId: lastRun ? parseRunSeed(lastRun.seed)?.campaignId ?? null : null
    }
};

process.stdout.write('\n' + JSON.stringify(output) + '\n', () => process.exit(0));
