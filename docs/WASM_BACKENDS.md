# WASM Backends

## Decision (2026-07): AssemblyScript is the supported product backend

**Dog Dash ships and documents AssemblyScript collision WASM as the only supported physics path for development, production, and CI.**

The C++/Emscripten tree under [`cpp/`](../cpp/) is **experimental / opt-in**. It mirrors the collision API and also exports Verlet physics and fractal noise.

| | **AssemblyScript (supported)** | **C++ (experimental)** |
|---|------------------------------|------------------------|
| **Binary** | `public/build/optimized.wasm` (~3 KB) | `public/build/game_cpp.wasm` (optional) |
| **Default build** | Yes — `predev` / `prebuild` | No |
| **Toolchain** | `asc` via npm (`--initialMemory 2 --optimize`) — AS-only; not coupled to C++ | Emscripten emsdk or Docker |
| **Collision API** | Asteroids, spores, boss hitboxes | Same symbols (parity) |
| **Verlet / noise** | — | Verlet consumed by Jelly-Moss soft-body (Option A); noise consumed by streaming density (Option B) |
| **Onboarding** | Required | Not required |

## Default path (what you need day-to-day)

```bash
npm install
npm run dev      # predev → build:wasm + copy:wasm
npm run build    # prebuild → brace check + AS WASM + Vite
```

No Emscripten. Collision runs through [`assembly/index.ts`](../assembly/index.ts) → [`src/wasm_loader.ts`](../src/wasm_loader.ts) → [`ObstacleSystem`](../src/obstacle_system/).

If WASM fails to load, obstacle checks use a **JavaScript circle/sphere fallback** so gameplay does not crash (see `checkCircleCollisionJs` / `checkSphereCollisionJs` in [`src/physics_utils.ts`](../src/physics_utils.ts)).

## Experimental C++ backend + Option A (soft-body Jelly-Moss)

Kept for portable builds and soft-body experiments. Details: [`cpp/README.md`](../cpp/README.md).

**Chosen deliverable: Option A — Verlet soft-body for 1–3 hero Nebula Jelly-Moss cores.**

When C++ WASM is loaded:

1. [`src/jelly_moss_softbody.ts`](../src/jelly_moss_softbody.ts) calls `allocPhysicsBodies` / `stepPhysics` / body accessors.
2. Up to three deferred hero mosses attach a small core net; projectile / player hits add impulses.
3. Core mesh positions are written back each frame (bone-like offsets). Membrane shader wobble remains the AS fallback.

```bash
npm run build:cpp-wasm              # local emsdk
npm run build:cpp-wasm:docker       # Docker, no local emsdk
npm run verify:cpp-wasm
npm run verify:cpp-softbody         # exercises Verlet consumer path

# Optional: AS + C++ when emsdk is available (skips C++ if missing)
npm run build:all-wasm

# Optional browser breadcrumb check (preview must serve dist with VITE_CPP_WASM=true):
#   VITE_CPP_WASM=true npm run build && npx vite preview --port 4173
#   npm run smoke:cpp-softbody
```

Runtime opt-in (falls back to AssemblyScript if the C++ binary is missing — **no crash**):

```bash
VITE_CPP_WASM=true npm run dev
```

Runtime breadcrumbs (for smoke / debugging):

- `window.wasmBackend` — `'cpp' | 'assemblyscript' | null`
- `window.jellyMossSoftBodyActive` — `true` when Verlet is driving ≥1 hero moss
- `window.jellyMossSoftBodyHeroCount` — attached hero count (0–3)

`asc` flags (`--initialMemory 2 --optimize`) stay on the AssemblyScript `build:wasm` script only. C++ memory growth is handled by `refreshMemoryView()` after `allocPhysicsBodies` (and other `alloc*` calls).

Native host tests: `BUILD_NATIVE_TESTS` stays off — see comment in [`cpp/CMakeLists.txt`](../cpp/CMakeLists.txt).

## Option B — biome noise for streaming density

**Chosen deliverable: chunk-level `fractalNoise2D` density modulation for streaming spawn systems**, via [`src/biome_noise.ts`](../src/biome_noise.ts) implementing `BiomeNoisePort` ([`src/ports/biome_noise_port.ts`](../src/ports/biome_noise_port.ts)).

`BiomeNoiseSystem` samples noise **once per streaming chunk** (`CHUNK_SIZE = 64` world units), not per vertex/object, and caches the result in a small per-channel ring buffer (`foliage` / `spore` / `candy` channels, offset in noise-space so they don't move in lockstep). Wired exactly like Option A: a module-level singleton (`biomeNoise`), bound in [`src/main/startup.ts`](../src/main/startup.ts) alongside `jellyMossSoftBody.bindWasm(handle)` — no `GameContext` growth.

| Backend | Source |
|---|---|
| C++ (`wasmBackend === 'cpp'` and `fractalNoise2D` present) | `exports.fractalNoise2D(worldX * scale, channelSeed * scale, octaves, lacunarity, gain)` |
| AssemblyScript / no C++ binary | Tiny JS multi-octave value-noise fallback (same fBm shape, no crash, no emsdk needed) |

Consumers (direct import of the singleton, same pattern as `jellyMossSoftBody`):

- [`src/level_manager/foliage_streaming.ts`](../src/level_manager/foliage_streaming.ts) — `spawnOpenFoliage` multiplies `scaledCount()` by `biomeNoise.densityMultiplier(x, 'foliage')`, varying foliage scatter **and** void-root-ball density (both route through `scaledCount`) per chunk. Spore-cloud spawn count uses its own `'spore'` channel sample so it varies independently of general foliage.
- [`src/candy_obstacles/candy_belt_manager.ts`](../src/candy_obstacles/candy_belt_manager.ts) — `generateCandyBelt` samples `biomeNoise.sample(x, 'candy')` per candidate spawn and skips below `CANDY_GAP_THRESHOLD`, carving organic gaps into the belt instead of a flat Poisson scatter.

Both consumers run under **every** backend — the JS fallback keeps density variation active (and stable) on the default AssemblyScript path; only the noise *source* changes with `VITE_CPP_WASM=true`. No new build steps or emsdk requirement are added to `npm run dev` / `npm run build` / CI.

Breadcrumb: `window.biomeNoiseBackend` — `'cpp' | 'js'`.

## CI

- **typecheck-and-build** / **smoke**: AssemblyScript WASM only (required path).
- **cpp-wasm**: optional job (Emscripten, `continue-on-error`). Builds `game_cpp.wasm`, runs `verify:cpp-wasm` + `verify:cpp-softbody`. Failures do not block merge.

## Null WASM

`game.wasmExports` is typed `WasmExports | null`. Load failure leaves it `null`; obstacle collision must not assume exports exist. Soft-body bind is a no-op when the handle is null or backend is AssemblyScript.

## Further reading

- [`cpp/README.md`](../cpp/README.md) — emsdk / Docker for experimental builds
- [`src/wasm_loader.ts`](../src/wasm_loader.ts) — loader API and export types
- [`src/jelly_moss_softbody.ts`](../src/jelly_moss_softbody.ts) — Option A Verlet consumer
- [`assembly/index.ts`](../assembly/index.ts) — supported collision source
