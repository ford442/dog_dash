# Dog Dash: Comprehensive Action/Adventure Design Elaboration

## I. Alien Flora (Space Plants) - Expanded Ecosystem

### Nebula Jelly-Moss
**Advanced Mechanics**
- **Health System:** The moss core has 3 health states (Bright: 100-51%, Dim: 50-26%, Flickering: 25-0%). Each state reduces spore burst radius by 33% when destroyed.
- **Stealth Depth:** Hiding inside provides 3-tier camouflage - 50% opacity reduction, dampens engine audio by 40%, and makes you invisible to Void Root Balls' harpoon targeting. However, shield leech scales with proximity to core: 2% shield/sec at membrane edge, 8% shield/sec at core contact.
- **Crafting Synergy:** Bioluminescent Extract quality depends on destruction method - Precision shot (single hit to core) yields "Pure Extract" (3x crafting value), while sustained damage creates "Tainted Extract" that can be refined but requires additional resources.
- **Ecosystem Interaction:** Groups of 3+ Jelly-Moss create a "Nebula Field" - a localized zone where spore clouds regenerate 50% faster and Solar Sails gain +15% efficiency from ambient light.

**Visual Deep-Dive**
- **Membrane Shader:** Two-layer system - outer layer uses Gerstner wave displacement for macro wobble, inner layer employs voronoi noise for micro-pulse. Transparency uses dithered alpha-to-coverage for performance with 8 samples.
- **Fractal Moss:** Procedurally generated using L-system branching with 4-7 recursion levels. Each branch rotates on independent axis at 0.5-2 RPM, creating moiré parallax. Emission uses HDR values (5-10 intensity) with temporal dithering for pulsing effect.

**Behavioral AI**
- **Disturbance Response:** Detection radius 30m. When projectile enters radius, moss contracts over 0.75s, becoming invulnerable for 2s. Contraction reduces diameter by 30% but increases rebound force by 200%.
- **Spore Burst:** On death, releases 40-60 spore particles with initial velocity 15 m/s radial outward. Particles have 8-second lifespan and leave faint trails that reveal secret passages for 12 seconds.

### Solar Sails / Light Leaves
**Enhanced Gameplay**
- **Solar Wind Physics:** Each leaf creates a vector field extending 5m perpendicular to its surface. Entering this field applies 3 m/s² acceleration along leaf's orientation vector. Multiple overlapping fields vector-sum for complex trajectories.
- **Speed Boost Stacking:** Base sail provides 2x velocity cap for 5 seconds. Each additional overlapping sail adds +0.5x multiplier (max 4x). Boost duration extends by 1s per sail, up to 10s total.
- **Blind Mechanic:** When wrapped, screen fades to 15% visibility over 0.5s. HUD elements remain but are distorted by refraction shader. Wrapping lasts 3 seconds unless player uses "Burst Thrusters" (consumable) to break free.

**Technical Implementation**
- **Thin-Film Shader:** Uses physical-based iridescence based on actual thin-film interference equations. Thickness map varies 200-700nm across leaf surface, creating true color-shifting based on viewing angle and light position. Requires custom BRDF with 2D lookup texture for performance.
- **Light Detection:** Each leaf casts 3 raycasts toward nearest light source every 0.5s. If >60% rays hit, leaf begins 2-second unfold animation. Unfolding increases surface area by 300% and activates wind field.

### Void Root Balls (Active Threat)
**Combat Deep-Dive**
- **Grapple Sequence:**
  - *Detection:* 20m radius, checks line-of-sight every 1.5s.
  - *Wind-up:* 0.5s telegraph with audio cue and glowing vine tip.
  - *Launch:* Harpoon travels at 25 m/s, can be shot mid-flight (hitbox: 0.3m radius).
  - *Connection:* On hit, applies 10 m/s² pull force + disables rotation control.
  - *Sever Window:* Vine has 30 HP, must be destroyed in 4 seconds before impact.
- **Damage Values:** Core impact deals 50 base damage + 5 damage/sec bleed for 10s. Vine whip (if you drift into it) deals 20 damage and knocks ship back 15m.

**Behavioral States**
- **Drift Mode:** Rotates at 0.3 RPM, passive. Crystal flowers grow every 10s (max 3). Flowers emit pulsing light that attracts Spore Clouds.
- **Anchor Mode:** Triggered when player enters 40m radius. Root Ball stops drifting, orients toward player, and begins harpoon cycles. After 30s or when all flowers harvested, enters Withered state - becomes inert and dark, but roots remain as permanent obstacles.

**Visual Polish**
- **Parallax Roots:** 3-layer texture mapping with independent UV scroll speeds (0.1, 0.25, 0.5 units/sec) creates depth. Crystal spikes use telescoping geometry - 3 nested cylinders that extend with spring-damper simulation.
- **Barb Physics:** Each barb is a separate mesh with hinge constraints. When harpoon launches, barbs unfold with ballistic trajectory simulation.

### Star-Eater Pitchers (Boss Encounter)
**Multi-Phase Boss Design**
- **Phase 1 - Suction (70-100% HP):**
  - Pull force: 5 m/s², ramps to 8 m/s² over 10s.
  - Debris spawn: 1 asteroid every 4s from mouth, 15-25 m/s velocity.
  - Uvula exposed for 2s every 8s (telegraphed by throat glow).
- **Phase 2 - Enraged (30-70% HP):**
  - Pull force increases to 12 m/s².
  - Debris pattern becomes 3-shot burst every 6s.
  - Mouth begins snapping closed every 5s (instant death if inside).
  - Weak point now only exposed for 1s every 6s.
- **Phase 3 - Desperation (0-30% HP):**
  - Pull force drops to 3 m/s² but adds 5 m/s² tangential swirl.
  - Continuous debris stream + homing plasma globs (30 HP each).
  - Uvula permanently exposed but surrounded by rotating teeth shield (must shoot gaps).

**Arena Design**
- **Minions:** Boss appears in "Star-Field" zone with 2-4 smaller Pitchers (minions) in 200m radius orbit. Destroying minions reduces main boss HP by 10% each but triggers 15-second rage period where all stats increase 25%.
- **Background:** Features accretion disk shader with rotating particle system (5000 particles) creating sense of orbital motion.

**Visual Spectacle**
- **Swirling Shader:** Uses 3D noise (16x16x16) sampled with time offset, blended with radial gradient. 4-pass render: base plasma, interior glow, teeth reflections, distortion field.
- **Disco-Ball Teeth:** Each tooth uses cubemap reflection with 6 pre-rendered environment maps. Rotates at 2 RPM, creating light shafts via volumetric lighting with 32 samples.

### Spore Clouds
**Chain Reaction Simulation**
- **Spore Properties:** Each spore has 5 HP. On death, creates spherical damage radius 3m, dealing 15 damage to nearby spores. Cascade limit: 20 spores per frame to prevent performance spike.
- **Electromagnetic Behavior:** Spores have +1 electric charge. Player ship has -1 charge, creating baseline attraction force of 2 m/s². Shooting spores adds temporary +0.5 charge to ship, increasing attraction for 3s.

**HUD Glitch Effects**
- **Inhalation:** When 10+ spores contact ship, triggers 5-second glitch:
  - Scanlines every 0.1s.
  - Vertex jitter on HUD elements (±5 pixel offset).
  - Audio: 200ms delay + bitcrush to 8-bit.
  - Shield display shows false values (actual ±20% variance).
- **Crafting Integration:** Collect spores by flying through cloud at <10 m/s. Each spore converts to "Luminous Dust" - 10 dust crafts into "Stellar Fuel" (extends boost duration) or "Glitch Grenade" (causes enemy HUD effects).

### Vacuum Kelp
**Tunnel Dynamics**
- **Node System:** Each kelp strand has 5-8 nodes spaced 20-30m apart. Nodes are harvestable weak points (50 HP). Severing a node splits strand, creating new tunnel entrance.
- **Energy Drain:** Contact drains 3 energy/sec + reduces max speed by 70%. Drain rate doubles each consecutive second of contact (capped at 12/sec).
- **Rare Drops:** Each node has 15% chance to drop "Quantum Seed" - crafting material for "Phase Shifter" upgrade that allows brief intangibility.

**Collective Behavior**
- **Wave Propagation:** Kelp clusters share phase data via invisible springs. Cutting one node causes 0.5s delay, then neighbor nodes pulse red and retract 5m over 1s.
- **Flinch Response:** When neighbor severed, remaining kelp increases wobble amplitude by 50% and reduces node HP by 10 (temporary, recovers over 5s).

## II. Geological & Crystalline Objects - Material Science

### Fractured Geodes
**EM Field Mechanics**
- **Hum Frequency:** Each geode emits unique frequency (200-800 Hz). Tuning ship's sensors to match (via audio puzzle) reveals interior contents.
- **Safe Harbor:** Interior provides 90% damage reduction from external sources but amplifies internal sounds by 3x. EM field disables all guided weapons.
- **Storm Geodes:** Variant with unstable EM field that arcs lightning every 3s. Lightning chains to nearby conductive objects (Liquid Metal, ship hull). Each arc deals 35 damage but charges "Plasma Caster" ammo by +5.

**Harvesting System**
- **Crystal Quality:** 3 grades - Cracked (common), Flawed (uncommon), Perfect (rare). Quality determined by geode integrity: shooting exterior reduces interior quality.
- **Zero-G Mining:** Requires "Grav-Drill" tool (unlocked Level 3). Mining mini-game: hold trigger at resonance frequency (visualized as waveform matching) for 4s to extract without cracking.

### Liquid Metal Blobs
**Material Behavior**
- **Splitting:** Blobs >5m diameter split into 2-4 smaller blobs when shot (threshold: 100 damage). Each split blob inherits 50% mass but 75% velocity.
- **Recombination:** Blobs within 2m radius merge over 1.5s, forming larger mass. Merged blob temporarily (3s) gains reflective coating that deflects projectiles.
- **Metal Creep:** Contact leaves 0.5m residue trail that solidifies after 5s. Solidified metal has 200 HP and blocks paths. Can be melted with Magma Heart projectiles.

**Shader Implementation**
- **Mirror Surface:** Uses screen-space reflection with 4-ray cone tracing. Fallback to cubemap for off-screen reflections. Metallic value 1.0, roughness 0.02.
- **Flow Map:** Velocity field drives UV distortion with 2D fluid simulation at 64x64 resolution, updated every 0.1s.

### Ice Needles
**Thermal Dynamics**
- **Super-Bleed:** Needle shards cause "Cryo-Wound" - 2 damage/sec for 15s, stacks up to 3x. Movement speed reduced by 10% per stack.
- **Thermal Interaction:**
  - Hot exhaust (boost thrusters) melts needles within 3m over 2s, creating steam clouds that obscure vision.
  - Magma Heart proximity (20m) causes sublimation - needles evaporate into harmless vapor with high-pitched whistle.
- **Refractive Edges:** Needles act as prisms, splitting Plasma Caster shots into 3 weaker projectiles (30% damage each) with 15° spread.

**Formation Patterns**
- **Crystal Matrices:** Needles grow in hexagonal grids with 5m spacing. Destroying one needle causes chain fracture to neighbors within 0.3s.
- **Supercooled Core:** Matrix center contains "Frost Heart" - harvestable for "Cryo Rounds" that freeze enemies for 2s.

### Magma Hearts
**Eruption Cycle**
- **Build Phase:** 0-80% pressure - crust thickness increases, glow pulses every 2s. Can be safely mined for "Pyroclast Ore" (1-3 pieces).
- **Critical Phase:** 80-100% pressure - 5-second warning with intensifying rumble. Crust cracks appear, leaking lava droplets.
- **Eruption:** Pressure releases, launching 8-12 lava globs at 20-40 m/s in radial pattern. Each glob deals 60 damage + leaves burning pool (10 dmg/sec for 5s).
- **Cooldown:** 15s inactive period where core is exposed and vulnerable (200 HP). Destroying core yields "Magma Core" legendary crafting item.

**Pyroclast Ore Uses**
- **Weapon Upgrade:** 10 ore + Pure Extract crafts "Magma Lance" - Plasma Caster variant that fires piercing shot dealing 100 damage + burn DOT.
- **Defensive Tool:** Can be dropped as mine, creates 5m lava pool on impact.

## III. Artifacts & Anomalies - Risk/Reward Systems

### Derelict Buoys
**Hacking Minigame Deep-Dive**
- **Data Dock:** 3m radius sphere with floating UI ring. Player must maintain position within ±0.5m vertical/horizontal tolerance.
- **Sequence:**
  - *Approach:* Buoy begins Morse code audio transmission (3-7 letters). Frequency 440Hz, 200ms dot, 600ms dash.
  - *Decipher:* Player inputs code via directional keys (Up=dot, Down=dash). 3 mistakes fails hack and triggers alarm.
  - *Extraction:* Correct code initiates 5-second countdown where shields drop to 0 and thruster efficiency reduced to 30%.
- **Risk Multiplier:** Each failed attempt increases local enemy spawn rate by 50% for 60s.

**Map Fragment System**
- **Lost Sector:** 3 fragments combine to reveal "Lost Sector" - bonus level with unique flora.
- **Persistence:** Fragments are persistent across runs but buoy locations randomize.
- **Unlock:** Fully decoded buoy network unlocks "Quantum Compass" - permanent HUD upgrade showing nearest rare resource.

### Grav-Lenses
**Gravitational Simulation**
- **Singularity Core:** 0.5m radius sphere with gravitational force `F = (50 * mass) / distance²`. Creates stable orbit at 15m radius with velocity 12 m/s.
- **Slingshot Mechanics:**
  - Perfect slingshot (90° entry angle) grants 3x velocity boost for 8s.
  - Partial slingshot (45-90°) grants 1.5x boost.
  - Failed approach (<45°) pulls ship into 5m "Crush Zone" - 20 damage/sec + screen distortion.
- **Shatter Condition:** 150 damage in 3-second window. Creates 3-second micro-black hole (2m radius) that sucks in all projectiles and small objects, then evaporates with blinding flash.

**Navigation Puzzle**
- **Chaining:** Lenses placed in sequences requiring chain slingshots. Missing a slingshot dumps player into hazard field.
- **Detuning:** Can be "detuned" by shooting with Cryo Rounds, temporarily disabling gravity for 10s.

### Data Monoliths
**Hacking Evolution**
- **Circuitry Patterns:** Rotating slab with glowing cyan traces. Player must trace path from input to output using cursor while avoiding "firewalls" - moving red blocks.
- **Difficulty Tiers:**
  - *Tier 1:* Static path, 2 firewalls.
  - *Tier 2:* Rotating slab, 4 firewalls, timer 30s.
  - *Tier 3:* Morphing circuitry, 6 firewalls, timer 20s + background EM interference.
- **Rewards:** Tier 1 = Lore entry, Tier 2 = Blueprint fragment, Tier 3 = Immediate upgrade token.

**Lore Integration**
- **The Architects:** 20 monoliths tell story of "The Architects" - ancient civilization that created flora.
- **Bonuses:** Each decoded monolith grants 5% damage bonus against specific flora type. Full set unlocks "Architect's Key" - opens final level.

### Fossilized Space Whales
**Level-Scale Geometry**
- **Size:** 300-800m long, creating entire tunnel level. Ribcage sections have 40m clearance, requiring precise flight.
- **Barnacle Harvest:** 50-200 barnacles per whale, each contains "Memory Fragment" - audio log from whale's life. Collecting all fragments in a level reconstructs whale's migration path, revealing secret exit.
- **Memory Fog:** Dense fog in cranial cavity shows ghostly visions of whale's final moments. Contact causes "Temporal Echo" - ship duplicates inputs with 1s delay for 10s.
- **Grind Rails:** Whale's baleen plates create 5m-wide grinding paths. Grinding builds "Flow" meter - at max grants 5s of phase-through ability.

## IV. Visual & Shader Systems - Technical Art Bible

### Chroma-Shift Rocks
**Distance-Driven Vulnerability**
- **Shader:** Vertex shader calculates distance to player every frame. At <10m, triggers hue shift from base color to vibrant magenta over 0.5s.
- **Vulnerability Window:** When magenta, rock takes 3x damage. Shooting creates "shatter mask" - texture that propagates cracks based on impact point.
- **Performance:** Uses instanced rendering with custom per-instance data (health, crack mask UV). Single draw call for 1000+ rocks.

### Ghost Debris
**Phase-Shift Mechanic**
- **Dithering Shader:** Uses blue noise texture with temporal accumulation. Transparency threshold = `sin(time*2 + position.x*0.1) * 0.5 + 0.5`.
- **Phase States:**
  - *Solid (3s):* Fully opaque, physical collision.
  - *Fading (1s):* Dithered transparency, ghost collision (50% damage).
  - *Ethereal (2s):* Fully ghosted, no collision, can be flown through.
  - *Reforming (1s):* Reverse dither, regenerating health.
- **Player Interaction:** "Phase Shifter" upgrade allows ship to sync with debris phase, temporarily becoming ghosted (2s cooldown).

### Action Feedback Suite
**Camera Systems**
- **Shake Matrix:**
  - *Light impact:* 2D translation noise, 0.1 intensity, 0.2s duration.
  - *Heavy hit:* 3D rotation + translation, 0.5 intensity, 0.4s duration, frequency 15Hz.
  - *Explosion:* Perlin noise with radial impulse, 1.0 intensity, 0.6s, chromatic aberration +0.05.
- **Hit Stop:** 50ms freeze on damage taken. Boss attacks trigger 100ms freeze with audio pause. Stacks with "Impact Frame" - single-frame white flash at 100% screen brightness.

**HUD Juice**
- **Speed Lines:** Radial blur activated at >2x base speed, intensity scales with velocity.
- **Damage Direction:** Edge blood splatter texture points toward damage source, fades over 3s.
- **Resource Pop:** Collecting crafting materials triggers 3D text animation - material name floats upward, scales 1x→1.5x→0.8x while rotating 360°.

## V. Combat & Core Mechanics - Player Systems

### Plasma Caster - Full Arsenal
**Base Stats**
- **Damage:** 25 per shot, 5 shots/sec, projectile speed 80 m/s.
- **Ammo:** 1 Bioluminescent Extract = 20 shots. Max capacity 100 shots.
- **Heat:** Each shot generates 8 heat. At 100 heat, weapon overheats (3s cooldown). Heat dissipates at 10/sec when not firing.

**Upgrade Path**
- **Charged Shot (Tier 1):** Hold for 1.5s to fire 100-damage piercing blast. Consumes 5 ammo.
- **Rapid Fire (Tier 2):** Increases rate to 8 shots/sec, but heat generation becomes 12/shot.
- **Elemental Converter (Tier 3):**
  - *Cryo Rounds:* Freeze flora for 2s, 2x damage to Magma Hearts.
  - *Pyro Rounds:* Burn effect 5 dmg/sec for 5s, 2x damage to Ice Needles.
  - *Void Rounds:* Phase through shields, effective against Data Monoliths.

**Alternate Fire - Extractor Beam**
- **Function:** Right-click to siphon resources from flora at 10 units/sec.
- **Risk:** Roots ship in place, disables weapons, attracts enemies.
- **Synergy:** Can extract from Nebula Jelly-Moss without destroying it, yielding 5 Pure Extract over 10s but draining 50% shields.

### Industrial Megastructures - Tunnel Run Architecture
**Structural Design**
- **Scale:** Fills vertical screen space (top 15% to bottom 15%), extends 300-500m horizontally.
- **Piston Patterns:**
  - *Simple:* Single piston, 2m diameter, 3m stroke, 2s cycle.
  - *Crusher:* Dual pistons from top/bottom, 1.5s offset, 1m clearance at closest.
  - *Chaser:* Piston follows player Y-position with 0.5s lag, forcing constant movement.
- **Blast Doors:** 5m wide openings that close over 1.5s. Emergency release button on far side (shoot to reopen).

**Risk/Reward Inside Tunnels**
- **Conduit Paths:** Narrow maintenance shafts (1.5m wide) run behind walls. Entering requires "Micro-Drone" upgrade but contains rare resources.
- **Coolant Vents:** Periodic steam bursts (2s warning) that push ship laterally. Can be ridden for shortcuts but deal 10 heat damage.
- **Speed Challenge:** Completing tunnel without slowing below 1.5x base speed grants "Speed Demon" token - permanent +5% base speed.

**Visual Identity**
- **Material Library:** Rusted metal (roughness 0.9, metallic 0.8), glowing orange seams (emission 3.0), oil leak decals with screen-space refraction.
- **Parallax Interiors:** Multi-layer textures on walls create depth - foreground rust, midground panels, background machinery with independent scroll speeds based on player speed.

## VI. Player Ship & Progression Framework

### The "Dash" - Player Vehicle
**Base Specifications**
- **Size:** 2m x 1.5m x 0.8m ellipsoid.
- **Mobility:** 15 m/s max speed, 30 m/s² acceleration, 720°/s rotation.
- **Shields:** 100 HP, recharges 5/sec after 3s of no damage.
- **Energy:** 100 units, powers boost (20/sec) and special abilities.

**Core Upgrades (Persistent)**
- **Hull Tiers:**
  - *Mk I:* Base.
  - *Mk II:* +50 shields, +5 m/s speed (requires 5 Magma Cores).
  - *Mk III:* +100 shields, +10 m/s, damage reduction 20% (requires Architect's Key).
- **Thruster Types:**
  - *Chemical:* High boost (2.5x) short duration (3s).
  - *Plasma:* Medium boost (2x), regenerates while moving.
  - *Quantum:* Low boost (1.5x), phases through obstacles (unlocked late-game).
- **Sensor Suite:**
  - *Basic:* 50m resource detection.
  - *Advanced:* 100m + weak point highlighting (requires 10 Data Monoliths).
  - *Architect's Eye:* Reveals hidden paths + enemy attack telegraphs (requires full monolith set).

### Crafting & Economy
**Resource Tiers**
- **Common:** Luminous Dust (spores), Pyroclast Ore (magma).
- **Uncommon:** Pure Extract (jelly-moss), Void Gems (root balls).
- **Rare:** Quantum Seeds (kelp), Frost Hearts (ice).
- **Legendary:** Magma Core, Architect's Key.

**Crafting Recipes**
- **Stellar Fuel:** 10 Luminous Dust = 1 boost refill + 5s extended duration.
- **Phase Shifter:** 5 Quantum Seeds + 1 Void Gem = 3 charges of 2s intangibility.
- **Plasma Lance:** 10 Pyroclast Ore + 3 Pure Extract = Magma Caster upgrade.
- **Hull Patch:** 5 Void Gems + 20 Luminous Dust = +25 max shields (one-time use).

### Meta-Progression: The Starchart
- **Sector Unlock:** 5 main levels, each ending with Star-Eater Pitcher. Defeating boss unlocks next sector plus 2 side-levels (Lost Sectors from map fragments).
- **New Game+:** Enemies have 2x HP, 1.5x damage; Flora yields 2x resources; Unlock "Architect Mode" - level editor using collected assets.

## VII. Implementation Roadmap - Phased Delivery

**Phase 1: Combat Foundation (Weeks 1-4)**
- Plasma Caster: Implement base firing, heat system, ammo UI.
- Destructible Asteroids: 5 variants, 50-200 HP, fracture physics.
- Camera Shake & Hit Stop: Prototype in test scene.
- Basic HUD: Health, ammo, minimap.

**Phase 2: Flora Ecosystem (Weeks 5-8)**
- Nebula Jelly-Moss: Wobble shader, spore burst VFX, stealth mechanics.
- Void Root Balls: Harpoon AI, sever mechanic, grapple physics.
- Spore Clouds: Billboard system, chain reaction, collection.
- Resource Pipeline: Harvesting, inventory, basic crafting UI.

**Phase 3: Advanced Systems (Weeks 9-12)**
- Solar Sails: Thin-film shader, solar wind vector fields.
- Star-Eater Pitcher: Boss AI, phase transitions, arena VFX.
- Industrial Tunnels: Procedural piston patterns, speed challenge tracking.
- Shader Suite: Chroma-Shift, Ghost Debris, full material library.

**Phase 4: Polish & Integration (Weeks 13-16)**
- All Flora: Vacuum Kelp rope physics, Ice Needle thermal, Magma Heart cycles.
- Artifacts: Derelict Buoy hacking, Grav-Lens simulation, Data Monolith puzzles.
- Audio: FM synthesis patches for each flora, 3D spatialization.
- Optimization: Instancing (1000+ spores), LODs, occlusion culling for tunnels.

**Phase 5: Meta-Game (Weeks 17-20)**
- Progression System: Upgrade trees, persistent unlocks, New Game+.
- Level Editor: Architect Mode with asset browser.
- Leaderboards: Speed run timers, resource collection totals.
- Final Polish: Balance pass, tutorial, accessibility options.

## VIII. Performance Budgets & Technical Constraints

- **Rendering:**
  - Flora: 500 instances max per level, 3 LODs (5000, 2000, 500 tris).
  - Spore Clouds: GPU instancing with 2000 particles, frustum culling.
  - Shaders: All custom shaders <100 instructions, max 4 texture samples.
- **Physics:**
  - Active Rigidbodies: 50 max (asteroids, debris).
  - Kinematic Flora: 100 max, simplified sphere colliders.
  - Rope Physics: Vacuum Kelp uses 8-segment simplified springs, updated at 30Hz.
- **Audio:**
  - Voices: 32 max, priority system for threats.
  - FM Synthesis: Real-time generation for flora, <5% CPU per source.
