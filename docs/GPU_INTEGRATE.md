# GPU integrate (visual particles)

`src/gpu_integrate/` advances the **visual** particle and debris systems
(`ParticleSystem`, `DebrisSystem` in `src/particles.ts`) in a WebGPU compute
pass. It is separate from `src/gpu_chores/` (compact/reduce helpers only) and
never touches gameplay: nothing in collision, `SpatialIndex`, harvest, saves or
the replay snapshot reads these systems.

**Status: opt-in.** Enable with `?gpu_integrate`. It is parity-tested against
the JS integrate (below) but has not been profiled on real hardware yet; flip
the default in `readGpuIntegratePreference()` once it has.

## Ownership split

| Owner | State |
|-------|-------|
| CPU (`particles.ts`) | `life`, `maxLife`, `size`, colour, slot order (swap-remove), emission, draw list (chores `compact`), draw scale, particle spin |
| GPU (`kernels.ts`) | position, velocity, debris rotation, and the per-slot instance matrix |

Each step the CPU runs the same lifecycle loop as the JS path and records every
swap-remove in a gather permutation: survivor `i` comes from `perm[i]`. The
`integrate` entry point does `dst[i] = advance(src[perm[i]])` (ping-pong
buffers), and `compose` builds `mat4x4` instance matrices for the compacted draw
slots. Slot order, counts and culling therefore match the JS path exactly; only
float rounding differs.

Newly emitted particles are written into the CPU SoA by `emit()` as before and
uploaded (`writeState`) at the start of the next step.

## Readback and "last-good"

Matrices are copied to one of three `MAP_READ` staging buffers and read back
asynchronously. Each result carries a monotonic `seq`; `IntegrateBinding`
applies the newest result into `InstancedMesh.instanceMatrix` (and the colour
snapshot taken for that same step) and ignores anything older than what is on
screen. If every staging buffer is busy the sim still advances and the mesh
keeps its last-good matrices. The sim is never gated on readback.

Expect particles to be drawn a frame or two behind the sim in GPU mode.

## Fallbacks

| Situation | Behaviour |
|-----------|-----------|
| no `?gpu_integrate`, `?gpu_integrate=0`, or `?no_gpu_compute` | JS integrate; the renderer device is not even looked at |
| boot probe failed / no WebGPU device | JS integrate |
| pipeline build fails (`createComputePipelineAsync` rejects) | that system stays on JS |
| validation error, rejected `mapAsync` | kernel marked failed; system returns to JS next step |
| device lost (`onWebGpuDeviceLost`) | manager detaches every kernel; systems return to JS |

Returning to JS drops in-flight particles (≤ 1 s of sparks, ≤ 4 s of debris):
their kinematics lived on the GPU and cannot be read back from a lost device.

The integrate never calls `requestAdapter` / `requestDevice`; it adopts the
renderer's device like the chores layer does (a unit test greps for this).

## Parity tests

Golden fixture: `tests/fixtures/gpu_integrate/golden.json`, recorded from the
**JS** integrate on a seeded scenario (`tests/gpu_integrate/scenario.ts`).

| Test | Where | What it checks |
|------|-------|----------------|
| `npm run test:unit` → `tests/unit/gpu_integrate.test.ts` | Node, no GPU | JS still reproduces the golden; the full GPU-mode pipeline on `f32_reference.ts` (an op-by-op f32 mirror of the WGSL) matches it; fallback, stale-readback and `?no_gpu_compute` behaviour |
| `npm run test:gpu-parity` → `tests/gpu/integrate_parity.spec.ts` | headless Chrome, SwiftShader WebGPU | the real WGSL matches the golden |

Tolerances: translation (the integrated position) 5e-5; the rotation·scale
basis 5e-3, because WGSL only guarantees `sin`/`cos` to 2⁻¹¹ absolute error on
[-π, π] and SwiftShader sits near that bound (hardware is usually ~1e-6). Angles
are range-reduced to [-π, π] before `sin`/`cos`. A wrong axis, formula or slot
order shows up as O(0.1–1).

After an intentional change to the JS particle/debris integrate, change
`kernels.ts` and `f32_reference.ts` to match and re-record:

```bash
npm run gpu-integrate:record
```

## Future

- Bind the matrix storage buffer straight to the instanced draw (TSL
  `storage()` / `instancedArray`) and skip the readback entirely.
- Spores, once their visual state is split from gameplay state the same way.
