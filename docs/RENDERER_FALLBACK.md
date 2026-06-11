# Renderer Fallback

Dog Dash uses WebGPU as the primary Three.js renderer and WebGL2 as a toggleable fallback for visual debugging and compatibility checks.

## Runtime Selection

Default:

```text
http://localhost:5173/
```

Force WebGL2:

```text
http://localhost:5173/?renderer=webgl
```

The app also accepts `?webgl` as a shorthand. If WebGPU is unavailable or blocked by an insecure context, the renderer factory falls back to WebGL2 automatically.

Runtime breadcrumbs:

```js
window.rendererType
window.usingWebGPU
window.usingWebGL
window.rendererFallbackReason
```

## Shared State

Both renderer paths use the same:

- Three.js scene and camera
- level config and level manager data
- player/enemy/flora/particle objects
- controls and HUD
- WASM collision checks
- main animation loop

Renderer selection must not fork gameplay state.

## Debug Helpers

The backquote debug panel includes:

- `Wireframe`: applies wireframe rendering to current and newly spawned materials.
- `Collision Debug`: draws lightweight wire spheres for the player, asteroids, squids, slingable objects, spore clouds, jelly moss, and gravity-anchor fields.

Startup flags:

```text
?wireframe
?collisionDebug
```

## Material Compatibility

Most game materials are standard Three.js materials or Three node materials. The WebGL2 renderer first attempts to render the same materials for maximum parity. If a WebGL2 render throws because a node material is not accepted, the render wrapper converts node materials in the active scene to approximate `MeshStandardMaterial`, `MeshBasicMaterial`, or `PointsMaterial` fallbacks and retries once.

That fallback preserves base color, opacity, transparency, blending, roughness, metalness, emissive values, maps, and wireframe flags where available. TSL-specific animated shader nodes are not preserved after conversion.

## Verification

Recommended local checks:

```bash
npm run build
npm run dev
```

Manual browser checks:

- `http://localhost:5173/`
- `http://localhost:5173/?renderer=webgl`
- `http://localhost:5173/?renderer=webgl&wireframe&collisionDebug`

Open the debug panel with backquote and confirm the renderer line reports the expected backend.
