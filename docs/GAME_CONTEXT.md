# GameContext — composition root

Dog Dash constructs gameplay systems **once at bootstrap**, not at module import time. Shared mutable state lives on a typed `GameContext` installed into the live `game` binding.

## Where to construct a new system

1. Prefer a class (or factory) in its own module under `src/` with an explicit constructor that takes `scene` / ports — **no** `import { scene } from './scene_context'` inside the system if you can avoid it.
2. Instantiate it in [`src/create_game_systems.ts`](../src/create_game_systems.ts) when always-on, **or** register one entry in [`src/level_env_registry.ts`](../src/level_env_registry.ts) when level-gated and code-split (see “Adding a level environment flag” below).
3. Add the field to `GameSystems` / `GameContext` in [`src/game_runtime.ts`](../src/game_runtime.ts) when the system lives on `game`.
4. Wire cross-system callbacks in [`src/main/startup.ts`](../src/main/startup.ts) or [`src/main/startup_callbacks.ts`](../src/main/startup_callbacks.ts).

Bootstrap flow:

```
main.ts → bootstrap()
  → initializeStartup()
       createGameSystems({ scene, camera, playerState })
       createGameManagers(...)
       assemble GameContext → installGameContext(ctx)
  → startGameLoop()  // reads game.* each frame
```

## How to update each frame

Hook into the matching phase under `src/main/`:

| Phase | File | Typical work |
|-------|------|----------------|
| Core | `loop_core.ts` | Player, obstacles, pause, density throttle |
| Combat | `loop_combat/` | Boss, pickups, power-ups, friends, weapons |
| World | `loop_world.ts` | Level manager, décor, camera, artifacts |
| Geological | `loop_geological.ts` | Geological props |
| Finish | `loop_finish.ts` | HUD bars, win check |

Call `game.yourSystem.update(...)` (or a thin helper that takes ports from `game`). Do not import live singletons from a composition module.

## GameContext field groups

`GameContext` is still a flat bag on the live `game` binding (the loop reads `game.playerState`, `game.hudManager`, etc.). Fields are grouped into named slices in [`src/game_runtime.ts`](../src/game_runtime.ts) for documentation and future nesting:

| Slice | Type | Examples |
|-------|------|----------|
| **core** | `CoreRuntime` | `playerState`, `wasmExports`, `wasmMemory`, `wasmBackend`, `clock` |
| **frame** | `FrameCounters` | `fpsFrameCount`, `objectDensityMultiplier`, `geologicalUpdateFrame` |
| **run** | `RunState` | `grenadeAmmo`, `completedChaptersThisRun`, `wantsBoost`, `moonGateSequenceActive` |
| **extensions** | `GameContextExtensions` | `levelManager`, `obstacleSystem`, `slingComboManager`, scene anchors |
| **systems** | `GameSystems` | eager gameplay systems from `createGameSystems()` |
| **managers** | `GameManagers` | friends, hub, victory, tutorial, etc. |

Do **not** add new unscoped fields — place them on the matching slice type in `game_runtime.ts`.

## Domain ports (`src/ports/`)

Domain modules depend on **narrow port interfaces**, not `import { game } from './game_runtime'`. Concrete classes are constructed in `createGameSystems()` / `startup.ts` and passed in.

| Port | File | Typical consumers |
|------|------|-------------------|
| `AudioPort` | `ports/audio_port.ts` | collectibles, sling combo, power-up hooks |
| `JuicePort` | `ports/juice_port.ts` | sling combo, combat feedback |
| `HudPort` | `ports/hud_port.ts` | sling combo, graze scoring |
| `InventoryPort` | `ports/inventory_port.ts` | resource harvester, craft bay |
| `CollisionPort` | `ports/collision_port.ts` | obstacle_system WASM checks |
| `PlayerMotionPort` | `ports/player_motion_port.ts` | dream portal, power-ups |

### Example — collectibles (`AudioPort`)

```ts
// src/collectibles/manager.ts — no game import, no getAudioSystem()
import type { AudioPort } from '../ports';

export class OrbManager {
    constructor(scene: THREE.Scene, particleSystem: ParticleSystem, audio: AudioPort, powerUpThreshold = 5) {
        this.audio = audio;
        // ...
    }
}
```

Wired in `create_game_systems.ts`:

```ts
const audioSystem = getAudioSystem(); // composition root only
const orbManager = new OrbManager(scene, particleSystem, audioSystem, 4);
```

### Example — space friends & ambient audio (`AudioPort`)

[`src/space_friends/FriendsManager.ts`](../src/space_friends/FriendsManager.ts), [`src/singing_geodes.ts`](../src/singing_geodes.ts), [`src/crystal_chimes.ts`](../src/crystal_chimes.ts), and [`src/flower_constellations/manager.ts`](../src/flower_constellations/manager.ts) depend strictly on `AudioPort` instead of concrete `AudioSystem`:

```ts
// src/space_friends/FriendsManager.ts
import type { AudioPort } from '../ports';

export class FriendsManager implements FriendSpawnerHost, FriendInteractionHost {
    constructor(scene: THREE.Scene, audio: AudioPort, particles: ParticleSystem) {
        this.scene = scene;
        this.audio = audio;
        this.particles = particles;
    }
}
```

### Example — tutorial system (`AudioPort`)

[`src/tutorial_system/tutorial_core.ts`](../src/tutorial_system/tutorial_core.ts) and `TutorialOrb` receive `AudioPort` via dependency injection without creating eager audio singletons:

```ts
// src/tutorial_system/tutorial_core.ts
export abstract class TutorialSystemCore {
    constructor(scene: THREE.Scene, hud: HUDManager, audio: AudioPort, dogController: DogCockpitController) {
        this.scene = scene;
        this.hud = hud;
        this.audio = audio;
        this.dogController = dogController;
    }
}
```

### Example — power-up hooks (`AudioPort` + `JuicePort`)

[`src/powerup_manager/powerup_hooks.ts`](../src/powerup_manager/powerup_hooks.ts) takes narrow ports in `PowerUpHookContext` — health mutations use an `onHeal` callback wired in `create_game_systems.ts` against `playerState`, not a direct `game_config` import.

```ts
const powerUpHookCtx = {
    audioSystem,      // AudioPort
    juiceManager,     // JuicePort
    onHeal: () => { /* playerState + HUD update */ },
};
```

### Example — graze feedback (`AudioPort` + `HudPort` + `JuicePort`)

[`src/obstacle_system/graze_feedback.ts`](../src/obstacle_system/graze_feedback.ts) exports `createGrazeHandler()` — the composition root in [`src/main/obstacle_setup.ts`](../src/main/obstacle_setup.ts) passes real managers once; graze math stays in `collision_hooks.ts`.

```ts
onGraze: createGrazeHandler({
    ports: { audio: game.audioSystem, hud: game.hudManager, juice: game.juiceManager },
    getPlayerPosition: () => player?.position,
    onFirstGraze: (pos) => game.friendsManager.cheerFlotilla(pos),
}),
```

### Example — dream portal (`PlayerMotionPort`)

[`src/dream_portal.ts`](../src/dream_portal.ts) accepts `DreamPortalCallbacks.motion: PlayerMotionPort`. [`src/main/dream_portal_update.ts`](../src/main/dream_portal_update.ts) builds the adapter over `playerState` + `player` at the composition root.

```ts
const motion: PlayerMotionPort = {
    getScrollSpeed: () => playerState.autoScrollSpeed,
    setScrollSpeed: (speed) => { playerState.autoScrollSpeed = speed; },
    setWorldOriginY: (y) => { playerState.worldOriginY = y; },
    nudgePlayer: (dx, dy) => { /* ... */ },
};
new DreamPortalSystem(scene, { getPlayer: () => player, motion, snapCamera, spawnOrb, ... });
```

### Example — resource harvester (`InventoryPort`)

```ts
// src/resource_harvester.ts
import type { InventoryPort } from './ports';

export class ResourceHarvester {
    constructor(inventory: InventoryPort) { /* saveManager satisfies InventoryPort */ }
}
```

### Example — obstacle collision (`CollisionPort`)

`ObstacleSystemOptions.getWasm` / `setWasmMemory` are typed from `CollisionPort` in [`src/obstacle_system/types.ts`](../src/obstacle_system/types.ts). Bootstrap passes handles from `game.wasmExports` / `game.wasmMemory`.

### Example — sling combo (multi-port)

[`src/sling_combo.ts`](../src/sling_combo.ts) takes `JuicePort`, `HudPort`, and `AudioPort` in `SlingComboManagerOptions` — wired in `startup.ts` with the real `juiceManager`, `hudManager`, and `audioSystem` instances.

## Domain modules — ports, not the bag

`level_manager`, `environment`, and gameplay systems like `storm_geodes` must **not** import composition-root singletons.

- **LevelManager**: pass systems via `LevelManagerOptions.env` ([`src/level_manager/types.ts`](../src/level_manager/types.ts)). Environment flags use `buildEnvironmentPlugins` / `applyEnvironmentPlugins` with a `LevelPluginHost` that already includes those ports.
- **environment.ts**: call `bindEnvironmentSystems({ particleSystem, weaponSystem, liquidMetalSystem })` from bootstrap (and again only if liquid metal were ever swapped — today it is eager).
- **StormGeodeSystem**: constructor `StormGeodeFxDeps` (`playHit`, `onBoltStrike`) — wired when the storm-geode chunk loads in `level_systems_loader.ts`.

After a deferred module loads, [`level_systems_loader.ts`](../src/level_systems_loader.ts) (via `level_env_registry.ts`) assigns the real instance onto `game` and calls `game.levelManager.installEnvironmentSystems(...)` for environment ports so stubs are not left stale. Transitions **await** `ensureLevelSystemsForLevel(next)` before `startLevel`.

## Heavy / deferred systems

Stubs from `deferred_system_stubs.ts` stand in until the matching flag is needed:

- `ensureGameplayReady()` → `ensureLevelSystemsForLevel(1)` (no-op when Level 1 needs only eager systems)
- `ensureLevelSystemsForLevel(n)` → dynamic `import()` per system key derived from `LEVEL_CONFIG[n]`
- `ensureSlingableSystems()` → slingables / toy rockets (background after first click)
- Prefetch via `maybePrefetchNextLevel` at ~75% of the current segment

See the chunk map in [`docs/PERFORMANCE_BUDGETS.md`](PERFORMANCE_BUDGETS.md).

## Adding a level environment flag

Use the **closed-loop registry** in [`src/level_env_registry.ts`](../src/level_env_registry.ts) — do not hand-edit `level_systems_loader.ts` or scatter plugin entries.

### Code-split (deferred) environment

1. Extend `LevelEnvironments` in `level_config.ts`.
2. Add **one** entry to `DEFERRED_ENV_REGISTRY` with:
   - `load` — dynamic `import()` of the feature module
   - `install` — construct the real system and call `installEnvPartial` (or assign onto `game` for non-port systems)
   - `plugin` — `activate` / `deactivate` hooks for `buildEnvironmentPlugins`
3. Add stub + `GameSystems` field in `create_game_systems.ts` if not already present.
4. Add the flag to `PLUGIN_ORDER` in `level_manager/environment_plugins.ts` (preserves activation order).
5. Enable the flag on the target level(s) in `LEVEL_CONFIG`.

`DEFERRED_ENV_FLAGS` / `EAGER_ENV_FLAGS` must classify **every** `LevelEnvironments` key (compile-time exhaustiveness). `npm run check:env-registry` walks `LEVEL_CONFIG` and fails if a deferred flag has no loader.

### Eager environment (always constructed at bootstrap)

1. Extend `LevelEnvironments` in `level_config.ts`.
2. Add activate/deactivate in `buildEagerEnvPlugins` inside `level_env_registry.ts`.
3. Add the flag to `EAGER_ENV_FLAGS` and `PLUGIN_ORDER`.
4. Ensure the system is on `LevelEnvironmentPorts` and wired in `create_game_systems.ts`.

See also `docs/SIDE_SCROLLER_OBJECTS.md`, `docs/plans/COSMIC_ARCHITECT_TASK.md`, and decoration / JS budgets in `docs/PERFORMANCE_BUDGETS.md`.
