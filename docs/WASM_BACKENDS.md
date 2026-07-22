# WASM Backends

## Decision (2026-07): AssemblyScript is the supported product backend

**Dog Dash ships and documents AssemblyScript collision WASM as the only supported physics path for development, production, and CI.**

The C++/Emscripten tree under [`cpp/`](../cpp/) is **experimental / parked**. It mirrors the collision API and also exports Verlet physics and fractal noise, but:

- Those extras are **not** called from TypeScript gameplay today
- `game_cpp.wasm` is **not** part of the default `public/build/` tree
- Emscripten is **not** required to clone, `npm run dev`, or `npm run build`

Revisit dual-backend product integration only if a concrete gameplay feature needs Verlet or WASM noise (see “Future” below).

| | **AssemblyScript (supported)** | **C++ (experimental)** |
|---|------------------------------|------------------------|
| **Binary** | `public/build/optimized.wasm` (~3 KB) | `public/build/game_cpp.wasm` (optional) |
| **Default build** | Yes — `predev` / `prebuild` | No |
| **Toolchain** | `asc` via npm | Emscripten emsdk or Docker |
| **Collision API** | Asteroids, spores, boss hitboxes | Same symbols (parity) |
| **Verlet / noise** | — | Present in C++ only; unused by TS |
| **Onboarding** | Required | Not required |

## Default path (what you need day-to-day)

```bash
npm install
npm run dev      # predev → build:wasm + copy:wasm
npm run build    # prebuild → brace check + AS WASM + Vite
```

No Emscripten. Collision runs through [`assembly/index.ts`](../assembly/index.ts) → [`src/wasm_loader.ts`](../src/wasm_loader.ts) → [`ObstacleSystem`](../src/obstacle_system/).

If WASM fails to load, obstacle checks use a **JavaScript circle/sphere fallback** so gameplay does not crash (see `checkCircleCollisionJs` / `checkSphereCollisionJs` in [`src/physics_utils.ts`](../src/physics_utils.ts)).

## Experimental C++ backend

Kept for portable builds and future experiments. Details: [`cpp/README.md`](../cpp/README.md).

```bash
# Only if you intentionally want the C++ artifact
npm run build:cpp-wasm              # local emsdk
npm run build:cpp-wasm:docker       # Docker, no local emsdk
npm run verify:cpp-wasm

# Optional: AS + C++ when emsdk is available (skips C++ if missing)
npm run build:all-wasm
```

Runtime opt-in (still falls back to AssemblyScript if the C++ binary is missing):

```bash
VITE_CPP_WASM=true npm run dev
```

**Do not** treat `VITE_CPP_WASM` as a supported production configuration until a gameplay consumer of Verlet/noise lands and CI smoke covers that flag.

C++-only exports (`allocPhysicsBodies`, `stepPhysics`, `fractalNoise2D`, …) remain typed as `Partial<CppExtrasExports>` on `WasmExports` for the loader; they are **not** wired into the game loop.

## CI

- **typecheck-and-build** / **smoke**: AssemblyScript WASM only (required path).
- **cpp-wasm**: optional job (Emscripten). Failures do not block merge; confirms the experimental tree still builds when runners have emsdk.

## Null WASM

`game.wasmExports` is typed `WasmExports | null`. Load failure leaves it `null`; obstacle collision must not assume exports exist.

## Future (when Option B would make sense)

1. Wire at least one gameplay caller of Verlet or noise.
2. Ensure `npm run build:cpp-wasm && npm run copy:cpp-wasm` is verified in an optional CI job (already sketched).
3. Document production opt-in and smoke under `VITE_CPP_WASM=true`.

Until then, expand **AssemblyScript** if new collision primitives are needed.

## Further reading

- [`cpp/README.md`](../cpp/README.md) — emsdk / Docker for experimental builds
- [`src/wasm_loader.ts`](../src/wasm_loader.ts) — loader API and export types
- [`assembly/index.ts`](../assembly/index.ts) — supported collision source
