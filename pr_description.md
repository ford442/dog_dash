## 🌌 Architect: Dynamic Starfield Parallax & Trail Colors

### Concept
> "Dynamic starfield parallax - 3-4 layers of stars with speed scaling based on thrust. Occasional shooting stars."
> "Dynamic Trail Colors - Instant visual feedback: blue (glide) → red (dive) → green (boost)."
From `ideas.md` Quick Wins and Whimsical Edition.

### Implementation
- Activated the existing `StarfieldSystem` (which was hidden behind a debug flag) globally in `main.ts` and removed the legacy static `createStars(3000)` implementation.
- Implemented **Dynamic Trail Colors** by adjusting the engine exhaust particle emitter colors based on the player's movement state (Up/Thrust = Green, Down/Dive = Red, Idle/Glide = Blue).
- The Starfield features 4 parallax layers with varying densities, sizes, and base speeds, configured with a dreamy pastel color palette.

### Visuals
- 4 star layers at varying `zRange`s, utilizing `THREE.Points` and TSL for twinkling animation and heart-shaped rendering.
- Speed dynamically scales based on `playerState.currentSpeedY` relative to thrust, creating a sensation of blazing fast vertical momentum.
- Occasional bright shooting stars streak across the screen using `THREE.Line`.
- The player ship emits vivid particle trails providing intuitive motion feedback.

### Integration
- `main.ts`: Removed `debugSystem.isEnabled('starfield')` guard, ensuring `starfield.update()` is called every frame. Deleted legacy static `stars`. Added conditional trail color emitting in `updatePlayer()`.
- `level_config.ts`: N/A

### Testing
- [x] `npm run build` passes
- [x] Tested globally across levels
- [x] Mobile/touch controls still work
