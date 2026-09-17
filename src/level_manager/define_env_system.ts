/**
 * Single factory for deferred env features: load/install/activate/deactivate,
 * decoration budget, and biome/role/palette metadata.
 *
 * `ENV_SYSTEM_MANIFEST` is the live loader consumed by `level_env_registry.ts`.
 */
import type { LevelConfig, LevelEnvironments } from '../level_config';
import type { LevelPluginHost, EnvPluginBuilder } from './plugin_host';
import type { DeferredLoaderContext } from '../level_env_registry_types';
import type { DeferredEnvSystemKey, SystemKey } from '../level_deferred_registry';
import { decorationBudget, type DecorationCategory } from '../decoration_budget';

/** Recipe biomes a generated Endless Dash chapter can draw from. */
export type Biome = 'nebula' | 'industrial' | 'biological' | 'crystalline' | 'candy';

/** The slot a system fills inside a `ChapterRecipe`. */
export type EnvRole = 'backdrop' | 'traversal' | 'hazard' | 'flavor' | 'boss';

/**
 * Coarse visual-coherence tags. A generator should avoid stacking backdrops
 * whose tag sets don't overlap (e.g. `pastel` + `neon` reads as "fighting").
 */
export type PaletteTag = 'warm' | 'cool' | 'pastel' | 'neon' | 'iridescent' | 'monochrome';

export type EnvSystemDescriptorFields = {
    label: string;
    role: EnvRole;
    biomes: readonly Biome[];
    paletteTags: readonly PaletteTag[];
    difficultyWeight: 1 | 2 | 3 | 4 | 5;
    tutorialId?: string;
};

/** Value type for a given env flag, e.g. `AsteroidFieldEnvironmentConfig` for `'asteroidField'`. */
type EnvFlagValue<F extends DeferredEnvSystemKey> = NonNullable<LevelEnvironments[F & keyof LevelEnvironments]>;

export type EnvSystemSpec<F extends DeferredEnvSystemKey> = EnvSystemDescriptorFields & {
    flag: F;
    /**
     * Runtime system key, when it differs from `flag`. Some flags share a
     * system: `candyPlanetRing` and `candyField` both drive the
     * `candyPlanetRing` system key; `nebula` and `nebulaRibbons` both drive
     * the `nebula` system key. Defaults to `flag`.
     */
    systemKey?: SystemKey;
    load: () => Promise<Record<string, unknown>>;
    install: (ctx: DeferredLoaderContext, mod: Record<string, unknown>) => void | Promise<void>;
    activate: (host: LevelPluginHost, value: EnvFlagValue<F>, cfg: LevelConfig, levelLength: number) => void;
    deactivate: (host: LevelPluginHost) => void;
    update?: (sys: unknown, delta: number, cameraX: number, playerPos?: unknown) => void;
    cleanup?: (sys: unknown) => void;
    budget: { category: DecorationCategory; instances: number };
};

export type EnvSystemDefinition<F extends DeferredEnvSystemKey> = EnvSystemDescriptorFields & {
    flag: F;
    systemKey: SystemKey;
    load: () => Promise<Record<string, unknown>>;
    install: (ctx: DeferredLoaderContext, mod: Record<string, unknown>) => void | Promise<void>;
    plugin: EnvPluginBuilder;
    activate: EnvSystemSpec<F>['activate'];
    deactivate: EnvSystemSpec<F>['deactivate'];
    update?: EnvSystemSpec<F>['update'];
    cleanup?: EnvSystemSpec<F>['cleanup'];
    budget: EnvSystemSpec<F>['budget'];
};

/** Auditor id for the manifest-declared budget of a deferred env flag. */
export function envManifestBudgetId(flag: string): string {
    return `env:${flag}`;
}

function registerManifestBudget<F extends DeferredEnvSystemKey>(spec: EnvSystemSpec<F>): void {
    decorationBudget.register(envManifestBudgetId(spec.flag), {
        label: spec.label,
        category: spec.budget.category,
        maxActive: spec.budget.instances
    });
}

export function defineEnvSystem<F extends DeferredEnvSystemKey>(spec: EnvSystemSpec<F>): EnvSystemDefinition<F> {
    const { flag, activate, deactivate } = spec;
    return {
        flag,
        systemKey: spec.systemKey ?? flag,
        label: spec.label,
        role: spec.role,
        biomes: spec.biomes,
        paletteTags: spec.paletteTags,
        difficultyWeight: spec.difficultyWeight,
        tutorialId: spec.tutorialId,
        load: spec.load,
        install: (ctx, mod) => {
            registerManifestBudget(spec);
            return spec.install(ctx, mod);
        },
        activate,
        deactivate,
        update: spec.update,
        cleanup: spec.cleanup,
        budget: spec.budget,
        plugin: (host, cfg, levelLength) => ({
            flag,
            activate: (value) => {
                registerManifestBudget(spec);
                activate(host, value as EnvFlagValue<F>, cfg, levelLength);
                decorationBudget.syncCount(envManifestBudgetId(flag), spec.budget.instances);
            },
            deactivate: () => {
                deactivate(host);
                decorationBudget.syncCount(envManifestBudgetId(flag), 0);
            }
        })
    };
}
