# Side-Scroller Objects & Creatures

Dog Dash scrolls along **+X**. **Y** is vertical flight space. **Z** is depth (negative = into the screen).

## Depth bands

Use `src/depth_layers.ts` for consistent placement:

| Layer | Z range | Examples |
|-------|---------|----------|
| `FAR_BACKGROUND` | -80 … -55 | Far castles, galaxies |
| `BACKGROUND` | -50 … -30 | Flowers, spore clouds, tissue walls |
| `MIDGROUND` | -28 … -8 | Ferns, trees, geological props |
| `NEAR` | -10 … 5 | Candy belt, friends |
| `GAMEPLAY` | -2 … 2 | Player, collision obstacles |

```ts
import { DEPTH_LAYERS, randomZInLayer } from './depth_layers';

const z = randomZInLayer('MIDGROUND');
```

## How objects get into the world

### 1. Streaming foliage (`level_manager.ts`)

`LevelManager.spawnOpenFoliage()` scatters decorative plants from `foliage.ts` ahead of the camera. Zones stream continuously as the player moves (not just once at level start).

- Density keys live in `level_config.ts` → `foliageDensity`
- Catalogable species need `userData.speciesId` and an entry in `discovery_system.ts` → `SPECIES_NAMES`
- Animated plants are tracked in `visuals.ts` → `moonPlants`

**Add a new plant species**

1. Create `createMyPlant()` in `foliage.ts`
2. Add a density key to `LevelConfig.foliageDensity` and each level block in `level_config.ts`
3. Add a `spawn()` line in `LevelManager.spawnOpenFoliage()`
4. Register `speciesId` in `discovery_system.ts` if scannable

### 2. Dreamy layers (flowers, castles, candy)

Spawned once per level in `LevelManager.startLevel()` using the **actual level segment** from `LEVEL_DISTANCE_BOUNDARIES` (via `getLevelSpan()`), not `cfg.distance`.

| Manager | Module | Placement |
|---------|--------|-----------|
| `ConstellationManager` | `flower_constellations.ts` | Giant background blooms |
| `CastleBackgroundManager` | `cloud_castles.ts` | Parallax cloud castles |
| `CandyBeltManager` | `candy_obstacles.ts` | Bouncy sweet obstacles |

### 3. Parallax backgrounds (infinite wrap)

Clouds, stars, asteroid fields, biological tissue, ghost debris, butterflies — fixed instance pools that wrap when the camera passes.

Pattern: `activate()` on level start → `update(delta, cameraX)` each frame.

### 4. Rare bestiary (`creature_manager.ts`)

Per-frame probabilistic spawn gated by `LevelConfig` rates (`crystalTarsierRate`, `geodeTitanRate`).

### 5. Streaming companions (`space_friends.ts`)

`FriendsManager.maybeSpawnFriends()` places kitty/bunny/lantern ahead of the player every ~100 units.

### 6. Level-specific batches

Examples: Level 6 `AquaticLifeManager.spawnForLevel6()`, trapped friends for rescue objectives.

## Level configuration

`level_config.ts` controls:

- `foliageDensity` — decorative plant counts per zone chunk
- `asteroidRate` — hazard interval + parallax asteroid belt density
- `levelType` — `open`, `tunnel`, or `organic_tunnel` (constrains Y and spawns rib geometry)
- Atmosphere: `skyColors`, `fogDensity`, `godRays`, `aurora`, `lightning`, `meteorShower`
- Creature/hazard rates: `squidSpawnRate`, `crystalTarsierRate`, etc.

Level transitions use `LEVEL_DISTANCE_BOUNDARIES` (cumulative X positions). `cfg.distance` is still used for HUD “distance to moon” flavor text — prefer `getLevelSpan()` for placement math.

## Wiring checklist (important)

All spawned meshes must be added to the **same** `THREE.Scene` that `main.ts` renders. `LevelManager` receives scene, managers, spawners, and `getPlayer` via its constructor — do not import a parallel scene from `scene_setup.ts` when extending placement code.

## Debug

- Backquote → debug panel (wireframe, collision radii)
- `?collisionDebug` — collision sphere overlay
- `?renderer=webgl` — WebGL2 fallback

## Related files

| Domain | Files |
|--------|-------|
| Placement orchestration | `level_manager.ts`, `depth_layers.ts`, `level_config.ts` |
| Plants & props | `foliage.ts`, `foliage_shared.ts`, `geological.ts`, `environment.ts` |
| Creatures | `space_friends.ts`, `creature_manager.ts`, `aquatic_life.ts`, `butterfly_swarm.ts` |
| Dreamy decor | `flower_constellations.ts`, `cloud_castles.ts`, `candy_obstacles.ts` |
| Parallax BG | `clouds.ts`, `stars.ts`, `biological_background.ts`, `asteroid_field.ts` |
