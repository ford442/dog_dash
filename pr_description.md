## 🌌 Architect: Lightning Bolt System

### Concept
> "1. Flying Through Multi-Layered Cloudscapes
> ...
> - Lightning flashes that briefly illuminate the cloud layers from within, creating dynamic lighting"

### Implementation
- Implemented `LightningBoltSystem` using `InstancedMesh` to render procedural jagged lightning bolts.
- The TSL shader computes multiple sine waves with different frequencies to displace UV coordinates and generate a branching line effect.
- Integrated into `level_manager.ts` and activated for levels 1, 2, and 3 where clouds and atmospheric phenomena are prevalent.
- `cleanup()` logic included to properly dispose of geometry and material data.

### Visuals
- Procedural bolts that dynamically appear in the deep background (`z: -30` to `-10`).
- TSL fragment shader employs distance fields from the jagged center line, mixed with a glowing blue edge and bright white core.
- Timed fading mimics rapid high-frequency flashing synchronized with the game's clock.

### Integration
- `game_systems.ts`: Instantiated and exported `lightningBoltSystem`.
- `level_manager.ts`: Checked `levelIndex === 1 || levelIndex === 2 || levelIndex === 3` inside `startLevel()` to trigger `lightningBoltSystem.activate()`, and called `update` inside the main `update` loop.
- `level_config.ts`: N/A

### Testing
- [x] `npm run build` passes
- [x] Tested in Level 1, 2, and 3 (where clouds are present)
- [x] Mobile/touch controls still work
