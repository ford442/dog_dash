# Dog Dash — C++ WASM Module

Optional WebAssembly backend compiled with [Emscripten](https://emscripten.org/). It mirrors the AssemblyScript collision API and adds **Verlet physics** (`stepPhysics`, body accessors) and **fractal noise** (`fractalNoise2D`, `fractalNoise3D`) for procedural terrain and sling gameplay.

The default game build uses AssemblyScript only. Enable the C++ backend at runtime with `VITE_CPP_WASM=true` after building and copying `game_cpp.wasm`.

See [docs/WASM_BACKENDS.md](../docs/WASM_BACKENDS.md) for when to choose each backend.

## Quick start

### Option A — Local emsdk (recommended for active C++ work)

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

From the repo root:

```bash
npm run build:cpp-wasm          # release build → build/ + public/build/
npm run verify:cpp-wasm         # instantiate check (Node)
```

Set `EMSDK` if your checkout is not in a default location:

```bash
export EMSDK=/path/to/emsdk
source "$EMSDK/emsdk_env.sh"
npm run build:cpp-wasm
```

`cpp/build.sh` also picks up `emcc` when it is already on `PATH` after you `source emsdk_env.sh`.

### Option B — Docker (no local emsdk)

Requires Docker. Builds inside the official `emscripten/emsdk` image:

```bash
npm run build:cpp-wasm:docker
```

Equivalent one-liner:

```bash
./cpp/build.sh --docker --release
```

### Option C — CMake (alternative to build.sh)

```bash
cd cpp
emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release
emmake cmake --build build
cp build/game_cpp.wasm ../public/build/
```

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run build:cpp-wasm` | Release build via `cpp/build.sh --release` |
| `npm run build:cpp-wasm:debug` | Debug/unoptimised build |
| `npm run build:cpp-wasm:docker` | Docker build (no local emsdk) |
| `npm run copy:cpp-wasm` | Copy `build/game_cpp.wasm` → `public/build/` |
| `npm run build:all-wasm` | AssemblyScript (always) + C++ (when emsdk is present) |
| `npm run verify:cpp-wasm` | Node smoke-check of `public/build/game_cpp.wasm` |

## Runtime opt-in

Create `.env.development.local`:

```
VITE_CPP_WASM=true
```

Or force in code:

```ts
import { loadWasm, WasmBackend } from './wasm_loader';
const wasm = await loadWasm(WasmBackend.Cpp);
```

If `game_cpp.wasm` is missing or fails to load, `wasm_loader.ts` falls back to AssemblyScript automatically.

## Source layout

| File | Role |
|------|------|
| `src/main.cpp` | Entry point (includes subsystems) |
| `src/collision.cpp` | Asteroid/spore/boss collision (AS parity) |
| `src/physics.cpp` | Verlet integrator |
| `src/noise.cpp` | Simplex + fractal noise |
| `build.sh` | Single-command Emscripten build |
| `CMakeLists.txt` | CMake/Emscripten alternative |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `emcc not found` | `source /path/to/emsdk/emsdk_env.sh` or use `--docker` |
| `loadWasm(Cpp)` falls back to AS | Run `npm run build:cpp-wasm` and confirm `public/build/game_cpp.wasm` exists |
| Docker permission errors | Ensure your user can run `docker` (or use local emsdk) |
