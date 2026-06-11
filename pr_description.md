## 🌌 Architect: Fractured Geodes (Mining Mechanics)

### Concept
> "Allow players to mine internal crystals; adjust EM field strength and discharge mechanic if crystals are shot too many times. Add interior safe harbor gameplay and spawn points for resources."

### Implementation
- Rebuilt `createFracturedGeode` in `src/geological.ts` to spawn multiple individual crystal meshes instead of a single core. Attached `userData` containing state for `health`, `maxHealth`, `quality`, and `isDischarged`.
- Implemented `damageGeode` helper to handle the health math and visual shrinking/hiding of individual crystals upon taking projectile hits.
- Implemented hit detection for geodes in `src/main.ts` by checking distance against `weaponSystem.getActiveProjectiles()`. On core depletion, the geode drops floating gems based on its quality.
- Added `inSafeHarbor` boolean to `playerState`.
- Calculated safe harbor state in the main update loop based on player distance to active geode EM fields.
- Updated player damage pipelines across `src/main.ts` and `src/obstacle_system.ts` to skip taking damage if the player is in a safe harbor.

### Visuals
- Geodes now contain multiple crystal meshes at their center that visually scale down and disappear as they take damage.
- When struck by a projectile, a bright purple particle spark is emitted.
- Upon depletion, the protective EM field (the outer wireframe sphere) vanishes entirely.
- Drop multiple `OrbType.STAR` style gems (randomized) upon breaking the final crystal.

### Integration
- `src/main.ts`: Hooked hit detection into the main geological system update loop. Updated boss snap/hit logic to respect `inSafeHarbor`.
- `src/obstacle_system.ts`: Updated squid and asteroid collision logic to respect `inSafeHarbor`.
- `src/game_config.ts`: Added `inSafeHarbor` to `playerState`.
- `src/geological.ts`: Significantly modified internal geode creation and management logic.

### Testing
- [x] `npm run build` passes
- [ ] Mobile/touch controls still work
