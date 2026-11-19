# Pickups, power-ups, projectiles & slingables as game assets

What the player **collects, fires, wears and slings** should read as a thing
at a glance: you should know what you are about to pick up, and what your
loadout is from the shots alone. This is the sibling of
[HAZARD_ART.md](HAZARD_ART.md) (hazards / enemies / bosses), which defines the
bar and the `?gallery` review page used here.

## The bar (from HAZARD_ART.md)

1. **Silhouette**: filled black at ~64 px you can tell what it is.
2. **Front**: a face, tip, nose or hook, so direction reads.
3. **Not colour-only**: two different things differ in *shape*.
4. **Tell**: at least one animation tied to a gameplay state.

## Review

`npm run dev`, then open `http://localhost:5173/?gallery&only=pickup,powerup,projectile,slingable,player`.
The State buttons map to:

| State | Pickups / slingables | Power-ups / orbit icons | Projectiles |
|---|---|---|---|
| Idle | resting loop | full timer | flying |
| Telegraph | player inside the tell range | last seconds of the timer (expiry blink) | – |
| Hit | collect pop / tethered (puffball inflating) | shield bounce; one butterfly leaves per hit | re-fire (muzzle pop-in) |

`Silhouette` + `64 px` is the bar #1 check. `Hitboxes` shows the collection
radius (tokens, 1.5u), the bolt hitbox (0.5u) and the slingable radius.
Entries live in `src/asset_gallery/pickup_entries.ts` and go through the real
classes (`UpgradePickup`, `UpgradeSystem`, `Projectile`,
`SlingableObjectSystem`).

## Audit

Scores are silhouette / front / not-colour-only / tell: ✓ meets the bar, ~
partly, ✗ fails, – not applicable. "Before" is `main` at the start of this pass.

### Weapon upgrades and projectiles

| Entity | Before | After |
|---|---|---|
| Upgrade tokens (cryo, pyro, rapid, pierce) | ✗✗✗~: all four the same `IcosahedronGeometry(0.5, 1)`, colour only; bob/pulse/tumble | ✓✓✓✓: emblem inside a coloured token ring. **Cryo** snowflake, **pyro** three-tongued flame, **rapid** fan of three lightning bolts, **pierce** barbed arrow. They face the camera (no tumble). Tell: inside 8u the token spins up, glows and leans toward the player; collect pops and shrinks. |
| Orbit icons (3 around the player) | ✗–✗✗: the same icosahedron, new geometry + material per icon | ✓–✓✓: the token's emblem at half size (shared geometry + material). Tell: **timer gauge**, one icon drops per third of the duration and the last blinks through the final 2.5 s. |
| Projectiles | ✗~✗–: one `CapsuleGeometry(0.1, 0.6)`; the upgrade only set a shared colour uniform, so every bolt in flight was repainted on the next shot | ✓✓✓✓: per loadout bolt + trail. **Plasma** capsule, **cryo** spinning hexagonal ice shard with frost flecks, **pyro** fireball with trailing tongues and a flickering wide trail, **rapid** short pellet stream, **pierce** long needle with guide rings and a long streak. The bolt is opaque (keeps a silhouette); the trail is additive. Bolts face their velocity (aimed shots). A shot keeps the loadout it was fired with. Tell: muzzle pop-in, cryo spin, pyro flicker. **Hitbox unchanged** (0.5 radius query for every kind). |

### Power-ups (all 16 `PowerUpType`s)

**Finding: none of these were ever visible in the game.** Every builder starts
with `if (!ctx.rocket) return`, and `PowerUpManager.setRocket()` was never
called. It is now wired in `main/startup.ts` (`onPlayerLoaded`). Every rig also
blinks through its last 2 s, the shared "about to run out" tell.

| Power-up | Before | After |
|---|---|---|
| Rainbow Comet Tail | ✗✗✗~: additive back-face sphere (a glow blob) cycling colour | ✓✓✓✓: five rainbow streamers off the tail + a spinning star head. Tell: the tail **shortens as the timer drains**. |
| Flower Crown Boost | ~–✗✗: eight unlit spheres in a ring | ✓–✓✓: wreath of six five-petal flowers with leaves on top of the rocket; turns and bobs. |
| Bubblegum Shield | ✗–✗✓: bare translucent 32×32 sphere (bounce wobble existed) | ✓–✓✓: the bubble is the point, so the translucent shell stays, now with a gum **rim**, gloss highlight and a heart knot. Tell: a bounce wobbles it and flashes the rim white; it thins out near the end. |
| Twinkle Star Magnet | ✗✗✗~: only line segments | ✓✓✓✓: horseshoe magnet floating above the nose, poles forward, star on the bend. Tell: pull waves stream into the poles (the lines remain). |
| Unicorn Horn Blast | ✗✗✗✗: **no visual at all** | ✓✓✓✓: pearly spiral horn with a gold groove on the nose. Tell: glows in pulses with a sparkle at the tip. |
| Dream Cloud Carpet | ~–~~: five spheres + a plane strip | ✓✓✓✓: one merged cloud with a rainbow hem and a sleepy face at the front; breathes and bobs. |
| Lullaby Lantern | ~–~~: cylinder + glow sphere + cone | ✓–✓✓: ribbed paper lantern with caps, handle and tassel. Tell: it swings and music notes rise from it (the singing). |
| Puppy Hug Hug | ✗–✗~: torus + a squashed sphere "heart" | ✓–✓✓: ring of eight golden hearts + a big pink heart. Tell: **heartbeat** (double thump). |
| Fairy Dog Wings | ✓–✓~: reference (drawn wing shapes) | unchanged look; geometry now `markShared` (it was a module cache that `disposeObject` could free). |
| Moonbeam Slide | ✗~✗~: cylinder + octahedron | ✓✓✓✓: silver slide curving back to a sleepy crescent moon. Tell: speed streaks race down it. |
| Fairy Godmother Sparkle | ~~~~: sphere + circle + stick | ✓✓✓✓: tiny fairy dog (ears, snout, dress, wings, halo, wand). Tell: the wand star **charges up** through the last 40% of the timer, before the free power-up. |
| Candy Cane Vortex | ~–~~: six boxes in a ring | ✓–✓✓: six red/white striped candy canes whirling (one merged mesh). |
| Starlight Tiara | ~–~~: cones + octahedra | ✓–✓✓: gold band with five stars and cyan gems. Tell: the gems twinkle (invincible). |
| Butterfly Escort | ~~✗~: circle wings; six butterflies for three charges; a blocked hit called `scene.remove()` on a rocket child, so **no butterfly ever left** | ✓✓✓✓: three butterflies with drawn wings, body and antennae, **one per charge**. Tell: a blocked hit hides one with a puff. |
| Magic Paintbrush | ~~~~: cylinder + cone + sphere | ✓✓✓✓: wooden handle, ferrule, bristle tuft. Tell: the tip cycles through the rainbow and drips. |
| Best Friend Forever Aura | ✗–✗~: two additive tori | ~–✓✓: the aura rings stay (an aura is the point) plus two smiling friend stars chasing each other around them. Silhouette is still mostly ring. |

Before this pass, removing a power-up also never disposed its geometry or
materials, so every activation leaked them. Rigs now use shared geometry and
free their own materials with `disposeObject`.

### Slingables

| Kind | Before | After |
|---|---|---|
| `rock` | ✗✗✗~: flat icosahedron (grab-hint ring) | ✓✓✓✓ **Pet rock**: lumpy stone, googly eyes, eye-bolt tow point on top. Tell: squash-bounce in grab range. |
| `chromaRock` | ✗✗~✓: icosahedron, hue cycle | ✓–✓✓ **Geode**: dark stone husk with a prism-crystal cluster; the crystals carry the hue cycle and swell in range. |
| `puffball` | ~✗~✓: sphere + stem + flecks; inflate-and-pop | ✓✓✓✓ **Puffball**: tufted fluff ball with a face, cheeks and a stubby stem. Tell: face widens in range, gasps while inflating. |
| `tetherSprite` | ~✗~~: 5-sided cone + flat cone wings | ✓✓✓✓ **Tether sprite**: teardrop body with a face, folded paper wings, gold tow hook. Tell: wings flap faster in range / tethered. |
| `wreckingBall` | ~–~~: dodecahedron + bands | ✓–✓✓ **Wrecking ball**: steel ball with studs, hazard-stripe band and a chain stub that sways with speed. At 64 px its silhouette is close to the pet rock (ball + top attachment); colour and the face separate them. |
| `toyRocket` | ✓✓✓✓ reference | unchanged |

Puffballs and sprites no longer tumble (only a gentle roll), so their faces
stay toward the camera. The additive tether shell is fainter at rest (0.07,
was 0.16) so the body's shape reads; it still brightens when latched. The
wrecking ball's resting self-glow is lower (it glowed orange). Collision is
unchanged: `obj.radius`, a sphere.

### Placeholder rocket

| | Before | After |
|---|---|---|
| `rocket.glb` fallback | ✗✗––: a red `ConeGeometry(0.5, 2, 8)`. Once `player_update` laid it down, its **nose pointed backwards** (−X) and the flame sat mid-hull. | ✓✓––: white ogive hull, red nose, gold-rimmed porthole, four swept fins, dark nozzle; built nose-up and 2 units tall like the normalised GLB, so it lies nose-forward; flame at the nozzle. |

## The kit (`src/pickup_art/`)

- `shapes.ts`: 2D outlines (heart, star, flame, bolt, crescent, arrowhead,
  vane, butterfly wing), `extrudeShape`, and `sharedGeometry(key, build)`
  (build once, `markShared`).
- `upgrade_art.ts`: emblems, token ring, orbit-icon material; bolt and trail
  geometry/material per `ProjectileKind`; `projectileKindForUpgrade`.
- `powerup_rigs.ts`: `buildPowerUpRig(type)` returns `{ root, update(state) }`;
  `applyExpiryBlink`. `powerup_manager/manager_visuals.ts` attaches rigs and
  feeds them the effect timer and shield bounce.
- `slingable_art.ts`: unit-radius bodies + details per kind,
  `buildSlingableRig`, `updateSlingableRig`, shared shell / hint-ring geometry.
- `placeholder_rocket.ts`: `createPlaceholderRocketModel()`.

Everything reuses the hazard kit's `mergeKitParts` (multi-part static body →
one vertex-coloured geometry, one draw call).

## Budgets & performance

- Observe-only `decoration_budget.ts` entries (`syncCount`, review thresholds
  in the `?debug` panel; they never gate gameplay spawns):
  `upgrade_pickups` (8), `slingable_objects` (16), `powerup_attachments` (6).
- Draw calls: token 2 (emblem + ring); orbit icons 3 (shared geometry and
  material); bolt 2 (bolt + trail) + its existing light; slingable 2–4 for
  the body plus the existing shell, ring and sparkles (the puffball was 7+
  before); power-up rigs 1–6 each.
- No `InstancedMesh`: the counts are small (20 pooled bolts, a handful of
  tokens, slingables and attachments) and every geometry is already shared.

## Determinism

No visual here reads `gameplayRandom`. `src/pickup_art/` is on the
`check:math-random` gameplay-path list. Hitboxes, collection radii, bolt speed
and slingable radii are unchanged, and the token bob (which moves the
collection point) is untouched. **The replay fixtures pass without
re-recording.**

Two behaviour fixes are adjacent to gameplay and worth knowing:

- `PickupManager.update` spliced twice after a collection, silently dropping
  the neighbouring token (it stayed in the scene but could never be
  collected). It now stays in play.
- `UpgradePickup.collect` shrank via `requestAnimationFrame` (not sim-driven;
  absent headless). The pop-and-shrink now runs on the sim delta.

## Follow-ups

- Twinkle Star Magnet's pull lines are still `THREE.Line` with legacy untagged
  `Math.random()` (baseline file).
- Best Friend Forever Aura is still mostly an additive ring at 64 px.
- The dog pilot sits inside the placeholder hull, so it is not seen through
  the porthole.
