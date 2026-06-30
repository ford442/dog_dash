## 🌌 Architect: Galactic Core Lensing Effect

### Concept
> "A massive, slowly spinning black hole or quasar in the deep background, surrounded by an intensely glowing accretion disk that warps and distorts due to gravitational lensing."

### Implementation
- Added a `lensingMesh` utilizing `THREE.PlaneGeometry` around the event horizon.
- Created `createLensingMaterial` using `MeshPhysicalNodeMaterial` with `transmission: 1.0` and `ior: 2.0` to simulate glass/lensing.
- Warped the normal vectors in TSL based on the distance from the center, bending background light inwards to mimic intense gravity.

### Visuals
- Generates a bowl-like normal distortion `mat.normalNode = mix(normalLocal, inwardDir, strength)`.
- Replaces the generic non-distorting approach with a functional 2D screen-space style pull using `PlaneGeometry`.

### Integration
- `src/black_hole.ts`: Added to `BlackHoleSystem` group, inserted in the scene behind the halo but in front of the accretion disk to warp elements properly.
