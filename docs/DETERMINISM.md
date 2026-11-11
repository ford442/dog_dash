# Deterministic runs: seeds, input traces, headless replays

Two machines given the same **run seed** and the same **per-step input
trace** must produce the same world and the same outcome. That property is
what shareable seeds, ghost races, verifiable scores and weekly Endless Dash
seeds rely on, and it is enforced in CI by the headless replay suite.

## The contract

| Concern | Rule | Where |
|---|---|---|
| Time step | Gameplay advances in fixed `SIM_STEP` (1/60 s) increments, never `rawDelta` | `src/main/fixed_timestep.ts`, `src/main/game_loop.ts` |
| One step | `stepSimulation()` is the only entry point: core → combat → world → geological → finish | `src/main/sim_step.ts` |
| Game time | Read `getSimTime()` / `getSimTimeMs()`, never `performance.now()`, `Date.now()` or `clock.getElapsedTime()`, for anything that changes outcomes (fire cooldown, patrol sweeps, score multipliers, the `time` arg the loop phases get) | `src/sim_clock.ts` |
| Delayed gameplay | `scheduleSim(seconds, fn)`, never `setTimeout`, for i-frame windows, staggered boss volleys, delayed grants. Cosmetic flashes may keep `setTimeout` | `src/sim_clock.ts` |
| Randomness | Spawn / drop / AI rolls use `gameplayRandom(stream)` (named substreams of the run RNG). Visual-only `Math.random()` must carry `// visual-only` on the same line | `src/run_seed/gameplay_random.ts`, `tools/check_math_random.cjs` |
| Input | Key events only set held keys or latches (`game.wantsFire`, `wantsGrenade`, `wantsBoost`, ...). Latches are consumed inside the sim step. `captureSimInput()` records the mask at the top of each step | `src/main/sim_input.ts`, `src/ui_controls.ts`, `src/main/input_bindings.ts` |
| Run start | The sim does not step until `startRun()` has seeded the run; the sim clock resets there | `src/main/input_bindings.ts`, `src/main/game_loop.ts` |
| Level transitions | `checkProgress` starts the next chapter in the same step when its chunks are prefetched (the normal case), not in a promise callback | `src/level_manager/manager.ts` |
| Camera | `camera.position` is sim-owned (level streaming and cleanup read `camera.position.x`). Screen shake is applied only around the draw call | `src/juice_effects/screen_shake.ts`, `src/main/game_loop.ts` |
| Adaptive density | The low-FPS density multiplier thins decorative scatter only; hazard and harvestable counts ignore it | `src/level_manager/foliage_streaming.ts` |
| Rendering | The player, plasma bolts, slingables and the boss body are interpolated between their last two sim positions; true positions are restored right after the draw | `src/main/render_interpolation.ts` |

Visual systems (particles, juice, floating text, shader `time`) stay on
wall-clock delta. That's intended: hit-pause and screen shake must not be
locked to 60 Hz.

### Gameplay RNG streams

`gameplayRandom('obstacles' | 'candy' | 'enemies' | 'boss' | 'pickups' |
'powerups' | 'creatures' | 'friends' | 'geology' | 'flora' | 'slingables' |
'environment' | 'player' | 'harvest' | 'comboCorridor')`. Each domain has
its own stream, so one system drawing more or fewer numbers never shifts
another system's rolls. Decorative world-dressing uses `'environment'`, which
is seeded too so two machines see the same scenery, and is kept apart from
the hazard streams. Shared helpers that pick positions
(`randomZInLayer` / `randomZInRange` in `depth_layers.ts`) take the caller's
stream and default to `'environment'`.

Before `beginRun()` there is no seed yet, but systems built in the
composition root (butterfly swarms, the asteroid field, sky rails, void
jellyfish) keep their initial layout into the run. Those draws come from
fixed **boot streams** (`BOOT_SEED` in `gameplay_random.ts`), so the pre-run
world is the same on every machine. `startRun()` calls `beginRun()` before
spawning the prototype set-pieces (gravity anchors, tarsiers, slingables),
so those use the run streams.

## The Math.random gate

`npm run check:math-random` (also part of `npm run check`, CI, and the unit
suite via `tests/unit/math_random_gate.test.ts`):

1. Files on spawn / combat / harvest paths (`GAMEPLAY_PATHS` in the tool)
   may contain **no** untagged `Math.random()`.
2. Every other file may not exceed its count in
   `.github/math-random-baseline.json`, which lists legacy visual systems
   that have not been audited yet. New files start at zero. When you tag or
   port calls, ratchet the baseline down with `npm run check:math-random:update`.

## Headless replays: the gameplay test suite

`npm run test:replay` boots the **real** composition root in Node: the
same `composeGameContext()`, `startRun()` and `stepSimulation()` the browser
runs, but with no `WebGPURenderer` and no DOM (`tests/replay/headless_env.ts`
installs inert stand-ins). It uses the shipping AssemblyScript WASM for
collision. For each fixture in `tests/fixtures/replays/` it asserts:

- **Snapshot:** end position, health, cores, grenade ammo, score, current
  chapter, objectives completed, boss spawned / health / defeated, and a
  coarse trajectory checkpoint every 60 steps all match the committed
  `expect`.
- **Math.random independence:** the same replay under an unrelated
  `Math.random()` stream must match too. If it doesn't, an unseeded roll is
  on a gameplay path. Find the file with
  `node --import tsx tests/replay/taint_math_random.ts <fixture.json>`. It
  gives every source file its own `Math.random()` stream, then bisects: it
  salts half of the files that drew numbers, keeps the half whose salt
  changes the snapshot, and repeats until single files remain (`--sites`
  lists the call sites in those files, `--steps N` shortens the run,
  `--jobs N` caps parallel children). Detection is probabilistic. A leak
  that only matters when a roll lands on one side of a threshold may need
  a few salts to show, so the tool tries two salts per probe. A clean
  result means "nothing found on this path", not a proof.
- **Refresh-rate independence:** frame deltas of 1/30, 1/60 and 1/144 s fed
  through the real accumulator reach the identical pose.

Fixtures exist for chapters 1, 4 and 6 (the test fails if any of those is
missing), plus `endless.json`: an Endless Dash run (seed `0xd06de002`) that
crosses into a generated chapter 2 and its Star-Eater gate. Endless replays
preload the first generated chapters, and their chapter sequence is itself a
pure function of the seed ([ENDLESS_DASH.md](ENDLESS_DASH.md)). The suite
also runs `tests/replay/endless_smoke.ts` (`endless.test.ts`). That run
switches on every env-system key and boss gate once; it is a crash and
persistence check, not a replay. `architect.test.ts` flies the Architect
Lab course in `tests/fixtures/architect/course.json` three times, each
importing the seed JSON from scratch under a different `Math.random` and
display rate, and requires identical spawn streams
([ARCHITECT_LAB.md](ARCHITECT_LAB.md)). Each fixture stores the run the way the in-game recorder stores it:
the seed, the start chapter, the compressed 25 Hz ghost frames, and the
run-length-encoded per-step input trace (`src/ghost_run/input_trace.ts`).

### When a replay fails

If you changed physics, spawn density or `LEVEL_CONFIG` on purpose, re-record
the fixture and commit the diff of `expect`. That diff is how reviewers see
the change in chapter outcomes:

```bash
npm run replay:record -- --chapter 4            # uses the fixed default seed for the chapter
npm run replay:record -- --chapter 4 --seed 123 # or pick another seed
npm run replay:record -- --endless              # Endless fixture (default seed, 2 boundaries)
npm run replay:record -- --endless --seed 123 --chapters 3
```

`replay:record` flies the chapter with a small deterministic autopilot. It
dodges the nearest obstacle, fires on a cadence, and taps bark, boost and
roll. The autopilot's choices are recorded as a plain input trace, so the
replay itself never runs autopilot logic.

If you did **not** mean to change gameplay, the failure is the bug.

The snapshot tracks the player's outcome, not the whole world. A tweak that
changes what the recorded run hits or collects fails (raising chapter 1's
`candyAsteroidChance` from 0.15 to 0.5 changes health, score and the step-660
checkpoint). A tweak that never reaches the recorded path does not. Examples
are a hazard count already clamped by `GEOLOGICAL_SPAWN_CAPS`, or scenery
the autopilot never touches.

## Recordings from real play

`ghostRunRecorder` now also stores `startChapter`, the per-step input trace,
and a `touchUsed` flag on every recording (`saveGhostRecording` drops the
trace before the overlay frames if a run is too large for localStorage). A
keyboard recording plus its seed is enough to re-simulate the run headlessly.
That is the basis for leaderboard verification ("re-sim the replay"). No
networking or server sim is involved.

## Known gaps

- **Touch-only input paths** (continuous touch-boost speed creep, touch
  roll/bark edge detection) are not represented in the input mask yet.
  Recordings with `touchUsed: true` are not re-simulation-exact.
- **Pointer clicks** (raycast harvesting of spore clouds, popping wish
  lanterns in `src/main/input_bindings.ts`) are DOM events that act
  immediately and are not in the input trace, so runs that use them are
  not re-simulation-exact either.
- **Save state and loadout:** fixtures start from a fresh save. A verifiable
  score from a real player also needs the upgrades, memories and crafted
  loadout in effect at run start captured in the recording.
- **Slow networks:** if the next chapter's chunks are still downloading when
  the player crosses the boundary, the chapter starts when they arrive, not
  on a fixed step. Systems that `ensureGameplayReady()` loads in parallel are
  also constructed in chunk-arrival order, which decides the order of their
  boot-stream draws. Replays preload every chapter.
- **Pre-existing gameplay bugs the replays exposed (not fixed here):**
  `playerState.level` is never assigned after a chapter transition, so it
  stays at 1. Level-gated checks that read it (the chapter 4 Zephyr and
  chapter 6 Star-Eater boss spawns, the `loop_finish` win check) never
  fire. Some hazards (void-root impact, vine bleed, magma globs) can take
  health to 0 without calling game over. The replay harness treats
  `health <= 0` as game over. When these are fixed, the chapter 4 and 6
  fixtures will need re-recording.
- **Legacy `Math.random()` in visual systems** is baselined, not audited
  file-by-file. The replay suite proves that none of it reaches gameplay on
  the recorded chapter paths. Chapters without fixtures are covered only by
  the static gate.
