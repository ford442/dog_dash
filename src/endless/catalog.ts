/**
 * Tables the Endless Dash generator derives from the campaign: which biome
 * each campaign chapter teaches, the worst-case decoration load the campaign
 * already ships per biome, and where every system was first taught.
 *
 * Everything here is computed from `LEVEL_CONFIG`, `ENV_SYSTEM_MANIFEST` and
 * `ENV_SYSTEM_DESCRIPTORS` at import time — no hand-maintained copies.
 */
import {
    allEnvSystemDescriptors,
    type Biome,
    type EnvDescriptorKey,
    type EnvRole,
    type EnvSystemDescriptor
} from '../env_system_descriptors';
import { ENV_SYSTEM_MANIFEST } from '../level_manager/env_manifest';
import { isEnvironmentEnabled } from '../level_manager/types';
import { DEFERRED_LEVEL_NEEDS_LOAD } from '../level_deferred_registry';
import { LEVEL_CONFIG, type LevelConfig, type LevelEnvironments } from '../level_config';

export const BIOMES: readonly Biome[] = ['nebula', 'industrial', 'biological', 'crystalline', 'candy'];

export const CAMPAIGN_CHAPTERS = [1, 2, 3, 4, 5, 6] as const;

/** Biome each campaign chapter teaches (see docs/ENV_SYSTEM_DESCRIPTORS.md). */
export const CAMPAIGN_CHAPTER_BIOME: Record<number, Biome> = {
    1: 'candy',
    2: 'nebula',
    3: 'nebula',
    4: 'industrial',
    5: 'biological',
    6: 'crystalline'
};

/** Campaign chapters an Endless chapter of each biome borrows sky, foliage and music from. */
export const BIOME_TWINS: Record<Biome, readonly number[]> = {
    candy: [1],
    nebula: [2, 3],
    industrial: [4],
    biological: [5],
    crystalline: [6]
};

/** Deferred-level keys whose activity comes from a load rule rather than an env flag. */
function isLevelRuleKey(key: EnvDescriptorKey): key is keyof typeof DEFERRED_LEVEL_NEEDS_LOAD {
    return key in DEFERRED_LEVEL_NEEDS_LOAD && key !== 'clouds';
}

/** True when `key`'s system is active in `cfg` (env flag on, or its load rule fires). */
export function isSystemEnabledIn(key: EnvDescriptorKey, cfg: LevelConfig): boolean {
    if (isLevelRuleKey(key)) return DEFERRED_LEVEL_NEEDS_LOAD[key](cfg);
    const env = (cfg.environments ?? {}) as Record<string, LevelEnvironments[keyof LevelEnvironments]>;
    return isEnvironmentEnabled(env[key]);
}

const MANIFEST_INSTANCES = new Map<string, number>(
    ENV_SYSTEM_MANIFEST.map((entry) => [entry.flag, entry.budget.instances])
);

/** Manifest-declared decoration instances for a system (0 for systems not on the env manifest). */
export function manifestInstances(key: EnvDescriptorKey): number {
    return MANIFEST_INSTANCES.get(key) ?? 0;
}

/** Sum of manifest `budget.instances` over the env systems a config turns on. */
export function configManifestInstances(cfg: LevelConfig): number {
    let sum = 0;
    for (const [flag, instances] of MANIFEST_INSTANCES) {
        if (isSystemEnabledIn(flag as EnvDescriptorKey, cfg)) sum += instances;
    }
    return sum;
}

function campaignWorstCase(): Record<Biome, number> {
    const caps = { nebula: 0, industrial: 0, biological: 0, crystalline: 0, candy: 0 } as Record<Biome, number>;
    for (const chapter of CAMPAIGN_CHAPTERS) {
        const biome = CAMPAIGN_CHAPTER_BIOME[chapter];
        caps[biome] = Math.max(caps[biome], configManifestInstances(LEVEL_CONFIG[chapter]));
    }
    return caps;
}

/**
 * Decoration instance ceiling per biome: the heaviest campaign chapter of
 * that biome. A generated chapter may never exceed what the campaign
 * already ships, so random composition cannot find the 4×-prop combo.
 */
export const BIOME_INSTANCE_CAP: Readonly<Record<Biome, number>> = campaignWorstCase();

function teachingChapters(): Partial<Record<EnvDescriptorKey, number>> {
    const taught: Partial<Record<EnvDescriptorKey, number>> = {};
    for (const descriptor of allEnvSystemDescriptors()) {
        const chapter = CAMPAIGN_CHAPTERS.find((c) => isSystemEnabledIn(descriptor.key, LEVEL_CONFIG[c]));
        if (chapter !== undefined) taught[descriptor.key] = chapter;
    }
    return taught;
}

/** First campaign chapter that runs each system (undefined: the campaign never shows it). */
export const TEACHING_CHAPTER: Readonly<Partial<Record<EnvDescriptorKey, number>>> = teachingChapters();

/**
 * A traversal verb is fair game once the player has been taught it: either
 * a campaign chapter runs it, or it has its own tutorial. Endless unlocks
 * only after the whole campaign is complete (see `endlessUnlockState`), so
 * every eligible save has completed every teaching chapter — which keeps the
 * pool, and therefore a shared seed's chapters, identical on every machine.
 */
export function isTraversalTaught(descriptor: EnvSystemDescriptor): boolean {
    return TEACHING_CHAPTER[descriptor.key] !== undefined || descriptor.tutorialId !== undefined;
}

/** Tutorials a save must have seen before Endless unlocks: those of traversals no campaign chapter teaches. */
export const ENDLESS_REQUIRED_TUTORIALS: readonly string[] = [
    ...new Set(allEnvSystemDescriptors()
        .filter((d) => d.role === 'traversal' && TEACHING_CHAPTER[d.key] === undefined && d.tutorialId !== undefined)
        .map((d) => d.tutorialId as string))
];

function byKey(a: EnvSystemDescriptor, b: EnvSystemDescriptor): number {
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/** Descriptors for a role, in a fixed (key-sorted) order so picks are stable across engines. */
export function descriptorsForRole(role: EnvRole): EnvSystemDescriptor[] {
    return allEnvSystemDescriptors().filter((d) => d.role === role).sort(byKey);
}
