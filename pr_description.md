## 🌌 Architect: Planetary Horizon Rings

### Concept
> "3. Approaching Planetary Horizons and Celestial Bodies... Uses slow parallax scrolling for the planet's surface, sprite scaling to show approach, and color gradient shifts to simulate atmospheric perspective."

### Implementation
- `planetary_horizon.ts` has been enhanced with a procedural Planetary Ring.
- Uses `THREE.RingGeometry` with a custom TSL `MeshStandardNodeMaterial`.
- The ring animates by rotating over time alongside the clouds and scales properly with the approach logic.

### Visuals
- Procedural banding using `fbm` and `smoothstep` based on `length(positionLocal.xy)`.
- Features an inner and outer fade so the rings appear soft.
- Adds an emissive component for subtle glowing in the darker void.

### Integration
- `planetary_horizon.ts`: Instantiated in `PlanetaryHorizonSystem` constructor. Added to the `container`.
- `planetary_horizon.ts`: Updated `update()` to handle parallax `position.x`, vertical shift, uniform scaling, and rotational animation logic.

### Testing
- [x] `npm run build` passes
- [x] Tested in Level 3 at `npm run dev`
- [x] Mobile/touch controls still work
