# Architect Lab

Cosmic Architect Phase 4: a hub room where a player paints a 500–800 m
sandbox from **brushes**, playtests it in the real game, and shares it as a
versioned seed JSON. The campaign teaches systems, Endless Dash shuffles
them, and the Lab lets players compose them.

Everything lives in `src/architect/`. It loads in its own chunk: the hub tab
and `run.ts` (zod, the brush table, the course builder) are dynamic imports.
A player who never opens the Lab or flies a course never downloads them, and
the campaign and Endless paths are unchanged.

## Flow

```
Lab tab ─► ArchitectManager ─► ArchitectSeed ─► architectRunSeed ─► pending run seed + reload
(hub_tab)   (manager.ts)       (schema.ts)      (run.ts)                       │
                                                                               ▼
     beginGameplay: resolveArchitectRun ── bad / over budget ──► HUD notice, fly the campaign
                         │ ok
                         ▼
     startRun: buildSandboxCourse ─► createArchitectLayout ─► JourneyLayout (mode 'architect')
               (course.ts)            (layout.ts)
```

- **Playtest** is an ordinary run: `campaignId: 'architect'`, the course RNG
  code as `rngSeed`, and the placements in an `architect` run modifier. So it
  runs the real loop (fixed timestep, WASM collision), and the ghost recorder
  saves and matches it like any other seed. "Fly it again" re-queues the same
  course and races that ghost.
- **One chapter** at level index `ARCHITECT_LEVEL_INDEX` (200), clear of
  campaign chapters (1–6) and Endless chapters (101+). It borrows sky,
  foliage, speed and music from campaign chapter 2 (Nebula Drift). Every
  system starts off (the same `baseConfig` Endless uses), plus the base
  asteroid stream. Only brushes turn systems on. The Architect flow never
  forks `LevelManager` and adds nothing to `GameContext`.
- **The finish line** is the end of the course span (`loop_finish.ts`). A
  playtest banks no cores, sets no high score and unlocks no chapters.
  Materials, scans and bestiary entries persist as they do anywhere else.
- After a playtest, **Space Base** opens on the Lab tab. The draft is kept
  in localStorage (`dog_dash_architect_draft`) and re-validated on load.

## Brushes

`BRUSH_REGISTRY` (`src/architect/brushes.ts`) is the vocabulary. The Lab
lists whatever it holds. Add a row when a system becomes playable in
isolation. Do not special-case the Lab.

| Brush | Scope | Backed by | Density means |
|-------|-------|-----------|---------------|
| Spore Field | course | `clouds` | cloud cover (1–5) |
| Candy Belt Slice | course | `candyField` + `candyPlanetRing` | candy asteroid share |
| Sling Arena | course | `slingables` (toy rockets, sling objective) | wrecks (1–3) |
| Dream Room Door | anchor | `dreamPortals` | toys inside |
| Boss Gate | anchor (max 1) | `boss` (`bossEncounter`) | which boss: Zephyr → Star-Eater → Kraken |
| Wind Corridor | anchor | `windCurrents` | gust strength (alternates lift / dive) |
| Sky-Rail Flourish | course | `skyRailTerminal` | — |

*Anchor* brushes happen at their X. *Course* brushes tune the whole sandbox,
and their X only orders the timeline. Placing a brush twice stacks it: two
wind zones, two doors. A boss gate's objective beats a sling arena's in
either order. With neither, the objective is "Reach the finish flag".

Each row declares the env `systems` it switches on. A unit test checks that
every brush really enables them, so the decoration budget never drifts from
what actually runs.

## Seed JSON

```json
{ "v": 1, "rngSeed": "1R4C6QE",
  "placements": [ { "brushId": "wind_corridor", "density": 0.5, "x": 160 } ] }
```

Pasted text is untrusted. `parseArchitectSeed` is its only way in:

- text over 8 KB is refused before `JSON.parse`;
- a strict zod schema (`zod` is a direct dependency for exactly this):
  - `brushId` must come from the allowlist;
  - `density` must be 0–1 and `x` must be 0–800;
  - `rngSeed` must be a 1–7 character base-36 code;
  - at most 24 placements;
  - unknown keys (including `__proto__`) are rejected;
- `v` must be `1`. A higher `v` fails closed with "built with a newer
  version". Nothing in a seed is code: brushes are looked up, never
  evaluated.

Seeds that skip the Lab are validated too. The boot-path run-seed codec
only checks the modifier's shape. `resolveArchitectRun` re-runs the same
schema and the budget before a course starts. A failure shows its reason
on the HUD (`HudManager.showNotice`) and the campaign starts instead.

## Budget

The Lab shows two live meters. A course that is over either one, or that
breaks a brush rule (one boss gate), will not playtest. The Lab says why,
and `startRun` refuses it too.

| Meter | Sum | Cap |
|-------|-----|-----|
| Brush cost | `decorationCost` of every placement | `ARCHITECT_BRUSH_BUDGET` (100) |
| Decorations | manifest `budget.instances` of every distinct system switched on, base asteroids included | the twin biome's campaign worst case (`BIOME_INSTANCE_CAP.nebula`) |

## Tests

- `tests/unit/architect.test.ts` covers:
  - the schema's fail-closed cases (bad JSON, future `v`, unknown brush,
    out-of-range numbers, extra keys, `__proto__`, oversize text);
  - import determinism and the run-seed round trip;
  - tampered run seeds;
  - brush stacking and objectives;
  - the budget and the manager (draft persistence, refused imports change
    nothing).
- `tests/replay/architect.test.ts` flies
  `tests/fixtures/architect/course.json` three times through the real sim:
  - each run imports the JSON from scratch, with different `Math.random`
    salts and display rates;
  - all three must log identical obstacle and boss spawn streams,
    trajectories and end snapshots;
  - the run must reach the finish line and save a ghost that matches the
    course;
  - it must not unlock any campaign chapter.

The Sling Arena is not covered by the spawn-stream check:
`toy_rockets.ts` still places wrecks with `Math.random()` (legacy
baseline). Moving it to `gameplayRandom('slingables')` would change the
campaign chapter 4/6 fixtures, so it is left for its own change.

## Later

- `#architect=` URL hash links ("play my course"), the same schema behind
  them.
- Collecting brushes by scanning flora in the campaign.
- New Game+ modifier packs on the same seeds.
