## 🌌 Architect: Enhanced Volumetric Branching Lightning

### Concept
> "Lightning flashes that briefly illuminate the cloud layers from within, creating dynamic lighting"

### Implementation
- Enhanced `src/clouds.ts` (Volumetric Lightning) to use procedural noise-based directional lighting, rather than a flat circular gradient, allowing lightning flashes to highlight the internal volume and crevices of clouds dynamically. Added support for configurable `uLightningColor`.
- Enhanced `src/lightning_bolt.ts` (Lightning Bolts) to dynamically generate branching fractal patterns in TSL shaders instead of a single jagged line, improving realism. Added parameterized color support.
- Modified `LevelManager` to activate unique colored lightning for specific levels (e.g., purple lightning in Level 3).

### Visuals
- Cloud shading highlights internal billows when flashed.
- Lightning bolts now feature secondary branching paths.
- Lightning inherits colors defined per-level for better integration.

### Integration
- `src/level_manager.ts`: Enabled custom lightning color initialization in level 3 (`lightningBoltSystem.activate({ color: 0xaa44ff })`). Synchronized colored bolt strikes with cloud flash triggers.

### Testing
- [x] `npm run build` passes
- [x] Tested in Level 3 with purple branching lightning
- [x] Mobile/touch controls still work
