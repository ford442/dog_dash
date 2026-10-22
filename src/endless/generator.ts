/**
 * Endless Dash chapter generator: a run seed in, an endless sequence of
 * `ChapterRecipe`s and their `LevelConfig`s out.
 *
 * Deterministic and prefix-stable. Chapter n draws only from its own named
 * substreams of the seed (`chapter:n`, `layout:n`), and the solver state it
 * reads (previous biome / traversal / boss) comes from chapters 1..n-1, so
 * asking for 5 chapters or 50 yields the same first 5 on every machine.
 * The generator never touches the gameplay run streams in run_context.
 *
 * Constraint solver (hand-rolled, see the issue: no CSP library):
 *   - roles: backdrop (+0–2 layers), traversal, hazard, 1–3 flavor, optional boss;
 *   - scenery and hazards keep their biome affinity, traversal verbs travel;
 *   - layers and flavor share a palette tag with the backdrop;
 *   - traversal must be taught (catalog.isTraversalTaught);
 *   - decoration instances ≤ the biome's campaign worst case (manifest budgets);
 *   - summed difficultyWeight ≤ a budget that ramps with the chapter number;
 *   - a boss gate every 2–3 chapters, reusing Zephyr / Star-Eater / Kraken.
 * Required slots are solved by a small depth-first search over shuffled
 * candidates, so a cheap pick early never strands a later slot.
 */
import { ENV_SYSTEM_DESCRIPTORS, type Biome, type EnvDescriptorKey, type EnvRole } from '../env_system_descriptors';
import type { BossEncounterKind, LevelConfig } from '../level_config';
import { LEVEL_CONFIG } from '../level_config';
import type { ChapterSpan } from '../journey_layout';
import { SeededRng } from '../run_seed/rng';
import {
    BIOMES,
    BIOME_INSTANCE_CAP,
    BIOME_TWINS,
    descriptorsForRole,
    isTraversalTaught,
    manifestInstances
} from './catalog';
import {
    BOSS_KINDS,
    ENDLESS_BASE_KEYS,
    RECIPE_LIMITS,
    requirementMet,
    sharesPalette,
    type ChapterRecipe
} from './recipe';
import { RECIPE_PATCHES } from './patches';
import { ENDLESS_LEVEL_BASE } from './constants';

export { ENDLESS_LEVEL_BASE };

const DIFFICULTY_RAMP_START = 8;
const DIFFICULTY_RAMP_MAX = 18;
const BOSS_WEIGHT = ENV_SYSTEM_DESCRIPTORS.boss.difficultyWeight;

/** Difficulty budget of chapter `ordinal` (1-based): ramps up, plus room for a boss gate. */
export function difficultyBudgetFor(ordinal: number, boss: boolean): number {
    return Math.min(DIFFICULTY_RAMP_MAX, DIFFICULTY_RAMP_START + ordinal) + (boss ? BOSS_WEIGHT : 0);
}

const BIOME_TITLES: Record<Biome, string> = {
    candy: 'Candy Belt',
    nebula: 'Nebula Drift',
    industrial: 'Rust Works',
    biological: 'Living Deep',
    crystalline: 'Crystal Expanse'
};

export type EndlessChapter = {
    /** 1-based position in the run. */
    ordinal: number;
    levelIndex: number;
    /** Campaign chapter the sky, foliage and music are borrowed from. */
    twinChapter: number;
    recipe: ChapterRecipe;
    config: LevelConfig;
    span: ChapterSpan;
};

type Draft = { keys: Set<EnvDescriptorKey>; instances: number; difficulty: number };

function draftWith(draft: Draft, key: EnvDescriptorKey): Draft {
    if (draft.keys.has(key)) return draft;
    const keys = new Set(draft.keys);
    keys.add(key);
    return {
        keys,
        instances: draft.instances + manifestInstances(key),
        difficulty: draft.difficulty + ENV_SYSTEM_DESCRIPTORS[key].difficultyWeight
    };
}

function shuffled<T>(items: readonly T[], rng: SeededRng): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function pick<T>(items: readonly T[], rng: SeededRng): T {
    return items[Math.floor(rng.random() * items.length)];
}

function keysFor(role: EnvRole, filter: (key: EnvDescriptorKey) => boolean): EnvDescriptorKey[] {
    return descriptorsForRole(role).map((d) => d.key).filter(filter);
}

const inBiome = (biome: Biome) => (key: EnvDescriptorKey) => ENV_SYSTEM_DESCRIPTORS[key].biomes.includes(biome);

const TAUGHT_TRAVERSALS = keysFor('traversal', (key) => isTraversalTaught(ENV_SYSTEM_DESCRIPTORS[key]));

type SolverState = {
    previousBiome: Biome | null;
    previousTraversal: EnvDescriptorKey | null;
    previousBossKind: BossEncounterKind | null;
    nextBossAt: number;
    nextStartX: number;
};

export class EndlessSequence {
    readonly seed: number;
    private readonly root: SeededRng;
    private readonly chapters: EndlessChapter[] = [];
    private readonly state: SolverState;

    constructor(seed: number) {
        this.seed = seed >>> 0;
        // `fork` hashes the parent's state without advancing it, so every
        // named substream below is a pure function of the seed.
        this.root = new SeededRng(this.seed, 'endless');
        this.state = {
            previousBiome: null,
            previousTraversal: null,
            previousBossKind: null,
            nextBossAt: 2 + Math.floor(this.root.fork('boss-cadence').random() * 2),
            nextStartX: 0
        };
    }

    /** Chapter `ordinal` (1-based), generating any missing chapters before it. */
    chapter(ordinal: number): EndlessChapter {
        if (!Number.isInteger(ordinal) || ordinal < 1) throw new RangeError(`[endless] bad chapter ordinal ${ordinal}`);
        while (this.chapters.length < ordinal) this.chapters.push(this.generate(this.chapters.length + 1));
        return this.chapters[ordinal - 1];
    }

    /** The first `count` chapters. */
    first(count: number): EndlessChapter[] {
        if (count > 0) this.chapter(count);
        return this.chapters.slice(0, count);
    }

    private generate(ordinal: number): EndlessChapter {
        const rng = this.root.fork(`chapter:${ordinal}`);
        const state = this.state;

        const biome = pick(BIOMES.filter((b) => b !== state.previousBiome), rng);
        const twinChapter = pick(BIOME_TWINS[biome], rng);
        const bossDue = ordinal >= state.nextBossAt;
        const bossKind = bossDue ? pick(BOSS_KINDS.filter((k) => k !== state.previousBossKind), rng) : undefined;
        const distance = bossDue
            ? 1100 + Math.round(rng.random() * 20) * 10
            : 700 + Math.round(rng.random() * 40) * 10;
        const difficultyBudget = difficultyBudgetFor(ordinal, bossDue);

        const recipe = solveRecipe({ ordinal, biome, bossKind, distance, difficultyBudget, previousTraversal: state.previousTraversal }, rng);

        const span: ChapterSpan = { startX: state.nextStartX, endX: state.nextStartX + distance, length: distance };
        const config = buildChapterConfig(recipe, {
            ordinal,
            span,
            twin: LEVEL_CONFIG[twinChapter],
            rng: this.root.fork(`layout:${ordinal}`),
            objectiveRoll: rng.random()
        });

        state.previousBiome = biome;
        state.previousTraversal = recipe.traversal;
        state.nextStartX = span.endX;
        if (bossKind) {
            state.previousBossKind = bossKind;
            state.nextBossAt = ordinal + 2 + Math.floor(rng.random() * 2);
        }
        return { ordinal, levelIndex: ENDLESS_LEVEL_BASE + ordinal, twinChapter, recipe, config, span };
    }
}

type SolveInput = {
    ordinal: number;
    biome: Biome;
    bossKind?: BossEncounterKind;
    distance: number;
    difficultyBudget: number;
    previousTraversal: EnvDescriptorKey | null;
};

/** Fill the recipe roles for one chapter. Throws only if the descriptor tables make a biome unsolvable. */
export function solveRecipe(input: SolveInput, rng: SeededRng): ChapterRecipe {
    const { biome, difficultyBudget } = input;
    const cap = BIOME_INSTANCE_CAP[biome];
    const fits = (draft: Draft) => draft.instances <= cap && draft.difficulty <= difficultyBudget;

    let base: Draft = { keys: new Set(), instances: 0, difficulty: 0 };
    for (const key of ENDLESS_BASE_KEYS) base = draftWith(base, key);
    if (input.bossKind) base = draftWith(base, 'boss');

    // Shuffle every pool once up front so the number of draws never depends on backtracking.
    // Repeating last chapter's verb is allowed, but only as a last resort.
    const traversals = shuffled(TAUGHT_TRAVERSALS, rng).sort(
        (a, b) => Number(a === input.previousTraversal) - Number(b === input.previousTraversal)
    );
    const hazards = shuffled(keysFor('hazard', inBiome(biome)), rng);
    const backdrops = shuffled(keysFor('backdrop', inBiome(biome)), rng);
    const flavors = shuffled(keysFor('flavor', inBiome(biome)), rng);
    const layerCount = Math.floor(rng.random() * (RECIPE_LIMITS.maxLayers + 1));
    const flavorCount = RECIPE_LIMITS.minFlavor + Math.floor(rng.random() * (RECIPE_LIMITS.maxFlavor - RECIPE_LIMITS.minFlavor + 1));

    const flavorOk = (key: EnvDescriptorKey, backdrop: EnvDescriptorKey, draft: Draft) =>
        !draft.keys.has(key) && sharesPalette(key, backdrop) && requirementMet(key, draft.keys);

    // Depth-first over the required slots: traversal → hazard → backdrop → first flavor.
    type Required = { traversal: EnvDescriptorKey; hazard: EnvDescriptorKey; backdrop: EnvDescriptorKey; flavor: EnvDescriptorKey; draft: Draft };
    let solved: Required | null = null;
    search:
    for (const traversal of traversals) {
        const d1 = draftWith(base, traversal);
        if (!fits(d1)) continue;
        for (const hazard of hazards) {
            const d2 = draftWith(d1, hazard);
            if (!fits(d2)) continue;
            for (const backdrop of backdrops) {
                if (d2.keys.has(backdrop)) continue;
                const d3 = draftWith(d2, backdrop);
                if (!fits(d3)) continue;
                for (const flavor of flavors) {
                    if (!flavorOk(flavor, backdrop, d3)) continue;
                    const d4 = draftWith(d3, flavor);
                    if (!fits(d4)) continue;
                    solved = { traversal, hazard, backdrop, flavor, draft: d4 };
                    break search;
                }
            }
        }
    }
    if (!solved) throw new Error(`[endless] no valid ${biome} chapter within budget ${difficultyBudget}`);

    // Optional slots, greedily, while they still fit.
    let draft = solved.draft;
    const layers: EnvDescriptorKey[] = [];
    for (const layer of backdrops) {
        if (layers.length >= layerCount) break;
        if (draft.keys.has(layer) || !sharesPalette(layer, solved.backdrop)) continue;
        const next = draftWith(draft, layer);
        if (!fits(next)) continue;
        layers.push(layer);
        draft = next;
    }
    const flavor = [solved.flavor];
    for (const extra of flavors) {
        if (flavor.length >= flavorCount) break;
        if (!flavorOk(extra, solved.backdrop, draft)) continue;
        const next = draftWith(draft, extra);
        if (!fits(next)) continue;
        flavor.push(extra);
        draft = next;
    }

    return {
        biome,
        backdrop: solved.backdrop,
        layers,
        traversal: solved.traversal,
        hazard: solved.hazard,
        flavor,
        ...(input.bossKind ? { boss: 'boss' as const, bossKind: input.bossKind } : {}),
        distance: input.distance,
        difficultyBudget
    };
}

type BuildContext = {
    ordinal: number;
    span: ChapterSpan;
    twin: LevelConfig;
    rng: SeededRng;
    /** 0–1 roll for the objective when neither traversal nor boss decides it. */
    objectiveRoll: number;
};

/**
 * Base config from the twin: sky, foliage mix, speed and creature rates.
 * Every system switch (env flags, hazard densities, placements, objective)
 * is left off so the recipe alone decides what runs.
 */
export function baseConfig(twin: LevelConfig, name: string, span: ChapterSpan): LevelConfig {
    return {
        name,
        // HUD "distance to go" counts down to the end of this chapter.
        distance: span.endX,
        foliageDensity: { ...twin.foliageDensity, liquidMetal: 0 },
        speed: twin.speed,
        bgColor: twin.bgColor,
        skyColors: { ...twin.skyColors },
        levelType: 'open',
        fogDensity: twin.fogDensity,
        squidSpawnRate: twin.squidSpawnRate,
        crystalTarsierRate: twin.crystalTarsierRate,
        geodeTitanRate: twin.geodeTitanRate,
        moonSnailRate: twin.moonSnailRate,
        cosmicOtterRate: twin.cosmicOtterRate,
        astroPenguinRate: twin.astroPenguinRate,
        stellarSealPupRate: twin.stellarSealPupRate,
        astroBunnyRate: twin.astroBunnyRate,
        lunarLemurRate: twin.lunarLemurRate,
        pinwheelDensity: twin.pinwheelDensity,
        windChimeDensity: twin.windChimeDensity,
        gummyRingDensity: twin.gummyRingDensity,
        candyAsteroidChance: twin.candyAsteroidChance,
        mineRobotRate: twin.mineRobotRate,
        barnaclePodRate: twin.barnaclePodRate,
        enemyTintColor: twin.enemyTintColor,
        vignettes: twin.vignettes ? { ...twin.vignettes } : undefined,
        environments: {}
    };
}

const GATE_TITLES: Record<BossEncounterKind, string> = {
    zephyr: 'Zephyr Gate',
    starEater: 'Star-Eater Gate',
    kraken: 'Kraken Gate'
};

function chapterName(recipe: ChapterRecipe): string {
    const place = BIOME_TITLES[recipe.biome];
    if (recipe.bossKind) return `${place} · ${GATE_TITLES[recipe.bossKind]}`;
    return `${place} · ${ENV_SYSTEM_DESCRIPTORS[recipe.traversal].label}`;
}

/** Recipe → playable `LevelConfig` through the per-system patch table. */
export function buildChapterConfig(recipe: ChapterRecipe, ctx: BuildContext): LevelConfig {
    const cfg = baseConfig(ctx.twin, chapterName(recipe), ctx.span);
    const patchCtx = { recipe, span: ctx.span, twin: ctx.twin, ordinal: ctx.ordinal, rng: ctx.rng };
    // Scenery first, then verbs and threats, so patches that read the config see the backdrop.
    const order = [recipe.backdrop, ...recipe.layers, ...ENDLESS_BASE_KEYS, recipe.hazard, recipe.traversal, ...recipe.flavor];
    if (recipe.boss) order.push(recipe.boss);
    for (const key of new Set(order)) RECIPE_PATCHES[key](cfg, patchCtx);

    if (!cfg.objective) {
        if (recipe.traversal === 'slingables') {
            cfg.objective = { type: 'sling', target: 3, description: 'Complete 3 clean gravity slings' };
        } else if (recipe.traversal === 'comboCorridor') {
            cfg.objective = { type: 'combo', target: 5, description: 'Reach a 5x sling combo' };
        } else if (ctx.objectiveRoll < 0.5) {
            cfg.objective = { type: 'scan', target: 4, description: 'Catalog 4 alien plants' };
        } else {
            cfg.objective = { type: 'survive', target: 1, description: `Cross the ${BIOME_TITLES[recipe.biome]}` };
        }
    }
    return cfg;
}
