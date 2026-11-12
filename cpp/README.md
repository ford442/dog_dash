# Dog Dash — C++ WASM Module (experimental research tree)

> **Product status:** AssemblyScript is the single supported, always-built backend for collision, Verlet soft-body physics, *and* fractal noise (all ported into [`assembly/`](../assembly/)). This tree is kept only for SIMD prototyping, native profiling, and portable-build experiments — it is **not a shipping target**, is optional, and is not required for `npm run dev` / `npm run build`. See [docs/WASM_BACKENDS.md](../docs/WASM_BACKENDS.md).

Optional WebAssembly module compiled with [Emscripten](https://emscripten.org/). It mirrors the **shipping AssemblyScript ABI** for:

- **Spatial hash** (`allocEntities`, `rebuildGrid`, `queryRadius`, `queryRadiusSimd`, `queryRadiusFirst`, …) — [`src/spatial_hash.cpp`](src/spatial_hash.cpp), a line-for-line port of [`assembly/spatial_hash.ts`](../assembly/spatial_hash.ts). Results are golden-checked against AS ([`tests/fixtures/spatial_hash/golden.txt`](../tests/fixtures/spatial_hash/golden.txt)), hit order included.
- **Legacy linear scans** (`allocAsteroids` / `checkCollision`, spore, boss).
- **Verlet physics** (`stepPhysics`, body accessors) and **fractal noise** (`fractalNoise2D/3D`).

**Not mirrored** (AssemblyScript only): `allocObjects` / `freeObjects` / `getObjectPtr` and the GPU-chore buffers.

**What this tree is for:** trying wider SIMD, SoA layouts and cell sizes on large entity counts, and native profiling of large Verlet nets. Winners get **ported back to AssemblyScript**; then regenerate the golden (`npm run gen:spatial-hash-golden`) and re-sync the C++ mirror. No gameplay feature depends on this tree.

`VITE_CPP_WASM=true` is a researcher flag. The loader **fails closed**: a `game_cpp.wasm` that is missing or lacks the spatial-hash exports is rejected (`console.error` + `window.wasmBackendRejected`) and AssemblyScript loads instead, so a stale binary can never quietly put collision on the JS brute-force path.

The C++ heap (1 MiB floor, grows freely) is **not comparable** to the AS heap (512 KiB floor, 16 MiB cap). See [docs/WASM_BACKENDS.md § Memory](../docs/WASM_BACKENDS.md).

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
npm run verify:cpp-wasm         # exports + spatial-hash golden vs AS (scalar + SIMD) + Verlet/noise smoke
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
| `npm run verify:cpp-wasm` | Exports + spatial-hash golden parity vs AS + Verlet/noise smoke |
| `npm run test:cpp-native` | Host build (CMake, no emsdk): `test_noise` + `test_spatial_hash` golden |
| `npm run bench:cpp-spatial-hash` | Native `rebuildGrid` / `queryRadius` microbench (`-- [entities] [queries] [cell]`) |
| `npm run gen:spatial-hash-golden` | Regenerate the golden from the AS binary after an intentional AS change |
| `npm run verify:cpp-softbody` | Node check of Verlet soft-body consumer exports |
| `npm run build:all-wasm` | AS always; C++ only if emsdk/docker available |

## Runtime

```bash
VITE_CPP_WASM=true npm run dev
```

Accepted: `window.wasmBackend === 'cpp'` and collision runs through the C++ `queryRadius`. Rejected (missing binary or missing spatial-hash exports): `window.wasmBackend === 'assemblyscript'` and `window.wasmBackendRejected` says why. Debug builds (no `-msimd128`) report `simdSupported() === 0`, so the loader does not mark the handle as SIMD.

Breadcrumbs: `window.wasmBackend`, `window.wasmBackendRejected`, `window.jellyMossSoftBodyActive`, `window.jellyMossSoftBodyHeroCount`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `loadWasm(Cpp)` falls back to AS | Read `window.wasmBackendRejected`; usually a stale binary — run `npm run build:cpp-wasm` |
| `verify:cpp-wasm` golden mismatch | `cpp/src/spatial_hash.cpp` drifted from `assembly/spatial_hash.ts` (or the golden was regenerated after an AS change) — re-sync the port |
| emsdk not found | `source emsdk_env.sh` or use `build:cpp-wasm:docker` |
| Soft-body inactive with C++ loaded | Confirm hero mosses spawned (deferred prototype content) and `jellyMossSoftBodyHeroCount > 0` |

WASM compile flags live in `cpp/build.sh` only (`CMakeLists.txt` no longer duplicates the Emscripten target).

## Native tests

`BUILD_NATIVE_TESTS` stays disabled — `cpp/tests/*.cpp` was never checked in. Re-add only when real native tests land (see `CMakeLists.txt` comment).

## Future

- SIMD (`v128`) collision broad-phase prototyping — see the WASM backend consolidation proposal in `docs/WASM_BACKENDS.md` and issue history for the planned uniform spatial hash.
- Native profiling of the Verlet integrator and noise kernels ahead of any future AssemblyScript `v128` port.
- Liquid-metal / vacuum-kelp soft interactions can reuse the same Verlet helpers (in `assembly/physics.ts` for shipping use; here for native comparison).
