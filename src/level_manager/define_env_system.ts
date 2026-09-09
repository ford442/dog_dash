/**
 * Phase 1 of the env-system-registration RFC (see PR description / docs for the
 * full design). This factory captures a single deferred env feature's wiring
 * — load, install, activate, deactivate — as one typed value instead of
 * scattering it across ~10 hand-edited files.
 *
 * IMPORTANT: this module and `env_manifest.ts` are a parallel, additive
 * structure. Nothing here is consumed by the runtime yet — `level_env_registry.ts`
 * (`DEFERRED_ENV_REGISTRY`, `buildDeferredEnvPlugins`, `installDeferredSystem`)
 * remains the actual source of truth until a later phase migrates consumers
 * over and deletes the hand-written entries one batch at a time.
 */
import type { LevelConfig, LevelEnvironments } from '../level_config';
import type { LevelPluginHost, EnvPluginBuilder } from './plugin_host';
import type { DeferredLoaderContext, DeferredEnvSystemKey, SystemKey } from '../level_env_registry';

/** Value type for a given env flag, e.g. `AsteroidFieldEnvironmentConfig` for `'asteroidField'`. */
type EnvFlagValue<F extends DeferredEnvSystemKey> = NonNullable<LevelEnvironments[F & keyof LevelEnvironments]>;

/**
 * Spec passed to `defineEnvSystem`. Mirrors what a `DEFERRED_ENV_REGISTRY` entry
 * already does (`load` + `install` + `plugin`), with the `plugin` builder's
 * returned `{ activate, deactivate }` pulled out into their own fields so a
 * future manifest-driven dispatch loop can call them directly.
 *
 * `activate`/`deactivate` take the full `LevelPluginHost` (not just this
 * feature's own system instance) because several real entries reach into
 * *other* host systems during activate/deactivate — e.g. `cosmicDust` also
 * toggles `nebulaSystem`'s ribbons, and `asteroidField` writes
 * `host.baseAsteroidDensity`. A narrower `(system) => void` signature (as in
 * the RFC's illustrative example) would not be able to express that honestly.
 *
 * `update`/`cleanup`/`budget` are accepted purely for forward-compatibility
 * with a future per-system update-dispatch loop and decoration-budget wiring
 * (docs/PERFORMANCE_BUDGETS.md). Neither is read by anything this phase —
 * `LevelManager.update()`'s hand-written per-system update calls are untouched.
 */
export type EnvSystemSpec<F extends DeferredEnvSystemKey> = {
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
    /** Forward-compatibility only — not wired to anything this phase. */
    update?: (sys: unknown, delta: number, cameraX: number, playerPos?: unknown) => void;
    /** Forward-compatibility only — not wired to anything this phase. */
    cleanup?: (sys: unknown) => void;
    /** Forward-compatibility only — not wired to anything this phase. */
    budget?: { category: string; instances: number };
};

export type EnvSystemDefinition<F extends DeferredEnvSystemKey> = {
    flag: F;
    systemKey: SystemKey;
    load: () => Promise<Record<string, unknown>>;
    install: (ctx: DeferredLoaderContext, mod: Record<string, unknown>) => void | Promise<void>;
    plugin: EnvPluginBuilder;
    activate: EnvSystemSpec<F>['activate'];
    deactivate: EnvSystemSpec<F>['deactivate'];
    update?: EnvSystemSpec<F>['update'];
    cleanup?: EnvSystemSpec<F>['cleanup'];
    budget?: EnvSystemSpec<F>['budget'];
};

export function defineEnvSystem<F extends DeferredEnvSystemKey>(spec: EnvSystemSpec<F>): EnvSystemDefinition<F> {
    const { flag, activate, deactivate } = spec;
    return {
        flag,
        systemKey: spec.systemKey ?? flag,
        load: spec.load,
        install: spec.install,
        activate,
        deactivate,
        update: spec.update,
        cleanup: spec.cleanup,
        budget: spec.budget,
        plugin: (host, cfg, levelLength) => ({
            flag,
            activate: (value) => activate(host, value as EnvFlagValue<F>, cfg, levelLength),
            deactivate: () => deactivate(host)
        })
    };
}
