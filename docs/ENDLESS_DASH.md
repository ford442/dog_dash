# Endless Dash

Seeded post-campaign runs that recombine the existing environment systems
into generated chapters. A seed code (`1R4C6QE`) always produces the same
chapter sequence on every machine, and the run's gameplay streams come from
the same seed (see [DETERMINISM.md](DETERMINISM.md)). The run never ends by
itself: chapters keep being generated until game over.

Everything new lives in `src/endless/` (TypeScript only, no C++ and no new
dependencies). It loads in its own chunks: the hub tab and the generator
are dynamic imports, so a player who never opens Endless never downloads
them and the campaign path is unchanged.

## Flow

```
seed ──► EndlessSequence ──► ChapterRecipe ──► buildChapterConfig ──► LevelConfig
          (generator.ts)      (recipe.ts)       (patches.ts)            │
                                                                        ▼
                                  createEndlessLayout (layout.ts) ──► JourneyLayout
                                                                        │
                       startRun() installs it; LevelManager, prefetch, ◄┘
                       HUD and depth layers read spans/configs from it
```

- **`JourneyLayout`** (`src/journey_layout.ts`) is the seam. The campaign
  layout reproduces `LEVEL_CONFIG` + `LEVEL_DISTANCE_BOUNDARIES` exactly.
  `startRun()` installs the Endless layout only for `campaignId: 'endless'`
  seeds. Level progression, deferred-system prefetch, the HUD journey bar,
  the depth-layer spans and chapter music all ask the active layout.
- **Chapter indices** are `100 + ordinal` (`ENDLESS_LEVEL_BASE`), so no
  campaign `levelIndex === N` branch ever fires in an Endless chapter.
- **Campaign twin.** Each chapter borrows sky, foliage mix, speed, music
  and creature table from a campaign chapter of its biome (candy→1,
  nebula→2/3, industrial→4, biological→5, crystalline→6). Every system
  switch starts off; only the recipe turns systems on.

## Recipe

```ts
type ChapterRecipe = {
    biome: Biome;
    backdrop: EnvDescriptorKey;     // role 'backdrop'
    layers: EnvDescriptorKey[];     // 0–2 extra backdrops (schema addition)
    traversal: EnvDescriptorKey;    // role 'traversal' — the chapter's verb
    hazard: EnvDescriptorKey;       // role 'hazard'
    flavor: EnvDescriptorKey[];     // 1–3, role 'flavor'
    boss?: EnvDescriptorKey;        // 'boss' on gate chapters…
    bossKind?: BossEncounterKind;   // …with which boss: zephyr | starEater | kraken
    distance: number;               // 600–1400 world units
    difficultyBudget: number;
};
```

`asteroidField` runs in every chapter as the base obstacle stream
(`ENDLESS_BASE_KEYS`) and counts against both budgets.

`validateChapterRecipe(raw)` is the hand-written validator (no zod). It
checks structure, then every rule below, and returns all the errors.

## Constraints (hand-rolled solver)

`solveRecipe` is a small depth-first search over traversal → hazard →
backdrop → first flavor, then greedy optional layers and flavor. Every pool
is shuffled once up front, so the number of RNG draws never depends on
backtracking. It is about 90 lines, well under the size that would justify
a CSP library.

| Rule | Where the data comes from |
|------|---------------------------|
| Roles and biome affinity: scenery and hazards must list the chapter biome; traversal verbs work in any biome | `ENV_SYSTEM_DESCRIPTORS` (`role`, `biomes`) |
| Palette: every layer and flavor shares a `paletteTag` with the backdrop (no pastel next to neon) | descriptor `paletteTags` |
| Taught traversal: a campaign chapter runs it, or it has a `tutorialId` | `TEACHING_CHAPTER` (from `LEVEL_CONFIG`), descriptor `tutorialId` |
| Decorations: the sum of manifest `budget.instances` ≤ the campaign worst case for the biome | `BIOME_INSTANCE_CAP`, from `ENV_SYSTEM_MANIFEST` budgets over the campaign chapters |
| Difficulty: the sum of `difficultyWeight` ≤ `difficultyBudget` = min(18, 8 + ordinal), +5 on boss chapters | descriptor `difficultyWeight` |
| Companions: `starlightKoi` needs `biological`, `nebula` or `aquaticLife` | `RECIPE_REQUIRES_ANY` (mirrors `shouldSpawnStarlightKoi`) |
| Variety: the biome never repeats back-to-back; the traversal repeats only as a last resort | generator state |
| Bosses: the first gate is at chapter 2 or 3, then one every 2–3 chapters; the kind never repeats back-to-back | generator state |

Bosses reuse the existing ones. `LevelConfig.bossEncounter` tells
`BossManager` to spawn a Zephyr or Star-Eater once the player passes
`triggerX`. A Kraken gate makes the obstacle system spawn one Nebula Kraken
squid at `triggerX`, and destroying it completes the chapter's boss
objective.

### Why the generator never reads the save

A shared seed must give everyone the same chapters. So the traversal pool
is "everything the campaign teaches", and Endless unlocks only once the
whole campaign is complete (`endlessUnlockState`: unlocked marker level 7,
plus any `ENDLESS_REQUIRED_TUTORIALS`, currently none). `?debug` skips the
unlock check.

## Seeds and sharing

- **Code:** base-36 of the 32-bit `rngSeed`, 7 characters. `parseEndlessCode`
  accepts a code or a pasted link and ignores case, spaces and dashes.
- **Link:** `…/#endless=CODE`. The boot path reads the hash, strips it
  (`history.replaceState`) and starts the run. A save that has not finished
  the campaign starts the campaign instead.
- **This week's seed:** FNV-1a of `endless-weekly:YEAR-WWEEK` (UTC ISO
  week), so everyone flies the same journey from Monday to Sunday.
- **Hub "♾️ Endless" tab** (`src/endless/hub_tab.ts`) shows:
  - a locked card until the campaign is done;
  - this week's seed with a preview of its first chapters, and fly / copy
    link buttons;
  - a seed box with typed, pasted or 🎲 random seeds;
  - Endless records.

## Persistence

Endless chapters run the same harvester, discovery and bestiary systems as
the campaign, so materials, scanned species and cataloged creatures persist
the same way. On top of that:

- Campaign chapter completion is **not** recorded, so Endless never unlocks
  or skips campaign chapters. The journey-map overlay and the Moon victory
  check are skipped too.
- `SaveData.endless` (`getEndlessRecords` / `recordEndlessRun`) keeps runs
  flown, the furthest chapter, the best distance and the seed of the best run.
- The last-run summary stores the Endless run seed, so the hub's "Launch
  with seed" replays an Endless run too.

## Adding or retagging a system

The generator reads descriptors and the manifest, so a new
`defineEnvSystem` entry with correct `role` / `biomes` / `paletteTags` /
`difficultyWeight` / `budget` is picked up automatically. It also needs a
patch in `RECIPE_PATCHES` (`src/endless/patches.ts`). The table is
exhaustive over `EnvDescriptorKey`, so `tsc` fails until one is added. The
patch says how to switch the system on in a generated config (env flag,
density, or an absolute-X placement inside the chapter span).

Two descriptors were retagged when the generator landed:

- `grappleIsles` is now a **backdrop**. It has no grapple gameplay, and no
  chapter taught it as a traversal.
- `dayNightCycle` gained the **nebula** biome. Its 900 instances can never
  fit under candy's campaign worst case next to a hazard.

## Tests

- `tests/unit/endless_generator.test.ts` checks:
  - determinism, prefix stability, Math.random independence, and a golden
    sequence (the cross-machine fingerprint);
  - hostile seeds and stuck-at-0/1 RNGs against the budgets;
  - every key generated; configs enable exactly the recipe;
  - `LEVEL_CONFIG` untouched; contiguous spans; boss cadence; validator
    rejections.
- `tests/unit/endless_seed_layout.test.ts` covers the codec, ISO weeks, the
  weekly seed, the unlock gate, and both layouts.
- `tests/replay/endless.test.ts` runs `endless_smoke.ts`: a fixed journey
  that switches on all 62 descriptor keys and all three boss gates,
  flown through the real composition root. It then checks that materials,
  bestiary entries and Endless records persist, and that no campaign
  chapter was unlocked.
- `tests/fixtures/replays/endless.json` is a recorded Endless replay
  (seed `0xd06de002`). It crosses into chapter 2 and its Star-Eater gate,
  and gets the same snapshot / Math.random / 30-60-144 Hz checks as the
  campaign fixtures. Re-record it with `npm run replay:record -- --endless`.

If the golden-sequence test fails after a descriptor or generator change,
every previously shared seed now produces different chapters. If that is
intended, update the expected list and call it out in the PR.
