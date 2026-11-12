# Dog Dash — Agent Guide

This file is intended for AI coding agents working on the Dog Dash project. It describes the architecture, conventions, build system, and workflows you need to know before making changes.

---

## Project Overview

**Dog Dash** (also branded as *Space Dash — Journey to the Moon*) is a 3D browser-based space exploration and action game. The player pilots a rocket through six massive levels, dodging obstacles, blasting enemies, and discovering alien flora and geological objects. The game is built around a kid-friendly aesthetic with touch controls, a tutorial system led by an adorable space dog, and whimsical audio.

- **Primary language**: English (all code comments and documentation are in English)
- **Target runtime**: Modern browsers with WebGPU support (Chrome 113+, Edge 113+). There is no live WebGL2 renderer; a failed probe hard-fails with a diagnostic screen.
- **Entry point**: `index.html` loads `src/main.ts`

---

## Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Renderer** | Three.js + WebGPU only | No WebGL fallback. `?skip_gpu_boot` skips the probe for bundle-health checks. Breadcrumbs: `window.webgpuProbe`, `window.rendererType`, `window.usingWebGPU`, `window.usingWebGL` (always false) |
| **Language** | TypeScript | ES2022, ES modules, strict mode enabled |
| **Build Tool** | Vite v7 | Zero-config; handles bundling, dev server, and production builds |
| **WASM** | AssemblyScript (`asc`) | Spatial-hash collision, Verlet soft-body physics and fractal noise, compiled to `.wasm`. The only supported backend; `cpp/` is a research-only tree ([docs/WASM_BACKENDS.md](../WASM_BACKENDS.md)) |
| **Audio** | Web Audio API | 100% procedural synthesis — no external audio files |
| **Testing** | `node --test` + Playwright | Unit tests in `tests/unit/` (`npm run test:unit`), headless seeded replays in `tests/replay/` (`npm run test:replay`), Playwright smoke in `tests/smoke.spec.ts` (`npm run test:smoke`); CI in `.github/workflows/ci.yml` |
| **Deployment** | Python | `deploy.py` (Contabo bundle API) or `scripts/deploy.py` (SFTP); credentials come from environment variables only — see [docs/DEPLOY.md](../DEPLOY.md) |

---

## Project Structure

All gameplay TypeScript lives in `src/`: about 200 top-level modules plus feature subdirectories (`main/`, `level_manager/`, `audio_system/`, `boss_system/`, `geological/`, `hud_system/`, `ports/`, …). Many `foo.ts` files are thin re-exports of a `foo/` directory, so a file's line count says little — open the directory.

```
/
├── src/                          # all gameplay TypeScript
│   ├── main.ts                   # thin entry: calls bootstrap() in src/main/
│   └── vite-env.d.ts             # Vite client types + Three.js WebGPU type stubs
├── index.html                    # HTML entry point
├── package.json                  # npm scripts and dependencies
├── tsconfig.json                 # TypeScript config (strict, ESNext, bundler mode, no emit)
├── assembly/                     # AssemblyScript; index.ts re-exports noise.ts, physics.ts, spatial_hash.ts
├── cpp/                          # experimental C++/Emscripten research tree (not a shipping target)
├── shaders/                      # TSL node materials (jelly-moss.ts, magical_edition.ts)
├── scripts/                      # watch-wasm.cjs, C++ verify/golden scripts, deploy.py (SFTP)
├── tools/                        # quality gates: check_braces, check_level_env_registry, check_math_random, typecheck_baseline
├── public/build/                 # WASM artifacts copied here for Vite to serve
├── build/                        # asc output (optimized.wasm, .wat, .wasm.map)
├── tests/                        # unit/ (node --test), replay/ + fixtures/ (headless seeded replays), smoke.spec.ts (Playwright)
├── docs/                         # architecture notes; docs/plans/ is historical planning
├── playwright.config.ts          # Playwright smoke-test config (hard-fail contract, system Chrome)
├── dist/                         # Vite production build output (generated)
└── test-results/                 # Playwright run artifacts (generated)
```

### Where to start

The domain map (which file owns what) lives in the root [`CLAUDE.md`](../../CLAUDE.md) under *Architecture → Domain map*; it is not copied here so it cannot drift. Entry points:

- `src/main/` — bootstrap, fixed-timestep game loop phases, input/HUD wiring
- `create_game_systems.ts` / `game_runtime.ts` — composition root (`GameContext`); see [docs/GAME_CONTEXT.md](../GAME_CONTEXT.md)
- `renderer_mode.ts` / `webgpu_probe.ts` — WebGPU-only boot and the hard-fail diagnostic path
- `level_config.ts` / `level_manager/` — the six chapters and their environment systems

---

## Build Commands

All commands are defined in `package.json`.

```bash
# Install dependencies
npm install

# Development server (builds WASM first, then starts Vite on :5173)
npm run dev

# Production build (brace check → WASM → copy → Vite build)
npm run build

# Preview the production build locally
npm run preview

# Build the WASM module only
npm run build:wasm

# Copy WASM artifacts into public/build/
npm run copy:wasm

# Watch assembly/ for changes and auto-rebuild WASM
npm run watch:wasm
```

### Build details

1. **`npm run build:wasm`** compiles `assembly/index.ts` with:
   ```bash
   asc assembly/index.ts -o build/optimized.wasm -t build/optimized.wat --sourceMap --initialMemory 8 --maximumMemory 256 --optimize --enable simd
   ```
2. **`npm run copy:wasm`** copies `optimized.wasm` and `optimized.wasm.map` into `public/build/` so Vite serves them in both dev and production.
3. **`npm run prebuild`** (automatic before `npm run build`) runs `tools/check_braces.cjs` (a custom checker that walks all `.ts`/`.js`/`.cjs` files and verifies brace balance), then `build:wasm` and `copy:wasm`.
4. **`npm run predev`** (automatic before `npm run dev`) runs `build:wasm` and `copy:wasm`.

---

## Code Style Guidelines

Follow the patterns already established in the codebase:

- **Modules**: ES modules (`"type": "module"` in `package.json`). Use `import`/`export`.
- **Three.js imports**: Always import as a namespace:
  ```ts
  import * as THREE from 'three';
  ```
- **WebGPU / TSL imports**: Import specific nodes from `three/tsl` and classes from `three/webgpu`:
  ```ts
  import { color, time, sin, vec3 } from 'three/tsl';
  import { MeshStandardNodeMaterial } from 'three/webgpu';
  ```
- **Exports**: Prefer **named exports**. Only a handful of modules use `export default` (`cloud_castles/index.ts`, `magical_effects/factories.ts`, `powerup_manager/singleton.ts`, `space_friends/FriendsManager.ts`).
- **Types**: TypeScript `strict` mode is on. Define shared types in the same file as the primary consumer, or in dedicated config modules such as `level_config.ts`.
- **Comments**: Use JSDoc block comments for major classes/systems and inline comments for tricky logic.
- **Constants**: Global configuration objects typically use `ALL_CAPS` (e.g., `LEVEL_CONFIG`, `CONFIG`, `UPGRADE_CONFIGS`).
- **Formatting**: There is no Prettier or ESLint configuration in the repo. Keep indentation consistent with the surrounding file (usually 4 spaces).

---

## Key Module Divisions

See the domain map in the root [`CLAUDE.md`](../../CLAUDE.md) (*Architecture → Domain map*). It is the single maintained list of which module owns which feature.

### Level configuration
Level data is centralized in `level_config.ts`. There are 6 levels defined in `LEVEL_CONFIG` (keys `1`–`6`), each specifying distance, speed, background color, sky colors, foliage density, asteroid rate, tunnel parameters, and squid spawn rate.

### Renderer
Boot is centralized in `renderer_mode.ts` / `webgpu_probe.ts`.

- WebGPU only. `?renderer=webgl` does **not** exist.
- Debug startup flags: `?skip_gpu_boot`, `?wireframe`, `?collisionDebug`.
- Debug overlay: backquote opens the panel and reports the active renderer backend.
- See `docs/RENDERER_FALLBACK.md` and the root `AGENTS.md`.

### WASM physics
`assembly/index.ts` re-exports `noise.ts`, `physics.ts` and `spatial_hash.ts`:

- **Spatial hash** (`assembly/spatial_hash.ts`) — the live gameplay collision path. `src/spatial_index.ts` does one `rebuildGrid` per fixed sim step, then layer-masked `queryRadius` calls; `src/spatial_fill.ts` writes entities via `allocEntities`.
- **Verlet soft-body** (`physics.ts`, pooled via `src/verlet_body_pool.ts`) and **fractal noise** (`noise.ts`) ship by default.
- Legacy linear scans (`allocAsteroids` / `allocSporeClouds` / `allocBossHitboxes` + `checkCollision` / `checkSporeCollision` / `checkBossCollision`) remain as thin buffers.

The JavaScript side writes into `Float32Array` / `Int32Array` views backed by WASM memory. After any `alloc*` call it must call `refreshMemoryView()` (memory growth detaches old views). If WASM is unavailable, `spatial_index.ts` falls back to JS brute-force queries. Full contract and the C++ research tree: [docs/WASM_BACKENDS.md](../WASM_BACKENDS.md).

---

## Testing Instructions

- **Playwright smoke suite is active**: `npm run test:smoke` runs `tests/smoke.spec.ts` against the production build and asserts the WebGPU hard-fail contract (probe breadcrumb, blocking screen, no WebGL context, one adapter request) — see `playwright.config.ts` and the root `AGENTS.md`.
- **Quality gates**: `npm run check` is the local pre-PR gate — brace balance, env-registry, `Math.random` gate, typecheck ratchet (`typecheck:ci`, baseline 0), unit tests and headless replays. CI (`.github/workflows/ci.yml`) runs `typecheck:ci`, `test:unit`, `check:math-random`, `test:replay` and `build` on PRs/pushes to `main`, then the smoke suite (currently `continue-on-error`).
- **WebGPU is unavailable in headless/automated environments.** That is expected: the smoke suite asserts the diagnostic screen, not a GL fallback. Verify visuals in a real WebGPU-enabled browser.
- **Manual testing workflow**:
  1. `npm run dev`
  2. Open `http://localhost:5173` in Chrome/Edge 113+ with a working GPU
  3. Open `http://localhost:5173/?skip_gpu_boot` only to confirm the bundle parses without touching the GPU
  4. Verify the title screen appears and the game loop starts on click/tap
  5. Use `?level=N` (1–6) to start straight at a chapter without unlocking it; `?debug` or the backquote key opens the debug panel
  6. Smoke-test level transitions, touch controls (if on a touch device), audio, wireframe, and collision debug

---

## Deployment

Both helpers upload the production bundle in `dist/`; neither stores credentials in the repo.

```bash
npm run build
export DEPLOY_TOKEN="…"      # deploy.py (Contabo bundle API)
python deploy.py
```

`scripts/deploy.py` is the direct-SFTP alternative (needs `paramiko`). Variables and usage: [docs/DEPLOY.md](../DEPLOY.md).

---

## Security Considerations

1. **Credentials are environment variables only.** Never commit tokens, passwords or host-specific secrets; see [docs/DEPLOY.md](../DEPLOY.md).
2. **No `.env` handling in the app.** The game itself reads no secrets; only the deploy helpers do.
3. **No CSP headers**: There are no Content-Security-Policy meta tags or headers configured in `index.html`.
4. **WASM source maps**: `optimized.wasm.map` is copied to `public/build/` and served in production builds. This is usually harmless but increases bundle size.

---

## Quick Reference for Common Tasks

| Task | Where to look / What to run |
|------|-----------------------------|
| Add a new level | `level_config.ts` + `level_manager/` / `src/main/startup.ts` |
| Change player controls | `touch_controls.ts`, `ui_controls.ts`, or `src/main/input_bindings.ts` |
| Add a new sound | `audio_system.ts` (Web Audio API synthesis) |
| Add a new enemy pattern | `enemy_patterns.ts` + `obstacle_system.ts` |
| Add a visual effect | `magical_effects.ts`, `juice_effects.ts`, or `particles.ts` |
| Add a new gameplay system | `docs/GAME_CONTEXT.md` — construct in `createGameSystems`, put on `GameContext` |
| Add a new shader material | `shaders/*.ts` and import into the relevant background module |
| Change renderer selection | `renderer_mode.ts`, `render_debug_helpers.ts`, `src/main/`, `scene_setup.ts`, and `docs/RENDERER_FALLBACK.md` |
| Change collision logic | `assembly/spatial_hash.ts` (+ `src/spatial_index.ts`, `src/spatial_fill.ts`) → `npm run build:wasm && npm run copy:wasm` |
| Update UI / HUD | `hud_system.ts` or `ui_controls.ts` |
| Build for release | `npm run build` |
