# Scenery, backdrops & flavor creatures as game assets (#418)

The world has 70 environment systems (`src/level_manager/env_manifest.ts`:
45 backdrop, 12 flavor, 7 hazard, 6 traversal; `grappleIsles` moved from
traversal to backdrop since the issue was filed) plus the eager scenery built
at boot. Many named an *object* but drew a bare primitive. This page tags
every system, records what changed, and lists what is left.

Siblings: [HAZARD_ART.md](HAZARD_ART.md) (#416: the bar and the `?gallery`
page) and [PICKUP_ART.md](PICKUP_ART.md) (#417).

## The bar for scenery

- **Silhouette**: you can name it at distance, even as a backdrop. Not every
  sphere is a blob: planets, bubbles, balloons and black holes are round on
  purpose.
- **Same cost or less**: this is scenery, so the goal is a better outline from
  about the same triangles, and the same or fewer draw calls (merge parts into
  one vertex-coloured geometry, keep `InstancedMesh`).
- **Visual-only randomness**: geometry is shaped by position hashes (no RNG);
  placement uses `Math.random() // visual-only`, never `gameplayRandom`.
- Budgets in `decoration_budget.ts` stay accurate (instance counts did not
  change in this pass).

## Review

`npm run dev`, then open `http://localhost:5173/?gallery&only=scenery`.
State buttons: **Idle** (player far), **Telegraph** (player close: hook ring
lights, star peeks bright, bunny glows, geode crystals brighten), **Hit**
(singing geode sings / storm geode throws an arc, on a loop). Foliage, the
galaxy and the moon only have the idle loop. The galaxy is a shader disc, so
`Silhouette` shows its quad; judge it in the normal view. Entries live in
`src/asset_gallery/scenery_entries.ts` and use the same shared geometry and
material factories the systems instance.

## What changed

Triangles are per object (per instance for instanced systems). DC = draw calls.

| System | Before | After | Tris before → after | DC |
|---|---|---|---|---|
| Grapple Isles (`grapple_isles.ts`) | 4 layers of `IcosahedronGeometry(1, 1)` with random tumble: rocks, same as asteroids | **Floating island**: flat grassy top with dirt rim, rocky crag underside, three hanging roots, candy-pink tree, lantern on a post, gold grapple hook ring on the front edge. Islands stay upright (Y turn + slight tilt), hook ring toward the camera. Tell: the ring and a cyan wash light up within 40u of the player; the lantern flickers. | 80 → 156 | 4 (unchanged) |
| Hide-and-Seek Stars (`hide_and_seek_stars.ts`) | `IcosahedronGeometry(0.8, 1)` ball | **The pickup's star** (same body) with two eyes; faces the camera and rocks side to side instead of tumbling. Peek tell (grow + brighten near the player) kept. | 80 → 88 | 1 |
| Collectible star (`collectibles/orb.ts`) | `DodecahedronGeometry(0.5)`, not a star either | Shared five-point star body (`scenery_art/star.ts`). Hitbox unchanged (spatial-hash radius 0.35, collection radius 2.0). | 36 → 76 | 2 (unchanged) |
| Space Pets Swarm (`space_pets_swarm.ts`) | `SphereGeometry(0.5, 12, 12)`, transmissive, helmet faced away from the camera | **Space bunny**: lavender body and belly, white helmet with blue visor, long ears with pink insides through the helmet, tail puff, feet, gold collar. Opaque (no transmission). Three-quarter view drifting +X. Tell: ears flop; glows near the player; sparkle burst kept. | 264 → 232 | 1 |
| Singing Geodes (`singing_geodes.ts`) | `IcosahedronGeometry(1.5, 2)`, whole rock glowing rainbow | **Round stone bowl** with a ragged mouth, crown of five stepped crystal "organ pipes" fanning up out of it, glowing druzy lining (back faces). Only crystals and lining glow. Mouth kept toward the camera with a slow sway. Tell: when it sings to the player (25u trigger) the crystals **flare** (per-instance `aSing`, decays). | 180 → 229 | 1 |
| Storm Geodes (`storm_geodes.ts`) | `IcosahedronGeometry(1, 1)`, whole rock pulsing blue | **Flat, angular boulder** split by a zig-zag lightning crack, five needle shards bursting sideways out of it. Shape differs from the singing geode (wide burst vs round crown), not only colour. Tell: the geode that throws an arc **flashes** (per-instance `aFlash`). | 80 → 127 | 1 |
| Quantum Mirrors (`quantum_mirrors.ts`) | `IcosahedronGeometry(2, 0)` with `Math.random` vertex jitter | **Broken-mirror shard**: thin six-sided pane, bright faces and darker cut edges, tumbling and catching the chromatic shift. | 20 → 20 | 1 |
| Galaxies ×3 (`visuals.ts` `createGalaxy`) | 3 nested additive spheres each (cloud, glow, core) | **Spiral galaxy**: one tilted shader disc with two arms, star clusters on the arms and a bright bulge; spins in its own plane. | ~1,200 → 2 | 3 → 1 each |
| Moon (`visuals.ts` `createMoon`) | `SphereGeometry(8)` + 8 grey spheres stuck on as bumps + atmosphere | **Carved craters** (bowl + raised rim, dark floors, bright rims, darker maria) in one merged mesh, plus a **landmark**: the space dog's flag with a paw print at the north pole. Atmosphere and alien plants kept (plants keep clear of the flag). | ~2,900 → 5,144 (atmosphere unchanged) | 9 → 1 (+ atmosphere) |
| Shrub (`foliage/plants_basic.ts`) | sphere + 3–5 sphere "flowers" | Lumpy leaf dome ringed by folded leaf blades, five-petal flowers with yellow centres. 3 shared variants. | ~810–1,040 → ~200 | 4–6 → 2 |
| Balloon bush | 5–9 loose spheres | Leafy base, balloons with knots and strings. | ~2,400–4,300 → ~600–850 | 5–9 → 2 |
| Raining cloud | one sphere + rain | Row of five puffs with a **flat, darker base**; rain falls from the base. | 480 → 400 | 1 (+ rain) |
| Floating orb | bare sphere | **Glowing seed pod**: bulb cupped by four leaf sepals with a stem curl. Only the bulb glows (node material masks the music-reactive emissive). | 480 → 144 | 1 |
| Flowering tree | cylinder + 5–9 sphere blooms | Forked trunk with branches into a wide crown of lumpy blossom clumps with petal speckle. | ~600–1,050 → ~390–470 | 6–10 → 2 |

Net: draw calls go down (galaxies, moon, all five plants); per-instance
triangles go up a little on the isles (+76) and geodes (+49 / +47), which is
the price of an opening and a crystal cluster. At the configured densities
that is about +3.8k triangles for isles (50 instances) and +1k for singing
geodes (20). The moon is one hero object and gains ~2.2k triangles while
dropping 8 draw calls. `tests/unit/scenery_art.test.ts` pins a triangle
ceiling per shared geometry, so later growth has to be deliberate.

Also fixed on the way:

- Grapple isles set `positionNode = positionWorld + bob` (the instance and
  model transforms were applied on top of an already-world position), and
  space pets read `positionWorld` inside their `positionNode` for the phase.
  Both now bob in local units with a per-instance phase from `instanceIndex`.
- Hide-and-seek stars pulsed on `Date.now()`; they use accumulated delta.
- Geode, star, mirror cleanup disposed the geometry; it is shared now, so
  cleanup only frees the material. `CollectibleOrb.destroy` skips shared
  geometry.
- Untagged `Math.random` ratchets down: `plants_basic.ts` 70 → 46,
  `quantum_mirrors.ts` 12 → 0, `visuals.ts` 7 → 0.

## The kit (`src/scenery_art/`)

- `kit.ts`: re-exports the hazard kit (`mergeKitParts`, `placed`, hashes) and
  `sharedGeometry`; adds `mergeMaskedParts` (per-part `aMask` attribute so one
  material can treat crystal vs rock, bulb vs leaf), `filterTriangles` (carve
  openings), `displaceRadial`, `crystalPrism`, `leafBlade`, `triangleCount`.
- `isles.ts`, `star.ts`, `space_pet.ts`, `geodes.ts`, `mirror.ts`, `moon.ts`,
  `galaxy.ts`, `foliage_shapes.ts`: one shared geometry (or a few variants) per
  asset. Material factories live next to their systems
  (`createIsleMaterial`, `createHideAndSeekStarMaterial`,
  `createSpacePetMaterial`, `createSingingGeodeMaterial`,
  `createStormGeodeMaterial`, `createQuantumMirrorMaterial`) so the gallery
  draws the real thing.

## Determinism

No new code reads `gameplayRandom`. Geometry is hash-shaped; rotations,
variants and scales are `Math.random() // visual-only`. Gameplay timing and
spawns are untouched, and the replay fixtures pass without re-recording.

Pre-existing and **not** changed here: singing and storm geodes still place
instances with `gameplayRandom('geology')` (positions, scales, arc timers).
Moving them to visual randomness would shift the geology stream and needs a
replay re-record; it is listed below.

## Audit: all 70 manifest systems

Tags: **recognisable** (you can name it), **abstract** (an effect on purpose),
**blob** (named as an object, drawn as a bare primitive). "Fixed" = reworked
in this pass.

| flag | label | role | module | tag | today |
|---|---|---|---|---|---|
| dynamicStarfield | Dynamic Starfield | backdrop | dynamic_starfield.ts | abstract | instanced star billboards, 4 layers |
| dayNightCycle | Day/Night Cycle | backdrop | day_night_cycle.ts | abstract | instanced star planes + full-screen tint |
| candyPlanetRing | Candy Planet Ring | backdrop | candy_obstacles/candy_field_system.ts | **blob** | 3 instanced layers of Icosahedron / Dodecahedron; no ring |
| pastelNebula | Pastel Nebula | backdrop | pastel_nebula.ts | abstract | instanced puff / glitter billboards |
| candyField | Candy Field | backdrop | (same as candyPlanetRing) | **blob** | same bare polyhedra |
| wishLanterns | Wish Lanterns | flavor | wish_lanterns.ts | **blob** | open 8-sided cylinder with additive glow; no taper or flame |
| spacePetsSwarm | Space Pets Swarm | flavor | space_pets_swarm.ts | recognisable (**fixed**) | merged space bunny |
| blackHole | Black Hole | hazard | black_hole.ts | recognisable | horizon sphere + accretion rings + lensing |
| galacticCore | Galactic Core | backdrop | galactic_core.ts | recognisable | black hole: sphere + ring disk + halo |
| dreamPortals | Dream Portals | flavor | dream_portal/ | recognisable / **blob** room | torus portal fine; room toys are Icosahedra, lantern an Octahedron |
| industrial | Industrial Background | backdrop | industrial_background/ | recognisable | extruded gears, pistons, pipes, belts |
| waterfall | Waterfall | backdrop | waterfall.ts | recognisable | flowing sheet + mist |
| planetaryHorizon | Planetary Horizon | backdrop | planetary_horizon.ts | recognisable | planet + rings + moon gate |
| moonPalace | Moon Palace | backdrop | moon_palace.ts | **blob** | one Sphere(60) with a crater shader + 5 boxes; no palace |
| reEntry | Re-Entry | hazard | reentry.ts | abstract | heat planes + plasma streaks |
| biological | Biological Background | backdrop | biological_background.ts | abstract | tissue planes + squashed-sphere corpuscles |
| nebula | Nebula | backdrop | nebula/ | abstract | instanced cloud puffs + sparkles |
| nebulaRibbons | Nebula Ribbons | backdrop | nebula/ribbon_layers.ts | abstract | ribbon strips |
| cosmicDust | Cosmic Dust | backdrop | cosmic_dust.ts | abstract | dust billboards |
| godRays | God Rays | backdrop | godrays.ts | abstract | tapered light shafts |
| aurora | Aurora | backdrop | aurora.ts | abstract | curtain planes |
| lightning | Lightning | hazard | lightning_bolt.ts | abstract | bolt cylinders + flashes |
| asteroidField | Asteroid Field | hazard | asteroid_field.ts | recognisable | kit asteroid (HAZARD_ART.md) |
| ghostDebris | Ghost Debris | hazard | ghost_debris.ts | recognisable | kit shard (HAZARD_ART.md) |
| voidJellyfish | Void Jellyfish | flavor | void_jellyfish.ts | recognisable (reference) | merged bell + tentacles |
| aquaticLife | Aquatic Life | flavor | aquatic_life.ts | recognisable | jellies, kelp, bubble reef |
| meteorShower | Meteor Shower | hazard | meteor_shower.ts | abstract | streaks (HAZARD_ART.md follow-up) |
| dancingJellyMoss | Dancing Jelly Moss | flavor | dancing_jelly_moss.ts | **blob** | Dodecahedron(1.5, 2), nearly a sphere |
| weather | Weather | backdrop | weather_system.ts | abstract | rain streaks |
| singingGeodes | Singing Geodes | flavor | singing_geodes.ts | recognisable (**fixed**) | bowl + crystal pipe crown |
| cloudCastles | Cloud Castles | flavor | cloud_castles/ | recognisable | puffs, towers, turrets, bridges, flags |
| grappleIsles | Grapple Isles | backdrop | grapple_isles.ts | recognisable (**fixed**) | floating island |
| skyRailTerminal | Sky Rail Terminal | traversal | sky_rail_terminal.ts | **blob** (terminal) | rails fine; terminals are bare Box(10, 20, 10) |
| windCurrents | Wind Currents | traversal | wind_currents.ts | abstract | wind streaks |
| flowerConstellations | Flower Constellations | flavor | flower_constellations/ | recognisable | petal flowers + heart pollen |
| hideAndSeekStars | Hide-and-Seek Stars | flavor | hide_and_seek_stars.ts | recognisable (**fixed**) | the pickup star with eyes |
| bouncePads | Bounce Pads | traversal | bounce_pads.ts | recognisable (weak) | disc + emissive rings; would gain a rim and springs |
| spaceGarden | Space Garden | flavor | space_garden.ts | **blob** | 80 instanced Sphere(1.5) glowing balls |
| comboCorridor | Combo Corridor | traversal | combo_corridor.ts | recognisable | hoop gates |
| timeShiftZones | Time Shift Zones | traversal | time_shift_zones.ts | abstract | zone tint planes |
| aerialGuardPatrol | Aerial Guard Patrol | hazard | aerial_guard_patrol.ts | see HAZARD_ART.md | capsule drone + searchlight (listed there) |
| airTokens | Air Tokens | traversal | air_tokens.ts | recognisable | octahedron gem pickup |
| shootingStars | Shooting Stars | flavor | shooting_stars.ts | abstract | streaks |
| fossilizedSpaceWhales | Fossilized Space Whales | backdrop | fossilized_space_whales.ts | **blob** (weak) | 150 identical half-torus ribs in a row; no skull, spine or tail |
| hyperspaceTunnel | Hyperspace Tunnel | backdrop | hyperspace_tunnel.ts | abstract | tunnel rings |
| pulsarLighthouse | Pulsar Lighthouses | backdrop | pulsar_lighthouse.ts | abstract | beam planes + core billboard |
| radiantHalos | Radiant Halos | backdrop | radiant_halos.ts | abstract | huge tori |
| voidLatticeNetworks | Void Lattice Networks | backdrop | void_lattice_networks.ts | abstract | wireframe octahedra |
| astralResonanceRings | Astral Resonance Rings | backdrop | astral_resonance_rings.ts | abstract | huge tori |
| echoingVoidRipples | Echoing Void Ripples | backdrop | echoing_void_ripples.ts | abstract | ripple shader planes |
| galacticLeylines | Galactic Leylines | backdrop | galactic_leylines.ts | abstract | line strips |
| chronoTesseracts | Chrono Tesseracts | backdrop | chrono_tesseracts.ts | **blob** (weak) | one Box with UV edge glow; no inner cube |
| celestialClockworks | Celestial Clockworks | backdrop | celestial_clockworks.ts | recognisable | SDF gear on a plane |
| orbitalMegastructures | Orbital Megastructures | backdrop | orbital_megastructures.ts | recognisable (weak) | 3/4 torus with circuitry shader |
| ascendantMonoliths | Ascendant Monoliths | backdrop | ascendant_monoliths.ts | recognisable | rune slabs |
| cosmicCyberGrid | Cosmic Cyber Grid | backdrop | cosmic_cyber_grid.ts | abstract | grid plane |
| energyRifts | Energy Rifts | backdrop | energy_rifts.ts | abstract | rift shader planes |
| prismaticCrystals | Prismatic Crystals | backdrop | prismatic_crystals.ts | **blob** | Dodecahedron(15, 0): a 12-face ball, not a crystal |
| stardustVortex | Stardust Vortex | backdrop | stardust_vortex.ts | abstract | swirl shader planes |
| bioluminescentSpores | Bioluminescent Spore Clouds | backdrop | bioluminescent_spores.ts | abstract | spore particles |
| quantumMirrors | Quantum Mirror Anomalies | backdrop | quantum_mirrors.ts | recognisable (**fixed**) | broken-mirror shards |
| holographicDataStreams | Holographic Data Streams | backdrop | holographic_data_streams.ts | abstract | stream shader planes |
| cosmicWebFilaments | Cosmic Web Filaments | backdrop | cosmic_web_filaments.ts | abstract | filament planes |
| magneticPlasmaArcs | Magnetic Plasma Arcs | backdrop | magnetic_plasma_arcs.ts | abstract | half-torus arcs |
| dimensionalFractures | Dimensional Fractures | backdrop | dimensional_fractures.ts | abstract | flattened rift shells |
| cosmicStringHorizons | Cosmic String Horizons | backdrop | cosmic_string_horizons.ts | abstract | long string cylinders |
| etherealPrismaticRibbons | Ethereal Prismatic Ribbons | backdrop | ethereal_prismatic_ribbons.ts | abstract | ribbon planes |
| quantumSingularityCore | Quantum Singularity Core | backdrop | quantum_singularity_core.ts | recognisable | shader horizon + accretion disk |
| etherealSupernovaRemnants | Ethereal Supernova Remnants | backdrop | ethereal_supernova_remnants.ts | abstract | glowing shells |
| quantumFoamBubbles | Quantum Foam Bubbles | backdrop | quantum_foam_bubbles.ts | recognisable | iridescent bubbles (round on purpose; unchanged) |

### Eager and level-owned scenery

| system | module | tag | today |
|---|---|---|---|
| Starfield | stars.ts | abstract | Points layers + shooting-star lines |
| Sky dome | sky.ts | abstract | gradient sphere |
| Clouds | clouds/ | abstract | cloud billboards |
| Galaxies ×3 | visuals.ts | recognisable (**fixed**) | spiral disc |
| Moon | visuals.ts | recognisable (**fixed**) | carved craters + flag |
| Tumbling stars | video_tumbling_star.ts | recognisable | extruded star |
| Fractured geode | geological/geodes.ts | **blob** | closed Icosahedron shell hides its crystals (they sit at 0.7·size inside a 1.0·size shell) |
| Jelly moss, magma heart, liquid metal | geological/ | recognisable (round on purpose) | wobbling / lava spheres |
| Gravity anchor, vacuum kelp, ice needles | geological/ | recognisable | core + rings; capsule chain; cone cluster |
| Storm geodes | storm_geodes.ts | recognisable (**fixed**) | cracked boulder + needle shards |
| Chroma shift, industrial geometry, bubble coral, crystal chimes, derelict buoy, data monolith | various | recognisable | kit ore asteroid; rooms; coral; chimes; buoy; slab |
| Foliage: shrub, balloon bush, raining cloud, floating orb, flowering tree | foliage/plants_basic.ts | recognisable (**fixed**) | see above |
| Foliage: glowing flower | foliage/plants_basic.ts | **blob** | stem + sphere head, no petals |
| Foliage: lotus, puffball, star dust fern, nebula rose, vine | foliage/ | recognisable (vine weak) | |

## Follow-ups (remaining blobs, by visibility)

- **candyPlanetRing / candyField** (`candy_obstacles/candy_parallax.ts`
  `createCandyGeometry`): lollipop, wrapped sweet, jellybean, and an actual
  ring. The `'mixed'` layer falls through to the default `Icosahedron(1, 0)`,
  so the lollipop / jellybean cases never run there. Shapes exist in
  `candy_obstacles/candy_asteroid.ts`.
- **prismaticCrystals**: clusters of pointed hexagonal prisms (`crystalPrism`
  in the kit).
- **moonPalace**: towers, domes and spires on the moon sphere.
- **fossilizedSpaceWhales**: skull, spine, ribs tapering to a tail fluke.
- **spaceGarden**: bulb plants or planters instead of glowing balls.
- **wishLanterns**: tapered paper body with a flame at the open base.
- **dancingJellyMoss**: tufted mound with fronds and bulb tips.
- **skyRailTerminal** terminals, **chronoTesseracts** inner cube + struts,
  **dreamPortals** room toys and lantern, **fractured geode** (open the shell or
  reuse `getGeodeGeometry('singing')`), **glowing flower** petals.
- Borderline: biological corpuscles (biconcave disc), bounce pads (rim +
  springs).
- Singing / storm geodes: move instance placement off `gameplayRandom('geology')`
  (scenery should not draw from a gameplay stream) and re-record the replays.
