## 🌌 Architect: Volumetric Lightning Storm Enhancement

### Concept
> "1. Flying Through Multi-Layered Cloudscapes... Lightning flashes that briefly illuminate the cloud layers from within, creating dynamic lighting. The effect is a palpable sense of flying through a vast, three-dimensional atmosphere rather than just over a flat background."

### Implementation
- `src/lightning_bolt.ts` has been upgraded from simple 2D planes to full 3D `CylinderGeometry` bolts using TSL procedural distortions.
- `src/clouds.ts` flash logic upgraded to be fully additive and height-weighted, giving depth to the flashes.
- `src/godrays.ts` updated to temporarily shift god ray color temp towards the lightning strike color.
- Dash speed directly impacts the spawn rate of the lightning, making storms reactive.

### Visuals
- Bolts now use `normalView` for soft edges, with procedural side branching built in to create jagged forks in 3D space.
- The flash adds a massive volumetric emissive blast to the clouds using `finalColor.add(flashFactor)`.
- Foreground clouds flash brighter than background clouds via a height-based component.

### Integration
- `src/godrays.ts`: Hooked up `lightningColorTimer` inside `update()` to smoothly lerp base godray color.
- `src/level_manager.ts`: Bound `onBoltStrike` to `godRaySystem.triggerLightningFlash(1.0, color)` and passed `speed` to `lightningBoltSystem.update`.
- `src/lightning_bolt.ts`: Receives player dash speed and dynamically boosts `currentDensity`.

### Testing
- [x] `npm run build` passes
- [x] Tested locally to verify behavior
- [x] Mobile/touch controls still work
