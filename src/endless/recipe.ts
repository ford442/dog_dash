/**
 * `ChapterRecipe`: one generated Endless Dash chapter, as roles filled with
 * env-system descriptor keys. `validateChapterRecipe` checks an untrusted
 * recipe (pasted JSON, an Architect brush) against the same rules the
 * generator solves for, so a recipe is valid no matter where it came from.
 */
import { ENV_SYSTEM_DESCRIPTORS, type Biome, type EnvDescriptorKey, type EnvRole } from '../env_system_descriptors';
import type { BossEncounterKind } from '../level_config';
import { BIOMES, BIOME_INSTANCE_CAP, isTraversalTaught, manifestInstances } from './catalog';

export type ChapterRecipe = {
    biome: Biome;
    backdrop: EnvDescriptorKey;
    /** Extra backdrop-role layers behind `backdrop` (campaign chapters run 2–6 backdrop systems). */
    layers: EnvDescriptorKey[];
    traversal: EnvDescriptorKey;
    hazard: EnvDescriptorKey;
    flavor: EnvDescriptorKey[];
    boss?: EnvDescriptorKey;
    /** Which existing boss the gate reuses; set exactly when `boss` is. */
    bossKind?: BossEncounterKind;
    distance: number;
    /** Cap on the summed `difficultyWeight` of every system the chapter runs. */
    difficultyBudget: number;
};

export const RECIPE_LIMITS = {
    minDistance: 600,
    maxDistance: 1400,
    maxLayers: 2,
    minFlavor: 1,
    maxFlavor: 3,
    maxDifficultyBudget: 23
} as const;

export const BOSS_KINDS: readonly BossEncounterKind[] = ['zephyr', 'starEater', 'kraken'];

/** Every Endless chapter also runs the asteroid stream all six campaign chapters run. */
export const ENDLESS_BASE_KEYS: readonly EnvDescriptorKey[] = ['asteroidField'];

/** Flavor that only appears alongside one of these systems (see `shouldSpawnStarlightKoi`). */
export const RECIPE_REQUIRES_ANY: Partial<Record<EnvDescriptorKey, readonly EnvDescriptorKey[]>> = {
    starlightKoi: ['biological', 'nebula', 'aquaticLife']
};

/** Every system the chapter runs, base keys included, without duplicates. */
export function recipeKeys(recipe: ChapterRecipe): EnvDescriptorKey[] {
    const keys = [recipe.backdrop, ...recipe.layers, recipe.traversal, recipe.hazard, ...recipe.flavor, ...ENDLESS_BASE_KEYS];
    if (recipe.boss) keys.push(recipe.boss);
    return [...new Set(keys)];
}

export function recipeInstances(recipe: ChapterRecipe): number {
    return recipeKeys(recipe).reduce((sum, key) => sum + manifestInstances(key), 0);
}

export function recipeDifficulty(recipe: ChapterRecipe): number {
    return recipeKeys(recipe).reduce((sum, key) => sum + ENV_SYSTEM_DESCRIPTORS[key].difficultyWeight, 0);
}

export function sharesPalette(a: EnvDescriptorKey, b: EnvDescriptorKey): boolean {
    const tags = ENV_SYSTEM_DESCRIPTORS[b].paletteTags;
    return ENV_SYSTEM_DESCRIPTORS[a].paletteTags.some((t) => tags.includes(t));
}

export function requirementMet(key: EnvDescriptorKey, present: ReadonlySet<EnvDescriptorKey>): boolean {
    const anyOf = RECIPE_REQUIRES_ANY[key];
    return !anyOf || anyOf.some((k) => present.has(k));
}

export type RecipeValidation = { ok: true; recipe: ChapterRecipe } | { ok: false; errors: string[] };

function isKey(value: unknown): value is EnvDescriptorKey {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ENV_SYSTEM_DESCRIPTORS, value);
}

/** Structural and constraint check of an untrusted recipe. */
export function validateChapterRecipe(raw: unknown): RecipeValidation {
    const errors: string[] = [];
    if (!raw || typeof raw !== 'object') return { ok: false, errors: ['recipe is not an object'] };
    const r = raw as Record<string, unknown>;
    const keyList = (field: string, max: number): EnvDescriptorKey[] => {
        const value = r[field];
        if (!Array.isArray(value) || value.length > max || !value.every(isKey)) {
            errors.push(`${field} must be a list of at most ${max} system keys`);
            return [];
        }
        return value;
    };

    if (!BIOMES.includes(r.biome as Biome)) errors.push(`unknown biome ${String(r.biome)}`);
    for (const field of ['backdrop', 'traversal', 'hazard'] as const) {
        if (!isKey(r[field])) errors.push(`${field} is not a system key`);
    }
    const layers = keyList('layers', RECIPE_LIMITS.maxLayers);
    const flavor = keyList('flavor', RECIPE_LIMITS.maxFlavor);
    if (flavor.length < RECIPE_LIMITS.minFlavor) errors.push(`needs at least ${RECIPE_LIMITS.minFlavor} flavor system`);
    if ((r.boss === undefined) !== (r.bossKind === undefined)) errors.push('boss and bossKind go together');
    if (r.boss !== undefined && !isKey(r.boss)) errors.push('boss is not a system key');
    if (r.bossKind !== undefined && !BOSS_KINDS.includes(r.bossKind as BossEncounterKind)) {
        errors.push(`unknown bossKind ${String(r.bossKind)}`);
    }
    const distance = r.distance;
    if (typeof distance !== 'number' || !(distance >= RECIPE_LIMITS.minDistance && distance <= RECIPE_LIMITS.maxDistance)) {
        errors.push(`distance must be ${RECIPE_LIMITS.minDistance}–${RECIPE_LIMITS.maxDistance}`);
    }
    const budget = r.difficultyBudget;
    if (typeof budget !== 'number' || !(budget > 0 && budget <= RECIPE_LIMITS.maxDifficultyBudget)) {
        errors.push(`difficultyBudget must be 1–${RECIPE_LIMITS.maxDifficultyBudget}`);
    }
    if (errors.length > 0) return { ok: false, errors };

    const recipe: ChapterRecipe = {
        biome: r.biome as Biome,
        backdrop: r.backdrop as EnvDescriptorKey,
        layers,
        traversal: r.traversal as EnvDescriptorKey,
        hazard: r.hazard as EnvDescriptorKey,
        flavor,
        ...(r.boss !== undefined ? { boss: r.boss as EnvDescriptorKey, bossKind: r.bossKind as BossEncounterKind } : {}),
        distance: distance as number,
        difficultyBudget: budget as number
    };

    const slots: [EnvDescriptorKey, EnvRole][] = [
        [recipe.backdrop, 'backdrop'],
        ...layers.map((k): [EnvDescriptorKey, EnvRole] => [k, 'backdrop']),
        [recipe.traversal, 'traversal'],
        [recipe.hazard, 'hazard'],
        ...flavor.map((k): [EnvDescriptorKey, EnvRole] => [k, 'flavor']),
        ...(recipe.boss ? [[recipe.boss, 'boss'] as [EnvDescriptorKey, EnvRole]] : [])
    ];
    const seen = new Set<EnvDescriptorKey>();
    for (const [key, role] of slots) {
        const d = ENV_SYSTEM_DESCRIPTORS[key];
        if (d.role !== role) errors.push(`${key} is a ${d.role}, not a ${role}`);
        // Traversal verbs travel between biomes; scenery and hazards keep their affinity.
        if (role !== 'traversal' && !d.biomes.includes(recipe.biome)) errors.push(`${key} does not belong in ${recipe.biome}`);
        if (seen.has(key)) errors.push(`${key} is used twice`);
        seen.add(key);
    }
    for (const key of [...layers, ...flavor]) {
        if (!sharesPalette(key, recipe.backdrop)) errors.push(`${key} palette clashes with backdrop ${recipe.backdrop}`);
    }
    if (!isTraversalTaught(ENV_SYSTEM_DESCRIPTORS[recipe.traversal])) {
        errors.push(`traversal ${recipe.traversal} is not taught by the campaign or a tutorial`);
    }
    const present = new Set(recipeKeys(recipe));
    for (const key of present) {
        if (!requirementMet(key, present)) errors.push(`${key} needs one of ${RECIPE_REQUIRES_ANY[key]!.join(', ')}`);
    }
    const instances = recipeInstances(recipe);
    if (instances > BIOME_INSTANCE_CAP[recipe.biome]) {
        errors.push(`${instances} decoration instances exceed the ${recipe.biome} cap of ${BIOME_INSTANCE_CAP[recipe.biome]}`);
    }
    const difficulty = recipeDifficulty(recipe);
    if (difficulty > recipe.difficultyBudget) errors.push(`difficulty ${difficulty} exceeds budget ${recipe.difficultyBudget}`);

    return errors.length > 0 ? { ok: false, errors } : { ok: true, recipe };
}
