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

Vite splits the production build so the title screen and Level 1 do not download later-level modules. Vendor libraries use stable `manualChunks`; level systems use per-module dynamic `import()` from [`src/level_systems_loader.ts`](../src/level_systems_loader.ts).

### Cold-load chunks (title → Level 1)

| Chunk | Role | Typical size (minified) | Notes |
|-------|------|-------------------------|-------|
| `index-*.js` | Boot, L1 loop, eager décor / pastel nebula / liquid metal | ~700 KB | Entry from `index.html`; Vite may warn (>500 KB) — still a clear multi-chunk split vs the former 1.85 MB monolith |
| `three-*.js` | Three.js + WebGPU/TSL | ~1.1 MB | Cached vendor; `manualChunks` in `vite.config.ts` |
| `audio-*.js` | Procedural audio | ~54 KB | Cached vendor split |

**Cold path:** ~1.85 MB minified / ~490 KB gzip for `index` + `three` + `audio`. Level 4–6 modules (waterfall, industrial, biological, boss, aquatic, …) are **not** downloaded until those levels are prefetched or entered.

WASM collision (`public/build/optimized.wasm`, ~3 KB) stays on the critical path.

### Per-level async chunks

[`ensureLevelSystemsForLevel(n)`](../src/level_systems_loader.ts) reads `LEVEL_CONFIG[n]` and loads only missing systems **before** `startLevel`. Prefetch runs at ~75% of the current segment (`maybePrefetchNextLevel`).

| Level | Example async modules |
|-------|------------------------|
| 1 Neon Garden | *(none — pastel nebula + liquid metal are eager)* |
| 2 Asteroid Belt | `ghost_debris`, `black_hole`, `chroma_shift`, `storm_geodes`, `slingable_objects`, `dream_portal` |
| 3 Orbital Descent | `meteor_shower`, `planetary_horizon`, `reentry`, `bubble_coral`, `dream_portal` |
| 4 Rusty Gauntlet | `industrial_background`, `industrial_geometry`, `bubble_coral`, slingables |
| 5 Astral Leviathan | `biological_background`, `cosmic_dust`, `void_jellyfish`, `starlight_koi`, `bubble_coral`, industrial geometry (whale ribs) |
| 6 Aqua Expanse | `waterfall`, `aquatic_life`, `boss_system`, `galactic_core`, plus koi / coral / jellyfish as flagged |

Typical async chunk sizes (minified): 2–13 KB each (e.g. `waterfall` ~8 KB, `boss_system` ~10 KB, `industrial_background` ~11 KB, `dream_portal` ~12 KB, `galactic_core` ~5 KB).

Two guardrails for these: the deferred module must not be statically imported by
anything in the entry graph (Vite prints "dynamically imported … but also
statically imported by" and folds it back into `index-*.js`), and shared
constants belong in an eager module — `DREAM_ROOM_Y` lives in `game_config.ts`
for exactly that reason.

Slingable prototype props load in the background after first click via `ensureSlingableSystems()` — they do not block Level 1 start.

### Measure

1. `npm run build` — inspect the chunk list; entry must only sync-import `three` and `audio`.
2. `npm run preview`, Network → JS: title load should show `index` + `three` + `audio` only; later levels pull their modules at prefetch / transition.
3. In-game: debug FPS panel (`` ` ``).

Configuration: [`vite.config.ts`](../vite.config.ts) (`three` + `audio` only). Lazy wiring: [`src/level_systems_loader.ts`](../src/level_systems_loader.ts). Loop spawn predicates without pulling heavy managers: [`src/level_spawn_rules.ts`](../src/level_spawn_rules.ts).
