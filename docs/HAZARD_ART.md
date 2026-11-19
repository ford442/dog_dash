# Hazards, enemies & bosses as game assets

What the player fights should read as a *thing* — a rock, a critter, a boss with
a weak spot — not a primitive with a random colour. This doc holds the review
bar, the audit, the procedural kit that implements it, and the `?gallery`
review page. Sibling passes: pickups / power-ups / projectiles (#417), scenery
(#418); both reuse the gallery.

## The bar

1. **Silhouette** — filled black at ~64 px you can tell what it is and whether
   it is a hazard, a pickup or scenery.
2. **Front** — a face, eye, nose, thruster or hook, so motion direction reads.
3. **Not colour-only** — two different things differ in *shape*, not just hue.
4. **Tell** — at least one animation tied to a gameplay state (idle, telegraph,
   hit, death).
5. **Not every sphere is a blob** — round is fine when it is recognisable and
   has a role (planet, bubble, puffer).

## Review with `?gallery`

`npm run dev`, then open `http://localhost:5173/?gallery`. Every hazard, enemy
and boss sits on a turntable; the toolbar switches:

| Control | URL param | What it checks |
|---|---|---|
| Show | `only=hazard,enemy,boss` | category filter |
| State | `mode=idle\|telegraph\|hit` | bar #4: the tells |
| Boss | `phase=entering\|phase1\|phase2\|phase3\|defeated` | boss anatomy per phase |
| Chapter | `chapter=1..6` | rock palette + the chapter's `enemyTintColor` |
| Tint | `tint=0` | compare tinted vs. character colour |
| Silhouette | `silhouette` | bar #1: flat black on white |
| 64 px | `px=64` | bar #1 at the test size |
| Spin | `spin=0` | stop the turntable (in-game side view) |
| Hitboxes | `hitboxes` | red = damaging / weak point, blue = shield |

The URL updates as you click, so a review comment can link the exact view.
The page is a lazy chunk loaded only when `?gallery` is present
(`src/main.ts`); the game bundle never imports it. It needs WebGPU like the
game; headless Chrome works with the Vulkan SwiftShader flags
(`--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader
--use-angle=vulkan`).

**Adding entries** (#417 / #418): create `src/asset_gallery/<area>_entries.ts`
that calls `registerGalleryEntries({ id, label, category, build })` and import
it next to `hazard_entries` in `gallery.ts`. `build(ctx)` returns the object
plus optional `update(dt, t, ctx)` (pose for the state) and `hitboxes(ctx)`.

## Audit

Scores: ✓ meets the bar, ~ partly, ✗ fails, – not applicable. "Before" is
`main` at the start of this pass; "After" is with this change.

### Fixed in this pass

| Entity | Where | Before | After |
|---|---|---|---|
| Asteroid (`createAsteroid`, also boss mouth debris) | `hazard_art/asteroid_kit.ts`, `obstacle_system/spawn_pools.ts` | ✗✗✗~ — one unit icosphere, cloned per spawn (defeating `markShared`). In chapters 1–6 `applyLevelVariant` then swapped it for the *same* lumpy enemy skin, so rocks and enemies were the same shape. | ✓–✓✓ — five shared shapes (chunk, shard, cratered boulder, ore-vein rock, rubble) with baked vertex shading; chapter palette + glowing ore seams on the material. No clone; rocks no longer wear enemy skins. Tell: tumble + split/debris on hit. |
| Formation enemies (`createPatternEnemy`) | `hazard_art/enemy_characters.ts` | ✗✗✗✗ — noisy icosphere, random hue, 60% tint. **Never visible:** they sat in the obstacle loop without `rotationSpeed`, so `rotation += undefined * dt` made the world matrix NaN on frame 1. They still collided. | ✓✓✓✓ — see the six characters below. Rotation speeds are 0, the generic spin no longer hides the face. |
| Ch1 pollen pod → **Burr Pod** | `enemy_characters.ts` | ✗✗✗✗ | ✓✓✓✓ spiky ribbed seed pod, one big browed eye, petal-crown tail. Idle: crown flutter, blink. Telegraph: spikes bristle, crown flares. |
| Ch2 chroma shard → **Prism Mite** | 〃 | ✗✗✗✗ | ✓✓✓✓ faceted crystal lance with twin eyes and crystal wings. Telegraph: wings splay, body hums. |
| Ch3 re-entry scrap → **Scorch Beetle** | 〃 | ✗✗✗✗ | ✓✓✓✓ heat-shield beetle: head, mandibles, legs, rocket nozzle. Telegraph: elytra lift off a molten belly, flame roars. |
| Ch4 drone husk → **Rust Drone** | 〃 | ✗✗✗✗ | ✓✓✓✓ boxy twin-rotor drone, camera-lens eye, antenna, grabber claw. Telegraph: lens flares and contracts, strobe, nose dips. |
| Ch5 krill pod → **Krill** | 〃 | ✗✗✗✗ | ✓✓✓✓ segmented shrimp, rostrum, stalk eyes, antennae, legs, tail fan. Telegraph: tail curls up, photophores flare. |
| Ch6 jelly drifter → **Jelly Drifter** | 〃 | ~✗✗✗ (bell + 4–6 sticks) | ✓✓✓✓ scalloped bell with a face, glowing core, tapered tentacles. Idle: bell pulse, sway. Telegraph: fast pulse, tentacles reach forward. |
| Zephyr boss | `boss_system/zephyr_rig.ts` | ✗✗~✗ — r4 sphere, three additive tori, r12 translucent sphere. Nothing showed what was hittable. | ✓✓✓✓ "eye of the storm": the **eye** (r 3.6) is the weak point and matches the exposed hitbox (r 4); a **cloud wreath** sits on the shield hitbox (r 8); brows, lids, three hurricane **spiral arms**, inflow wind rings. Gale: lids slit, iris heats orange in the last 2.5 s (Shear coming). Shear: body leans with the draft, lids part before Eye. Eye: lids thrown open, eye glows, wreath parts. Hit: white flash. Defeat: pupil shrinks and spins, clouds dissipate. |
| Pitcher minion | `boss_system/pitcher_minion.ts` | ✗~✗✗ — capsule + open cone. **Drawn in the wrong place:** a child of the boss group positioned with the boss's world position added again, so it floated far from its hitbox. | ✓✓✓✓ a flying pitcher plant: ribbed urn, toothed lip, chomping lid, leaf wings, eyes; glowing **nectar** = what you shoot. Whole animated body fits the r 2.5 hitbox (unit-tested). Rage: nectar turns red, faster chomp. Hit: flash + wobble. |
| Ghost debris | `ghost_debris.ts` | ✗–~✓ — instanced icosphere | ✓–~✓ kit **shard** shape (broken debris); phase-shift shader unchanged. |
| Chroma shift rocks | `chroma_shift.ts` | ✗–~✓ — instanced icosphere | ✓–~✓ kit **ore** shape: raised seams catch the iridescent shader. |
| Background asteroid field | `asteroid_field.ts` | ✗ icosphere | kit **chunk** shape (scenery, but shares the rock language). |

### Reference assets (already good, unchanged)

| Entity | Notes from the gallery |
|---|---|
| Grumpy Mine Robot (ch4) | ✓✓✓✓ eyes + brows, pupils flare within 12u. Body is still a flat red icosahedron. |
| Nebula Puffer, Void Jellyfish, Moon Snail | creatures, not hazards; good references for faces and merged geometry. |
| Nebula Kraken | ✓✓✓✓ strong silhouette. **Finding:** its collision radius (`getRadius`) is much smaller than the visible mantle; worth a pass. |
| Star-Eater Pitcher | ~✓✓✓ the mouth, jaw and teeth face the camera, but **from the side its silhouette is a plain pill**. Worth a follow-up so it holds up at 64 px. |

### Still below the bar (follow-ups)

| Entity | Where | Score | Suggested direction |
|---|---|---|---|
| Barnacle Pod (ch5) | `spawn_pools.ts` `createBarnaclePod` | ✗✗✗✗ dodecahedron | cluster of barnacle cones with feeding cirri that retract when the beam pulls it |
| Candy asteroid | `spawn_pools.ts` `createCandyAsteroid` | ~✗~✓ round + candy material + squash | reuse `candy_obstacles/candy_asteroid.ts` lollipop / wrapper shapes |
| Gummy ring | `candy_obstacles/gummy_ring.ts` | ✓–✓✓ torus — fine for its role | – |
| Meteor shower streaks | `meteor_shower.ts` | ✓–✓~ long boxes as streaks | add a head rock from the kit |
| Gravitational lens | `grav_lens.ts` | ~–✓✓ sphere + rings | it *is* a black hole; ok |
| Aerial guard patrol | `aerial_guard_patrol.ts` | ~~✓✓ capsule + searchlight cone | add a face or turret to the capsule |
| Magma globs / thorny vines | `loop_geological.ts` hazards | not reviewed in this pass | add gallery entries |

## The kit

- `src/hazard_art/kit.ts`: deterministic hash / value / fbm noise,
  `mergeKitParts` (multi-part static body → one non-indexed geometry with a
  `color` attribute, so a body is one draw call), `placed`, `fibonacciSphere`.
- `src/hazard_art/asteroid_kit.ts`: `getAsteroidGeometry(kind)` (shared,
  unit radius, never disposed), `buildAsteroidGeometry(kind)` (owned copy for
  instanced users), `createAsteroidMaterial(kind, chapter)`,
  `pickAsteroidKind()`. `ore` has two material groups (rock, vein).
- `src/hazard_art/enemy_characters.ts`: `createEnemyCharacter(id, colour)`,
  `updateEnemyRig(mesh, dt, t, alert, aimDy)`, `enemyTellTarget(...)`,
  `rollEnemyBodyColor(id, tint)`, `CHAPTER_ENEMY`.
- `src/hazard_art/art_chapter.ts`: `artChapterFor(level, config)` picks
  the campaign chapter whose art a level uses. Endless chapters copy their
  twin's `enemyTintColor`, so they get the twin's rocks and enemy; Lost
  Sectors and Architect courses get the nearest tint; no tint → chapter 1.
- `src/obstacle_system/surface.ts`: `primaryMaterial`, a hue-preserving
  depth fade (the old one reset every obstacle to grey), and
  `setObstacleSurfaceColor` for the candy power-up.

**Tint.** Enemies now start from their character colour (small visual jitter)
and are pulled 30% toward `enemyTintColor`; eyes, glow and details use their
own materials, so the tint recolours the body without erasing the face.
Previously a random hue was lerped 60% to the tint.

**Telegraph.** `enemyTellTarget` is 1 while the player is ahead of the
enemy's face within `ENEMY_TELL_RANGE` (16u) and ±7u vertically. The rig
eases toward it and aims its face at the player. Formation enemies attack by
contact, so this is the "about to hit you" tell.

## Budgets & performance

- Every kit geometry is built once and `markShared` (`noteGeometryCreated`);
  face and detail materials are shared. Per spawn: one body material + one
  glow material (enemies), one or two materials (rocks), because the depth fade
  writes `material.color` per obstacle.
- Draw calls per formation enemy: 4–9 (body, face, glow/animated parts). A
  21-enemy formation is ~120–190 draws. If profiling shows it, the next step is
  per-chapter `InstancedMesh` pools for body + face.
- `decoration_budget.ts`: `hazard_obstacles` and `formation_enemies` are
  **observe-only** (`syncCount`, shown in the `?debug` panel). They are
  gameplay spawns from the run RNG, so the budget must never gate them.
  Zephyr now has its own `zephyr_boss` entry instead of borrowing
  `star_eater_boss`.

## Determinism

Visuals never touch `gameplayRandom` / the run RNG. Shapes come from position
hashes; per-spawn variety (rock kind, palette jitter, enemy hue jitter, blink
and animation phase) uses `Math.random()` tagged `// visual-only`.
`src/hazard_art/` is on the `check:math-random` gameplay-path list.

This pass moved the old visual draws **off** the `obstacles` stream: asteroid
grey variation and rotation, formation-enemy hue and per-vertex noise
(240 draws per enemy), candy/mine/barnacle rotations and candy sparkle.
That changes every later obstacle roll, so the replay fixtures were
re-recorded (see the PR). Collision radii (`userData.radius`) and all boss
hitboxes are unchanged; Zephyr's radii are now named constants from the rig.
