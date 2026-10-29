import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessSequence, difficultyBudgetFor, solveRecipe, type EndlessChapter } from '../../src/endless/generator.ts';
import {
    BOSS_KINDS,
    RECIPE_LIMITS,
    recipeDifficulty,
    recipeInstances,
    recipeKeys,
    sharesPalette,
    validateChapterRecipe,
    type ChapterRecipe
} from '../../src/endless/recipe.ts';
import {
    BIOMES,
    BIOME_INSTANCE_CAP,
    configManifestInstances,
    descriptorsForRole,
    isSystemEnabledIn,
    isTraversalTaught,
    manifestInstances
} from '../../src/endless/catalog.ts';
import { ENV_SYSTEM_DESCRIPTORS, type EnvDescriptorKey } from '../../src/env_system_descriptors.ts';
import { LEVEL_CONFIG } from '../../src/level_config.ts';
import { SeededRng } from '../../src/run_seed/rng.ts';

const ALL_KEYS = Object.keys(ENV_SYSTEM_DESCRIPTORS) as EnvDescriptorKey[];
/** Seeds that tend to break bit-twiddling PRNG code, plus a spread of hashed ones. */
const HOSTILE_SEEDS = [0, 1, 2, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff, 0xdeadbeef, 0xd06de001];
const SPREAD_SEEDS = Array.from({ length: 400 }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0);
const CHAPTERS_PER_SEED = 15;

function summary(chapters: EndlessChapter[]): string[] {
    return chapters.map((c) => {
        const r = c.recipe;
        return [r.biome, r.backdrop, r.traversal, r.hazard, r.bossKind ?? '-', r.distance].join(' ');
    });
}

/** An RNG stuck at one value: the solver's worst case for picks and shuffles. */
class StuckRng extends SeededRng {
    private readonly value: number;
    constructor(value: number) {
        super(1, 'stuck');
        this.value = value;
    }
    override random(): number {
        return this.value;
    }
}

test('a seed produces the same chapters on every run (and machine)', () => {
    const a = new EndlessSequence(0x5eed).first(20);
    const b = new EndlessSequence(0x5eed).first(20);
    assert.deepEqual(a, b);
    assert.notDeepEqual(summary(new EndlessSequence(0x5eee).first(20)), summary(a));
});

test('generation is prefix-stable: chapter N does not depend on how far ahead was generated', () => {
    const long = new EndlessSequence(77).first(25);
    const short = new EndlessSequence(77).first(6);
    assert.deepEqual(short, long.slice(0, 6));
    assert.deepEqual(new EndlessSequence(77).chapter(11), long[10]);
});

test('generation never touches Math.random', () => {
    const real = Math.random;
    Math.random = () => {
        throw new Error('Math.random called by the Endless generator');
    };
    try {
        new EndlessSequence(0xabc).first(30);
    } finally {
        Math.random = real;
    }
});

// A cross-machine fingerprint: a different result here means shared seeds
// now produce different chapters. If that is intentional (descriptor or
// generator change), update the list and say so in the PR — old links break.
test('golden chapter sequence for seed 0xd06de002', () => {
    assert.deepEqual(summary(new EndlessSequence(0xd06de002).first(8)), [
        'crystalline nebulaRibbons airTokens asteroidField - 1090',
        'biological fossilizedSpaceWhales timeShiftZones lightning starEater 1120',
        'industrial hyperspaceTunnel windCurrents industrialGeometry - 990',
        'biological nebula airTokens asteroidField - 850',
        'industrial dynamicStarfield comboCorridor stormGeode kraken 1260',
        'crystalline galacticCore windCurrents asteroidField - 750',
        'biological godRays airTokens lightning zephyr 1200',
        'industrial industrial gravLens asteroidField - 790'
    ]);
});

test('hostile seeds: every generated chapter is valid and inside its biome decoration budget', () => {
    for (const seed of [...HOSTILE_SEEDS, ...SPREAD_SEEDS]) {
        for (const ch of new EndlessSequence(seed).first(CHAPTERS_PER_SEED)) {
            const r = ch.recipe;
            const cap = BIOME_INSTANCE_CAP[r.biome];
            const where = `seed ${seed} chapter ${ch.ordinal} (${r.biome})`;
            const v = validateChapterRecipe(r);
            assert.ok(v.ok, `${where}: ${v.ok ? '' : v.errors.join('; ')}`);
            assert.ok(recipeInstances(r) <= cap, `${where}: recipe ${recipeInstances(r)} > cap ${cap}`);
            // What the built config actually switches on, not just what the recipe says.
            const built = configManifestInstances(ch.config);
            assert.ok(built <= cap, `${where}: config enables ${built} instances > cap ${cap}`);
            assert.ok(recipeDifficulty(r) <= r.difficultyBudget, `${where}: difficulty over budget`);
        }
    }
});

test('hostile RNGs: the solver stays in budget when every roll is 0 or ~1', () => {
    const traversals: (EnvDescriptorKey | null)[] = [null, ...descriptorsForRole('traversal').map((d) => d.key)];
    for (const value of [0, 0.999999]) {
        for (const biome of BIOMES) {
            for (const bossKind of [undefined, ...BOSS_KINDS]) {
                for (const ordinal of [1, 50]) {
                    for (const previousTraversal of traversals) {
                        const recipe = solveRecipe({
                            ordinal,
                            biome,
                            bossKind,
                            distance: 900,
                            difficultyBudget: difficultyBudgetFor(ordinal, bossKind !== undefined),
                            previousTraversal
                        }, new StuckRng(value));
                        const v = validateChapterRecipe(recipe);
                        assert.ok(v.ok, `${biome}/${bossKind ?? 'no boss'}/rng ${value}: ${v.ok ? '' : v.errors.join('; ')}`);
                    }
                }
            }
        }
    }
});

test('a hand-built recipe over the decoration budget is rejected', () => {
    const biome = 'candy';
    const heaviest = (role: 'backdrop' | 'flavor') => descriptorsForRole(role)
        .filter((d) => d.biomes.includes(biome))
        .map((d) => d.key)
        .sort((a, b) => manifestInstances(b) - manifestInstances(a));
    const backdrops = heaviest('backdrop');
    const recipe: ChapterRecipe = {
        biome,
        backdrop: backdrops[0],
        layers: backdrops.slice(1, 1 + RECIPE_LIMITS.maxLayers),
        traversal: descriptorsForRole('traversal').find((d) => isTraversalTaught(d))!.key,
        hazard: descriptorsForRole('hazard').find((d) => d.biomes.includes(biome))!.key,
        flavor: heaviest('flavor').slice(0, RECIPE_LIMITS.maxFlavor),
        distance: 900,
        difficultyBudget: RECIPE_LIMITS.maxDifficultyBudget
    };
    assert.ok(recipeInstances(recipe) > BIOME_INSTANCE_CAP[biome], 'test recipe must actually be over the cap');
    const v = validateChapterRecipe(recipe);
    assert.equal(v.ok, false);
    assert.ok(!v.ok && v.errors.some((e) => e.includes('decoration instances exceed')), JSON.stringify(v));
});

test('every descriptor key can fill a recipe role, and the generator uses all of them', () => {
    const roles = ['backdrop', 'traversal', 'hazard', 'flavor', 'boss'] as const;
    const byRole = new Set(roles.flatMap((role) => descriptorsForRole(role).map((d) => d.key)));
    assert.deepEqual([...byRole].sort(), [...ALL_KEYS].sort(), 'a descriptor has a role the recipe does not know');

    const used = new Set<EnvDescriptorKey>(['magicPaintbrush']); // always loaded, never a pick
    for (const seed of SPREAD_SEEDS.slice(0, 300)) {
        for (const ch of new EndlessSequence(seed).first(12)) recipeKeys(ch.recipe).forEach((k) => used.add(k));
    }
    const missing = ALL_KEYS.filter((k) => !used.has(k));
    assert.deepEqual(missing, [], `never generated: ${missing.join(', ')}`);
});

test('a built chapter config enables exactly the recipe systems', () => {
    for (const seed of SPREAD_SEEDS.slice(0, 60)) {
        for (const ch of new EndlessSequence(seed).first(10)) {
            const want = new Set([...recipeKeys(ch.recipe), 'magicPaintbrush']);
            const got = ALL_KEYS.filter((k) => isSystemEnabledIn(k, ch.config));
            assert.deepEqual(got.sort(), [...want].sort(), `seed ${seed} chapter ${ch.ordinal}`);
        }
    }
});

test('the campaign LEVEL_CONFIG is never mutated by generation', () => {
    const before = JSON.stringify(LEVEL_CONFIG);
    for (const seed of SPREAD_SEEDS.slice(0, 40)) new EndlessSequence(seed).first(10);
    assert.equal(JSON.stringify(LEVEL_CONFIG), before);
});

test('chapter spans tile the X journey with no gaps', () => {
    for (const seed of HOSTILE_SEEDS) {
        const chapters = new EndlessSequence(seed).first(CHAPTERS_PER_SEED);
        let x = 0;
        for (const ch of chapters) {
            assert.equal(ch.span.startX, x);
            assert.equal(ch.span.length, ch.recipe.distance);
            assert.equal(ch.span.endX, x + ch.recipe.distance);
            assert.equal(ch.config.distance, ch.span.endX);
            assert.equal(ch.levelIndex, 100 + ch.ordinal);
            assert.ok(ch.recipe.distance >= RECIPE_LIMITS.minDistance && ch.recipe.distance <= RECIPE_LIMITS.maxDistance);
            x = ch.span.endX;
        }
    }
});

test('boss gates every 2–3 chapters, reusing Zephyr / Star-Eater / Kraken without back-to-back repeats', () => {
    const kindsSeen = new Set<string>();
    for (const seed of [...HOSTILE_SEEDS, ...SPREAD_SEEDS.slice(0, 100)]) {
        const bosses = new EndlessSequence(seed).first(20).filter((c) => c.recipe.bossKind);
        assert.ok(bosses.length > 0);
        assert.ok([2, 3].includes(bosses[0].ordinal), `seed ${seed}: first boss at ${bosses[0].ordinal}`);
        for (let i = 1; i < bosses.length; i++) {
            const gap = bosses[i].ordinal - bosses[i - 1].ordinal;
            assert.ok(gap === 2 || gap === 3, `seed ${seed}: boss gap ${gap}`);
            assert.notEqual(bosses[i].recipe.bossKind, bosses[i - 1].recipe.bossKind);
        }
        for (const b of bosses) {
            kindsSeen.add(b.recipe.bossKind!);
            assert.equal(b.config.objective?.type, 'boss');
            assert.equal(b.config.bossEncounter?.kind, b.recipe.bossKind);
            const { startX, endX } = b.span;
            const triggerX = b.config.bossEncounter!.triggerX;
            assert.ok(triggerX > startX && triggerX < endX, `seed ${seed}: boss trigger outside its chapter`);
        }
    }
    assert.deepEqual([...kindsSeen].sort(), [...BOSS_KINDS].sort());
});

test('difficulty budget ramps with the chapter and is capped', () => {
    assert.ok(difficultyBudgetFor(1, false) < difficultyBudgetFor(8, false));
    assert.equal(difficultyBudgetFor(500, false), difficultyBudgetFor(1000, false));
    assert.ok(difficultyBudgetFor(500, true) <= RECIPE_LIMITS.maxDifficultyBudget);
});

test('validator rejects malformed and rule-breaking recipes', () => {
    const base = new EndlessSequence(0xd06de002).chapter(1).recipe;
    const errorsFor = (patch: Record<string, unknown>) => {
        const v = validateChapterRecipe({ ...base, ...patch });
        assert.equal(v.ok, false, `expected rejection of ${JSON.stringify(patch)}`);
        return v.ok ? [] : v.errors;
    };
    const has = (errors: string[], text: string) => assert.ok(errors.some((e) => e.includes(text)), errors.join('; '));

    assert.ok(validateChapterRecipe(base).ok);
    assert.equal(validateChapterRecipe(null).ok, false);
    assert.equal(validateChapterRecipe('nebula').ok, false);
    has(errorsFor({ backdrop: 'notASystem' }), 'backdrop is not a system key');
    has(errorsFor({ backdrop: base.hazard }), `is a hazard, not a backdrop`);
    has(errorsFor({ flavor: [base.flavor[0], base.flavor[0]] }), 'used twice');
    has(errorsFor({ flavor: [] }), 'at least');
    has(errorsFor({ layers: [base.backdrop, base.backdrop, base.backdrop] }), 'layers must be');
    has(errorsFor({ difficultyBudget: 1 }), 'exceeds budget');
    has(errorsFor({ distance: 50 }), 'distance must be');
    has(errorsFor({ boss: 'boss' }), 'boss and bossKind go together');
    has(errorsFor({ boss: 'boss', bossKind: 'dragon' }), 'unknown bossKind');
    has(errorsFor({ biome: 'lava' }), 'unknown biome');
});

test('validator rejects palette clashes and missing companions', () => {
    // A same-biome flavor whose palette shares nothing with the backdrop (e.g. pastel next to neon).
    let clash: { biome: (typeof BIOMES)[number]; backdrop: EnvDescriptorKey; flavor: EnvDescriptorKey } | null = null;
    for (const biome of BIOMES) {
        for (const b of descriptorsForRole('backdrop').filter((d) => d.biomes.includes(biome))) {
            const f = descriptorsForRole('flavor').find((d) => d.biomes.includes(biome) && !sharesPalette(d.key, b.key));
            if (f && !clash) clash = { biome, backdrop: b.key, flavor: f.key };
        }
    }
    assert.ok(clash, 'descriptor palettes never clash within a biome — palette rule is untestable');
    const recipe = {
        ...new EndlessSequence(3).chapter(1).recipe,
        biome: clash.biome,
        backdrop: clash.backdrop,
        layers: [],
        hazard: descriptorsForRole('hazard').find((d) => d.biomes.includes(clash!.biome))!.key,
        flavor: [clash.flavor]
    };
    const v = validateChapterRecipe(recipe);
    assert.ok(!v.ok && v.errors.some((e) => e.includes('palette clashes')), JSON.stringify(v));

    // starlightKoi only spawns next to biological / nebula / aquatic life.
    const koi = ENV_SYSTEM_DESCRIPTORS.starlightKoi;
    let checked = false;
    for (const seed of SPREAD_SEEDS) {
        for (const ch of new EndlessSequence(seed).first(10)) {
            const r = ch.recipe;
            const keys = recipeKeys(r);
            if (!koi.biomes.includes(r.biome) || !sharesPalette('starlightKoi', r.backdrop)) continue;
            if (keys.some((k) => k === 'biological' || k === 'nebula' || k === 'aquaticLife' || k === 'starlightKoi')) continue;
            const withKoi = validateChapterRecipe({ ...r, flavor: [r.flavor[0], 'starlightKoi'] });
            assert.ok(!withKoi.ok && withKoi.errors.some((e) => e.includes('starlightKoi needs')), JSON.stringify(withKoi));
            checked = true;
            break;
        }
        if (checked) break;
    }
    assert.ok(checked, 'found no chapter to test the starlightKoi companion rule against');
});

test('the generator only uses taught traversal verbs', () => {
    for (const seed of SPREAD_SEEDS.slice(0, 100)) {
        for (const ch of new EndlessSequence(seed).first(10)) {
            assert.ok(isTraversalTaught(ENV_SYSTEM_DESCRIPTORS[ch.recipe.traversal]), ch.recipe.traversal);
        }
    }
});
