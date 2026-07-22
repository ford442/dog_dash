## 🌌 Architect: Moon Palace Approach – Magical Crystal Finish

### Concept
> "Near the end, the moon becomes a giant glowing crystal palace with heart-shaped craters and silver slide ladders." (From Magical Whimsical Edition → Moon Palace Approach + future-plan.md §3)

### Implementation
- Upgraded the final Moon Palace approach visuals in `src/moon_palace.ts`.
- **Crystalline Surface**: Replaced the basic glowing sphere with a procedural TSL material featuring `fbm` noise for crystal facets and a mathematical heart SDF for craters.
- **Silver Slides**: Transformed the ladders into elegant, flat silver slides with a pulsing, scrolling shimmer using TSL.
- **Particle Reaction**: Added a lightweight, performant `THREE.InstancedMesh` sparkle system that spawns floating light orbs when the player gets within 300 units of the palace.
- **Approach Drama**: Deepened the initial Z depth to `-400` but brought the final approach distance up to `-80`, utilizing an exponential curve (`Math.pow(progress, 2.0)`) for dramatic, sudden scale as the level concludes.

### Visuals
- Deep procedural crystalline texture (`aaccff` to `ffffff`) dotted with vibrant pink (`ff69b4`) heart craters.
- Scrolling TSL energy waves rolling up `ddddff` silver slides.
- Dozens of `ffffff` additive-blended sparkles drifting off the sphere geometry when the player breaches the proximity threshold.

### Integration
- `src/moon_palace.ts`: Self-contained TSL and instantiation logic.
- Maintained exact `update(delta, cameraX, playerPos)` and `cleanup()` contracts.

### Testing
- [x] `npx tsc --noEmit` passes cleanly.
- [x] `npm run build` succeeds perfectly.
- [x] All interactions (glow, approach distance, proximity) function correctly within the established level hooks.
