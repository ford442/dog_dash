## 🌌 Architect: Storm Geodes

### Concept
> "Storm Geodes: Unstable variant arcs lightning every 3s. Chains to conductive objects (Liquid Metal, ship hull). 35 damage per arc but charges 'Plasma Caster' ammo by +5." (from ideas.md)

### Implementation
- Built `StormGeodeSystem` in `src/storm_geodes.ts` using `THREE.InstancedMesh` for performance scaling.
- Utilizes an `IcosahedronGeometry` with a custom TSL `MeshStandardNodeMaterial` that generates a dynamic, time-based pulsing emissive glow to visualize instability.
- Features a timer-based system that triggers lightning strikes every ~3 seconds via integration with the existing `LightningBoltSystem`.
- Active in levels 2, 4, and 5 via a new `stormGeodeDensity` field in `level_config.ts`.

### Visuals
- Geodes are situated in the background and foreground, providing a strong sense of depth.
- Procedural pulsing uses `sin` functions in TSL for high-performance organic glow logic.
- Emits bright lightning bolts and "hit" sound effects when discharging near the player.

### Integration
- `src/game_systems.ts`: Instantiates and exports `stormGeodeSystem`.
- `src/level_config.ts`: Adds `stormGeodeDensity` configurations for select levels.
- `src/level_manager.ts`: Toggles activation in `startLevel()` and updates positions/timers within the loop, supplying the player's position for dynamic lightning chaining.

### Testing
- [x] `npm run build` passes
- [x] Tested during build step to ensure no TS errors exist.
