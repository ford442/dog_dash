## 🌌 Architect: God Ray Activation Fix & Architecture Polish

### Concept
> "Dynamic Volumetric God Rays: Volumetric light shafts are implemented using an InstancedMesh with layered soft quads. TSL materials provide procedural drifting animation (swaying and pulsing), while intensity smoothly reacts to the player's dashing speed and current level density. The technique brings lighting life to cloudy and nebulous environments."

### Implementation
- `godrays.ts` was mostly implemented, but `GodRayOverlay` and its integration with lightning flashes in `clouds.ts` was missing.
- Added `GodRayOverlay` to `clouds.ts` using `MeshBasicNodeMaterial` with radial godray blending based on light source position.
- Updated `CloudSystem.triggerLightningAt` to activate the `GodRayOverlay` on lightning strikes.
- Cleaned up LevelManager config usage by centralizing `blackHole` and `cloudCastles` environment configuration via the `applyEnv` pattern in `level_manager.ts`.

### Visuals
- God rays overlay dynamically adjusts based on the lightning flash intensity and 3D screen position mapped to UV coordinates.
- Used TSL `uv`, `distance`, and `sin` to create the radial pulse and spread.
- Radial falloff dynamically blends with the screen to simulate scattering.

### Integration
- `clouds.ts`: Integrated `GodRayOverlay` within `CloudSystem`.
- `level_config.ts`: Cleaned up the `environments` list for levels, adding `cloudCastles` to Level 3 and centralizing `blackHole`.
- `level_manager.ts`: Replaced scattered level checks for environments with `applyEnv(cfg, 'environmentName')`.

### Testing
- [x] `npm run build` passes
- [x] Tested in Level 1 and Level 3 via `npm run dev` and playwright scripts
- [x] Mobile/touch controls unaffected
