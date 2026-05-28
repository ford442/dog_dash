## 🌌 Architect: Atmospheric Re-Entry with Heat Distortion Fix

### Concept
> "6. Atmospheric Re-Entry with Heat Distortion
> The Technique: Color palette shifting, transparency overlays, and sprite warping effects to simulate heat and friction."

### Implementation
- Added the missing `update()` call for the `ReEntrySystem` to `src/level_manager.ts`.
- The system was previously instantiated and activated during Level 3, but its update loop was never executed.
- This affects Level 3 (Orbital Descent).

### Visuals
- 50 Plasma streaks moving along the X axis.
- Heat distortion overlay using `MeshPhysicalNodeMaterial` for refraction.
- Heat glow overlay for color shifting.
- Player engine glow dynamically tints to orange based on re-entry intensity.

### Integration
- `src/level_manager.ts`: Line 286, `reEntrySystem.update` hooked into `LevelManager.update`.
- `level_config.ts`: N/A

### Testing
- [x] `npm run build` passes
- [x] Tested in Level 3
- [x] Mobile/touch controls still work
