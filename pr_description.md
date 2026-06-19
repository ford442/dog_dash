## 🌌 Architect: Lightning Bolt Dynamic Interaction Enhancement

### Concept
> "Dynamic Volumetric Lightning" enhancement. Improve the existing lightning bolts by adding dynamic interactions where they react to the player's engine glow and nearby weapon projectiles, contributing to the "Depth is King" visual standards.

### Implementation
- `src/lightning_bolt.ts` was modified to update `createLightningMaterial` to receive the `WeaponLightManager` instances and player position, applying them dynamically.
- `LightningBoltSystem` now accepts `weaponLightManager` in the constructor.
- Uses `distance` and `smoothstep` in `three/tsl` over a dynamic `Loop` for proximity lighting from weapon projectiles, along with additive `smoothstep` fading for the `uPlayerPos` engine glow.
- Updates the lightning color mixing directly on the GPU to give off brilliant cyan glows.

### Visuals
- **Player Engine Glow Interaction**: Lightning bolts slightly brighten up and tint cyan when the player flies close to them, showing engine light scattering.
- **Weapon Glow**: Nearby projectiles illuminate the bolts procedurally inside the TSL shader.

### Integration
- `src/lightning_bolt.ts`: Accepts TSL uniform injection of weapon lights and player pos.
- `src/game_systems.ts`: Passed `weaponLightManager` into `lightningBoltSystem`'s constructor.
- `src/level_manager.ts`: Calls `lightningBoltSystem.update(delta, cameraX, speed, this.getPlayer()?.position);` to keep the shader uniforms synced every frame.

### Testing
- [x] `npm run build` passes
- [x] Tested mathematically via static analysis to ensure TSL values match `aurora.ts` interactions
- [x] Mobile/touch controls untouched and intact
