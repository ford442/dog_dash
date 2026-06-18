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

### 4. Rare bestiary & ambient creatures (`creature_manager.ts`)

Unified registry of `AmbientCreatureDef` (spawnMode: 'probabilistic'|'streaming'|'level_batch', depthLayer, levelRates or rateKey from LevelConfig, clusterSize, factory, optional catalog).

- Probabilistic (per-frame rate, maxActive): Crystal Tarsier, Geode Titan (legacy-wrapped), + new Moon Jelly demo (clusters on L5/6, biome tint, debug toggle).
- Shared: spawn ahead, depth via `depth_layers.ts`, cleanup behind, generic update loop.
- Existing wrapped (legacy:true) so old arrays/loops unchanged; new ones use generic.
- Debug panel toggles per family (`creature_*`).
- Nice: cluster spawns, enemyTintColor passed to factory.

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
- `environments` — level-specific background systems (see table below)
- Ambient creatures now use `CreatureManager` registry for spawn (see "Rare bestiary" above)

Level transitions use `LEVEL_DISTANCE_BOUNDARIES` (cumulative X positions). `cfg.distance` is still used for HUD “distance to moon” flavor text — prefer `getLevelSpan()` for placement math.

## Environments (background systems)

Level-specific background and parallax systems are now declared in `LevelConfig.environments` (in `level_config.ts`). `LevelManager.startLevel()` uses a small plugin table to activate/deactivate based on the flags. This eliminates hardcoded `if (levelIndex === N)` branches.

Supported flags (add only the ones a level needs; absent/false means deactivate):

| Flag                | System                  | Typical level(s) | Notes |
|---------------------|-------------------------|------------------|-------|
| `butterflySwarm`    | ButterflySwarmSystem   | 1                | Active only on Neon Garden |
| `blackHole`         | BlackHoleSystem        | 2                | Galactic core hazard |
| `planetaryHorizon`  | PlanetaryHorizonSystem | 3                | Sets levelDistance before activate |
| `reEntry`           | ReEntrySystem          | 3                | Sets levelDistance; atmosphere heat |
| `industrial`        | IndustrialBackgroundSystem | 4            | Rusty gauntlet megastructures |
| `biological`        | BiologicalBackgroundSystem + nebula + cosmicDust + hide clouds | 5 | Astral Leviathan interior; clouds hidden |
| `nebula`            | NebulaSystem           | 5                | (composed under biological usually) |
| `cosmicDust`        | CosmicDustSystem       | 5                | |
| `waterfall`         | WaterfallSystem        | 6                | Aqua Expanse vertical effects |
| `aquaticLife`       | AquaticLifeManager     | 6                | Jellyfish/kelp/plankton (spawn + update in main) |

Example for a new level that mixes:

```ts
7: {
    ...
    environments: {
        butterflySwarm: true,
        waterfall: true,
        // godRays already controlled by top-level godRays.enabled
    }
}
```

In `LevelManager` the table is iterated so enabling systems is just data. Special setup (levelDistance) happens inside the activate closures for the relevant plugins.

## Wiring checklist (important)

**Single scene source of truth**: `src/scene_context.ts` creates the one `THREE.Scene` (plus camera, basic lights, canvas). All `scene.add()` calls — foliage, player, parallax, dreamy decor, geological props, etc. — must target this scene.

- `main.ts` imports from `scene_context`, calls `initializeSceneAndRenderer()` + `attachLightsAndEnv()`, and owns the render/animate loop.
- `scene_setup.ts` is gutted (only re-exports for transitional imports); it no longer instantiates a parallel renderer or scene.
- Player loading: canonical in `player_loader.ts` (migrated to context scene). `main.ts` no longer duplicates the GLTF load.
- Geological spawners + cleanup: canonical in `environment.ts` (one copy). `main.ts` imports them.
- Legacy code importing scene/camera from `scene_setup` will get the shared objects via re-exports.
- `LevelManager` is already injected with the canonical scene/managers/spawners from `main.ts`.

Never `new THREE.Scene()` outside `scene_context.ts`. Never add to a scene that isn't rendered by main.

## Debug
- Backquote → debug panel (wireframe, collision radii)
- `?collisionDebug` — collision sphere overlay
- `?renderer=webgl` — WebGL2 fallback

## Related files

| Domain | Files |
|--------|-------|
| Placement orchestration | `level_manager.ts`, `depth_layers.ts`, `level_config.ts` |
| Core scene | `scene_context.ts` (single source), `main.ts` (render loop + init), `scene_setup.ts` (gutted compat) |
| Plants & props | `foliage.ts`, `foliage_shared.ts`, `geological.ts`, `environment.ts`, `visuals.ts` |
| Creatures | `space_friends.ts`, `creature_manager.ts` (registry + bestiary), `aquatic_life.ts`, `butterfly_swarm.ts`, `player_loader.ts`, `obstacle_system.ts` (krakens) |
| Dreamy decor | `flower_constellations.ts`, `cloud_castles.ts`, `candy_obstacles.ts` |
| Parallax BG | `clouds.ts`, `stars.ts`, `biological_background.ts`, `asteroid_field.ts` |
