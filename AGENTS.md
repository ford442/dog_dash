# Dog Dash Agent Notes

Dog Dash uses Three.js with WebGPU as the primary renderer and WebGL2 as a debug fallback.

## Renderer Modes

- Default: WebGPU when available.
- Force WebGL2: open the app with `?renderer=webgl`.
- Force/default WebGPU: omit the parameter or use `?renderer=webgpu`.
- Runtime breadcrumbs are exposed as `window.rendererType`, `window.usingWebGPU`, `window.usingWebGL`, and `window.rendererFallbackReason`.

The WebGL2 path shares the same scene, camera, level data, entities, controls, WASM collision path, and game loop. Keep renderer-specific work behind the renderer factory or small debug helpers instead of forking gameplay systems.

## Debug Helpers

Open the debug panel with the backquote key. The panel includes:

- `Wireframe` for renderer/geometry inspection.
- `Collision Debug` for lightweight collision-radius spheres.
- Renderer backend status in the FPS overlay.

Useful URL flags:

- `?renderer=webgl`
- `?wireframe`
- `?collisionDebug`

See `docs/RENDERER_FALLBACK.md` for the implementation details.
