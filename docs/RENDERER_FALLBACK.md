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
3. `requestAdapter()` — **once**
4. `requestDevice()` — **once**
5. Configure the game canvas with a `webgpu` context

The resulting `GPUDevice` and `GPUCanvasContext` are handed to
`WebGPURenderer` rather than letting it request its own, so "one adapter, one
device" holds for the whole page. The probe outcome is memoised: a failed probe
stays failed for the life of the page, and nothing — the renderer, the GPU
chores layer, debug tooling — may re-request a device afterwards.

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
  durationMs: 11
}
```

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

## URL flags

| Flag | Effect |
|------|--------|
| `?skip_gpu_boot` | Skips the probe entirely (stage `skipped`). For headless CI and bundle-health checks. Never a rendering path. |
| `?wireframe`, `?collisionDebug`, `?debug` | Unchanged debug helpers. |

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
