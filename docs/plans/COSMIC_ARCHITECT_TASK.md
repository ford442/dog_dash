# 🌌 COSMIC ARCHITECT TASK TEMPLATE

> **Reuse this template for every visual feature you add to Dog Dash.**  
> Just fill in the `[BRACKETS]` and follow the steps.

---

## 📋 TASK HEADER (Fill these in)

| Field | Value |
|-------|-------|
| **Feature Name** | `[e.g., Nebula Activation Fix]` |
| **Future-Plan Section** | `[e.g., §7 Drifting Through Nebulae]` |
| **Priority** | `[P0 Critical / P1 High / P2 Polish]` |
| **Level(s)** | `[e.g., Level 5]` |
| **Existing File(s)** | `[e.g., nebula.ts, main.ts]` |
| **New File(s)** | `[e.g., cosmic_dust.ts]` (or `N/A` if modifying existing) |

---

## 🔍 STEP 0: AUDIT (Do this first)

Before writing code, understand what's already there:

1. **Read `future-plan.md`** — Find the section describing your feature. Copy the key requirements.
2. **Read existing file(s)** — If a file already exists (e.g., `nebula.ts`), assess its status:
   - **NOT STARTED** — No file exists, or file is a stub.
   - **PARTIAL** — Has basic structure but missing key aspects from `future-plan.md`.
   - **MOSTLY COMPLETE** — Has most elements, needs polish or integration fixes.
   - **COMPLETE** — Fully implemented and integrated.
3. **Read `level_config.ts`** — Note which levels have config fields relevant to your feature.
4. **Read `main.ts`** — Search for how similar systems are integrated (see patterns below).

**Audit Result:**
```
[Write 2-3 sentences summarizing what exists and what's missing]
```

---

## 🏗️ STEP 1: CREATE / MODIFY THE FEATURE MODULE

Dog Dash uses a **flat module structure** — all `.ts` files live in the repository root. No `src/` folder.

### If creating a new file:
Create `YOUR_FEATURE.ts` in `/root/dog_dash/` following this exact pattern:

```typescript
import * as THREE from 'three';
// Import TSL nodes when shader complexity is needed
import { time, vec3, color, uniform, sin, mix } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';

export class YourFeatureSystem {
    scene: THREE.Scene;
    active: boolean = false;
    // ... your internal state

    constructor(scene: THREE.Scene /*, other deps */) {
        this.scene = scene;
        // Initialize meshes, materials, particles here
        // But KEEP THEM HIDDEN until activate() is called
        this.deactivate();
    }

    activate() {
        if (this.active) return;
        this.active = true;
        // Set meshes visible, reset state
        // this.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        // Hide meshes, pause effects
        // this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;
        // Animate, scroll, pulse, react to player...
    }

    cleanup() {
        // Remove from scene, dispose geometries/materials
        // this.scene.remove(this.mesh);
        // this.mesh.geometry.dispose();
        // (this.mesh.material as any).dispose?.();
    }
}
```

### Key architectural rules:
- **Use `THREE.InstancedMesh`** for any object count > 50 (clouds, asteroids, particles).
- **Use TSL (`three/tsl`)** for shader materials when you need procedural animation, noise, or glow.
- **Use `THREE.FrontSide`** for transparent sprites, `THREE.DoubleSide` for full-screen overlays.
- **Set `depthWrite = false`** on transparent materials to avoid z-fighting.
- **Set `frustumCulled = false`** on InstancedMeshes that wrap around the camera.
- **Hide on init** — Call `this.deactivate()` in the constructor so the system starts invisible.

---

## 🔌 STEP 2: INTEGRATE INTO `main.ts`

`main.ts` is the central hub. You must touch 4 areas:

### 2A: Instantiate your system (near the bottom, ~line 840+)

Find where other systems are created and add yours:

```typescript
// YOUR FEATURE SYSTEM
const yourFeatureSystem = new YourFeatureSystem(scene /*, deps */);
```

### 2B: Activate/deactivate per level in `LevelManager.startLevel()` (~line 456+)

Find the `if/else` block for level-specific effects and add your logic:

```typescript
if (levelIndex === YOUR_LEVEL) {
    yourFeatureSystem.activate();
} else {
    yourFeatureSystem.deactivate();
}
```

### 2C: Add to `LevelManager.update()` (~line 574+)

```typescript
yourFeatureSystem.update(delta, cameraX, player ? player.position : undefined);
```

### 2D: Add to cleanup logic if your system adds scene objects

Search for where `levelObjects` are cleaned up or where other systems call `cleanup()`. If your system spawns objects into `levelObjects`, ensure they get removed on level transition.

---

## ⚙️ STEP 3: UPDATE `level_config.ts` (if needed)

If your feature needs per-level tuning (density, speed, colors, etc.), add fields to `LevelConfig`:

```typescript
export type LevelConfig = {
    // ... existing fields
    yourFeatureDensity?: number;
    yourFeatureColor?: number;
};
```

Then set values in `LEVEL_CONFIG` for each level.

---

## ✅ STEP 4: INTEGRATION CHECKLIST

Before declaring done, verify:

- [ ] **File created** at repository root (e.g., `your_feature.ts`)
- [ ] **Imports use `three/tsl` and `three/webgpu`** (not vanilla Three.js materials for custom shaders)
- [ ] **`activate()` / `deactivate()` / `update()`** pattern followed
- [ ] **`main.ts` instantiation** added near other systems (~line 840+)
- [ ] **`startLevel()` hook** added with correct level condition
- [ ] **`LevelManager.update()` hook** added
- [ ] **Level config updated** (if new fields were added)
- [ ] **Cleanup handled** — objects don't leak between levels
- [ ] **Performance** — uses `InstancedMesh` for high counts
- [ ] **Mobile-friendly** — doesn't break touch controls
- [ ] **Build passes** — `npm run build` succeeds (runs brace check + WASM + Vite)

---

## 🎨 STEP 5: QUALITY STANDARDS ("Depth is King")

Every feature must create a sense of **vastness** and **depth**:

1. **Parallax Layers** — If applicable, use 3-5 layers at different Z-depths scrolling at different speeds. Foreground = fast, detailed, opaque. Background = slow, faint, silhouettes.
2. **Dynamic Lighting** — Objects should react to the player's engine glow and weapon fire. Use TSL `uniform()` for player position and update it in `update()`.
3. **Player Interaction** — The environment should feel alive. Clouds billow, nebulae pulse, waterfalls splash when explosions occur.
4. **Color Harmony** — Match the level's sky colors and bgColor. Use `level_config.ts` as your palette guide.
5. **Progressive Intensity** — Effects should build up or change over the course of a level (e.g., re-entry heat intensifies), not just binary on/off.

---

## 🎁 STEP 6: PRESENT (PR Description Template)

When submitting, use this format:

```markdown
## 🌌 Architect: [Feature Name]

### Concept
> Quote the relevant section from `future-plan.md` here.

### Implementation
- [What you built]
- [How it works]
- [Which levels are affected]

### Visuals
- [Parallax layers: N layers at speeds X, Y, Z]
- [Shader effects: e.g., TSL noise-based billowing]
- [Dynamic lighting: e.g., reacts to player engine glow]

### Integration
- `main.ts`: [Where and how it's hooked in]
- `level_config.ts`: [Any new config fields]

### Testing
- [ ] `npm run build` passes
- [ ] Tested in Level [N] at `npm run dev`
- [ ] Mobile/touch controls still work
```

---

## 📚 CODE PATTERNS (Copy-Paste Reference)

### Pattern A: InstancedMesh with TSL Material
From `nebula.ts`:
```typescript
const geo = new THREE.SphereGeometry(1, 8, 8);
const mat = createNebulaMaterial(config.color1, config.color2, config.opacity, ...);
this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
this.mesh.frustumCulled = false;
this.mesh.renderOrder = -1;
```

### Pattern B: TSL Noise + Time Animation
From `clouds.ts`:
```typescript
const uTime = time;
const scroll = vec2(uTime.mul(uBillowSpeed).mul(0.5), uTime.mul(uBillowSpeed).mul(0.2));
const noiseVal = fbm(noiseUv.add(scroll));
```

### Pattern C: Player Glow Interaction
From `nebula.ts`:
```typescript
const distToPlayer = length(positionWorld.sub(uPlayerPos));
const glowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);
finalColor = finalColor.add(uGlowColor.mul(glowIntensity.mul(0.8)));
```

### Pattern D: Wrapping InstancedMesh Positions
From `asteroid_field.ts` / `nebula.ts`:
```typescript
const margin = 50;
const limitBack = cameraX - (this.width / 2) - margin;
const limitFront = cameraX + (this.width / 2) + margin;
if (x < limitBack) x += this.width + margin * 2;
if (x > limitFront) x -= this.width + margin * 2;
```

### Pattern E: Full-Screen Overlay (Additive)
From `nebula.ts` PulseOverlay:
```typescript
const geo = new THREE.PlaneGeometry(2, 2);
this.mesh = new THREE.Mesh(geo, createPulseOverlayMaterial(uPulse));
this.mesh.position.set(0, 0, -1.01); // Just in front of camera far plane
camera.add(this.mesh); // Moves with camera
```

### Pattern F: Level-Conditional Activation in `main.ts`
From `main.ts` `startLevel()`:
```typescript
if (levelIndex === 3) {
    planetaryHorizonSystem.activate();
    reEntrySystem.activate();
} else {
    planetaryHorizonSystem.deactivate();
    if (levelIndex !== 3) reEntrySystem.deactivate();
}
```

---

## 📝 EXAMPLE: FILLED-OUT TASK

> Use this as a reference for how to fill out the template.

### Task Header
| Field | Value |
|-------|-------|
| **Feature Name** | Nebula Activation Fix |
| **Future-Plan Section** | §7 Drifting Through Nebulae and Energy Fields |
| **Priority** | P1 High |
| **Level(s)** | Level 5 (The Astral Leviathan) |
| **Existing File(s)** | `nebula.ts` (~490 lines, fully implemented) |
| **New File(s)** | N/A |

### Audit Result
`nebula.ts` is **COMPLETE** — it has 3 parallax cloud layers with TSL shaders, energy particles, a pulse overlay, weapon-light interaction, and player-engine glow response. However, `LevelManager.startLevel()` in `main.ts` **only ever calls `nebulaSystem.deactivate()`** — even in Level 5 where it should be active. This is a one-line integration bug.

### Implementation
1. **Modify `main.ts`** — In `LevelManager.startLevel()`, change Level 5's nebula handling from `deactivate()` to `activate()`.
2. **Verify `LevelManager.update()`** — `nebulaSystem.update()` is already called every frame.
3. **No new files needed** — The system is fully built.

### Code Change
```typescript
// In main.ts, inside startLevel():
if (levelIndex === 5) {
    biologicalSystem.activate();
    nebulaSystem.activate(); // WAS: nebulaSystem.deactivate()
    this.cloudSystem.layers.forEach(l => l.mesh.visible = false);
} else {
    biologicalSystem.deactivate();
    nebulaSystem.deactivate();
    if (levelIndex !== 4) {
        this.cloudSystem.layers.forEach(l => l.mesh.visible = true);
    }
}
```

### Integration Checklist
- [x] `activate()` / `deactivate()` / `update()` pattern followed
- [x] `main.ts` `startLevel()` hook fixed
- [x] `LevelManager.update()` already calls `nebulaSystem.update()`
- [x] No new config fields needed
- [x] Build passes

### PR Description
```markdown
## 🌌 Architect: Nebula Activation Fix

### Concept
> "The entire level is set inside a glowing purple and pink nebula... Multiple transparent cloud layers drift in different directions... The nebula pulses with a slow, rhythmic brightness change."

### Implementation
- `nebula.ts` was already fully implemented with TSL shaders, 3 cloud layers, energy particles, and interactive lighting.
- Bug fix: `LevelManager.startLevel()` now activates the nebula in Level 5 instead of deactivating it.

### Visuals
- 3 cloud layers at Z: -60, -40, -20 with varying opacity (0.4, 0.3, 0.15)
- Purple/pink/cyan color scheme matches Level 5's sky colors
- Pulse overlay creates rhythmic breathing light effect
- Player engine glow and weapon fire dynamically light up nearby clouds

### Integration
- `main.ts` line ~546: `nebulaSystem.activate()` in Level 5 block
```

---

## 🚀 QUICK START FOR JULES

1. Read `future-plan.md` and pick a technique.
2. Run the **Audit** (Step 0) — check if a file already exists.
3. Fill out the **Task Header**.
4. Follow **Steps 1-5** above.
5. Run `npm run build` before submitting.

**Remember:** *The player isn't just scrolling left to right; they are traveling through the cosmos.* 🚀
