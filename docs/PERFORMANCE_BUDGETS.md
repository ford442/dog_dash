# Performance Budgets — Decorative 3D Objects

Dog Dash uses a lightweight **Decoration Budget** registry so new flowers, creatures, ribbons, and background layers cannot silently blow past frame-rate guardrails.

## Quick start (two lines)

```ts
import { decorationBudget } from './decoration_budget';

decorationBudget.register('my_prop', {
    label: 'My glowing prop',
    category: 'foliage',      // foliage | creatures | effects | background3d
    maxActive: 24
});

// Before spawning:
if (!decorationBudget.canSpawn('my_prop')) return;
if (!decorationBudget.reportSpawn('my_prop')) return;

// When despawning / streaming cleanup:
decorationBudget.reportDestroy('my_prop');
```

For fixed **InstancedMesh** pools (allocated once at boot), call `syncCount(id, instanceCount)` after construction instead of per-spawn `reportSpawn`.

## Categories

| Category | Examples | Typical cap style |
|----------|----------|-------------------|
| `foliage` | Ferns, roses, scattered trees | Derived from `LEVEL_CONFIG.foliageDensity` |
| `creatures` | Butterflies, koi schools, space friends | Small active sets (≤20–100) |
| `effects` | Crystal chimes, wind mobiles, particles | Per-slice streaming, hard max |
| `background3d` | Nebula puffs, ribbon veils, parallax asteroids | Instanced or merged; fixed pools |

## Level config drives budgets

`applyLevelDecorationBudgets(cfg, objectDensityMultiplier)` (called on level start and when FPS scaler changes) updates:

- **`foliage_scatter`** — `sum(foliageDensity) × viewportWidth/100 × multiplier`
- **`crystal_chimes`** — from `chimeDensity`
- **`wind_chimes`** — from `windChimeDensity`

Add new density fields in `level_config.ts`, then wire them in `applyLevelDecorationBudgets`.

## Debug overlay

- **Dev builds** or **`?debug`** in the URL: press **\`** to open the debug panel.
- Scroll to **Decoration Budgets** — live `current/max` per category (green → yellow at cap → red if over).

Production builds keep counter enforcement with **no DOM overlay** unless `?debug` is present.

## Enforcement path

Registering with `decoration_budget.ts` is still opt-in — nothing forces a
new system to call `register`/`syncCount`/`reportSpawn`. Three layers exist
today (or are landing) to catch a system that skips it, at different points
in the workflow:

1. **Debug-panel drift auditor** (dev-time, manual) — `src/decoration_budget_auditor.ts`
   walks the live scene graph (`scene.traverse()`, summing `InstancedMesh.count`
   + 1 per plain `Mesh`) and compares that total against the sum of
   `decorationBudget.getSnapshot()`'s `currentActive` values. It cannot
   attribute a specific mesh to a specific system (that would need invasive
   per-object tagging across ~70 env systems and everything else in the
   scene), so instead it tracks that gap *relative to a baseline* captured the
   first time it samples the scene, and flags when the gap grows meaningfully
   beyond that baseline — i.e. something new is adding scene nodes without a
   matching registry update. It renders as its own section in the debug panel
   (`` ` `` in dev or `?debug`), next to the Decoration Budgets section it
   cross-checks. This is a manual, dev-time signal — nobody is forced to look
   at it.
2. **CI unit coverage** — `tests/unit/decoration_budget_coverage.test.ts`
   constructs each of a set of env systems directly against a bare
   `THREE.Scene` (no renderer, no DOM, bypassing the whole game bootstrap) and
   asserts their `decorationBudget` counts are present and within their
   declared `maxActive`. This catches a *regression* in an already-covered
   system's registration (e.g. someone changes a spawn path and forgets to
   update the `syncCount` call), but does not by itself catch a *new* system
   that never gets added to this test file — that's a human review step, same
   as remembering to register at all.
3. **`defineEnvSystem`'s `budget` field** (`src/level_manager/define_env_system.ts`,
   `src/level_manager/env_manifest.ts`) — a required
   `{ category: DecorationCategory; instances: number }` on every manifest
   entry. This is the intended **structural** guard for new systems: once a
   later phase makes `env_manifest.ts` the live activation path (replacing
   `level_env_registry.ts`'s hand-written `DEFERRED_ENV_REGISTRY`), a new
   entry literally cannot compile without stating its decoration-budget
   category and instance estimate, the same way `activate`/`deactivate` are
   already required today. **This is not live yet** — `env_manifest.ts` is
   still a parallel, additive structure that nothing imports at runtime (see
   its own header comment), so today `budget` is populated but unenforced;
   only when a later phase migrates real consumers over does it become a
   compile-time gate on new systems, and it still can't catch a system that
   never gets a manifest entry in the first place.

None of these three fully closes the loop on their own — (1) is manual and
coarse, (2) only guards systems someone remembered to add a test for, and (3)
isn't live. Together they're a meaningfully better trail than "grep
CLAUDE.md's rule and hope," which is what existed before this pass.

## Authoring rules

1. **Prefer `InstancedMesh`** for anything that repeats (flowers in a field, bubbles, nebula puffs, butterfly swarms).
2. **Hero objects (1–3)** can be heavier — merged meshes, unique materials, interaction logic (e.g. toy rockets, moon snail).
3. **Background scrollers** must be instanced or merged — no per-chunk `new Mesh()` loops for dozens of copies.
4. **Share materials** — use `candy_materials.ts` `cacheKey` / `trackMaterial`, or `markShared()` from `gpu_resources.ts`; aim for &lt;5 material variants per system.
5. **Measure before/after** — toggle the debug panel FPS readout and enable **Wireframe** to see draw-call pressure.
6. **Register early** — add your budget in `registerDefaultDecorationBudgets()` so the overlay and caps are visible from boot.
7. **Pair spawn/destroy** — every `reportSpawn` path must `reportDestroy` on all exit paths (stream cull, deactivate, clear, expire).

## Dispose / GPU lifetime

Streaming systems create and destroy many meshes. Incomplete teardown leaks WebGL/WebGPU memory across long runs and restarts.

### Owned vs shared

| Kind | How marked | On mesh teardown (`disposeObject`) |
|------|------------|--------------------------------------|
| **Owned** | Created for one mesh/system; unmarked | Dispose geometry, material(s), and owned texture maps |
| **Shared / cached** | `markShared(resource)` or candy `cacheKey` via `retainMaterial` | **No-op** — leave alive for other users |
| **Owned clone** | `.clone()` of a shared prototype (e.g. toy rocket hull) | Dispose the clone only |

Rules:

1. Call `disposeObject(obj)` after `scene.remove` on streaming/recycle paths (foliage, geological, obstacles, candy belt, slingables).
2. Never `material.dispose()` on `foliageMaterials`, candy `cacheKey` mats, module singletons, or `SHARED_*_GEOMETRY` — mark them shared at creation instead.
3. `disposeCandyMaterial` / `disposeMaterialIfOwned` are safe for mixed trees; they no-op on shared mats.
4. `disposeCandyMaterialCache()` is **app-teardown only** (process-lifetime cache).
5. Level start calls `decorationBudget.resetCounts()` then re-syncs live foliage / void roots / butterfly / nebula fixed pools.

### Debug leak detector

In **dev** or **`?debug`**: open the debug panel (`` ` ``) → **GPU Resources**.

- Live approximate geometry/material create−dispose counters
- **Force stream cleanup** — runs foliage + geological + obstacle behind-camera culls, then samples counts for ~60 frames

Expect owned counts to drop after forced cleanup and stabilize (shared mats/geos remain).

### Manual Chrome GPU memory band

After a full 6-level run + restart ×2–3, check Chrome Task Manager → **GPU memory**:

- Expect **no monotonic climb** across restart cycles beyond ~noise
- Documented acceptance band (manual spot-check, WebGL path): **within ~±80 MB** of the post-first-run steady value across subsequent restarts (record your machine’s baseline when validating a change)

Headless/cloud cannot render at all (WebGL is deferred — see [RENDERER_FALLBACK.md](RENDERER_FALLBACK.md)); use a real GPU + WebGPU browser for the memory check.

## Systems already on the registrar

| ID | Module | Notes |
|----|--------|-------|
| `foliage_scatter` | `level_manager.ts` | Streaming decorative plants |
| `butterfly_swarm` | `butterfly_swarm.ts` | Fixed 100-instance background pool |
| `butterfly_escort` | `butterfly_swarm.ts` | ≤20 escort instances |
| `lunar_lemur` | `LunarLemur.ts` | ≤3 hero perches per level |
| `dog_cockpit` | `dog_cockpit/procedural_dog.ts` | 1 procedural astronaut dog when the rocket GLB has no armature |
| `crystal_chimes` | `crystal_chimes.ts` | ≤12 clusters, instanced rods |
| `wind_chimes` | `wind_chimes.ts` | ≤8 hero mobiles |
| `nebula_cloud_puffs` | `nebula.ts` | 45 cloud instances (3 layers) |
| `nebula_energy_motes` | `nebula.ts` | 50 particle/mote instances |
| `nebula_ribbons` | `nebula.ts` | 24 ribbon sheets (3 layers) |
| `dream_portal` | `dream_portal.ts` | ≤3 bonus-room doors per level |
| `dream_room_props` | `dream_portal.ts` | Bonus-room contents: instanced toys + jellies + exit ring/lantern |
| `galactic_core` | `galactic_core.ts` | Single finale backdrop set-piece (4 meshes, additive) |
| `combo_corridor` | `combo_corridor.ts` | Fixed 40-instance corridor ring `InstancedMesh`; `frustumCulled = false` |
| `grapple_isles` | `grapple_isles.ts` | 4 parallax-layer `InstancedMesh`es, 20+15+10+5 = 50 fixed; `frustumCulled = false` on all 4 |
| `sky_rail_terminal_rails` | `sky_rail_terminal.ts` | Fixed 60-instance rail `InstancedMesh`; `frustumCulled = false`. Registered as a separate id from `sky_rail_terminal_terminals` (two structurally distinct meshes) rather than one summed id |
| `sky_rail_terminal_terminals` | `sky_rail_terminal.ts` | Fixed 10-instance terminal `InstancedMesh`; `frustumCulled = false` |
| `space_garden` | `space_garden.ts` | Fixed 80-instance orb `InstancedMesh`; `frustumCulled = false` |
| `bounce_pads` | `bounce_pads.ts` | 50-slot `InstancedMesh` pool; `.count` synced to the config-driven pad count (e.g. 2 in level 4), not the pool size; `frustumCulled = false` |
| `shooting_stars` | `shooting_stars.ts` | Fixed 25-instance streak `InstancedMesh`; `frustumCulled = false` |
| `flower_constellations` | `flower_constellations_system.ts` (wraps `flower_constellations/manager.ts`) | Non-instanced: `Math.floor(15 * densityMultiplier)` flower groups, each several individual meshes. `level_config.ts` only ever passes `true` (multiplier 1.0) for this flag, so 15 is the real observed max, not a guess |
| `cloud_castles` | `cloud_castles_system.ts` (wraps `cloud_castles/castle_manager.ts`) | Organic spawn/despawn via `maintainCastles()` / `cleanupFarCastles()`, bookkept with `reportSpawn`/`reportDestroy` per castle (not `syncCount`) — the code enforces only a floor (≥3 ahead, ≥2 background-layer behind), not a ceiling, so 20 is a generous documented estimate, not a derived maximum. Each castle is a `THREE.Group` of ~15 individual meshes, not instanced |
| `aerial_guard_patrol` | `aerial_guard_patrol.ts` | 20-slot drone + searchlight `InstancedMesh` pool (two meshes, tracked as one id); `.count` synced to the config-driven zone count (e.g. 3 in level 4); `frustumCulled = false` |
| `time_shift_zones` | `time_shift_zones.ts` | `InstancedMesh` rebuilt per activation, one instance per configured zone (2 is the max across `level_config.ts`, in level 4); `frustumCulled = false` |
| `wind_currents` | `wind_currents.ts` | One `InstancedMesh` **per zone**, `Math.max(10, Math.floor(width * height / 10))` instances each, summed across zones — see "Wind currents: a hidden instance cost" below; `frustumCulled = false` on every zone mesh |
| `singing_geodes` | `singing_geodes.ts` | 80-slot `InstancedMesh` pool; `.count`/live-instance array synced to the density-driven count (level configs use 15, 20), not the pool size; `frustumCulled = false` |

### Wind currents: a hidden instance cost

`wind_currents.ts` builds one `InstancedMesh` per configured zone, sized
`Math.max(10, Math.floor(zone.width * zone.height / 10))`. Level 2's
`windCurrents` entry (`level_config.ts`) configures two 200×20 zones, each
producing `Math.floor(200 * 20 / 10) = 400` instances — **800 instances total**
for a system whose flag name gives no hint of that cost. This was flagged
during the decoration-budget audit specifically because it's easy to add a
new `windCurrents` zone (or widen an existing one) without realizing the
instance count scales with `width * height`, not with an obvious "how many
things" knob. If a future level widens or adds zones, re-check this sum —
`docs/PERFORMANCE_BUDGETS.md`'s registrar entry (`wind_currents`, `maxActive:
800`) will start reporting "over budget" in the debug panel as a signal, but
the underlying render cost (and any downstream animation-loop work per
instance) grows immediately, before that panel is ever opened.

### `frustumCulled` — when `false` is correct, and the one exception

Every one of the systems above (and most of the existing registrar) sets
`mesh.frustumCulled = false` on its `InstancedMesh`. This is deliberate, not
an oversight: Three.js computes an `InstancedMesh`'s culling bounds once from
its base geometry and the instances' transforms, but these are
camera-relative wrapping/parallax systems — they reposition individual
instances every frame (`setMatrixAt` in the wrap/scroll logic) without
recomputing that bounding volume, so the built-in frustum test can cull
instances that are actually on-screen (or fail to cull ones that aren't) as
they scroll past the wrap boundary. Disabling culling and relying on the
system's own streaming/wrap logic to keep the active set reasonable is the
correct trade-off for anything that manages its own positioning this way.

Static, non-wrapping meshes should leave the default (`frustumCulled = true`)
alone — the one deliberate counterexample in the codebase is
`src/chroma_shift.ts:214`, which explicitly sets `frustumCulled = true` on
its rock `InstancedMesh`: those instances are placed once (`.count` starts at
0 and grows as rocks are revealed, but placed instances don't get
repositioned every frame the way a wrap/parallax layer does), so the default
per-instance culling behaves correctly and there's no reason to pay for
rendering off-screen rocks.

## Related files

- `src/decoration_budget.ts` — registry, helpers, overlay
- `src/debug_system.ts` — FPS + system toggles (`\` key)
- `src/gpu_resources.ts` — `markShared` / `retainMaterial` / `disposeMaterialIfOwned`
- `src/utils.ts` — ownership-aware `disposeObject`
- `src/gpu_leak_detector.ts` — debug GPU counters + force cleanup
- `src/level_config.ts` — per-level density knobs
- `src/candy_materials.ts` — `trackMaterial` / `cacheKey` / `estimateCandyMaterialCost` / `disposeCandyMaterial`

## JavaScript bundle budgets (production)

Vite splits the production build so the title screen does not download post-title meta UI, victory/tutorial implementations, or later-level modules. Vendor + named domain chunks use `manualChunks` in [`vite.config.ts`](../vite.config.ts); level systems use per-module dynamic `import()` from [`src/level_systems_loader.ts`](../src/level_systems_loader.ts) / [`src/level_env_registry.ts`](../src/level_env_registry.ts); hub / journey / bestiary / victory / tutorial use [`src/meta_ui_loader.ts`](../src/meta_ui_loader.ts).

### Cold-load chunks (title screen)

| Chunk | Role | Typical size (minified) | Notes |
|-------|------|-------------------------|-------|
| `index-*.js` | Boot, HUD shell, L1 loop, décor/manager stubs | **~413 KB** raw / **~113 KB gzip** (was ~774 / ~212) | Meets &lt;120 KB gzip budget; raw stretch &lt;350 KB still open |
| `three-*.js` | Three.js + WebGPU/TSL | ~1.53 MB | Cached vendor; keep separate |
| `audio-*.js` | Procedural audio | ~57 KB | Cached vendor split |
| `meta-ui-*.js` | Hub / crafting / bestiary UI | ~59 KB | On hub / bestiary open |
| `journey-map-*.js` | Journey map overlay | ~34 KB | On map open |
| `victory-*.js` | Victory celebration | ~35 KB | First gameplay click |
| `tutorial-*.js` | Tutorial system | ~117 KB | First gameplay click |
| `game_managers_impl-*.js` | Friends / flora / candy / butterfly | ~43 KB | First gameplay click (`ensureGameManagers`) |
| `clouds-*.js` | CloudSystem TSL layers | ~9 KB | First gameplay click |

**Title Network:** only `index` + `three` + `audio`. Do **not** download `meta-ui`, `journey-map`, `victory`, `tutorial`, `game_managers_impl`, `clouds`, `boss_*`, `industrial_*`, or `aquatic_*` until those flows open / levels load.

WASM collision (`public/build/optimized.wasm`, ~3 KB) stays on the critical path.

### Named async chunks (`manualChunks` + dynamic import)

| Chunk id | Modules | When loaded |
|----------|---------|-------------|
| `meta-ui` | `hub_screen`, `hub_integration`, `crafting_system`, `bestiary` (UI) | Hub open / bestiary key |
| `journey-map` | `journey_map/**` | Journey map overlay |
| `victory` | `victory_system/**` except `victory_state` | First gameplay click (`ensureGameplayReady`) |
| `tutorial` | `tutorial_system/**` except `persistence` | Same gate as victory |
| *(dynamic)* | `game_managers_impl` (friends / flora / candy / butterfly) | Same gate |
| *(dynamic)* | `clouds/**`, pastel nebula, asteroid field, liquid metal, … | Same gate / per-level |

Eager helpers kept out of those chunks on purpose: `bestiary_data`, `crafting_constants`, `hub_pending_chapter`, `journey_progress`, `victory_system/victory_state`, `tutorial_system/persistence`.

### Per-level async chunks

[`ensureLevelSystemsForLevel(n)`](../src/level_systems_loader.ts) reads `LEVEL_CONFIG[n]` and loads only missing systems **before** `startLevel`. Prefetch runs at ~75% of the current segment (`maybePrefetchNextLevel`). Boot uses stubs from [`deferred_system_stubs.ts`](../src/deferred_system_stubs.ts) until install.

| Level | Example async modules |
|-------|------------------------|
| 1 Neon Garden | pastel nebula, liquid metal, asteroid field, god rays, lightning, crystal chimes, candy field, magic paintbrush (+ managers / clouds via `ensureGameplayReady`) |
| 2 Asteroid Belt | `ghost_debris`, `black_hole`, `chroma_shift`, `storm_geodes`, `slingable_objects`, `dream_portal`, grav lens |
| 3 Orbital Descent | `meteor_shower`, `planetary_horizon`, `reentry`, `bubble_coral`, `dream_portal` |
| 4 Rusty Gauntlet | `industrial_background`, `industrial_geometry`, `bubble_coral`, slingables, buoys / monoliths |
| 5 Astral Leviathan | `biological_background`, `cosmic_dust`, `void_jellyfish`, `starlight_koi`, `bubble_coral`, industrial geometry (whale ribs) |
| 6 Aqua Expanse | `waterfall`, `aquatic_life`, `boss_system`, `galactic_core`, plus koi / coral / jellyfish as flagged |

Typical per-level async chunk sizes (minified): 2–13 KB each.

**Guardrails:** a deferred module must not be statically imported by the entry graph (Vite prints "dynamically imported … but also statically imported by" and folds it back into `index-*.js`). Shared constants belong in an eager module — e.g. `DREAM_ROOM_Y` in `game_config.ts`, `BESTIARY_ENTRIES` in `bestiary_data.ts`. Prefer stubs + `ensure*` / registry install over constructing full managers at boot (aligns with GameContext shrink).

Slingable prototype props load in the background after first click via `ensureSlingableSystems()` — they do not block Level 1 start. Meta UI is prefetched after first click via `prefetchMetaUi()` without blocking start.

### Compile / toolchain (keep; do not thrash)

| Tool | Setting | Notes |
|------|---------|-------|
| AssemblyScript | `asc … --initialMemory 2 --optimize` | Supported collision product path |
| C++ WASM | emsdk/docker, `VITE_CPP_WASM` | Experimental only — not in default entry |
| Vite | `target: 'es2022'` | Keep |
| tsc | `strict: true`, `moduleResolution: bundler` | Keep; no emit |
| Node CI | 24 | Keep |

### Measure

1. `npm run build` — inspect the chunk list; title sync path is `index` + `three` + `audio` only.
2. Record raw + gzip: `gzip -c dist/assets/index-*.js | wc -c`.
3. `npm run preview`, Network → JS: title load should show `index` + `three` + `audio` only; open hub/journey → meta chunks; later levels pull modules at prefetch / transition.
4. In-game: debug FPS panel (`` ` ``).

Configuration: [`vite.config.ts`](../vite.config.ts). Lazy wiring: [`src/level_systems_loader.ts`](../src/level_systems_loader.ts), [`src/meta_ui_loader.ts`](../src/meta_ui_loader.ts). Loop spawn predicates without pulling heavy managers: [`src/level_spawn_rules.ts`](../src/level_spawn_rules.ts).
