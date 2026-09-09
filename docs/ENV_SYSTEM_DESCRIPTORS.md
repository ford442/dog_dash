# Env System Descriptors

Machine-readable metadata for every level-environment system, in
[`src/env_system_descriptors.ts`](../src/env_system_descriptors.ts).

## Why this exists

`level_env_registry.ts` and `level_deferred_registry.ts` answer *how* to
load and activate a system. Until this file, nothing answered *where a
system belongs* — which biome(s) it reads coherently in, what role it
plays (backdrop / traversal / hazard / flavor / boss), its rough palette,
and how much it adds to difficulty. That metadata used to live only
implicitly in `LEVEL_CONFIG`, spread across 6 levels — not queryable.

This is prerequisite groundwork for **Endless Dash** (procedural
post-campaign chapters composed from the existing environment systems):
a generator needs to ask "give me a traversal system for the `industrial`
biome" instead of hand-maintaining a table per feature.

## Shape

```ts
interface EnvSystemDescriptor {
    key: EnvDescriptorKey;       // SystemKey | 'butterflySwarm'
    label: string;
    role: 'backdrop' | 'traversal' | 'hazard' | 'flavor' | 'boss';
    biomes: Biome[];             // 'nebula' | 'industrial' | 'biological' | 'crystalline' | 'candy'
    paletteTags: PaletteTag[];   // coarse visual-coherence hint, not literal colors
    difficultyWeight: 1 | 2 | 3 | 4 | 5;
    tutorialId?: string;         // unset until a generator actually gates on it
}
```

`defineEnvSystem(descriptor)` is the registration call each system
"declares" itself with. Descriptors live beside each other in one file
rather than inside ~40 separate implementation modules — every system
already has exactly one declaration site (its entry in
`DEFERRED_ENV_REGISTRY` / `DEFERRED_LEVEL_REGISTRY`), and this metadata
has nothing to do with how those modules render, so it's declared once
here in the same order instead.

## Adding a new environment system

1. Add the system to `level_env_registry.ts` / `level_deferred_registry.ts`
   as usual (see that file's own header comment).
2. Add one `defineEnvSystem({...})` entry to `ENV_SYSTEM_DESCRIPTORS` in
   `src/env_system_descriptors.ts`, keyed by the same flag / system key.
3. `tests/unit/env_system_descriptors.test.ts` and a compile-time
   exhaustiveness check both fail the build if the descriptor is missing.

## Query API

```ts
import { envSystemsForRoleInBiome } from './env_system_descriptors';

const industrialHazards = envSystemsForRoleInBiome('hazard', 'industrial');
```

Also exported: `getEnvSystemDescriptor`, `allEnvSystemDescriptors`,
`envSystemsForBiome`, `envSystemsForRole`.

## Biome mapping (how it was derived)

Biome affinity was derived from which levels each system is actually
enabled in (`LEVEL_CONFIG` in `level_config.ts`), mapped through:

| Level | Name | Biome |
|-------|------|-------|
| 1 | The Neon Garden | `candy` |
| 2 | The Asteroid Belt | `nebula` |
| 3 | Orbital Descent | `nebula` |
| 4 | The Rusty Gauntlet | `industrial` |
| 5 | The Astral Leviathan | `biological` |
| 6 | The Aqua Expanse | `crystalline` |

A handful of backdrop systems were given a broader affinity than their
historical single-level usage (e.g. `nebula`/`nebulaRibbons` also tagged
`biological`) where the visual clearly reads in more than one biome —
the whole point of Endless Dash is combinations the 6 hand-authored
levels never tried. Treat these as a first pass to refine once generated
chapters are actually played, not as ground truth.

## Not yet included

- `tutorialId` gating (needs `tutorial_system` step ids wired through).
- The `ChapterRecipe` / constraint solver itself (Endless Dash Phase 1+).
- Literal color values for palette coherence — `paletteTags` is a coarse
  heuristic (`warm`/`cool`/`pastel`/`neon`/`iridescent`/`monochrome`), not
  a color system.
