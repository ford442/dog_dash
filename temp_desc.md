## 🌌 Architect: Weather Warzone (Rain/Snow)

### Concept
> "Dynamic weather changes mid-run (rain → snow)" - §18.2 New Mechanics & Level Concepts (ideas.md)

### Implementation
- Added `weather_system.ts` implementing `WeatherSystem` to render procedurally animated rain and snow particles.
- Uses `InstancedMesh` with TSL shaders for high-performance physics-less falling animation.
- Hooked into `LevelManager` and activated for Level 6 via `level_config.ts`.

### Visuals
- Parallax depth distribution covering the camera frustum z-range.
- Shader effects: TSL noise-based swaying (wind effect) mixed with vertical falling.
- Dynamic lighting: Particles softly glow and react to the player's engine proximity (`uPlayerPos`).

### Integration
- `src/weather_system.ts`: The core feature module.
- `src/level_config.ts`: Added `weather` flag and toggled for Level 6.
- `src/level_manager/environment_plugins.ts`: Mapped `weather` flag to `weatherSystem.activate()`.
- `src/create_game_systems.ts`, `src/deferred_system_stubs.ts`, `src/level_systems_loader.ts`: Added for deferred system loading support.
- `src/level_manager/manager.ts`: Hooked up `weatherSystem.update()`.

### Testing
- [x] `npm run build` passes
- [x] Tested in Level 6 at `npm run dev`
- [x] Mobile/touch controls still work
