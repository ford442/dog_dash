# Dog Dash Agent Notes

Dog Dash uses Three.js with WebGPU as the primary renderer and WebGL2 as a debug fallback.

## Renderer Modes

- Default: WebGPU when available.
- Force WebGL2: open the app with `?renderer=webgl`.
- Force/default WebGPU: omit the parameter or use `?renderer=webgpu`.
- Runtime breadcrumbs are exposed as `window.rendererType`, `window.usingWebGPU`, `window.usingWebGL`, and `window.rendererFallbackReason`.

The WebGL2 path shares the same scene, camera, level data, entities, controls, WASM collision path, and game loop. Keep renderer-specific work behind the renderer factory or small debug helpers instead of forking gameplay systems.

## GPU Chores vs. GPU Simulation

`src/gpu_chores/` is for **visual, non-authoritative** helper compute only: `compact` for instance draw lists, `reduce` for HUD and juice meters. Backend order is WebGPU → AssemblyScript/WASM → JS.

Rules when touching this layer:

- Never move collision, gravity, spore state, or anything a save file records into a chore. Gameplay authority stays on AssemblyScript/WASM.
- Never call `requestAdapter()` / `requestDevice()` from chores. Adopt the renderer's existing device, or run on the CPU tiers.
- Never write chore results back into a particle SoA — that is what would make WebGPU and the renderer both hot on the same state.
- Synchronous ops must stay bit-identical to `src/gpu_chores/js_backend.ts`; `tests/unit/gpu_chores.test.ts` enforces it.
- A GPU particle/spore **integrate** step is a separate, parity-gated piece of work: it requires golden-fixture tests against `assembly/index.ts` before it lands. Do not grow it out of the chores layer.

Kill switch: `?no_gpu_compute`. Breadcrumbs: `window.gpuChores`. Details in [docs/GPU_CHORES.md](docs/GPU_CHORES.md).

## Debug Helpers

Open the debug panel with the backquote key. The panel includes:

- `Wireframe` for renderer/geometry inspection.
- `Collision Debug` for lightweight collision-radius spheres.
- Renderer backend status in the FPS overlay.

Useful URL flags:

- `?renderer=webgl`
- `?no_gpu_compute`
- `?wireframe`
- `?collisionDebug`

See `docs/RENDERER_FALLBACK.md` for the implementation details.

## Typecheck gate

Strict TypeScript currently reports **zero errors**; a **baseline ratchet** keeps it that way:

- `npm run typecheck` — raw `tsc --noEmit` (must stay clean)
- `npm run typecheck:ci` — fail on any error newer than `.github/typecheck-baseline.txt`
- `npm run typecheck:baseline:update` — regenerate the baseline (only when intentionally accepting debt)
- `npm run check` — local pre-PR gate: brace balance + typecheck ratchet

CI (`.github/workflows/ci.yml`) runs `npm run typecheck:ci` then `npm run build` on PRs/pushes to `main`. Prefer `npm run check` locally before opening a PR.

### TSL typing convention

When a TSL value is reassigned across node subtypes (e.g. `let total = float(0.0)` then `total = total.add(...)`), annotate it as `TSLNode` from `src/tsl_types.ts` instead of a narrow `ConstNode`/`MathNode`/`OperatorNode` type. Do not fight `three/tsl` inference with `as any` casts.

## Composition root

Gameplay systems are constructed in `createGameSystems()` / bootstrap (`src/main/startup.ts`), not at import time. Shared state is the typed `GameContext` on `game` (`src/game_runtime.ts`). Domain modules take ports — see `docs/GAME_CONTEXT.md`.

**Environment features:** register in `src/level_env_registry.ts` (one entry for deferred systems). Do not land features via one-shot `patch_*.py` sed scripts — those caused half-wired systems (e.g. Cloud Castles). `npm run check:env-registry` validates the closed loop.

## Cursor Cloud specific instructions

Standard commands live in `README.md` / `package.json` / `CLAUDE.md` (`npm run dev` on :5173, `npm run build`, `npm run check` for braces + typecheck ratchet). `predev`/`prebuild` rebuild the AssemblyScript WASM automatically, so no separate WASM step is needed for normal dev. There is no ESLint or unit-test suite; quality gates are brace check, typecheck baseline, production build, and Playwright smoke.

Non-obvious caveats for headless/cloud verification:

- The cloud VM has no GPU and no WebGPU adapter, so the default WebGPU path renders nothing. Always open the app with `?renderer=webgl` to force the WebGL2 fallback.
- Even with `?renderer=webgl`, a normally-launched headless/virtual Chrome shows a black canvas. Launch Chrome with software-GL flags so WebGL2 actually rasterizes: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. Confirm via `window.usingWebGL === true`. Under SwiftShader, TSL/node-material shaders fall back to plain standard materials (per `docs/RENDERER_FALLBACK.md`), so visuals look flatter/grayer than on a real GPU — this is expected, not a regression.
- Playwright smoke tests (`npm run test:smoke` / `npx playwright test`) exercise the production build on `/?renderer=webgl` with the SwiftShader flags above — see [README.md — Testing](README.md#testing). `playwright.config.ts` prefers system Chrome (`/usr/local/bin/google-chrome` on cloud) via `PLAYWRIGHT_CHROME_PATH` or `channel: 'chrome'`. Video capture additionally needs `npx playwright install ffmpeg` (one-off, not part of the update script).
- **Unit tests** (`npm run test:unit`) cover pure logic without a browser and run inside `npm run check` and CI. Smoke remains the heavyweight browser gate (currently soft-fail in CI until 3 consecutive green `main` runs).
