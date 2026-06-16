## 🌌 Architect: Plasma Storm Aurora Enhancement

### Concept
> "9. Dynamic Aurora Borealis / Plasma Storms... Shifting, colorful sky curtains implemented as wide procedural ribbons." We want to elevate this to Cosmic Architect standards by adding depth and dynamic lighting via TSL, turning it into a truly reactive plasma storm.

### Implementation
- `src/aurora.ts` has been enhanced to react directly to player activity, elevating it to the 'Depth is King' standard.
- The `AuroraSystem` now accepts `weaponLightManager` and `playerPos`, injecting them into the `createAuroraMaterial`.
- `LevelManager.update()` passes the player's position into the aurora update loop.
- The TSL `MeshBasicNodeMaterial` uses `length` and `smoothstep` to calculate proximity to the player and dynamic weapon projectiles.

### Visuals
- **Player Engine Glow:** A subtle brightening effect happens within the plasma ribbons whenever the player flies close to them.
- **Weapon Lighting Interaction:** Projectiles passing near the ribbons trigger localized intense light bursts (Plasma Reactions), making the sky feel alive and reactive to combat.

### Integration
- `src/aurora.ts`: Modified `AuroraSystem` constructor, `update` method, and `createAuroraMaterial` to handle TSL lighting logic.
- `src/game_systems.ts`: Passed `weaponLightManager` into `new AuroraSystem()`.
- `src/level_manager.ts`: Passed `player.position` into `auroraSystem.update()` for real-time tracking.

### Testing
- [x] `npm run build` passes
- [x] Verified TSL uniform additions don't throw warnings
- [x] Tested mathematically via static analysis to ensure smoothstep values don't clip
