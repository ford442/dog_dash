# GPU Chores

`src/gpu_chores/` is a small adapter for **non-authoritative helper compute**:
data-parallel work whose results only ever affect what is drawn or displayed.

> **Chores are not a particle-sim port.**
> Positions, velocities, lifetimes, collision, gravity and spore gameplay state
> stay on the AssemblyScript/CPU path and remain the single source of truth.
> Moving integration to the GPU is separate, parity-gated work — see
> [Future: GPU integrate](#future-gpu-integrate).

## Ops

| Op | Sync? | Authority | Used for |
|----|-------|-----------|----------|
| `compact(values, count, out, epsilon)` | yes | cosmetic | Build an instance draw list: indices where `values[i] > epsilon`, in input order. Returns the kept count. |
| `reduce(values, count, op)` | yes | cosmetic | `sum` / `max` / `min` for HUD and juice meters and debug readouts. |
| `reduceAsync(values, count, op)` | no | cosmetic | Same reduction on the renderer's WebGPU device. May land a frame or more late. |

Synchronous ops are **CPU-exact**: the AssemblyScript backend accumulates in
`f64` so it is bit-identical to the JS reference backend, and
`tests/unit/gpu_chores.test.ts` asserts that across several array sizes.
`reduceAsync` folds workgroup partials in tree order, so its `sum` may differ
in the last ulp — which is why it is restricted to cosmetic readouts.

## Backend order

```
WebGPU (async, cosmetic only)  →  AssemblyScript/WASM (sync)  →  JS (sync)
```

Two rules make this safe:

1. **No second device.** The WebGPU tier never calls `navigator.gpu.requestAdapter()`
   or `requestDevice()`. It adopts the device the Three.js `WebGPURenderer`
   already created, via `getGpuChores().attachRenderer(renderer)` in
   `src/scene_context.ts`. If renderer boot produced no WebGPU device — a WebGL
   session, or a failed boot probe — the tier simply stays off. Chores must
   never resurrect a GPU the renderer rejected.
2. **No dual-hot ownership.** Chores never write back into a particle SoA. They
   read a snapshot of values JS has already finalised for the frame and return
   indices or a scalar. There is no frame in which a compute pass and the
   renderer both own the same particle state.

The AssemblyScript tier reuses the *same* WASM instance gameplay collision runs
on, but only touches its own `allocChoreValues` / `allocChoreIndices` buffers.
The asteroid, spore and boss hitbox buffers are untouched, so collision
determinism and the physics fixtures are unaffected. A WASM build predating the
chore exports fails the `supportsChores` probe and falls through to JS.

## Kill switch and breadcrumbs

| URL flag | Effect |
|----------|--------|
| `?no_gpu_compute` | Pins the JS tier; WebGPU adoption and the WASM tier are both refused. |
| `?chores=js` / `?chores=wasm` / `?chores=webgpu` | Pins a preference explicitly. |

Runtime breadcrumbs land on `window.gpuChores`:

```js
{
  backend: 'webgpu' | 'wasm' | 'js',   // highest tier available
  syncBackend: 'wasm' | 'js',          // tier servicing compact/reduce
  gpuDisabled: false,
  reason: 'adopted renderer WebGPU device',
  ops: { compact: 1204, reduce: 3, reduceAsync: 0 }
}
```

The debug panel (`` ` `` in dev, or `?debug`) prints the same line under the
renderer info.

## Current consumers

- `src/particles.ts` — `ParticleSystem` and `DebrisSystem` build their instance
  draw list with `compact`, dropping instances that have shrunk below
  `DRAW_SCALE_EPSILON` (sub-pixel at any sane camera distance). Simulation runs
  exactly as before; only the submitted instance count changes.
- `getDrawStats()` on both systems uses `reduce` for peak draw scale. It is
  called on demand by debug tooling, never per frame from the render path.

## Adding a chore

1. Add the op to `SyncChoresBackend` in `src/gpu_chores/types.ts`.
2. Implement it in `js_backend.ts` first — that file defines the semantics.
3. Mirror it in `assembly/index.ts` (accumulate in `f64`) and in
   `wasm_backend.ts`, then `npm run build:wasm && npm run copy:wasm`.
4. Extend `tests/unit/gpu_chores.test.ts` so the WASM tier is asserted
   bit-identical to JS.
5. Keep it cosmetic. If an op's result would change a collision, a spawn
   decision, or anything a save file records, it does not belong here.

## Future: GPU integrate

A GPU particle/spore integrate step (positions and velocities advanced in a
compute pass) is deliberately **out of scope** for this layer. Before any of it
lands it needs:

- golden-fixture parity tests against `assembly/index.ts` for the same seeds,
- a decision on who owns the SoA on a frame where readback is late,
- and a fallback story for browsers where the device is lost mid-run.

Until those exist, gameplay authority stays on AS/WASM. Track that work in its
own issue; do not grow it out of `src/gpu_chores/`.
