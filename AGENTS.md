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

## Cursor Cloud specific instructions

Standard commands live in `README.md` / `package.json` / `CLAUDE.md` (`npm run dev` on :5173, `npm run build`, brace-check gate `node tools/check_braces.cjs`). `predev`/`prebuild` rebuild the AssemblyScript WASM automatically, so no separate WASM step is needed for normal dev. There is no lint or test suite.

Non-obvious caveats for headless/cloud verification:

- The cloud VM has no GPU and no WebGPU adapter, so the default WebGPU path renders nothing. Always open the app with `?renderer=webgl` to force the WebGL2 fallback.
- Even with `?renderer=webgl`, a normally-launched headless/virtual Chrome shows a black canvas. Launch Chrome with software-GL flags so WebGL2 actually rasterizes: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. Confirm via `window.usingWebGL === true`. Under SwiftShader, TSL/node-material shaders fall back to plain standard materials (per `docs/RENDERER_FALLBACK.md`), so visuals look flatter/grayer than on a real GPU — this is expected, not a regression.
- Playwright is already a dev dependency; for screenshots/video point `executablePath` at the system Chrome (`/usr/local/bin/google-chrome`) and pass the flags above. Video capture additionally needs `npx playwright install ffmpeg` (one-off, not part of the update script).
