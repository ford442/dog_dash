## 🌌 Architect: Waterfall Splash Lighting Enhancement

### Concept
> "Water is rendered as multiple transparent layers moving at different speeds, with foreground spray effects that pass in front of the ship. The water isn't just a background; it's an animated environment that reacts to your presence."
> From `future-plan.md` "2. Diving Into Waterfalls and Vertical Water Sections". Additionally, "Dynamic Lighting — Objects should react to the player's engine glow and weapon fire" from the Depth is King standard.

### Implementation
- Added a new `createSplashMaterial` TSL shader to `src/waterfall.ts` using `MeshBasicNodeMaterial`.
- Upgraded the `SplashSystem` to evaluate its distance to the player and smoothly mix the base water droplet color with the player's glowing engine color on proximity.
- Plumbed `uPlayerPos` and `weaponLights` references down from `WaterfallSystem` through to the `SplashSystem`.

### Visuals
- Dynamic lighting: Evaluates proximity via `length(positionWorld.sub(uPlayerPos))` and applies a fading mix via `smoothstep` to illuminate splashes passing directly in front of the ship.

### Integration
- `src/waterfall.ts`: Rewrote the `SplashSystem` constructor and `update` loop to accept and apply the new `uPlayerPos` uniform node accurately.
- Replaced the standard `MeshBasicMaterial` with the fully procedural Node material logic.

### Testing
- [x] `npm run build` passes
- [x] `npx tsc --noEmit` verifies TSL integrations
- [x] Tested in level transitions where `WaterfallSystem` is instantiated.
