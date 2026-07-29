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
| **Verlet / noise** | — | Verlet consumed by Jelly-Moss soft-body (Option A); noise still unused |
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
