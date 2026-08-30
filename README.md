# dog_dash

Dog Dash - A 3D world exploration game.

## Features

- **WebGPU rendering with WebGL2 fallback** - Modern GPU path by default, with a debug renderer for broader visual inspection
- **Smooth, glossy graphics** - Rounded organic shapes with specular highlights
- **First-person controls** - Explore the world with keyboard and mouse
- **Animated elements** - Dynamic environment with clouds and effects
- **3D perspective** - Proper depth rendering with WebGPU
- **npm buildable** - Modern build system with Vite
- **Alien Flora & Geological Objects** - Inspired by the design document (plan.md):
  - **Nebula Jelly-Moss** - Floating gelatinous organisms with pulsing fractal moss cores
  - **Spore Clouds** - Interactive clouds with chain reaction mechanics (click to trigger!)
  - **Chroma-Shift Rocks** - Color-shifting crystalline rocks that change hue with distance
  - **Fractured Geodes** - Crystalline safe harbors with pulsing EM fields

## How to Run

### Development

1. Install dependencies (use `npm ci` in CI or when you want a lockfile-exact install):

   ```bash
   npm ci          # reproducible install from package-lock.json
   # or
   npm install     # local development
   ```

2. Start the development server (`predev` rebuilds AssemblyScript WASM automatically — no Emscripten required; see [docs/WASM_BACKENDS.md](docs/WASM_BACKENDS.md)):

   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`

### Production Build

Build the project for production (`prebuild` runs brace check + WASM rebuild, then Vite bundles with `vite.config.ts`):

```bash
npm run build
```

The built files will be in the `dist/` directory. You can preview the production build with:
```bash
npm run preview
```

### Typecheck

Run the TypeScript compiler in strict mode (no emit):

```bash
npm run typecheck
```

CI uses a **baseline ratchet** so existing known errors do not block PRs, but new strict-mode violations do. For a local pre-PR gate (brace balance + typecheck ratchet):

```bash
npm run check                         # braces + env-registry + typecheck:ci + test:unit
npm run typecheck:ci                  # compare against .github/typecheck-baseline.txt
npm run typecheck:baseline:update     # after fixing errors, ratchet the baseline down
```

### Testing

Three layers — unit (fast, no GPU), smoke (browser bootstrap), and optional C++ WASM verify:

| Command | What it checks | GPU required |
|---------|----------------|--------------|
| `npm run test:unit` | Pure logic: spawn rules, crafting, env registry math, sling scoring, biome noise JS fallback, port contracts | No |
| `npm run test:smoke` | Production build + Playwright: WebGPU boot-probe hard-fail contract (breadcrumb, blocking screen, no WebGL context, one adapter request) | No — asserts the failure path |
| `npm run verify:cpp-wasm` | Experimental C++ WASM instantiates in Node | No |

`npm run check` includes unit tests. `npm run test` runs unit + smoke.

**Unit tests** use Node's built-in test runner with `tsx` for TypeScript imports (`tests/unit/*.test.ts` and `tests/*.test.mjs`). No build step required.

```bash
npm run test:unit
```

**Smoke tests** verify the production build on the WebGL2 fallback path. Headless/cloud VMs have no WebGPU adapter, so tests launch system Chrome with SwiftShader flags (see `playwright.config.ts`).

```bash
npm run build
npm run test:smoke          # alias for: npx playwright test
```

**Requirements (smoke):**

- Google Chrome (or Chromium). The config checks common install paths and falls back to Playwright's bundled Chromium.
- Optional: set `PLAYWRIGHT_CHROME_PATH` to override the Chrome executable (cloud default: `/usr/local/bin/google-chrome`).

**What the smoke test checks (DOM/state, not screenshot diffs):**

- Page loads with `window.usingWebGL === true`
- Canvas is initialized (sized by the renderer)
- Title screen dismisses on click; gameplay HUD elements appear
- After ~2s, the debug FPS overlay (`` ` `` toggle) shows live stats and `renderer: webgl`

**Smoke promotion (CI):** The smoke job currently uses `continue-on-error: true` (Phase A). Once `main` has **3 consecutive green smoke runs**, remove `continue-on-error` in `.github/workflows/ci.yml` (Phase C). If flakes appear, prefer `waitForFunction` over fixed `waitForTimeout` before promoting.

**C++ WASM verify** (`npm run verify:cpp-wasm`) runs in the experimental `cpp-wasm` CI job (soft-fail). Not required for the default AssemblyScript path.

### Requirements

- Node.js 16+ and npm
- A modern browser with WebGPU support for the primary renderer
- WebGL2 support for the fallback/debug renderer

## Controls

- **Space / W / Up Arrow** - Move up
- **A / S / Down Arrow** - Move down  
- **Mouse Click** - Shoot plasma bolts
- **K / Enter** - Fire weapon
- **G** - Throw Glitch Grenade (when crafted — see [docs/CRAFTING.md](docs/CRAFTING.md))
- **H** - Toggle heat effects (debug)
- **`** - Toggle debug panel

## Renderer

Dog Dash renders through **WebGPU only** — there is no WebGL fallback. If WebGPU cannot start, the game hard-fails with a diagnostic screen instead of quietly rendering through a different backend, so a Chrome failure and an Edge failure can be compared directly. Restoring a WebGL path is a later issue wave; see [docs/RENDERER_FALLBACK.md](docs/RENDERER_FALLBACK.md).

A single boot probe runs `requestAdapter()` and `requestDevice()` exactly once, then hands the device to the renderer. The result is memoised, so a failed probe stays failed and nothing re-requests a device afterwards.

Runtime breadcrumbs in the browser console:

- `window.webgpuProbe` — `{ ok, browser, reason, adapter, stage, userAgent, durationMs }`
- `window.rendererType`, `window.usingWebGPU`, `window.usingWebGL` (always false)

URL flags:

```text
http://localhost:5173/?skip_gpu_boot   # skip the probe entirely (headless CI)
http://localhost:5173/?wireframe
http://localhost:5173/?collisionDebug
```

The debug panel includes `Wireframe` and `Collision Debug` toggles, opened with the backquote key.

**Gameplay verification needs a WebGPU-capable browser** (Chrome/Edge 113+ with a working GPU). Headless CI cannot render the game, so the smoke suite asserts the hard-fail contract instead of driving gameplay.

## GPU Chores

`src/gpu_chores/` offloads **non-authoritative** helper compute — compacting instance draw lists and reducing values for HUD/juice meters. It picks a backend in the order WebGPU → AssemblyScript/WASM → JS, adopting the renderer's existing device rather than creating a second one.

**Chores are not a particle-sim port.** Positions, velocities, collision, gravity and spore gameplay state stay on the AssemblyScript/CPU path. A GPU integrate step is separate work and is gated on golden-fixture parity tests against `assembly/index.ts` — see [docs/GPU_CHORES.md](docs/GPU_CHORES.md).

Kill switch and breadcrumbs:

```text
http://localhost:5173/?no_gpu_compute     # pin the JS tier
http://localhost:5173/?chores=wasm        # pin a specific tier
```

- `window.gpuChores` — `{ backend, syncBackend, gpuDisabled, reason, ops }`

## Gameplay

Navigate your rocket through 6 massive levels, blasting asteroids and dodging crazy enemy formations:

- **Smooth Controls** - No more thrust physics! Direct up/down movement with responsive feel
- **Screen Shake** - Dynamic camera reacts to speed and impacts
- **Enemy Formations** - Face 10 different pattern types:
  - Sine Wave, Spiral, Figure Eight, Lissajous curves
  - Helix, Ring, Cross, V-Formation, Diamond, Chaos
- **Survival** - Your ship can survive 3 asteroid collisions
- **Journey** - Travel 3500+ meters through Level 1 alone
- **Exploration** - Discover alien flora and geological objects
- **Crafting** - Harvest materials, then craft next-run goodies at the Space Base Craft Bay ([docs/CRAFTING.md](docs/CRAFTING.md))

## Level Overview

1. **The Neon Garden** (3500m) - Dense alien flora, moderate speed
2. **The Asteroid Belt** (1200m) - Heavy asteroid density
3. **Orbital Descent** (2200m) - Atmospheric re-entry effects
4. **The Rusty Gauntlet** (3200m) - Industrial tunnel with moving obstacles
5. **The Astral Leviathan** (4200m) - Organic tunnel inside a space whale
6. **The Aqua Expanse** (5200m) - Waterfall and underwater sections

## Technical Details

- Built with Three.js, WebGPU renderer, and a WebGL2 fallback renderer
- **WASM Physics** - AssemblyScript for collision detection ([docs/WASM_BACKENDS.md](docs/WASM_BACKENDS.md); C++ tree is experimental)
- **Mathematical Patterns** - Procedural enemy formations using parametric equations
- Modern WebGPU API for next-generation graphics, with WebGL2 available for debugging and compatibility checks
- Vite build system for fast development (`vite.config.ts` — ES2022 target, `public/` assets, vendor + per-level code splitting — see [docs/PERFORMANCE_BUDGETS.md](docs/PERFORMANCE_BUDGETS.md))
