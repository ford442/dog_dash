# WASM Backends

## Decision (2026-09): AssemblyScript is the single supported, always-built backend

**Dog Dash ships and documents AssemblyScript WASM as the only supported physics path for development, production, and CI** — collision, Verlet soft-body physics, and fractal noise all live in [`assembly/`](../assembly/) and build by default. No `VITE_CPP_WASM` flag, emsdk, or Docker is required for any shipping feature.

The C++/Emscripten tree under [`cpp/`](../cpp/) is kept only as an **experimental research tree** (SIMD prototyping, native profiling, portable-build experiments) — it is explicitly **not a shipping target**. Its collision, Verlet physics, and noise algorithms were ported into AssemblyScript (this decision); `cpp/` is no longer the origin of anything a player reaches.

| | **AssemblyScript (supported, always built)** | **C++ (research only)** |
|---|------------------------------|------------------------|
| **Binary** | `public/build/optimized.wasm` (~4 KB) | `public/build/game_cpp.wasm` (optional, not shipped) |
| **Default build** | Yes — `predev` / `prebuild` | No |
| **Toolchain** | `asc` via npm (`--initialMemory 8 --maximumMemory 256 --optimize --enable simd`) — AS-only; not coupled to C++ | Emscripten emsdk or Docker (`cpp/build.sh` is the only C++ flag list) |
| **Collision API** | Uniform-grid spatial hash (`allocEntities` / `rebuildGrid` / `queryRadius` + SIMD narrow phase). Legacy asteroid/spore/boss linear scans remain as thin buffers. | Same legacy symbols (parity, unused in shipping code) |
| **Verlet soft-body** | ✅ [`assembly/physics.ts`](../assembly/physics.ts) — drives Jelly-Moss by default | Original source (`cpp/src/physics.cpp`), kept for native profiling |
| **Fractal noise** | ✅ [`assembly/noise.ts`](../assembly/noise.ts) — drives biome density by default | Original source (`cpp/src/noise.cpp`), kept for SIMD prototyping |
| **Onboarding** | Required | Not required |

## Default path (what you need day-to-day)

```bash
npm install
npm run dev      # predev → build:wasm + copy:wasm
npm run build    # prebuild → brace check + AS WASM + Vite
```

No Emscripten. Everything — collision, soft-body physics, and biome noise — runs through [`assembly/index.ts`](../assembly/index.ts) (which re-exports [`assembly/noise.ts`](../assembly/noise.ts) and [`assembly/physics.ts`](../assembly/physics.ts)) → [`src/wasm_loader.ts`](../src/wasm_loader.ts) → gameplay consumers.

Gameplay collision goes through [`src/spatial_index.ts`](../src/spatial_index.ts): one `rebuildGrid` per fixed sim step (`SIM_STEP`), then `queryRadius` for obstacles, collectibles, creatures, tether targets, boss hitboxes, and projectiles. [`src/spatial_fill.ts`](../src/spatial_fill.ts) is the live writer (`allocEntities`), superseding unused `allocObjects` packing.

If WASM fails to load, `SpatialIndex.queryJs` brute-forces the same sphere tests so gameplay does not crash (legacy `checkCircleCollisionJs` / `checkSphereCollisionJs` in [`src/physics_utils.ts`](../src/physics_utils.ts) remain for fixtures). Soft-body and noise consumers fall back the same way — see below.

## Soft-body Jelly-Moss (Verlet physics)

Ported from `cpp/src/physics.cpp` to [`assembly/physics.ts`](../assembly/physics.ts) — **ships in the default build, no flag needed.**

1. [`src/jelly_moss_softbody.ts`](../src/jelly_moss_softbody.ts) calls `allocPhysicsBodies` / `stepPhysics` / body accessors, exported by the default AssemblyScript WASM.
2. Up to three deferred hero mosses attach a small core net; projectile / player hits add impulses.
3. Core mesh positions are written back each frame (bone-like offsets).

If WASM fails to load entirely (`handle` is `null`), soft-body stays idle and the membrane sine/fbm shader wobble covers the visual — this is the only fallback path left; there is no more "C++ only" branch.

```bash
npm run verify:cpp-softbody     # research: exercises the cpp/ Verlet source directly
npm run smoke:cpp-softbody      # research: browser breadcrumb check against game_cpp.wasm
```

Runtime breadcrumbs (for smoke / debugging):

- `window.wasmBackend` — `'cpp' | 'assemblyscript' | null` (which binary loaded; `'assemblyscript'` in the default build)
- `window.jellyMossSoftBodyActive` — `true` when Verlet is driving ≥1 hero moss
- `window.jellyMossSoftBodyHeroCount` — attached hero count (0–3)

## Biome noise for streaming density

Ported from `cpp/src/noise.cpp` to [`assembly/noise.ts`](../assembly/noise.ts) — **ships in the default build, no flag needed.**

[`src/biome_noise.ts`](../src/biome_noise.ts) implements `BiomeNoisePort` ([`src/ports/biome_noise_port.ts`](../src/ports/biome_noise_port.ts)). `BiomeNoiseSystem` samples `fractalNoise2D` **once per streaming chunk** (`CHUNK_SIZE = 64` world units), not per vertex/object, and caches the result in a small per-channel ring buffer (`foliage` / `spore` / `candy` channels, offset in noise-space so they don't move in lockstep). Wired as a module-level singleton (`biomeNoise`), bound in [`src/main/startup.ts`](../src/main/startup.ts) alongside `jellyMossSoftBody.bindWasm(handle)`.

| Source | When |
|---|---|
| WASM `fractalNoise2D` (`assembly/noise.ts`) | Default — any time a WASM handle with the export is bound (both the default AssemblyScript binary and the research C++ binary have it) |
| JS multi-octave value-noise fallback (same fBm shape) | Only if WASM fails to load entirely — no crash, no emsdk needed |

Consumers (direct import of the singleton, same pattern as `jellyMossSoftBody`):

- [`src/level_manager/foliage_streaming.ts`](../src/level_manager/foliage_streaming.ts) — `spawnOpenFoliage` multiplies `scaledCount()` by `biomeNoise.densityMultiplier(x, 'foliage')`, varying foliage scatter **and** void-root-ball density (both route through `scaledCount`) per chunk. Spore-cloud spawn count uses its own `'spore'` channel sample so it varies independently of general foliage.
- [`src/candy_obstacles/candy_belt_manager.ts`](../src/candy_obstacles/candy_belt_manager.ts) — `generateCandyBelt` samples `biomeNoise.sample(x, 'candy')` per candidate spawn and skips below `CANDY_GAP_THRESHOLD`, carving organic gaps into the belt instead of a flat Poisson scatter.

Breadcrumb: `window.biomeNoiseBackend` — `'wasm' | 'js'` (was `'cpp' | 'js'` before this decision; renamed because the noise now comes from either WASM binary, not specifically C++).

## Experimental C++ research tree

Kept for portable-build experiments, SIMD prototyping, and native profiling — **not built, loaded, or required by any shipping feature.** Details: [`cpp/README.md`](../cpp/README.md).

```bash
npm run build:cpp-wasm              # local emsdk
npm run build:cpp-wasm:docker       # Docker, no local emsdk
npm run verify:cpp-wasm
npm run verify:cpp-softbody         # exercises the research Verlet source directly

# Optional: AS + C++ when emsdk is available (skips C++ if missing)
npm run build:all-wasm
```

Runtime opt-in for research purposes only (falls back to AssemblyScript if the C++ binary is missing — **no crash**, and no feature depends on this path anymore):

```bash
VITE_CPP_WASM=true npm run dev
```

`asc` flags (`--initialMemory 8 --maximumMemory 256 --optimize --enable simd`) stay on the AssemblyScript `build:wasm` script only.

**Memory:** 8 WASM pages (512 KiB) is the floor once the spatial hash, entity AOS, bucket table, and SIMD SoA scratch exist. `--maximumMemory 256` (16 MiB) lets `heap.alloc` / `heap.realloc` grow. After every `alloc*` (including `allocEntities` and `allocPhysicsBodies`) JS must call `refreshMemoryView()` — a grown `WebAssembly.Memory` detaches the previous `Float32Array` / `Int32Array`. C++ research builds use `INITIAL_MEMORY=1048576` + `ALLOW_MEMORY_GROWTH` in [`cpp/build.sh`](../cpp/build.sh) (the single C++ flag list; `CMakeLists.txt` is native-tests only).

**SIMD:** `queryRadius` is the scalar narrow phase; `queryRadiusSimd` vectorises candidate sphere tests *after* the hash. Feature-detect `v128` at instantiate (`detectWasmSimd()` in [`src/wasm_loader.ts`](../src/wasm_loader.ts)). Engines without SIMD skip the module and use the JS brute-force path in `SpatialIndex` — do not add a second shipping backend.

Native host tests: `BUILD_NATIVE_TESTS` stays off — see comment in [`cpp/CMakeLists.txt`](../cpp/CMakeLists.txt). The WASM Emscripten target was removed from CMake so flags cannot drift from `build.sh`.

## CI

- **typecheck-and-build** / **smoke**: AssemblyScript WASM only (required path) — collision, soft-body, and noise all covered by `npm run test:unit` (see [`tests/unit/wasm_noise_physics.test.ts`](../tests/unit/wasm_noise_physics.test.ts)) and the production build.
- **cpp-wasm**: optional job (Emscripten, `continue-on-error`). Builds `game_cpp.wasm`, runs `verify:cpp-wasm` + `verify:cpp-softbody` against the research source. Failures do not block merge, and never block a shipping feature.

## Null WASM

`game.wasmExports` is typed `WasmExports | null`. Load failure leaves it `null`; obstacle collision must not assume exports exist. Soft-body and biome-noise binds are no-ops when the handle is null or missing the relevant exports.

## Rapier (`@dimforge/rapier3d-compat`)

**Not a runtime physics backend.** There are no Rapier imports under `src/`. The package appears in the lockfile only as a **dev transitive** of `@types/three` (`npm ls @dimforge/rapier3d-compat`). Do not add it as a direct dependency or wire it as collision — AssemblyScript WASM remains the supported path (this document).

## Further reading

- [`cpp/README.md`](../cpp/README.md) — emsdk / Docker for the experimental research tree
- [`src/wasm_loader.ts`](../src/wasm_loader.ts) — loader API and export types
- [`src/jelly_moss_softbody.ts`](../src/jelly_moss_softbody.ts) — Verlet soft-body consumer
- [`src/biome_noise.ts`](../src/biome_noise.ts) — fractal noise consumer
- [`assembly/index.ts`](../assembly/index.ts) — supported collision source
- [`assembly/noise.ts`](../assembly/noise.ts) — supported fractal noise source (ported from `cpp/src/noise.cpp`)
- [`assembly/physics.ts`](../assembly/physics.ts) — supported Verlet physics source (ported from `cpp/src/physics.cpp`)
- [`docs/PERFORMANCE_BUDGETS.md`](PERFORMANCE_BUDGETS.md) — JS chunk budgets and compile settings
