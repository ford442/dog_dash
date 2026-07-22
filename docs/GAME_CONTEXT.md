# GameContext — composition root

Dog Dash constructs gameplay systems **once at bootstrap**, not at module import time. Shared mutable state lives on a typed `GameContext` installed into the live `game` binding.

## Where to construct a new system

1. Prefer a class (or factory) in its own module under `src/` with an explicit constructor that takes `scene` / ports — **no** `import { scene } from './scene_context'` inside the system if you can avoid it.
2. Instantiate it in [`src/create_game_systems.ts`](../src/create_game_systems.ts) (`createGameSystems`) when it is needed from Level 1 / always-on, **or** in [`src/level_environment_systems.ts`](../src/level_environment_systems.ts) / [`src/deferred_managers.ts`](../src/deferred_managers.ts) when it is level-heavy and code-split.
3. Add the field to `GameSystems` / `GameContext` in [`src/game_runtime.ts`](../src/game_runtime.ts) (and `GameSystems` in `create_game_systems.ts` if it is an eager system).
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
| Combat | `loop_combat.ts` | Boss, pickups, weapons, friends |
| World | `loop_world.ts` | Level manager, décor, camera, artifacts |
| Geological | `loop_geological.ts` | Geological props |
| Finish | `loop_finish.ts` | HUD bars, win check |

Call `game.yourSystem.update(...)` (or a thin helper that takes ports from `game`). Do not import live singletons from a composition module.

## Domain modules — ports, not the bag

`level_manager`, `environment`, and gameplay systems like `storm_geodes` must **not** import composition-root singletons.

- **LevelManager**: pass systems via `LevelManagerOptions.env` ([`src/level_manager/types.ts`](../src/level_manager/types.ts)). Environment flags use `buildEnvironmentPlugins` / `applyEnvironmentPlugins` with a `LevelPluginHost` that already includes those ports.
- **environment.ts**: call `bindEnvironmentSystems({ particleSystem, weaponSystem, liquidMetalSystem })` from bootstrap / after deferred install.
- **StormGeodeSystem**: constructor `StormGeodeFxDeps` (`playHit`, `onBoltStrike`) — wired in `createLevelEnvironmentSystems`.

After the async level chunk loads, [`level_systems_loader.ts`](../src/level_systems_loader.ts) assigns new instances onto `game` and calls `game.levelManager.installEnvironmentSystems(...)` plus `bindEnvironmentSystems` so stubs are not left stale.

## Heavy / deferred systems

Stubs from `deferred_system_stubs.ts` stand in until `ensureGameplayReady()` loads:

- Environment chunk → `createLevelEnvironmentSystems(deps)`
- Managers chunk → `createDeferredManagers(particleSystem, debrisSystem)`

## Adding a level environment flag

1. Extend `LevelEnvironments` in `level_config.ts`.
2. Add activate/deactivate in `buildEnvironmentPlugins`.
3. Ensure the system is on `LevelEnvironmentPorts` / constructed in the factory or deferred chunk.
4. See also `docs/SIDE_SCROLLER_OBJECTS.md` and decoration budgets in `docs/PERFORMANCE_BUDGETS.md`.
