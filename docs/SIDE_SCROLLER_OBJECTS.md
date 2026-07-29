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
- Catalogable species need `userData.speciesId` and an entry in `discovery_system.ts` → `SPECIES_NAMES`; instanced/proxy objects can also set `userData.scanPosition`.
- Animated plants are tracked in `visuals.ts` → `moonPlants`

**Add a new plant species**

1. Create `createMyPlant()` in `foliage.ts`
2. Add a density key to `LevelConfig.foliageDensity` and each level block in `level_config.ts`
3. Add a `spawn()` line in `LevelManager.spawnOpenFoliage()`
4. Register `speciesId` in `discovery_system.ts` if scannable

The Level 1 scan objective uses proximity scans, not shooting. The discovery pass includes foliage, geological props, space friends, and active rare creatures, but counts each `speciesId` once per run so streamed respawns do not double-count.

**Vignette clusters** (optional, after base scatter in `spawnOpenFoliage`):

Configure per level in `level_config.ts` → `vignettes`. Counts are **base per ~100 world units** in the streamed chunk, scaled by `objectDensityMultiplier` (FPS auto-throttle in `main.ts`). Tunnel levels pass a narrowed `yRange` so groves and arches stay inside the flyable band.

| Key | Effect |
|-----|--------|
| `treeGroves` | 3–6 trees clustered within ~14m X, shared Y band |
| `roseArches` | Rose pairs framing a vertical gap (encourages diving) |
| `geodeClearings` | `FracturedGeode` safe harbor + thinned fern ring |

```ts
vignettes: {
    treeGroves: 1.5,      // Level 1 Neon Garden
    roseArches: 0.8,
    geodeClearings: 0.5,  // Level 2 Asteroid Belt
}
```

Example level assignments: L1 groves + arches; L2 geode clearings; L3 arches; L4 tunnel groves + arches; L5 organic tunnel all three.

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

`CreatureManager` owns an `AmbientCreatureDef` registry. Each entry describes **how** to spawn; the manager handles spawn-ahead placement, depth via `depth_layers.ts`, cleanup behind the player, optional `enemyTintColor` passed to `factory`, and debug toggles (`creature_<id>` in the backquote panel).

| `spawnMode` | When it fires | Example |
|-------------|---------------|---------|
| `probabilistic` | Each frame: `Math.random() < rate` while under `maxActive` | Crystal Tarsier, Geode Titan |
| `streaming` | Every `streamInterval` world units: roll `levelRates[level]` then spawn | Moon Jelly schools (L5/6) |
| `level_batch` | Once per level index on first update | Aurora Ray school (L6) |

**Rate sources**

- `rateKey` — reads a per-level float from `LevelConfig` (e.g. `crystalTarsierRate`)
- `levelRates` — `{ [levelIndex]: probabilityOrGate }` when no config key exists

**Legacy wrap:** Tarsier and Geode Titan use `legacy: true` so their dedicated update/projectile/cleanup loops stay byte-for-byte unchanged; the registry only drives spawn gating.

**Add a new ambient creature**

1. Implement the class (or factory) with `update`, `getPosition`, `destroy`, and optional `group.userData.speciesId`.
2. Register in `CreatureManager` constructor (or call `registerAmbientCreature()` at startup):

```ts
creatureManager.registerAmbientCreature({
    id: 'moon_jelly',
    spawnMode: 'streaming',          // 'probabilistic' | 'streaming' | 'level_batch'
    depthLayer: 'BACKGROUND',        // from depth_layers.ts
    levelRates: { 6: 0.55 },         // or rateKey: 'myCreatureRate'
    maxActive: 9,
    spawnAhead: 65,
    streamInterval: 140,             // streaming only
    spawnYRange: [-15, 15],
    clusterSize: 3,                  // 2–4 for schools
    catalogId: 'moonJelly',          // optional bestiary id
    factory: (scene, x, y, z, tint) => new MoonJelly(scene, x, y, z, tint),
});
```

3. Register a debug toggle in `main.ts`: `debugSystem.register('creature_moon_jelly', 'Moon Jelly', true)`
4. Add `speciesId` to `discovery_system.ts` → `SPECIES_NAMES` if scannable
5. `creatureManager.clear()` runs on every level start (via `LevelManager.onLevelStart`) so level-batch entries can re-fire on replay

**Proof creatures:** `MoonJelly` (streaming + clusters + tint) and `AuroraRay` (level batch) live at the bottom of `creature_manager.ts`.

**Not in the registry (by design):**

- `FriendsManager` (`space_friends.ts`) — kitty/bunny/lantern companions with heal/wave rewards and their own interaction loop
- `AquaticLifeManager` (`aquatic_life.ts`) — L6 kelp/plankton/bubble-reef batch tied to `environments.aquaticLife` and HUD encounter events
- `ObstacleSystem` — Nebula Krakens are hazards, not ambient decor

### 5. Streaming companions (`space_friends.ts`)

`FriendsManager.maybeSpawnFriends()` places kitty/bunny/lantern ahead of the player every ~100 units.

### 6. Level-specific batches

Examples: aquatic levels using `AquaticLifeManager.spawnForLevel()`, trapped friends for rescue objectives.

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
| `blackHole`         | BlackHoleSystem        | 2                | Use nested options: `{ enabled, baseX, baseY }` |
| `planetaryHorizon`  | PlanetaryHorizonSystem | 3                | Sets levelDistance before activate |
| `reEntry`           | ReEntrySystem          | 3                | Sets levelDistance; atmosphere heat |
| `industrial`        | IndustrialBackgroundSystem | 4            | Rusty gauntlet megastructures |
| `biological`        | BiologicalBackgroundSystem | 5           | Astral Leviathan interior; hides cloud layers while active |
| `nebula`            | NebulaSystem           | 5                | Independent flag; Level 5 composes it with biological |
| `cosmicDust`        | CosmicDustSystem       | 5                | Independent flag; Level 5 composes it with biological |
| `waterfall`         | WaterfallSystem        | 6                | Aqua Expanse vertical effects |
| `aquaticLife`       | AquaticLifeManager     | 6                | Jellyfish/kelp/plankton; spawns/clears from the current level flag |
| `dreamPortals`      | DreamPortalSystem      | 2–3              | Bonus-room doorways: `{ enabled, portals: [{ x, y, z?, durationSeconds?, toyCount?, orbCount?, hazardCount?, theme? }] }` |
| `galacticCore`      | GalacticCoreSystem     | 6                | Finale backdrop: `{ enabled, approachStartX, approachEndX, startOffsetX, endOffsetX, startZ, endZ, baseY?, intensity?, innerColor?, outerColor? }` |

Example for a new level that mixes:

```ts
7: {
    ...
    environments: {
        butterflySwarm: true,
        waterfall: true,
        blackHole: { enabled: true, baseX: 3000, baseY: 100 },
        // godRays already controlled by top-level godRays.enabled
    }
}
```

In `LevelManager` the plugin table is iterated so enabling systems is just data. Special setup (levelDistance, black-hole placement, cloud hiding) happens inside the activate/deactivate closures for the relevant plugins. Aquatic life uses the same `environments.aquaticLife` flag from the main loop because it also emits HUD/audio encounter events.

## Dream Portals (bonus rooms)

`src/dream_portal.ts` — secret cloud doorways that drop the player into a short
bonus room and hand them back to the main run.

**Placement.** Doors are declared per level in `environments.dreamPortals.portals`
with **absolute world X** (same space as `gravLensCorridors.startX` and
`LEVEL_DISTANCE_BOUNDARIES`). `spawnDreamPortalsForLevel()` runs from
`onLevelStart`, mirroring how grav-lens corridors and artifacts are placed.
Each door is one-shot per run.

**The pocket.** The bonus room is *not* a second scene. It is a pocket of the
same scene parked at `DREAM_ROOM_Y` (4000, exported from `game_config.ts`).
Entering:

1. saves the player's Y and `autoScrollSpeed`, then teleports the player to the pocket;
2. sets `playerState.worldOriginY = DREAM_ROOM_Y` — `player_update.ts` measures the
   soft flight clamp against that origin, so the ±(-10, +15) band travels with the player;
3. parks `autoScrollSpeed` at 0 and snaps the camera.

Because the LevelManager stream, obstacle spawner and orb cleanup are all keyed
off camera/player **X**, freezing X freezes the main run in place — nothing is
torn down, so `hub → continue → portal → exit → hub` stays coherent. Level
progression and chunk prefetch are additionally gated on
`dreamPortalSystem.isInRoom()`.

Inside the pocket the player's X is frozen, so the *room* scrolls past them:
`roomGroup` (static anchor: backdrop + exit ring) holds a `roomScroll` child
that slides left at `ROOM_SCROLL_SPEED`, carrying the instanced toys, the drifting
dream jellies and the hero lantern.

**Exit is always available** — the exit ring is pinned directly above the player
(arms after 2 s), and the room timer is a hard backstop, so there is no soft-lock.

**Rewards reuse existing systems** (no parallel economy): star orbs come from
`OrbManager`, cores from `SaveManager.addCores`, score from `HUDManager.addScore`,
and both the door (`speciesId: 'dreamPortal'`) and the room's hero lantern
(`speciesId: 'dreamLantern'`) are fed to `DiscoveryManager` as scan targets.
Pocket orbs are cleaned up on exit via `OrbManager.cleanupOrbsAboveY()`.

Interaction tests are measured in the **XY plane** (`distanceXY`): the player never
leaves `z = 0`, so anything gated on 3D distance at a decorative depth would be
unreachable.

## Galactic Core (finale backdrop)

`src/galactic_core.ts` — event-horizon sphere, TSL accretion disk (`RingGeometry`
with layered radial/angular noise, additive), photon halo and a spiral "swirl
veil" that fakes mild lensing without any postprocessing pass.

It is a **camera-relative parallax backdrop**, not a world-anchored prop: the
core sits `offsetX` ahead of the camera at depth `z`, and the approach ramp —
driven by the player's world X between `approachStartX` and `approachEndX`,
eased — walks both toward their "end" values. That is what makes the finale read
as a slow fall toward something enormous.

Gameplay hooks are deliberately small (`src/main/galactic_core_update.ts`):
plasma bolts bend toward the core inside 240 units, and the ship trembles once
the ramp passes 0.7. `getStarfieldWarp()` is exposed for parallax layers that
want to smear on the approach.

WebGL2 (`?renderer=webgl`) gets simpler `MeshBasicMaterial` stand-ins and lower
geometry segment counts instead of the node materials.

## Wiring checklist (important)

**Single scene source of truth**: `src/scene_context.ts` creates the one `THREE.Scene` (plus camera, basic lights, canvas). All `scene.add()` calls — foliage, player, parallax, dreamy decor, geological props, etc. — must target this scene.

- `main.ts` imports from `scene_context`, calls `initializeSceneAndRenderer()` + `attachLightsAndEnv()`, and owns the render/animate loop.
- `scene_setup.ts` is gutted (only re-exports for transitional imports); it no longer instantiates a parallel renderer or scene.
- Player loading: canonical in `player_loader.ts` (migrated to context scene). `main.ts` no longer duplicates the GLTF load.
- Dreamy/friend/butterfly managers: canonical singleton factory in `game_managers.ts`. `main.ts` calls it once and passes the returned instances to `LevelManager` and the animate loop.
- Geological spawners + cleanup: canonical in `environment.ts` (one copy). `main.ts` imports them and only wraps gravity-anchor creation to attach tarsier side effects.
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
| Core scene | `scene_context.ts` (single source), `main.ts` (render loop + init), `scene_setup.ts` (gutted compat), `game_managers.ts` (scene-owned manager factory) |
| Plants & props | `foliage.ts`, `foliage_shared.ts`, `geological.ts`, `environment.ts`, `visuals.ts` |
| Creatures | `space_friends.ts`, `creature_manager.ts` (registry + bestiary), `aquatic_life.ts`, `butterfly_swarm.ts`, `player_loader.ts`, `obstacle_system.ts` (krakens) |
| Dreamy decor | `flower_constellations.ts`, `cloud_castles.ts`, `candy_obstacles.ts` |
| Parallax BG | `clouds.ts`, `stars.ts`, `biological_background.ts`, `asteroid_field.ts` |
