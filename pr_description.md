## 🌌 Architect: Volumetric Lightning Integration

### Concept
> "Lightning flashes that briefly illuminate the cloud layers from within, creating dynamic lighting" (from Multi-Layered Cloudscapes, Thunder Force IV reference).
> Enhances existing lightning mechanics with volumetric cloud integration, screen-space flashes, and God Ray synergies.

### Implementation
- Added a `lightning` config object (`{ enabled: boolean, density: number, color: number }`) to `LevelConfig` to drive spawn rates and colors dynamically per level.
- Updated `LightningBoltSystem` to read the density param, tying bolt generation directly to level definitions rather than a hardcoded chance, and added an extra procedural branch step (`branchWave3`) to the TSL material for more dramatic forks.
- Added `LightningFlashOverlay` to `CloudSystem`, a screen-space additive TSL overlay using a vignette mask that fades rapidly when a strike occurs.
- Hooked `GodRaySystem` into the strike event via a new `triggerLightningFlash` method that temporarily spikes light shaft intensity (`lightningSpike`).
- Configured lightning to appear in Levels 1, 2, 3, 4, 5 and 6 with varying densities and colors (e.g., purple strikes in the Nebula level).

### Visuals
- Full-screen additive vignette flash (`LightningFlashOverlay`) creates the blinding impact of a storm.
- Lightning material is now thicker and more jagged due to the added sine wave branch interference.
- God Rays pulse brightly in sync with the lightning strikes before decaying, simulating "light piercing through clouds."

### Integration
- `level_manager.ts`: Updates `onBoltStrike` to trigger both cloud flash and god ray flash. Configures `lightningBoltSystem.activate(cfg.lightning)` based on the level.
- `main.ts`: Ensures `levelManager.cloudSystem.setCamera(camera)` is called so the screen-space flash overlay is properly attached to the scene view.
- `level_config.ts`: Added the `lightning` parameters to the configs for testing across the game.

### Testing
- [x] `npm run build` passes
- [x] Tested in various levels with different densities.
- [x] Mobile/touch controls remain unaffected.
