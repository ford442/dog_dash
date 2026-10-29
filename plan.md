1. **Create the Feature Module `src/astral_resonance_rings.ts`**
    - Implement `AstralResonanceRingsSystem` based on technique #28.
    - Use `THREE.InstancedMesh` with `THREE.TorusGeometry`.
    - Create a custom TSL `MeshBasicNodeMaterial` for procedural energy pulses and edge fading.
    - Follow the template: constructor with `deactivate()`, `activate()`, `deactivate()`, `update()`, and `cleanup()`.
    - Register and sync with `decorationBudget`.

2. **Integrate into `src/level_config.ts`**
    - Add `astralResonanceRings?: { density?: number, speed?: number, color1?: number, color2?: number } | boolean;` to `LevelEnvironments`.
    - Add an active configuration for `astralResonanceRings` to a deep space level (e.g., level 5 or 6).

3. **Update Types and Interfaces**
    - `src/level_manager/types.ts`: Add `astralResonanceRingsSystem` to `LevelEnvironmentPorts`.
    - `src/create_game_systems.ts`: Add `astralResonanceRingsSystem` to `GameSystems` and instantiate a stub.
    - `src/deferred_system_stubs.ts`: Create `createAstralResonanceRingsSystemStub`.
    - `src/game_runtime.ts`: Add to `NestedEnvRuntime`, `bindNestedGameSlices`, and `syncNestedGameSlices`.

4. **Register the Environment System**
    - `src/level_deferred_registry.ts`: Add `'astralResonanceRings'` to `DEFERRED_ENV_FLAGS` and `DEFERRED_ENV_FLAG_SYSTEM_KEY`.
    - `src/level_manager/environment_plugins.ts`: Add `'astralResonanceRings'` to `PLUGIN_ORDER`.
    - `src/level_manager/env_manifest.ts`: Define `astralResonanceRings` using `defineEnvSystem` and add to `ENV_SYSTEM_MANIFEST`.

5. **Integrate into `src/level_manager/manager.ts`**
    - Add `astralResonanceRingsSystem` property to `LevelManager`.
    - Instantiate it in the constructor from `options.env.astralResonanceRingsSystem`.
    - Call its `update` in `LevelManager.update()`.
    - Call its `cleanup` in `LevelManager.disposeLevelStreamingResources()`.

6. **Integrate into `src/main/startup.ts`**
    - Add `astralResonanceRingsSystem: systems.astralResonanceRingsSystem` to the `env` block in `createLevelManager` options.

7. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
