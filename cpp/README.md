# Dog Dash — C++ WASM Module (experimental research tree)

> **Product status:** AssemblyScript is the single supported, always-built backend for collision, Verlet soft-body physics, *and* fractal noise (all ported into [`assembly/`](../assembly/)). This tree is kept only for SIMD prototyping, native profiling, and portable-build experiments — it is **not a shipping target**, is optional, and is not required for `npm run dev` / `npm run build`. See [docs/WASM_BACKENDS.md](../docs/WASM_BACKENDS.md).

Optional WebAssembly backend compiled with [Emscripten](https://emscripten.org/). It mirrors the AssemblyScript collision API and also exports **Verlet physics** (`stepPhysics`, body accessors) and **fractal noise** (`fractalNoise2D`, `fractalNoise3D`) — the same algorithms that now live in `assembly/physics.ts` and `assembly/noise.ts`.

**No gameplay feature depends on this tree anymore.** Soft-body Jelly-Moss ([`src/jelly_moss_softbody.ts`](../src/jelly_moss_softbody.ts)) and streaming biome density ([`src/biome_noise.ts`](../src/biome_noise.ts)) both run on the default AssemblyScript build's `stepPhysics` / `fractalNoise2D` exports, with no `VITE_CPP_WASM` flag required. `cpp/` stays useful as a reference implementation and for native/SIMD experiments that AssemblyScript can't do.

The default game build uses AssemblyScript only. `VITE_CPP_WASM=true` still loads `game_cpp.wasm` for research/comparison purposes if you build it (falls back to AS if the binary is missing — no crash) — but it changes nothing observable in gameplay, since both binaries expose the same soft-body and noise API.

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
npm run verify:cpp-wasm         # instantiate + light Verlet call check
npm run verify:cpp-softbody     # soft-body consumer path (alloc/impulse/step/read)
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
| `npm run verify:cpp-softbody` | Node check of Verlet soft-body consumer exports |
| `npm run build:all-wasm` | AS always; C++ only if emsdk/docker available |

## Runtime

```bash
VITE_CPP_WASM=true npm run dev
```

If `game_cpp.wasm` is missing or fails to load, `wasm_loader.ts` falls back to AssemblyScript automatically — which, since the AssemblyScript port, drives the same soft-body and noise consumers. There is no more "AS-only, features idle" fallback tier; the only idle case left is a total WASM load failure (see docs/WASM_BACKENDS.md § Null WASM).

Breadcrumbs: `window.wasmBackend`, `window.jellyMossSoftBodyActive`, `window.jellyMossSoftBodyHeroCount`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `loadWasm(Cpp)` falls back to AS | Run `npm run build:cpp-wasm` and confirm `public/build/game_cpp.wasm` exists |
| emsdk not found | `source emsdk_env.sh` or use `build:cpp-wasm:docker` |
| Soft-body inactive with C++ loaded | Confirm hero mosses spawned (deferred prototype content) and `jellyMossSoftBodyHeroCount > 0` |

## Native tests

`BUILD_NATIVE_TESTS` stays disabled — `cpp/tests/*.cpp` was never checked in. Re-add only when real native tests land (see `CMakeLists.txt` comment).

## Future

- SIMD (`v128`) collision broad-phase prototyping — see the WASM backend consolidation proposal in `docs/WASM_BACKENDS.md` and issue history for the planned uniform spatial hash.
- Native profiling of the Verlet integrator and noise kernels ahead of any future AssemblyScript `v128` port.
- Liquid-metal / vacuum-kelp soft interactions can reuse the same Verlet helpers (in `assembly/physics.ts` for shipping use; here for native comparison).
