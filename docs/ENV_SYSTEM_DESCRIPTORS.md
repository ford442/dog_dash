# Env System Descriptors

Machine-readable metadata for every level-environment system, in
[`src/env_system_descriptors.ts`](../src/env_system_descriptors.ts).

## Why this exists

`ENV_SYSTEM_MANIFEST` (`defineEnvSystem`) answers *how* to load a deferred
env flag **and** *where it belongs* (biome / role / palette / difficulty /
budget). `ENV_SYSTEM_DESCRIPTORS` is the query table Endless Dash reads:
deferred env rows are copied from the manifest; deferred-level and eager
systems still declare metadata here with `defineEnvDescriptor`.

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

Deferred env flags use the single `defineEnvSystem` factory (load, install,
activate, deactivate, budget, **and** descriptor fields). Query helpers
read `ENV_SYSTEM_DESCRIPTORS`, which is filled from the manifest plus
level/eager leftovers.

## Adding a new environment system

1. Add a `defineEnvSystem` entry to `ENV_SYSTEM_MANIFEST` (see `docs/GAME_CONTEXT.md`).
2. Descriptor fields on that factory are required — do not add a second
   `defineEnvSystem` in `env_system_descriptors.ts`.
3. For deferred-level / eager systems only, add `defineEnvDescriptor` in
   `src/env_system_descriptors.ts`.
4. `tests/unit/env_system_descriptors.test.ts` and `check:env-registry`
   fail if the flag or metadata is missing.

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
