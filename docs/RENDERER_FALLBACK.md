# Renderer: WebGPU only (WebGL deferred)

Dog Dash renders through **WebGPU exclusively**. There is no WebGL2 fallback.

> **Why the fallback was removed.** A silent WebGL fallback made WebGPU
> failures invisible: Chrome failing and Edge failing looked identical from the
> outside, because both quietly rendered through a different backend. Boot now
> hard-fails with a diagnostic screen so the two can be compared directly.
>
> **Restoring a WebGL path is a later issue wave.** It is deferred, not
> rejected. Until then, do not reintroduce a `webgl` / `webgl2` context on the
> default boot path.

## Boot probe

`src/webgpu_probe.ts` runs one probe at startup:

1. `navigator.gpu` present?
2. Secure context?
3. `requestAdapter({ powerPreference })` — **once**. `high-performance` by default; `low-power` with `?quality=battery` (see [Pixel-ratio policy](#pixel-ratio-policy))
4. `requestDevice()` — **once**
5. Configure the game canvas with a `webgpu` context

The resulting `GPUDevice` and `GPUCanvasContext` are handed to
`WebGPURenderer` rather than letting it request its own, so "one adapter, one
device" holds for the whole page. The probe outcome is memoised: a failed probe
stays failed for the life of the page, and nothing — the renderer, the GPU
chores layer, debug tooling — may re-request a device afterwards.

### Device descriptor

The single `requestDevice` call always uses an explicit descriptor:

- `label: "dog-dash"`
- `defaultQueue.label: "dog-dash-queue"`
- **no `requiredLimits`** — Three.js r182 does not document a minimum we must demand, so we omit them and boot on Intel iGPU / software adapters
- **no required features** that would fail the probe. Optional features are collected only when the adapter already exposes them:
  - `timestamp-query` — requested only with `?debug`, and only if `adapter.features` has it. Used for debug GPU timing; never required to play
  - `bgra8unorm-storage` is **not** requested. Three.js r182's `WebGPURenderer` adopts the probed device and the preferred canvas format; it does not need that storage flag to boot

An `uncapturederror` listener is attached to the device. Messages are appended to `window.webgpuProbe.uncapturedErrors` (capped). GPU chores must not call `requestDevice` — they adopt this device or stay on JS/WASM.

Success breadcrumbs also include `requestedFeatures`, `enabledFeatures` and `powerPreference`.

### Canvas configuration

`context.configure()` is called once, in the probe, and nowhere else:

| Field | Value | Why |
|-------|-------|-----|
| `format` | `navigator.gpu.getPreferredCanvasFormat()` | bgra8unorm on most desktops, rgba8unorm on some Android |
| `alphaMode` | `'opaque'` | the canvas never composites with the page |
| `usage` | default (`RENDER_ATTACHMENT`) | Three r182 only renders into the swap-chain texture. If extra bits are ever needed, set them here — never in chores or integrate |
| `colorSpace` / `toneMapping` | defaults (`srgb` / `standard`) | tone mapping is done by `WebGPURenderer` (ACES, exposure 1.3) |

`WebGPURenderer` gets `antialias: true` and `trackTimestamp` only when the device actually has `timestamp-query`.

### GPU timing (debug)

With `?debug` on an adapter that exposes `timestamp-query`, the debug panel (`` ` ``) shows a **GPU time** line: smoothed render-pass milliseconds per frame (`src/gpu_timing.ts`). The game loop drains Three's timestamp query pool once per frame; readback is async and may be a frame or two late. Without the feature the line reads `n/a`. It is never required to play.

## Pixel-ratio policy

Named presets live in `src/pixel_ratio.ts` and `CONFIG.pixelRatio`:

| Preset | Scale | How to select |
|--------|-------|----------------|
| `quality` | 1.0 | `?quality=quality`, debug panel |
| `default` | 0.75 | shipping default (no hidden `0.60`) |
| `battery` | 0.5 | `?quality=battery` (also selects the `low-power` adapter) |

The FPS scaler steps `0.50 → 0.75 → 1.0 → 1.5 → 2.0`. It no longer has a silent `0.60` rung.

## Shadows

`renderer.shadowMap.enabled` stays **false**. Directional lights do **not** allocate a 1024² shadow map or configure `shadow.camera` unless shadows are on (`?shadows` or the debug **Shadows** toggle). Mesh `castShadow` flags elsewhere are inert while the map is off.

## Optional post FX

`?fx=1` (debug toggle **Bloom / CA post FX**) enables a mild TSL bloom from `three/addons/tsl/display/BloomNode`. This is Three's own addons tree — not a third-party composer. The WebGL `EffectComposer` in `three/addons/postprocessing` is **not** used (it would need a WebGL context). `prefers-reduced-motion: reduce` disables the stack. Pixel-glow (`?pixelGlow`) still wins if both are on.

## Breadcrumbs

`window.webgpuProbe` is always populated:

```js
{
  ok: false,
  browser: "Microsoft Edge 128",     // distinguishes Chrome from Edge
  reason: "requestAdapter() resolved to null — no compatible adapter.",
  adapter: null,                      // vendor/architecture/features when known
  stage: "adapter",
  userAgent: "...",
  durationMs: 11,
  powerPreference: "high-performance"
}
```

After a successful boot the same object gains `lost: { reason, message, afterMs }` if the device is later lost.

`stage` is one of `ok`, `skipped`, `no-navigator-gpu`, `insecure-context`,
`adapter`, `device`, `canvas-context`. Adapter details survive a *device*
failure, which is what makes a cross-browser comparison possible.

Renderer breadcrumbs remain for compatibility:

```js
window.rendererType          // always 'webgpu'
window.usingWebGPU
window.usingWebGL            // always false — no WebGL context is created
window.rendererFallbackReason
```

## Failure behaviour

On a failed probe, `bootstrap()` renders the blocking screen from
`src/boot_failure.ts` and stops. The screen shows the browser, the reason, an
explanation of the stage, and the probe JSON with a copy button. There is no
"continue anyway" — there is nothing to continue into.

## Device loss

A device that booted can still be lost: driver reset, GPU-process crash, a
laptop evicting a backgrounded tab's GPU memory. The probe subscribes to
`device.lost` once. On any reason (`'unknown'` or `'destroyed'`):

1. `window.webgpuProbe.lost` is set to `{ reason, message, afterMs }`.
2. `bootstrap()`'s subscriber stops the animation loop (sim frozen, no more
   draws), suspends audio, and shows the same blocking screen with
   device-lost copy and a **Reload** button (`showDeviceLost` in
   `src/boot_failure.ts`).
3. GPU chores drop their WebGPU tier and stay on WASM/JS; `attachRenderer`
   refuses to adopt anything afterwards.

Nothing calls `requestAdapter` again — one adapter, one device per page load
still holds. Reload is the only recovery. Subscribe with
`onWebGpuDeviceLost()` / check `isWebGpuDeviceLost()` from `src/webgpu_probe.ts`.

## URL flags

| Flag | Effect |
|------|--------|
| `?skip_gpu_boot` | Skips the probe entirely (stage `skipped`). For headless CI and bundle-health checks. Never a rendering path. |
| `?debug` | Debug helpers **and** optional `timestamp-query` on the device descriptor when the adapter supports it. |
| `?quality=battery\|default\|quality` | Pixel-ratio preset (see above); `battery` also requests the `low-power` adapter. |
| `?fx=1` | Optional bloom post stack (reduced-motion aware). |
| `?shadows` | Enable shadow maps and configure the main light's shadow camera. |
| `?gpu_integrate` | Opt into the WebGPU particle/debris integrate ([GPU_INTEGRATE.md](GPU_INTEGRATE.md)). `?no_gpu_compute` overrides it. |
| `?wireframe`, `?collisionDebug` | Unchanged debug helpers. |

`?renderer=webgl` no longer exists.

## CI

Headless Chrome exposes no usable WebGPU adapter, so CI **cannot** run
gameplay, and must not add a GL context to stay green. `tests/smoke.spec.ts`
instead asserts the hard-fail contract:

- the probe breadcrumb is populated and names a browser, reason and stage
- the blocking screen appears with the probe JSON on it
- `window.usingWebGL` is false and the renderer never reports a `webgl` backend
- the bundle throws nothing on the way down
- nothing re-requests an adapter after boot

`?skip_gpu_boot` covers "the bundle parses and boots" without touching the GPU.

## Verification

Gameplay verification now requires a **WebGPU-capable browser** — Chrome or
Edge 113+ on a machine with a working GPU:

```bash
npm run build
npm run preview
```

Then open `http://localhost:4173/` and confirm:

- the game reaches the title screen and gameplay HUD
- `window.webgpuProbe.ok === true`
- the debug panel (backquote) reports `renderer: webgpu`

To exercise the failure path deliberately, launch the browser with WebGPU
disabled (`--disable-features=WebGPU` in Chrome/Edge) and confirm the boot
failure screen appears with a populated probe JSON.

## Material compatibility

The `window.usingWebGL` guards scattered through the visual systems
(`candy_materials`, `pastel_nebula`, `industrial_background`, `galactic_core`)
and `WebGLMaterialFallbackRenderer` are **kept but permanently inert** — they
are the seam a future WebGL wave would re-activate. Leave them alone rather
than deleting them.
