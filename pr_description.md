## 🌌 Architect: Volumetric Rim Lighting (Silver Lining) in Nebula

### Concept
> "The player's exhaust and weapons cast a subtle glow on nearby nebula clouds, creating a dynamic interplay of light." (From future-plan.md §7)

### Implementation
- Implemented Volumetric Rim Lighting (Silver Lining) on the Nebula clouds in `src/nebula.ts`.
- Calculated the dot product between the view direction (`cameraPosition`) and light direction (`uPlayerPos`).
- Applied a smoothstep edge factor based on density to ensure the rim lighting emphasizes the edges.
- Blended the rim lighting strongly into the emissive node to make the edges pop without washing out the alpha channel.
- Modifies `createNebulaMaterial()` and does not require new properties in level config.

### Visuals
- Dynamic lighting: Player engine glow strongly illuminates the edges of the cloud when flying behind a nebula puff, creating a highly realistic volumetric depth cue.

### Integration
- `src/nebula.ts`: Replaces proximity logic inside `createNebulaMaterial` to combine basic proximity glow and the new directional backlight silver lining.
- Fits perfectly into existing Level 5 nebula logic (environments.nebula).

### Testing
- [x] `npm run build` passes
- [x] Tested in Level 5
- [x] Mobile/touch controls unaffected
