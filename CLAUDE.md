# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dog Dash** (also branded as *Space Dash — Journey to the Moon*) is a 3D browser-based space exploration/action game. The player pilots a rocket through 6 levels, dodging obstacles, blasting enemies, and discovering alien flora and geological objects, with a kid-friendly aesthetic, touch controls, and a tutorial system led by a space dog.

- **Renderer**: Three.js + WebGPU (`three/webgpu` renderer, `three/tsl` for node-based shader materials)
- **Language**: TypeScript, ES2022, ES modules, strict mode
- **Build Tool**: Vite v7
- **Physics**: AssemblyScript WASM for collision detection, Verlet soft-body physics, and fractal noise — the single supported, always-built backend. Experimental C++/Emscripten tree under `cpp/` is research-only (SIMD prototyping, native profiling), not a shipping target — see [docs/WASM_BACKENDS.md](docs/WASM_BACKENDS.md).
- **Audio**: 100% procedural synthesis via Web Audio API (`audio_system.ts`) — no external audio files
- **Entry point**: `index.html` → `src/main.ts`

## Build & Dev Commands

```bash
npm install                  # install deps

npm run dev                   # predev builds+copies WASM, then starts Vite dev server on :5173
npm run build                 # prebuild (brace check) -> build:wasm -> copy:wasm -> vite build -> dist/
npm run preview                # preview production build

npm run build:wasm             # compile assembly/index.ts to build/optimized.wasm via asc
npm run copy:wasm               # copy optimized.wasm(.map) into public/build/
npm run watch:wasm               # watch assembly/ and rebuild WASM on change

# Experimental C++ WASM (optional; not required for onboarding — docs/WASM_BACKENDS.md)
npm run build:cpp-wasm           # release build of cpp/ via cpp/build.sh --release
npm run build:cpp-wasm:docker    # Docker build when emsdk is unavailable locally
npm run copy:cpp-wasm             # copy build/game_cpp.wasm into public/build/ (if present)
npm run verify:cpp-wasm          # Node instantiate check for game_cpp.wasm

npm run typecheck                 # strict TypeScript check (see baseline ratchet below)
npm run typecheck:ci              # CI gate: fail only on new errors vs .github/typecheck-baseline.txt
npm run typecheck:baseline:update # refresh baseline after fixing errors (ratchet down)
npm run check                     # local gate: brace balance + typecheck:ci
npm run test:unit                 # node --test unit suite (pretest:unit rebuilds WASM first)
npm run test:smoke                # Playwright WebGPU hard-fail contract test on the production build
```

There is no ESLint config. The automated quality gates are:

- `tools/check_braces.cjs` — runs on `prebuild`, verifies brace balance in `.ts`/`.js`/`.cjs` files
- `npm run typecheck:ci` — compares `tsc --noEmit` against a tracked baseline. The baseline is currently **0 errors**: strict mode is clean, so any new violation fails CI. After fixing errors locally, run `npm run typecheck:baseline:update` to ratchet the baseline down.
- `npm run check:env-registry` — validates the level environment registry closed loop (flags, registry keys, plugin order, `LEVEL_CONFIG` references)
- `npm run test:unit` — `node --import tsx --test` over `tests/unit/**/*.test.ts` + `tests/*.test.mjs` (no browser needed; `pretest:unit` rebuilds the AS WASM first). Includes coverage gates such as `decoration_budget_coverage` and `env_manifest_parity`
- `npm run check` — local pre-PR gate: brace check + env-registry check + typecheck ratchet + unit tests
- `npm run test:smoke` — Playwright WebGPU boot-probe test (headless has no adapter, so it asserts the hard-fail diagnostic screen and that no WebGL context is created). Needs a Chrome binary; point `PLAYWRIGHT_CHROME_PATH` at one if it is not on a standard path.
- GitHub Actions (`.github/workflows/ci.yml`) — `npm ci`, typecheck ratchet, unit tests, production build, then a smoke job (currently `continue-on-error`) and an experimental C++ WASM job on PRs to `main`.

WebGPU is unavailable headlessly, so runtime verification requires a browser with WebGPU enabled (Chrome/Edge 113+).

## Architecture

### Source layout
All gameplay TypeScript lives in `src/` (~200 top-level modules plus feature subdirectories such as `main/`, `level_manager/`, `audio_system/`, `boss_system/`, `geological/`, `hud_system/`, `ports/`; many `foo.ts` files are thin re-exports of a `foo/` directory). `assembly/index.ts` is AssemblyScript (separate from `src/`, excluded from `tsconfig.json`). `shaders/` (`jelly-moss.ts`, `magical_edition.ts`) holds TSL node-based shader materials. `cpp/` contains an alternative/experimental C++ physics WASM build.

### Core loop
`src/main.ts` is a thin entry that calls `bootstrap()` in `src/main/`. Startup (`src/main/startup.ts`) builds a typed `GameContext` via `createGameSystems` / `createGameManagers` (no import-time gameplay singletons). The game loop lives under `src/main/game_loop.ts` and `loop_*.ts`, driven by `LEVEL_CONFIG` (`src/level_config.ts`, levels 1–6). Gameplay runs on a **fixed timestep** (`src/main/fixed_timestep.ts`, `SIM_STEP` = 1/60 s) with render interpolation (`render_interpolation.ts`); gameplay systems must integrate against `SIM_STEP`, while purely visual systems keep wall-clock delta. Most other modules export classes (constructed in the composition root and `update()`-ed from the loop) or `createX`/`updateX`/`destroyX` factories. See [docs/GAME_CONTEXT.md](docs/GAME_CONTEXT.md).

### WASM physics
`assembly/index.ts` re-exports `noise.ts`, `physics.ts` and `spatial_hash.ts`:
- **Spatial hash** (`assembly/spatial_hash.ts`) — the live gameplay collision path. `src/spatial_index.ts` does one `rebuildGrid` per fixed sim step, then `queryRadius` (layer-masked) for obstacles, collectibles, creatures, tether targets, boss hitboxes and projectiles; `src/spatial_fill.ts` writes entities via `allocEntities`.
- Legacy linear scans (`allocAsteroids`/`allocSporeClouds`/`allocBossHitboxes` + `checkCollision`/`checkSporeCollision`/`checkBossCollision`) remain as thin buffers.
- Verlet soft-body (`physics.ts`, pooled via `src/verlet_body_pool.ts`) and fractal noise (`noise.ts`).

After any `alloc*` call JS must call `refreshMemoryView()` (memory growth detaches old typed-array views). After editing `assembly/index.ts`, run `npm run build:wasm && npm run copy:wasm` (or `npm run watch:wasm` during dev) to regenerate `public/build/optimized.wasm`. If WASM is unavailable at runtime, `spatial_index.ts` falls back to JS brute-force queries (see [docs/WASM_BACKENDS.md](docs/WASM_BACKENDS.md)).

### Domain map (where to make changes)
| Domain | Files |
|--------|-------|
| Core game loop, renderer, level progression | `src/main/` (incl. `main/loop_combat/`, `fixed_timestep.ts`, `render_interpolation.ts`), `level_config.ts`, `level_manager/`, `pixel_ratio.ts` |
| Env-system registration | `level_manager/env_manifest.ts` (`ENV_SYSTEM_MANIFEST`, one `defineEnvSystem` entry per deferred env feature), `level_env_registry.ts` (derived public entry), `level_deferred_registry.ts` |
| Environment & backgrounds | `foliage.ts`, `foliage_shared.ts`, `geological.ts`, `stars.ts`, `clouds.ts`, `nebula/`, `biological_background.ts`, `industrial_background/`, `planetary_horizon.ts`, `sky.ts`, `waterfall.ts`, `reentry.ts`, `asteroid_field.ts`, `environment.ts`, `aurora.ts`, `cosmic_dust.ts`, `meteor_shower.ts`, `ghost_debris.ts` |
| Gameplay & obstacles | `obstacle_system/`, `enemy_patterns.ts`, `weapons.ts`, `boss_system.ts`, `industrial_geometry.ts`, `space_robot_squid.ts`, `slingable_objects.ts`, `sling_combo.ts`, `tether_system.ts` |
| Visual effects | `particles.ts`, `juice_effects/`, `magical_effects.ts`, `lighting.ts`, `flower_constellations/`, `cloud_castles.ts`, `candy_obstacles.ts`, `butterfly_swarm.ts`, `lightning_bolt.ts`, `godrays.ts`, `video_tumbling_star.ts` |
| UI / UX | `ui_controls.ts`, `ui_factory.ts`, `hud_system.ts`, `touch_controls.ts`, `touch_settings.ts`, `docs/touch_integration_example.ts`, `tutorial_system.ts`, `victory_system.ts`, `debug_system.ts` |
| Performance guardrails | `decoration_budget.ts`, `decoration_budget_auditor.ts` (dev-only declared-vs-observed drift check), `docs/PERFORMANCE_BUDGETS.md` |
| Progression & economy | `upgrade_system.ts`, `powerup_manager.ts`, `collectibles.ts`, `save_manager.ts`, `boost_system.ts`, `roll_system.ts` |
| Characters | `dog_cockpit/`, `space_friends.ts`, `player_loader.ts` |
| GPU chores (visual-only helper compute) | `gpu_chores/`, `ports/gpu_chores_port.ts` — [docs/GPU_CHORES.md](docs/GPU_CHORES.md). **Not** a particle-sim port; gameplay authority stays on AS/WASM |
| Physics & WASM | `spatial_index.ts` + `spatial_fill.ts` (collision queries), `physics_utils.ts`, `wasm_loader.ts`, `verlet_body_pool.ts`, `jelly_moss_softbody.ts` (Verlet soft-body, ships by default), `biome_noise.ts` (fractal noise, ships by default), `assembly/index.ts` + `noise.ts` + `physics.ts` + `spatial_hash.ts` (supported, always built); `cpp/` experimental research tree only — [docs/WASM_BACKENDS.md](docs/WASM_BACKENDS.md) |
| Audio | `audio_system/` (incl. `chapter_music.ts` + `mixins/chapter_music.ts`), `audio_settings.ts`, `ui_audio_settings.ts`, `main/music_update.ts` — [docs/CHAPTER_MUSIC.md](docs/CHAPTER_MUSIC.md). 100% procedural; never add audio files to `public/` |
| Game-wide config / composition root | `game_config.ts`, `create_game_systems.ts`, `game_runtime.ts` (`GameContext`); see `docs/GAME_CONTEXT.md` |
| Env system metadata (biome/role/palette/difficulty per system) | `env_system_descriptors.ts` — see `docs/ENV_SYSTEM_DESCRIPTORS.md` |

## Code Style

- Three.js: always `import * as THREE from 'three'`
- WebGPU/TSL: import specific nodes from `three/tsl` (e.g. `color`, `time`, `sin`, `vec3`) and classes from `three/webgpu` (e.g. `MeshStandardNodeMaterial`)
- Prefer named exports; only a few modules (`cloud_castles/index.ts`, `magical_effects/factories.ts`, `powerup_manager/singleton.ts`, `space_friends/FriendsManager.ts`) use `export default`
- Global config objects use `ALL_CAPS` (e.g. `LEVEL_CONFIG`, `UPGRADE_CONFIGS`)
- 4-space indentation; no Prettier/ESLint configured — match surrounding file style

## Decorative object budgets

New 3D props (flowers, creatures, ribbons, background layers) **must** register with `decoration_budget.ts` before spawning. See `docs/PERFORMANCE_BUDGETS.md` for categories, level-config wiring, and perf rules (InstancedMesh, hero vs background caps, measure with debug FPS + wireframe). Press **\`** in dev or `?debug` to view live counts in the debug panel.

## Deployment

Optional deploy helpers live in `deploy.py` (Contabo bundle API) and `scripts/deploy.py` (direct SFTP). **Credentials are environment variables only** — see `docs/DEPLOY.md`. Do not commit tokens, passwords, or host-specific secrets.
