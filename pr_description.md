## 🌌 Dynamic Volumetric God Rays (Light Shafts)

### Concept
> "The effect is a palpable sense of flying through a vast, three-dimensional atmosphere rather than just over a flat background."

### Implementation
- Created `GodRaySystem` in `src/godrays.ts` using a highly performant **InstancedMesh** + **TSL shaders**.
- Light shaft intensity and definition now react dynamically to the player’s dashing speed (stronger and more prominent at higher velocities).
- Added `godRays` configuration to `LevelConfig` and enabled the effect on cloud/nebula-heavy levels (1, 2, and 5).

### Visuals
- 20 instanced quads using `AdditiveBlending` and `depthWrite = false`.
- Soft-edge fading (horizontal + vertical) with subtle procedural shimmering via TSL (UV + time based).
- Warm ethereal color palette (e.g. `0xffcc88`) that can be tuned per level.

### Integration
- **`main.ts`**: Instantiates `GodRaySystem` and passes it to `LevelManager`.
- **`level_manager.ts`**: Handles activation/deactivation on level transitions via `activate(cfg.godRays)` / `deactivate()`, plus per-frame updates.
- **`level_config.ts`**: Extended `LevelConfig` with the new `godRays` properties.

### Testing
- [x] `npm run build` passes cleanly
- [x] Verified in Levels 1, 2, and 5 via `npm run dev`
- [x] Mobile/touch controls unaffected
- [x] WebGPU constraints respected (no heavy dependencies)
