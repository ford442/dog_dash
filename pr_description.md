## 🌌 Architect: Dancing Jelly-Moss

### Concept
> "Dancing Jelly-Moss with tiny fairy lights swaying to background music." (§2.4 Animated Juice in docs/plans/ideas.md)

### Implementation
- Built a brand new visual system `DancingJellyMossSystem` following the Cosmic Architect pattern.
- Implements two parallax scrolling layers using `THREE.InstancedMesh`.
- Implements TSL-driven procedural swaying, glowing, and floating logic on GPU.
- Added to `LevelEnvironments` in `src/level_config.ts` and enabled for Levels 1 and 5.
- Registered via the environment plugin system in `src/level_manager/environment_plugins.ts` with deferred loading support.

### Visuals
- Layer 1: Jelly-moss patches (`DodecahedronGeometry`) featuring a TSL `MeshStandardNodeMaterial` that sways using `sin(time + positionWorld)` and visually glows when near the player (`smoothstep` using `distance` to `uPlayerPos`).
- Layer 2: Fairy lights (`PlaneGeometry`) using `MeshBasicNodeMaterial` with additive blending that bob gently over time and pulse their opacity.
- Dynamic wrapper ensures an infinite procedural parallax background field.

### Integration
- `src/dancing_jelly_moss.ts`: Core feature module
- `src/level_config.ts`: Added to Levels 1 and 5
- `src/level_manager/types.ts`: Added to `LevelEnvironmentPorts`
- `src/level_manager/environment_plugins.ts`: Added to `buildEnvironmentPlugins`
- `src/deferred_system_stubs.ts` / `src/level_systems_loader.ts` / `src/create_game_systems.ts`: Fully integrated into the dynamic loader pipeline.
- `src/level_manager/manager.ts`: Calls `this.dancingJellyMossSystem.update()` in the core loop.

### Testing
- [x] `npx tsc --noEmit` / `npm run typecheck:ci` passes
- [x] `npm run build` passes
- [x] `npx playwright test` passes
- [x] Verified `Euler` to `Quaternion` matrix decomposition fixes.
