## 🌌 Architect: Animated Energy Conduits

### Concept
> "Flying Through Industrial/Mechanical Megastructures... Energy conduits pulse with animated light that travels along their length, showing power flowing through the structure"
From `future-plan.md` §5 Flying Through Industrial/Mechanical Megastructures.

### Implementation
- Enhanced `createPulsingConduitMaterial` in `src/industrial_background.ts`.
- Previously, the material just made the entire pipe pulse synchronously as an "energy conduit".
- Replaced the simple sine pulse with a TSL-based traveling light pulse that uses `vUv.x` and `time` to create repeating glowing segments that scroll along the length of the pipes.
- Added a secondary, faster, smaller pulse traveling along the pipes for added visual complexity.
- Maintained interaction with dynamic lighting (player engine glow and weapon lights).

### Visuals
- 3D pipes now appear as active conduits with sharp, bright energy pulses traveling rapidly along them.
- Multiple frequencies of light pulses (base pattern repeating at scale 3.0, faster pattern at scale 5.0) overlapping to create an organic, chaotic energy flow.
- Dynamic lighting correctly illuminates the dark metal segments between the energy pulses.
- Background Layer Z: -40.

### Integration
- `src/industrial_background.ts`: Modified TSL material logic in `createPulsingConduitMaterial`. Integrated directly into the existing `IndustrialBackgroundSystem` active in Level 4.
- `level_config.ts`: N/A

### Testing
- [x] `npm run build` passes
- [x] Tested in Level 4 (The Rusty Gauntlet)
- [x] Mobile/touch controls still work
