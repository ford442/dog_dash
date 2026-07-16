# WASM Backends

Dog Dash ships two WebAssembly backends for physics and procedural helpers. Only one is active at runtime; the loader in `src/wasm_loader.ts` selects it.

## Decision matrix

| | **AssemblyScript (default)** | **C++ (opt-in)** |
|---|------------------------------|------------------|
| **Binary** | `public/build/optimized.wasm` | `public/build/game_cpp.wasm` |
| **Build** | `npm run build:wasm` (automatic in `predev` / `npm run build`) | `npm run build:cpp-wasm` (requires Emscripten) |
| **Extra deps** | None (`asc` via npm) | [Emscripten emsdk](https://emscripten.org/) or Docker |
| **Collision** | ✅ Asteroids, spores, bosses | ✅ Same API |
| **Verlet physics** | ❌ | ✅ `stepPhysics`, body accessors |
| **Fractal noise** | ❌ | ✅ `fractalNoise2D` / `fractalNoise3D` |
| **CI default** | ✅ Built on every PR | Optional job when emsdk is installed |
| **Runtime flag** | (default) | `VITE_CPP_WASM=true` or `loadWasm(WasmBackend.Cpp)` |

### When to use AssemblyScript

- Normal development and production builds
- You only need WASM collision checks (`checkCollision`, `checkSporeCollision`, `checkBossCollision`)
- Zero native toolchain beyond Node.js

### When to use C++

- Experimenting with sling/gravity gameplay (`stepPhysics`)
- Procedural terrain or asteroid fields driven by `fractalNoise2D`
- You already have Emscripten installed or are fine using the Docker one-liner

Gameplay code is not wired to C++-only exports yet; see `docs/plans/plan.md` for the planned integration. The loader and build pipeline are ready so those features can land behind the same opt-in flag.

## Build commands

```bash
# Default pipeline (AssemblyScript only)
npm run dev
npm run build

# AssemblyScript + C++ when emsdk is on PATH / EMSDK is set
npm run build:all-wasm

# C++ only
npm run build:cpp-wasm              # local emsdk
npm run build:cpp-wasm:docker       # Docker, no local emsdk

# Verify C++ artifact instantiates correctly
npm run verify:cpp-wasm
```

`prebuild` runs the brace checker only — it does **not** require C++ or Emscripten.

## Runtime selection

1. Set `VITE_CPP_WASM=true` in `.env.development.local`, **or**
2. Call `loadWasm(WasmBackend.Cpp)` explicitly.

If `game_cpp.wasm` is absent or fails to instantiate, the loader logs a warning and falls back to AssemblyScript.

## CI

- **typecheck-and-build** / **smoke**: AssemblyScript WASM + Vite (unchanged).
- **cpp-wasm** (optional): installs Emscripten, runs `npm run build:cpp-wasm`, and `npm run verify:cpp-wasm`. Does not block the smoke job.

## Further reading

- `cpp/README.md` — emsdk setup, Docker, CMake
- `src/wasm_loader.ts` — loader API and export types
- `assembly/index.ts` — AssemblyScript collision source
- `cpp/src/` — C++ collision, physics, and noise
