## 🌌 Architect: Cloud Interaction and Dynamic Lighting

### Concept
> "The player's exhaust and weapons cast a subtle glow on nearby nebula clouds, creating a dynamic interplay of light"
> (Adapted to Multi-Layered Cloudscapes from section 1 of future-plan.md to add player and weapon interactions to the dense volumetric clouds.)

### Implementation
- Enhanced `src/clouds.ts` (`createCloudSpriteMaterial`) by integrating the `WeaponLightManager` data and computing TSL lighting that reacts dynamically to weapon projectiles and the player's engine glow.
- Supplied `weaponLightManager` to `CloudSystem` inside `LevelManager` (`src/level_manager.ts`), which in turn passes it down to `CloudLayer`.
- Ensured `CloudSystem.update` accurately updates `uPlayerPos` for all layers.

### Visuals
- Cloud layers now react realistically to passing weapons, illuminating their dense volumes with cyan light.
- The player's engine exhaust casts an orange radial glow when passing through cloud layers.
- Seamlessly integrates with the existing Volumetric Lightning flashes.

### Integration
- `src/main.ts`: Provided `weaponLightManager` into `LevelManager`.
- `src/level_manager.ts`: Initialized `CloudSystem` with the `weaponLightManager` and updated it with `player.position`.
- `src/clouds.ts`: Extensively modified the `MeshBasicNodeMaterial` logic to loop through `weaponLights` and apply dynamic `smoothstep` light attenuation to the cloud rendering output.

### Testing
- [x] `npm run build` passes
- [ ] Tested in Levels 1-3
- [x] Mobile/touch controls still work
