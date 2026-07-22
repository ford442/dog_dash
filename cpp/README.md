# Dog Dash — C++ WASM Module (experimental)

> **Product status:** AssemblyScript is the supported collision backend. This tree is optional and not required for `npm run dev` / `npm run build`. See [docs/WASM_BACKENDS.md](../docs/WASM_BACKENDS.md).

Optional WebAssembly backend compiled with [Emscripten](https://emscripten.org/). It mirrors the AssemblyScript collision API and also exports **Verlet physics** (`stepPhysics`, body accessors) and **fractal noise** (`fractalNoise2D`, `fractalNoise3D`). Those extras are **not** wired into TypeScript gameplay yet.

The default game build uses AssemblyScript only. Enable the C++ backend at runtime with `VITE_CPP_WASM=true` after building and copying `game_cpp.wasm` (falls back to AS if the binary is missing).

## Quick start

### Local emsdk

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

### Docker (no local emsdk)

Requires Docker. Builds inside the official `emscripten/emsdk` image:

```bash
npm run build:cpp-wasm:docker
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build:cpp-wasm` | Release build via `cpp/build.sh --release` |
| `npm run build:cpp-wasm:debug` | Debug/unoptimised build |
| `npm run build:cpp-wasm:docker` | Docker build (no local emsdk) |
| `npm run copy:cpp-wasm` | Copy `build/game_cpp.wasm` → `public/build/` |
| `npm run verify:cpp-wasm` | Node smoke-check of `public/build/game_cpp.wasm` |
| `npm run build:all-wasm` | AS always; C++ only if emsdk/docker available |

## Runtime

```bash
VITE_CPP_WASM=true npm run dev
```

If `game_cpp.wasm` is missing or fails to load, `wasm_loader.ts` falls back to AssemblyScript automatically.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `loadWasm(Cpp)` falls back to AS | Run `npm run build:cpp-wasm` and confirm `public/build/game_cpp.wasm` exists |
| emsdk not found | `source emsdk_env.sh` or use `build:cpp-wasm:docker` |

## Future

Wire Verlet/noise from TS (or drop this tree) before treating C++ as a supported production path.
