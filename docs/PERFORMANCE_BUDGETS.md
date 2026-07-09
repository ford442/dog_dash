# Performance Budgets — Decorative 3D Objects

Dog Dash uses a lightweight **Decoration Budget** registry so new flowers, creatures, ribbons, and background layers cannot silently blow past frame-rate guardrails.

## Quick start (two lines)

```ts
import { decorationBudget } from './decoration_budget';

decorationBudget.register('my_prop', {
    label: 'My glowing prop',
    category: 'foliage',      // foliage | creatures | effects | background3d
    maxActive: 24
});

// Before spawning:
if (!decorationBudget.canSpawn('my_prop')) return;
if (!decorationBudget.reportSpawn('my_prop')) return;

// When despawning / streaming cleanup:
decorationBudget.reportDestroy('my_prop');
```

For fixed **InstancedMesh** pools (allocated once at boot), call `syncCount(id, instanceCount)` after construction instead of per-spawn `reportSpawn`.

## Categories

| Category | Examples | Typical cap style |
|----------|----------|-------------------|
| `foliage` | Ferns, roses, scattered trees | Derived from `LEVEL_CONFIG.foliageDensity` |
| `creatures` | Butterflies, koi schools, space friends | Small active sets (≤20–100) |
| `effects` | Crystal chimes, wind mobiles, particles | Per-slice streaming, hard max |
| `background3d` | Nebula puffs, ribbon veils, parallax asteroids | Instanced or merged; fixed pools |

## Level config drives budgets

`applyLevelDecorationBudgets(cfg, objectDensityMultiplier)` (called on level start and when FPS scaler changes) updates:

- **`foliage_scatter`** — `sum(foliageDensity) × viewportWidth/100 × multiplier`
- **`crystal_chimes`** — from `chimeDensity`
- **`wind_chimes`** — from `windChimeDensity`

Add new density fields in `level_config.ts`, then wire them in `applyLevelDecorationBudgets`.

## Debug overlay

- **Dev builds** or **`?debug`** in the URL: press **\`** to open the debug panel.
- Scroll to **Decoration Budgets** — live `current/max` per category (green → yellow at cap → red if over).

Production builds keep counter enforcement with **no DOM overlay** unless `?debug` is present.

## Authoring rules

1. **Prefer `InstancedMesh`** for anything that repeats (flowers in a field, bubbles, nebula puffs, butterfly swarms).
2. **Hero objects (1–3)** can be heavier — merged meshes, unique materials, interaction logic (e.g. toy rockets, moon snail).
3. **Background scrollers** must be instanced or merged — no per-chunk `new Mesh()` loops for dozens of copies.
4. **Share materials** — use `candy_materials.ts` cache keys; aim for &lt;5 material variants per system.
5. **Measure before/after** — toggle the debug panel FPS readout and enable **Wireframe** to see draw-call pressure.
6. **Register early** — add your budget in `registerDefaultDecorationBudgets()` so the overlay and caps are visible from boot.

## Systems already on the registrar

| ID | Module | Notes |
|----|--------|-------|
| `foliage_scatter` | `level_manager.ts` | Streaming decorative plants |
| `butterfly_swarm` | `butterfly_swarm.ts` | Fixed 100-instance background pool |
| `butterfly_escort` | `butterfly_swarm.ts` | ≤20 escort instances |
| `lunar_lemur` | `LunarLemur.ts` | ≤3 hero perches per level |
| `crystal_chimes` | `crystal_chimes.ts` | ≤12 clusters, instanced rods |
| `wind_chimes` | `wind_chimes.ts` | ≤8 hero mobiles |
| `nebula_cloud_puffs` | `nebula.ts` | 45 cloud instances (3 layers) |
| `nebula_energy_motes` | `nebula.ts` | 50 particle/mote instances |
| `nebula_ribbons` | `nebula.ts` | 24 ribbon sheets (3 layers) |

## Related files

- `src/decoration_budget.ts` — registry, helpers, overlay
- `src/debug_system.ts` — FPS + system toggles (`\` key)
- `src/level_config.ts` — per-level density knobs
- `src/candy_materials.ts` — `PROP_COST_HINTS` for new materials
