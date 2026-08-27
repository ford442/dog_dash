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

Use `?renderer=webgl` on headless/cloud; real GPU + WebGPU is preferred for the memory check.

## Systems already on the registrar

| ID | Module | Notes |
|----|--------|-------|
| `foliage_scatter` | `level_manager.ts` | Streaming decorative plants |
| `butterfly_swarm` | `butterfly_swarm.ts` | Fixed 100-instance background pool |
| `butterfly_escort` | `butterfly_swarm.ts` | ≤20 escort instances |
| `lunar_lemur` | `LunarLemur.ts` | ≤3 hero perches per level |
| `crystal_chimes` | `crystal_chimes.ts` | ≤12 clusters, instanced rods |
| `wind_chimes` | `wind_chimes.ts` | ≤8 hero mobiles |
| `nebula_cloud_puffs` | `nebula.ts` | 45 cloud instances (3 layers) |
| `nebula_energy_motes` | `nebula.ts` | 50 particle/mote instances |
| `nebula_ribbons` | `nebula.ts` | 24 ribbon sheets (3 layers) |
| `dream_portal` | `dream_portal.ts` | ≤3 bonus-room doors per level |
| `dream_room_props` | `dream_portal.ts` | Bonus-room contents: instanced toys + jellies + exit ring/lantern |
| `galactic_core` | `galactic_core.ts` | Single finale backdrop set-piece (4 meshes, additive) |

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
