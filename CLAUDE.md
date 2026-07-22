# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dog Dash** (also branded as *Space Dash — Journey to the Moon*) is a 3D browser-based space exploration/action game. The player pilots a rocket through 6 levels, dodging obstacles, blasting enemies, and discovering alien flora and geological objects, with a kid-friendly aesthetic, touch controls, and a tutorial system led by a space dog.

- **Renderer**: Three.js + WebGPU (`three/webgpu` renderer, `three/tsl` for node-based shader materials)
- **Language**: TypeScript, ES2022, ES modules, strict mode
- **Build Tool**: Vite v7
- **Physics**: AssemblyScript compiled to WASM for collision detection (also a parallel C++/Emscripten WASM build under `cpp/`)
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

npm run build:cpp-wasm           # release build of cpp/ via cpp/build.sh --release
npm run build:cpp-wasm:debug     # debug build of cpp/ via cpp/build.sh
npm run copy:cpp-wasm             # copy build/game_cpp.wasm into public/build/

npm run typecheck                 # strict TypeScript check (see baseline ratchet below)
npm run typecheck:ci              # CI gate: fail only on new errors vs .github/typecheck-baseline.txt
npm run typecheck:baseline:update # refresh baseline after fixing errors (ratchet down)
npm run check                     # local gate: brace balance + typecheck:ci
npm run test:smoke                # Playwright smoke test (WebGL path, SwiftShader in CI)
```

There is no ESLint or unit-test suite. The automated quality gates are:

- `tools/check_braces.cjs` — runs on `prebuild`, verifies brace balance in `.ts`/`.js`/`.cjs` files
- `npm run typecheck:ci` — compares `tsc --noEmit` against a tracked baseline (currently ~142 known strict-mode violations); CI fails only when **new** errors appear. After fixing errors locally, run `npm run typecheck:baseline:update` to ratchet the baseline down.
- `npm run check` — local workflow helper: brace check + typecheck ratchet (use before PRs)
- GitHub Actions (`.github/workflows/ci.yml`) — `npm ci`, typecheck ratchet, production build, and Playwright smoke test on PRs to `main`.

WebGPU is unavailable headlessly, so runtime verification requires a browser with WebGPU enabled (Chrome/Edge 113+).

## Architecture

### Source layout
All gameplay TypeScript lives in `src/` (~70 modules, flat — no further subdirectories). `assembly/index.ts` is AssemblyScript (separate from `src/`, excluded from `tsconfig.json`). `shaders/jelly-moss.ts` holds TSL node-based shader materials. `cpp/` contains an alternative/experimental C++ physics WASM build.

### Core loop
`src/main.ts` is a thin entry that calls `bootstrap()` in `src/main/`. Startup (`src/main/startup.ts`) builds a typed `GameContext` via `createGameSystems` / `createGameManagers` (no import-time gameplay singletons). The game loop lives under `src/main/game_loop.ts` and `loop_*.ts`, driven by `LEVEL_CONFIG` (`src/level_config.ts`, levels 1–6). Most other modules export classes (constructed in the composition root and `update()`-ed from the loop) or `createX`/`updateX`/`destroyX` factories. See [docs/GAME_CONTEXT.md](docs/GAME_CONTEXT.md).

### WASM physics
`assembly/index.ts` exports buffer-allocation and collision-check functions consumed from `src/physics_utils.ts` and the main loop (`src/main/`):
- `allocAsteroids(count)`, `allocSporeClouds(count)`, `allocBossHitboxes(count)` — allocate `Float32Array` views into WASM memory for circular/spherical hitboxes
- `checkCollision`, `checkSporeCollision`, `checkBossCollision` — run collision checks against those buffers

JS writes object positions directly into the `Float32Array` views, then calls the check functions. After editing `assembly/index.ts`, run `npm run build:wasm && npm run copy:wasm` (or `npm run watch:wasm` during dev) to regenerate `public/build/optimized.wasm`.

### Domain map (where to make changes)
| Domain | Files |
|--------|-------|
| Core game loop, renderer, level progression | `src/main/`, `level_config.ts`, `level_manager/` |
| Environment & backgrounds | `foliage.ts`, `foliage_shared.ts`, `geological.ts`, `stars.ts`, `clouds.ts`, `nebula.ts`, `biological_background.ts`, `industrial_background.ts`, `planetary_horizon.ts`, `sky.ts`, `waterfall.ts`, `reentry.ts`, `asteroid_field.ts`, `environment.ts`, `aurora.ts`, `cosmic_dust.ts`, `meteor_shower.ts`, `ghost_debris.ts` |
| Gameplay & obstacles | `obstacle_system.ts`, `enemy_patterns.ts`, `weapons.ts`, `boss_system.ts`, `industrial_geometry.ts`, `space_robot_squid.ts`, `slingable_objects.ts`, `sling_combo.ts`, `tether_system.ts` |
| Visual effects | `particles.ts`, `juice_effects.ts`, `magical_effects.ts`, `lighting.ts`, `flower_constellations.ts`, `cloud_castles.ts`, `candy_obstacles.ts`, `butterfly_swarm.ts`, `lightning_bolt.ts`, `godrays.ts`, `video_tumbling_star.ts` |
| UI / UX | `ui_controls.ts`, `ui_factory.ts`, `hud_system.ts`, `touch_controls.ts`, `touch_settings.ts`, `docs/touch_integration_example.ts`, `tutorial_system.ts`, `victory_system.ts`, `debug_system.ts` |
| Performance guardrails | `decoration_budget.ts`, `docs/PERFORMANCE_BUDGETS.md` |
| Progression & economy | `upgrade_system.ts`, `powerup_manager.ts`, `collectibles.ts`, `save_manager.ts`, `boost_system.ts`, `roll_system.ts` |
| Characters | `dog_cockpit.ts`, `space_friends.ts`, `player_loader.ts` |
| Physics & WASM | `physics_utils.ts`, `wasm_loader.ts`, `assembly/index.ts` |
| Audio | `audio_system.ts` |
| Game-wide config / composition root | `game_config.ts`, `create_game_systems.ts`, `game_runtime.ts` (`GameContext`); see `docs/GAME_CONTEXT.md` |

## Code Style

- Three.js: always `import * as THREE from 'three'`
- WebGPU/TSL: import specific nodes from `three/tsl` (e.g. `color`, `time`, `sin`, `vec3`) and classes from `three/webgpu` (e.g. `MeshStandardNodeMaterial`)
- Prefer named exports; only a few modules (`dog_cockpit.ts`, `magical_effects.ts`, `powerup_manager.ts`, `space_friends.ts`, `cloud_castles.ts`) use `export default`
- Global config objects use `ALL_CAPS` (e.g. `LEVEL_CONFIG`, `UPGRADE_CONFIGS`)
- 4-space indentation; no Prettier/ESLint configured — match surrounding file style

## Decorative object budgets

New 3D props (flowers, creatures, ribbons, background layers) **must** register with `decoration_budget.ts` before spawning. See `docs/PERFORMANCE_BUDGETS.md` for categories, level-config wiring, and perf rules (InstancedMesh, hero vs background caps, measure with debug FPS + wireframe). Press **\`** in dev or `?debug` to view live counts in the debug panel.

## Deployment

Optional deploy helpers live in `deploy.py` (Contabo bundle API) and `scripts/deploy.py` (direct SFTP). **Credentials are environment variables only** — see `docs/DEPLOY.md`. Do not commit tokens, passwords, or host-specific secrets.
