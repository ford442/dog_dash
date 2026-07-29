# Dog Dash — Agent Guide

This file is intended for AI coding agents working on the Dog Dash project. It describes the architecture, conventions, build system, and workflows you need to know before making changes.

---

## Project Overview

**Dog Dash** (also branded as *Space Dash — Journey to the Moon*) is a 3D browser-based space exploration and action game. The player pilots a rocket through six massive levels, dodging obstacles, blasting enemies, and discovering alien flora and geological objects. The game is built around a kid-friendly aesthetic with touch controls, a tutorial system led by an adorable space dog, and whimsical audio.

- **Primary language**: English (all code comments and documentation are in English)
- **Target runtime**: Modern browsers with WebGPU support (Chrome 113+, Edge 113+) and a WebGL2 fallback for debugging/compatibility checks
- **Entry point**: `index.html` loads `src/main.ts`

---

## Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Renderer** | Three.js + WebGPU / WebGL2 | WebGPU is primary. `?renderer=webgl` forces the WebGL2 fallback for visual debugging. Runtime breadcrumbs are exposed on `window.rendererType`, `window.usingWebGPU`, `window.usingWebGL`, and `window.rendererFallbackReason` |
| **Language** | TypeScript | ES2022, ES modules, strict mode enabled |
| **Build Tool** | Vite v7 | Zero-config; handles bundling, dev server, and production builds |
| **WASM** | AssemblyScript (`asc`) | Collision-detection physics compiled to `.wasm` |
| **Audio** | Web Audio API | 100% procedural synthesis — no external audio files |
| **Testing** | Playwright | Smoke suite in `tests/smoke.spec.ts` (`npm run test:smoke`); config in `playwright.config.ts`; CI in `.github/workflows/ci.yml` |
| **Deployment** | Python + Paramiko | SFTP upload script (`deploy.py`) |

---

## Project Structure

The project uses a mostly flat `src/` module structure. Most TypeScript source files live directly under `src/`, with a few shader helpers in `shaders/`.

```
/
├── src/*.ts                      # TypeScript modules (see Key Module Divisions)
├── index.html                    # Main HTML entry point
├── package.json                  # npm scripts and dependencies
├── tsconfig.json                 # TypeScript config (strict, ESNext, bundler mode)
├── src/vite-env.d.ts             # Vite client types + Three.js WebGPU type stubs
├── assembly/
│   └── index.ts                  # AssemblyScript source for WASM physics
├── shaders/
│   └── jelly-moss.ts             # TSL node-based shader materials
├── scripts/
│   └── watch-wasm.cjs            # Dev utility: auto-rebuild WASM on changes
├── tools/
│   └── check_braces.cjs          # Build-time brace-balance checker
├── public/
│   ├── build/                    # WASM artifacts copied here for Vite to serve
│   ├── rocket.glb                # 3D rocket model
│   └── rocket.jpg                # Rocket texture/preview
├── build/
│   ├── optimized.wasm            # Compiled WASM output
│   ├── optimized.wat             # WAT text output
│   └── optimized.wasm.map        # Source map
├── playwright.config.ts          # Playwright smoke-test config (WebGL/SwiftShader flags)
├── tests/
│   └── smoke.spec.ts             # Production-build smoke tests (`npm run test:smoke`)
├── dist/                         # Vite production build output
└── test-results/                 # Playwright run artifacts
```

### Notable files by size and importance

- `src/main/` — Bootstrap, game loop phases, input/HUD wiring (entry: thin `main.ts`)
- `create_game_systems.ts` / `game_runtime.ts` — Composition root (`GameContext`); see `docs/GAME_CONTEXT.md`
- `renderer_mode.ts` — WebGPU/WebGL2 renderer selection and runtime backend breadcrumbs
- `render_debug_helpers.ts` — Wireframe, collision bounds, and WebGL node-material fallback helpers
- `audio_system.ts` (~2,500 lines) — Procedural music and sound synthesis
- `magical_effects.ts` (~2,300 lines) — Visual effect systems
- `powerup_manager.ts` (~1,700 lines) — Power-up logic and UI
- `victory_system.ts` (~1,500 lines) — End-of-level and win sequences
- `foliage.ts` (~1,500 lines) — Alien plant generation and animation
- `candy_obstacles.ts` (~1,400 lines) — Candy-themed obstacle system
- `dog_cockpit.ts` (~1,400 lines) — Dog astronaut animations and accessories
- `space_friends.ts` (~1,300 lines) — Companion character system
- `hud_system.ts` (~1,300 lines) — In-game heads-up display
- `tutorial_system.ts` (~1,200 lines) — Interactive tutorial flow
- `cloud_castles.ts` (~1,100 lines) — Cloud castle background environments
- `geological.ts` (~1,100 lines) — Rock and geological object generation
- `touch_controls.ts` (~1,000 lines) — Touch input handling and control modes
- `juice_effects.ts` (~1,000 lines) — Screen shake, bursts, and game-feel effects
- `flower_constellations.ts` (~900 lines) — Constellation pattern system
- `industrial_background.ts` (~700 lines) — Industrial tunnel backgrounds
- `space_robot_squid.ts` (~700 lines) — Nebula Kraken boss implementation
- `touch_settings.ts` (~700 lines) — Touch control settings UI

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
   asc assembly/index.ts -o build/optimized.wasm -t build/optimized.wat --sourceMap --initialMemory 2 --optimize
   ```
2. **`npm run copy:wasm`** copies `optimized.wasm` and `optimized.wasm.map` into `public/build/` so Vite serves them in both dev and production.
3. **`npm run prebuild`** (automatic before `npm run build`) runs `tools/check_braces.cjs`, a custom syntax checker that walks all `.ts`/`.js`/`.cjs` files and verifies brace balance.
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
- **Exports**: Prefer **named exports**. Only a handful of modules use `export default` (`dog_cockpit.ts`, `magical_effects.ts`, `powerup_manager.ts`, `space_friends.ts`, `cloud_castles.ts`, `vite-env.d.ts`).
- **Types**: TypeScript `strict` mode is on. Define shared types in the same file as the primary consumer, or in dedicated config modules such as `level_config.ts`.
- **Comments**: Use JSDoc block comments for major classes/systems and inline comments for tricky logic.
- **Constants**: Global configuration objects typically use `ALL_CAPS` (e.g., `LEVEL_CONFIG`, `CONFIG`, `UPGRADE_CONFIGS`).
- **Formatting**: There is no Prettier or ESLint configuration in the repo. Keep indentation consistent with the surrounding file (usually 4 spaces).

---

## Key Module Divisions

When you need to find or add functionality, start in the module that matches the domain:

| Domain | Files |
|--------|-------|
| **Core Game Loop** | `src/main/`, `create_game_systems.ts`, `game_runtime.ts` |
| **Environment & Backgrounds** | `foliage.ts`, `foliage_shared.ts`, `geological.ts`, `stars.ts`, `clouds.ts`, `nebula.ts`, `biological_background.ts`, `industrial_background.ts`, `planetary_horizon.ts`, `sky.ts`, `waterfall.ts`, `reentry.ts`, `asteroid_field.ts`, `environment.ts` |
| **Gameplay & Obstacles** | `obstacle_system.ts`, `enemy_patterns.ts`, `weapons.ts`, `boss_system.ts`, `industrial_geometry.ts`, `space_robot_squid.ts` |
| **Visual Effects** | `particles.ts`, `juice_effects.ts`, `magical_effects.ts`, `lighting.ts`, `flower_constellations.ts`, `cloud_castles.ts`, `candy_obstacles.ts`, `butterfly_swarm.ts` |
| **UI / UX** | `ui_controls.ts`, `hud_system.ts`, `touch_controls.ts`, `touch_settings.ts`, `docs/touch_integration_example.ts`, `tutorial_system.ts`, `victory_system.ts` |
| **Progression & Economy** | `upgrade_system.ts`, `powerup_manager.ts`, `collectibles.ts`, `save_manager.ts`, `level_config.ts` |
| **Characters** | `dog_cockpit.ts`, `space_friends.ts` |
| **Movement & Abilities** | `boost_system.ts`, `roll_system.ts` |
| **Shaders (TSL)** | `shaders/jelly-moss.ts` |
| **Physics & WASM** | `physics_utils.ts`, `assembly/index.ts` |
| **Audio** | `audio_system.ts` |

### Level configuration
Level data is centralized in `level_config.ts`. There are 6 levels defined in `LEVEL_CONFIG` (keys `1`–`6`), each specifying distance, speed, background color, sky colors, foliage density, asteroid rate, tunnel parameters, and squid spawn rate.

### Renderer fallback
Renderer selection is centralized in `renderer_mode.ts`.

- Default: WebGPU when available.
- Force WebGL2: `?renderer=webgl` or `?webgl`.
- Debug startup flags: `?wireframe`, `?collisionDebug`.
- Debug overlay: backquote opens the panel and reports the active renderer backend.
- Keep game state, scene objects, camera, level data, controls, and WASM collision shared across renderer paths.

### WASM physics
`assembly/index.ts` exports the following functions used by the TypeScript side:
- `allocAsteroids(count)` — allocates a float buffer for 2D circular objects
- `allocSporeClouds(count)` — allocates a float buffer for 3D spherical objects
- `allocBossHitboxes(count)` — allocates a float buffer for boss hitbox circles
- `checkCollision(...)` — 2D circle collision against the asteroid buffer
- `checkSporeCollision(...)` — 3D sphere collision against the spore-cloud buffer
- `checkBossCollision(...)` — 2D circle collision against boss hitboxes

The JavaScript side writes object positions into `Float32Array` views backed by WASM memory, then calls the exported check functions.

---

## Testing Instructions

- **Playwright smoke suite is active**: `npm run test:smoke` runs `tests/smoke.spec.ts` against the production build on `/?renderer=webgl` with software-GL (SwiftShader) flags — see `playwright.config.ts` and the root `AGENTS.md` (source of truth) for the headless/cloud caveats.
- **Quality gates**: `npm run check` (brace balance + typecheck baseline ratchet), `npm run build`, and the smoke suite. CI (`.github/workflows/ci.yml`) runs `npm run typecheck:ci` then `npm run build` on PRs/pushes to `main`.
- **WebGPU is often unavailable in headless/automated environments.** Use `?renderer=webgl` for browser smoke tests that do not require WebGPU, and use a real WebGPU-enabled browser to verify the primary renderer.
- **Manual testing workflow**:
  1. `npm run dev`
  2. Open `http://localhost:5173` in a supported browser for WebGPU
  3. Open `http://localhost:5173/?renderer=webgl` to verify the WebGL2 fallback
  4. Verify the title screen appears and the game loop starts on click/tap
  5. Smoke-test level transitions, touch controls (if on a touch device), audio, wireframe, and collision debug

---

## Deployment

The project is deployed via `deploy.py`:

```bash
# 1. Build the production bundle
npm run build

# 2. Upload dist/ to the remote server
python deploy.py
```

- **Local source**: `dist/`
- **Remote target**: `test.1ink.us/dog-dash` (SFTP via Paramiko)
- The script recursively creates directories and uploads files.

---

## Security Considerations

1. **Hardcoded credentials**: `deploy.py` contains a hardcoded SFTP password. Do **not** commit modified versions of this file with credentials in plaintext. If you refactor deployment, move secrets to environment variables or a separate ignored config file.
2. **No `.env` handling**: The project currently has no dotenv or secrets-management setup.
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
| Change collision logic | `assembly/index.ts` → `npm run build:wasm` |
| Update UI / HUD | `hud_system.ts` or `ui_controls.ts` |
| Build for release | `npm run build` |
