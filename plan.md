1. **Understand the Goal**: The task requires adding a new visual feature, `pulsarLighthouse`, to the game following the "Cosmic Architect Task Template". It should be based on Technique #20 from `docs/plans/future-plan.md`.

2. **Audit & Preparation**:
    * **Future-Plan Section**: §20 Pulsar Lighthouse Beams
    * **Description**: Volumetric sweeping fan beams across the deep space background.
    * **Key Components**: `InstancedMesh` with `THREE.PlaneGeometry` (or similar), custom `MeshBasicNodeMaterial` via TSL for a sweeping fan effect, animated based on time, integrated via `LevelManager`.
    * **Current State**: New module needs to be created. No `src/pulsar_lighthouse.ts` exists.

3. **Step 1: Create `src/pulsar_lighthouse.ts`**:
    * Follow the `COSMIC ARCHITECT TASK TEMPLATE`.
    * Import `three` and TSL functions.
    * Define `PulsarLighthouseSystem` class.
    * Implement `constructor` (initialize `InstancedMesh` and `MeshBasicNodeMaterial`, call `deactivate()`).
    * Implement `activate()` (show mesh, reset state, handle budget).
    * Implement `deactivate()` (hide mesh).
    * Implement `update(delta, cameraX, speed)` (animate beams).
    * Implement `cleanup()` (dispose geometries/materials, sync budget).
    * TSL Logic: Create a sweeping volumetric beam effect.

4. **Step 2: Update `LevelEnvironments` configuration**:
    * In `src/level_config.ts`:
        * Add `pulsarLighthouse?: boolean | import('./pulsar_lighthouse').PulsarLighthouseConfig;` to `LevelEnvironments` type.

5. **Step 3: Update `src/level_deferred_registry.ts`**:
    * Add `'pulsarLighthouse'` to `DEFERRED_ENV_FLAGS`.
    * Add `pulsarLighthouse: 'pulsarLighthouse'` to `DEFERRED_ENV_FLAG_SYSTEM_KEY`.

6. **Step 4: Update `src/level_manager/types.ts`**:
    * Add `pulsarLighthouseSystem` to `LevelEnvironmentPorts` with `activate`, `deactivate`, `update`, `cleanup` methods.

7. **Step 5: Update `src/deferred_system_stubs.ts`**:
    * Create and export `createPulsarLighthouseSystemStub()`.

8. **Step 6: Update `src/create_game_systems.ts`**:
    * In `createGameSystems`, initialize the stub: `pulsarLighthouseSystem: createPulsarLighthouseSystemStub()`.

9. **Step 7: Update `src/level_manager/env_manifest.ts`**:
    * Define the system descriptor using `defineEnvSystem<'pulsarLighthouse'>({ ... })`. Include label, difficultyWeight, and budget (e.g., category: 'background3d', instances: 10).
    * Add the descriptor to `ENV_SYSTEM_MANIFEST`.

10. **Step 8: Update `src/level_manager/environment_plugins.ts`**:
    * Add `'pulsarLighthouse'` to `PLUGIN_ORDER` array.

11. **Step 9: Integrate into `LevelManager` (`src/level_manager/manager.ts`)**:
    * Declare property: `readonly pulsarLighthouseSystem: LevelEnvironmentPorts['pulsarLighthouseSystem'];`
    * Assign in constructor: `this.pulsarLighthouseSystem = options.env.pulsarLighthouseSystem;`
    * Call `update` in `update()`: `if (enabled('pulsarLighthouse') && this.pulsarLighthouseSystem) this.pulsarLighthouseSystem.update(delta, cameraX, speed);`
    * Call `cleanup` in `disposeLevelStreamingResources()`: `if (this.pulsarLighthouseSystem) this.pulsarLighthouseSystem.cleanup?.();`

12. **Step 10: Configure in Levels (`src/level_config.ts`)**:
    * Enable `pulsarLighthouse` in a suitable level's environments (e.g., Level 5 or 6). Let's pick Level 6 or any deep space level. For testing, Level 5 works nicely.

13. **Step 11: Build and Verify**:
    * Check typechecking (`npm run check`).
    * Run build (`npm run build`).
    * Use Playwright or Live Preview to ensure no errors and visual effect works (optional but recommended).

14. **Pre-commit and Submit**:
    * Follow `pre_commit_instructions`.
    * Call `submit`.
