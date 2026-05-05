# Dog Dash — Ideas & Suggestions Consolidated

> This file consolidates ideas, design docs, and suggestions from `future-plan.md`, `plan.md`, `weekly_plan.md`, `jules.md`, and other project docs into a single reference.

---

## 1. Quick Wins (High Impact, Low Effort)

These deliver the biggest feel improvement for the smallest effort.

- **Audio layer** — Procedural rocket thrust whoosh (looped + pitch shift), asteroid impact + glass-shatter, collectible "ting" + happy dog bark, shield/boost activation sounds, victory fanfare. The game is currently silent except for the procedural audio system; adding SFX hooks will 10× the feel.
- **Dog cockpit animation** — Tiny animated dog inside the rocket: head turns toward mouse look, tail wags on thrust, ears perk on collectibles, happy/sad face on hit/victory.
- **Collectibles v2** — Glowing Dog Treat Orbs that float; collecting 3–5 grants a temporary boost. Hook into the existing `collectibles.ts` system.
- **Dog Boost / Afterburner** — Hold SHIFT or double-tap SPACE for a short speed burst + bright flame trail (reuse the re-entry shader). Limited charges, recharges via orbs.
- **Dynamic starfield parallax** — 3–4 layers of stars with speed scaling based on thrust. Occasional shooting stars.
- **Score + high-score save** — Distance counter + `localStorage` persistence.
- **Simple pause menu + restart** — Essential for mobile and kid players.

---

## 2. Magical Whimsical Edition

Tailored for a kid-friendly, storybook aesthetic. Everything is pastel, sparkly, friendly, and full of wonder.

### 2.1 Dreamy Scenery & Backgrounds
- **Pastel Rainbow Nebula** — Swirling cotton-candy pinks, purples, teals, soft golds with floating glitter particles.
- **Floating Flower Constellations** — Giant glowing space flowers (daisies, tulips, lotuses) that bloom bigger when you fly close and release heart-shaped pollen clouds.
- **Candy Planet Ring** — Belt of colorful swirling lollipops, jellybeans, and gummy asteroids that bob and bounce.
- **Dreamy Cloud Castles** — Fluffy pink and purple cloud platforms with tiny glowing windows and rainbow bridges in the far background.
- **Starlight Butterfly Swarms** — Huge clouds of sparkling butterflies that follow the rocket and leave rainbow trails.
- **Moon Palace Approach** — Near the end, the moon becomes a giant glowing crystal palace with heart-shaped craters and silver slide ladders.

### 2.2 Cute Objects & Friends
- **Sparkle Stars / Magic Bones** — Collect glowing pastel stars or bone-shaped lollipops that explode into confetti.
- **Space Kitties & Bunnies** — Tiny friendly alien pets in astronaut helmets that wave and give bonus sparkles.
- **Wish Lanterns** — Floating paper lanterns that pop for colorful fireworks + happy giggle sound.
- **Singing Crystal Geodes** — Bigger, friendlier geodes that hum lullaby notes and light up in rainbow colors.

### 2.3 Magical Abilities & Power-ups
- **Fairy Dog Wings** — Temporary rainbow butterfly wings; press SHIFT for a floaty glide + sparkly dust trail.
- **Magic Sprinkle Blast** — Mouse-click shoots a cone of glitter that turns nearby asteroids into floating flower petals.
- **Friendship Bubble Shield** — Giant heart-shaped bubble that protects the dog and makes everything slow down and sparkly.
- **Star Wand Boost** — Collect 3 stars → auto wave wand to flash the screen rainbow and give super speed.

### 2.4 Animated Juice
- Super-cute dog animations (tutu/cape, happy dance on collect, worried-but-adorable on hit).
- Dancing Jelly-Moss with tiny fairy lights swaying to background music.
- Rocket bow + constant gentle sparkle particles from engines.
- Shooting star showers that sometimes drop extra collectibles.

### 2.5 Audio — Pure Magic
- Twinkly chime music (music-box + soft synth harp) that gets happier the faster you go.
- Friendly whoosh sounds like wind chimes.
- Cute creature sounds: space kitties meow, bunnies boop, flowers "boing".
- Victory: big group cheer of dog barks + fairy bells + little girl's "Yay!"

### 2.6 Wild Bonus Notions
- Secret hide-and-seek stars behind flowers that play peek-a-boo.
- Color-changing rocket skins (unicorn-horn, rainbow, princess-crown).
- Dream Portal Doors in clouds leading to bonus dream rooms full of floating toys.
- Thank-you notes from the Moon Palace at the end.
- Cozy pause screen showing the dog curled up with a blanket and storybook.

---

## 3. Power-Up Expansion (15 Ideas)

All triggered by collecting 3–5 glowing pastel orbs or rare "magic bone" icons. Short duration (8–15s) so they feel frequent and special.

### Tier 1 — Reuse Existing Code Heavily
1. **Rainbow Comet Tail** — Long flowing rainbow tail auto-collects nearby stars and turns small asteroids into floating candy. Reuse spore-cloud particles, make them pastel and heart-shaped.
2. **Flower Crown Boost** — Giant glowing flower crown on the dog's helmet; gives gentle upward float + pollen trail that slows obstacles. Copy Jelly-Moss sway, tint pink/purple.
3. **Bubblegum Shield** — Chewy pink heart-shaped bubblegum bubble wraps the rocket. Asteroids bounce off with stretchy "boing!" sparkles.
4. **Twinkle Star Magnet** — All collectibles gently float toward the rocket like magic. Soft glowing lines + chime particles connecting stars to rocket.

### Tier 2 — One New Tiny Prefab Each
5. **Unicorn Horn Blast** — Sparkly unicorn horn pops from rocket nose; click shoots a beam of stars that turns asteroids into dancing butterflies.
6. **Dream Cloud Carpet** — Fluffy rainbow cloud under rocket for 10s; auto-hover, ignores gravity. New low-poly cloud mesh with nebula shader tinted cotton-candy.
7. **Lullaby Lantern** — Floating lantern sings a soft tune and makes nearby obstacles gently sway aside.
8. **Puppy Hug Hug** — Warm golden glow; doubles collectible value and grants 1 free extra-life heart if low.

### Tier 3 — Wow-Factor Magic
9. **Moonbeam Slide** — Silver sparkly slide beams down from rocket; slide for bonus speed and collectibles.
10. **Fairy Godmother Sparkle** — Tiny fairy version of the dog appears, waves wand, randomly grants another power-up.
11. **Candy Cane Vortex** — Swirling red/white tornado sucks in small obstacles and pops them into jellybean confetti in slow motion.
12. **Starlight Tiara** — Glowing crystal tiara on the dog; invincible + leaves permanent star trail for extra points.
13. **Butterfly Escort** — Swarm of pastel butterflies flies in formation and blocks 2–3 hits automatically.
14. **Magic Paintbrush** — Mouse-drag paints a temporary rainbow bridge the rocket can fly along.
15. **Best Friend Forever Aura** — Giant pink heart aura; time slows slightly, music gets extra twinkly, every collectible plays a tiny giggle.

**Implementation note**: A simple `powerup_manager.ts` holding an array of active effects (temporary flags + particle emitters) plus cute floating countdown hearts above the rocket.

---

## 4. Alien Flora (Space Plants) — Expanded Ecosystem

### 4.1 Nebula Jelly-Moss
- **Advanced behavior**: Membrane physics (real vertex wobble shader rather than scale), semi-permeable shader reducing projectile velocity by 50%.
- **Weak-points**: Expose fractal moss "cores" as harvestable targets.
- **Hide/stealth mechanic**: Hiding inside provides 3-tier camouflage (50% opacity reduction, dampens engine audio by 40%, invisible to Void Root Balls' harpoon targeting). Shield leech scales with proximity: 2%/sec at edge, 8%/sec at core.
- **Destruction**: Collapse + spore particle burst + reveal hidden nodes.
- **Crafting synergy**: Precision shot to core yields "Pure Extract" (3× crafting value); sustained damage yields "Tainted Extract" requiring refinement.
- **Ecosystem interaction**: Groups of 3+ create a "Nebula Field" where spore clouds regenerate 50% faster and Solar Sails gain +15% efficiency.
- **Disturbance response**: Detection radius 30m. On projectile entry, contracts over 0.75s, becomes invulnerable for 2s, diameter reduces 30%, rebound force increases 200%.

### 4.2 Solar Sails / Light Leaves
- **Solar wind physics**: Each leaf creates a vector field extending 5m perpendicular. Entering applies 3 m/s² acceleration along leaf orientation. Overlapping fields vector-sum.
- **Speed boost stacking**: Base sail = 2× velocity cap for 5s. Each additional overlapping sail adds +0.5× (max 4×). Duration extends by 1s per sail, up to 10s total.
- **Blind mechanic**: When wrapped, screen fades to 15% visibility over 0.5s. HUD distorted by refraction shader. Lasts 3s unless "Burst Thrusters" consumable breaks free.
- **Thin-film shader**: Physical iridescence based on actual thin-film interference. Thickness map varies 200–700nm.
- **Light detection**: 3 raycasts toward nearest light every 0.5s. If >60% hit, leaf unfolds over 2s, surface area increases 300%, wind field activates.

### 4.3 Void Root Balls
- **Grapple sequence**: 20m detection radius, checks LoS every 1.5s. 0.5s telegraph (glowing vine tip). Harpoon travels 25 m/s, can be shot mid-flight (0.3m hitbox). On hit: 10 m/s² pull + disables rotation control. Vine has 30 HP, must be destroyed in 4s.
- **Damage values**: Core impact = 50 base + 5 dmg/sec bleed for 10s. Vine whip = 20 damage + 15m knockback.
- **Behavioral states**:
  - *Drift Mode*: Rotates at 0.3 RPM, passive. Crystal flowers grow every 10s (max 3). Flowers attract Spore Clouds.
  - *Anchor Mode*: Triggered at 40m radius. Stops drifting, orients toward player, begins harpoon cycles. After 30s or when all flowers harvested, enters Withered state (inert, dark, roots remain as obstacles).
- **Visual polish**: 3-layer parallax root textures with independent UV scroll. Crystal spikes use telescoping geometry (3 nested cylinders with spring-damper). Barbs are separate meshes with hinge constraints.

### 4.4 Star-Eater Pitchers (Boss Encounter)
- **Phase 1 — Suction (70-100% HP)**: Pull 5 m/s² ramping to 8 over 10s. Debris: 1 asteroid every 4s at 15–25 m/s. Uvula exposed 2s every 8s (telegraphed by throat glow).
- **Phase 2 — Enraged (30-70% HP)**: Pull 12 m/s². 3-shot debris burst every 6s. Mouth snaps closed every 5s (instant death if inside). Weak point exposed 1s every 6s.
- **Phase 3 — Desperation (0-30% HP)**: Pull drops to 3 m/s² + 5 m/s² tangential swirl. Continuous debris + homing plasma globs (30 HP each). Uvula permanently exposed but surrounded by rotating teeth shield (must shoot gaps).
- **Arena**: Boss appears in "Star-Field" zone with 2–4 smaller Pitchers (minions) in 200m orbit. Destroying minions reduces main boss HP by 10% each but triggers 15s rage period (+25% all stats).
- **Visuals**: Accretion disk shader (5000 particles). 4-pass render: base plasma, interior glow, teeth reflections, distortion field. Disco-ball teeth with cubemap reflection + volumetric light shafts (32 samples).

### 4.5 Spore Clouds
- **Chain reaction**: Each spore has 5 HP. On death, 3m spherical damage radius dealing 15 damage to nearby spores. Cascade limit: 20 spores/frame.
- **Electromagnetic behavior**: Spores have +1 charge, ship has -1 charge, baseline attraction 2 m/s². Shooting spores adds temporary +0.5 charge to ship for 3s.
- **HUD glitch**: When 10+ spores contact ship, 5s glitch (scanlines every 0.1s, vertex jitter on HUD ±5px, audio 200ms delay + bitcrush to 8-bit, shield display shows false values ±20%).
- **Crafting**: Fly through cloud at <10 m/s to collect. Each spore = "Luminous Dust". 10 dust crafts into "Stellar Fuel" (extends boost) or "Glitch Grenade" (causes enemy HUD effects).

### 4.6 Vacuum Kelp
- **Node system**: 5–8 nodes per strand, spaced 20–30m apart. Nodes are harvestable weak points (50 HP). Severing splits strand, creating new tunnel entrance.
- **Energy drain**: Contact drains 3 energy/sec + reduces max speed by 70%. Doubles each consecutive second (capped at 12/sec).
- **Rare drops**: 15% chance per node for "Quantum Seed" — crafts "Phase Shifter" upgrade (brief intangibility).
- **Collective behavior**: Kelp clusters share phase data via invisible springs. Cutting one node causes 0.5s delay, then neighbors pulse red and retract 5m over 1s. Flinch response: wobble amplitude +50%, node HP -10 (recovers over 5s).

---

## 5. Geological & Crystalline Objects

### 5.1 Fractured Geodes
- **EM field**: Each geode emits unique frequency (200–800 Hz). Tuning ship sensors to match (audio puzzle) reveals interior contents.
- **Safe harbor**: Interior provides 90% damage reduction but amplifies internal sounds 3×. EM field disables guided weapons.
- **Storm Geodes**: Unstable variant arcs lightning every 3s. Chains to conductive objects (Liquid Metal, ship hull). 35 damage per arc but charges "Plasma Caster" ammo by +5.
- **Harvesting**: Crystal quality has 3 grades (Cracked, Flawed, Perfect). Shooting exterior reduces interior quality. Zero-G mining requires "Grav-Drill" (Level 3 unlock): hold trigger at resonance frequency for 4s to extract without cracking.

### 5.2 Liquid Metal Blobs
- **Splitting**: Blobs >5m diameter split into 2–4 smaller blobs when shot (threshold: 100 damage). Each inherits 50% mass, 75% velocity.
- **Recombination**: Blobs within 2m merge over 1.5s. Merged blob gains reflective coating for 3s that deflects projectiles.
- **Metal creep**: Contact leaves 0.5m residue trail solidifying after 5s (200 HP, blocks paths). Can be melted with Magma Heart projectiles.
- **Shader**: Screen-space reflection with 4-ray cone tracing. Fallback to cubemap. Metallic 1.0, roughness 0.02. Flow map: 64×64 2D fluid simulation updated every 0.1s.

### 5.3 Ice Needles
- **Cryo-wound**: Needle shards cause 2 dmg/sec for 15s, stacks up to 3×. Movement speed -10% per stack.
- **Thermal interaction**: Hot exhaust (boost) melts needles within 3m over 2s, creating steam clouds. Magma Heart proximity (20m) causes sublimation into harmless vapor.
- **Refractive edges**: Needles act as prisms, splitting Plasma Caster shots into 3 weaker projectiles (30% damage each) with 15° spread.
- **Formation**: Hexagonal grids with 5m spacing. Destroying one causes chain fracture to neighbors within 0.3s. Matrix center contains "Frost Heart" (harvestable for "Cryo Rounds" that freeze enemies for 2s).

### 5.4 Magma Hearts
- **Eruption cycle**:
  - *Build (0–80% pressure)*: Crust thickens, glow pulses every 2s. Safely mine "Pyroclast Ore" (1–3 pieces).
  - *Critical (80–100%)*: 5s warning with intensifying rumble. Crust cracks, lava droplets leak.
  - *Eruption*: Launches 8–12 lava globs at 20–40 m/s radial. 60 damage + burning pool (10 dmg/sec for 5s).
  - *Cooldown (15s)*: Core exposed and vulnerable (200 HP). Destroying core yields "Magma Core" legendary crafting item.
- **Pyroclast uses**: 10 ore + Pure Extract = "Magma Lance" (piercing shot, 100 damage + burn DOT). Can be dropped as mine creating 5m lava pool.

### 5.5 Chroma-Shift Rocks
- **Distance-driven vulnerability**: Vertex shader calculates distance to player. At <10m, hue shifts to vibrant magenta over 0.5s. When magenta, takes 3× damage.
- **Shatter mask**: Texture propagates cracks from impact point.
- **Performance**: Instanced rendering with custom per-instance data. Single draw call for 1000+ rocks.

---

## 6. Artifacts & Anomalies — Risk/Reward Systems

### 6.1 Derelict Buoys
- **Hacking minigame**: 3m radius Data Dock. Player maintains position within ±0.5m tolerance.
  - *Approach*: Buoy transmits Morse code (3–7 letters, 440Hz, 200ms dot / 600ms dash).
  - *Decipher*: Input via directional keys (Up=dot, Down=dash). 3 mistakes fails hack, triggers alarm.
  - *Extraction*: Correct code initiates 5s countdown; shields drop to 0, thruster efficiency 30%.
- **Risk multiplier**: Each failed attempt increases local enemy spawn rate by 50% for 60s.
- **Map fragments**: 3 fragments combine to reveal "Lost Sector" (bonus level). Fragments persist across runs but buoy locations randomize.
- **Unlock**: Fully decoded buoy network unlocks "Quantum Compass" (permanent HUD upgrade showing nearest rare resource).

### 6.2 Grav-Lenses
- **Singularity core**: 0.5m radius, gravity `F = (50 * mass) / distance²`. Stable orbit at 15m radius with velocity 12 m/s.
- **Slingshot mechanics**:
  - Perfect (90° entry): 3× velocity boost for 8s.
  - Partial (45–90°): 1.5× boost.
  - Failed (<45°): Pulled into 5m "Crush Zone" — 20 dmg/sec + screen distortion.
- **Shatter**: 150 damage in 3s window creates 3s micro-black hole (2m radius) sucking in projectiles/small objects, then evaporates with blinding flash.
- **Navigation puzzle**: Lenses placed in sequences requiring chain slingshots. Missing dumps player into hazard field.
- **Detuning**: Shooting with Cryo Rounds temporarily disables gravity for 10s.

### 6.3 Data Monoliths
- **Hacking evolution**: Rotating slab with glowing cyan traces. Trace path from input to output using cursor while avoiding moving "firewall" red blocks.
- **Difficulty tiers**:
  - *Tier 1*: Static path, 2 firewalls.
  - *Tier 2*: Rotating slab, 4 firewalls, 30s timer.
  - *Tier 3*: Morphing circuitry, 6 firewalls, 20s timer + background EM interference.
- **Rewards**: Tier 1 = Lore entry, Tier 2 = Blueprint fragment, Tier 3 = Immediate upgrade token.
- **Lore**: 20 monoliths tell story of "The Architects". Each decoded grants 5% damage bonus against specific flora type. Full set unlocks "Architect's Key" (opens final level).

### 6.4 Fossilized Space Whales
- **Level-scale geometry**: 300–800m long, creating entire tunnel level. Ribcage sections have 40m clearance.
- **Barnacle harvest**: 50–200 barnacles per whale. Each contains "Memory Fragment" (audio log). Collecting all reconstructs whale's migration path, revealing secret exit.
- **Memory fog**: Dense fog in cranial cavity shows ghostly visions of whale's final moments. Contact causes "Temporal Echo" — ship duplicates inputs with 1s delay for 10s.
- **Grind rails**: Baleen plates create 5m-wide grinding paths. Grinding builds "Flow" meter; at max grants 5s phase-through ability.

---

## 7. Combat & Player Systems

### 7.1 Plasma Caster — Full Arsenal
- **Base stats**: 25 damage/shot, 5 shots/sec, 80 m/s projectile speed. Ammo: 1 Bioluminescent Extract = 20 shots (max 100). Heat: 8/shot; at 100 heat, 3s overheat cooldown. Heat dissipates at 10/sec when not firing.
- **Upgrades**:
  - *Charged Shot (Tier 1)*: Hold 1.5s for 100-damage piercing blast. Consumes 5 ammo.
  - *Rapid Fire (Tier 2)*: 8 shots/sec, but heat generation 12/shot.
  - *Elemental Converter (Tier 3)*: Cryo Rounds (freeze flora 2s, 2× vs Magma Hearts), Pyro Rounds (burn 5 dmg/sec for 5s, 2× vs Ice Needles), Void Rounds (phase through shields, effective vs Data Monoliths).
- **Alternate fire — Extractor Beam**: Right-click siphons resources at 10 units/sec. Roots ship, disables weapons, attracts enemies. Can extract from Jelly-Moss without destroying it: 5 Pure Extract over 10s but drains 50% shields.

### 7.2 Industrial Megastructures — Tunnel Run Architecture
- **Scale**: Fills vertical screen space (top 15% to bottom 15%), extends 300–500m horizontally.
- **Piston patterns**:
  - *Simple*: Single piston, 2m diameter, 3m stroke, 2s cycle.
  - *Crusher*: Dual pistons top/bottom, 1.5s offset, 1m clearance at closest.
  - *Chaser*: Piston follows player Y with 0.5s lag.
- **Blast doors**: 5m wide openings closing over 1.5s. Emergency release button on far side (shoot to reopen).
- **Risk/reward**:
  - *Conduit paths*: 1.5m-wide maintenance shafts behind walls. Requires "Micro-Drone" upgrade. Contains rare resources.
  - *Coolant vents*: 2s warning steam bursts pushing ship laterally. Can be ridden for shortcuts but deal 10 heat damage.
  - *Speed challenge*: Completing tunnel without slowing below 1.5× base speed grants "Speed Demon" token (+5% base speed permanent).

### 7.3 Ghost Debris
- **Phase-shift mechanic**: Blue noise dithering with temporal accumulation. Transparency threshold = `sin(time*2 + position.x*0.1) * 0.5 + 0.5`.
- **Phase states**:
  - *Solid (3s)*: Fully opaque, physical collision.
  - *Fading (1s)*: Dithered transparency, ghost collision (50% damage).
  - *Ethereal (2s)*: Fully ghosted, no collision, can be flown through.
  - *Reforming (1s)*: Reverse dither, regenerating health.
- **Player interaction**: "Phase Shifter" upgrade allows ship to sync with debris phase (2s cooldown).

### 7.4 Action Feedback Suite
- **Camera shake matrix**:
  - *Light impact*: 2D translation noise, 0.1 intensity, 0.2s.
  - *Heavy hit*: 3D rotation + translation, 0.5 intensity, 0.4s, 15Hz.
  - *Explosion*: Perlin noise with radial impulse, 1.0 intensity, 0.6s, chromatic aberration +0.05.
- **Hit stop**: 50ms freeze on damage. Boss attacks trigger 100ms freeze with audio pause. Stacks with "Impact Frame" (single-frame white flash at 100% brightness).
- **HUD juice**:
  - Speed lines: radial blur at >2× base speed, intensity scales with velocity.
  - Damage direction: edge blood-splatter texture pointing toward source, fades over 3s.
  - Resource pop: 3D text animation — material name floats up, scales 1×→1.5×→0.8× while rotating 360°.

---

## 8. Player Ship & Progression

### 8.1 The "Dash" — Base Specs
- Size: 2m × 1.5m × 0.8m ellipsoid.
- Mobility: 15 m/s max, 30 m/s² acceleration, 720°/s rotation.
- Shields: 100 HP, recharges 5/sec after 3s of no damage.
- Energy: 100 units, powers boost (20/sec) and specials.

### 8.2 Core Upgrades (Persistent)
- **Hull Tiers**:
  - *Mk I*: Base.
  - *Mk II*: +50 shields, +5 m/s speed (requires 5 Magma Cores).
  - *Mk III*: +100 shields, +10 m/s, 20% damage reduction (requires Architect's Key).
- **Thruster Types**:
  - *Chemical*: High boost (2.5×), short duration (3s).
  - *Plasma*: Medium boost (2×), regenerates while moving.
  - *Quantum*: Low boost (1.5×), phases through obstacles (late-game unlock).
- **Sensor Suite**:
  - *Basic*: 50m resource detection.
  - *Advanced*: 100m + weak point highlighting (requires 10 Data Monoliths).
  - *Architect's Eye*: Reveals hidden paths + enemy attack telegraphs (requires full monolith set).

### 8.3 Crafting & Economy
- **Resource tiers**:
  - Common: Luminous Dust (spores), Pyroclast Ore (magma).
  - Uncommon: Pure Extract (jelly-moss), Void Gems (root balls).
  - Rare: Quantum Seeds (kelp), Frost Hearts (ice).
  - Legendary: Magma Core, Architect's Key.
- **Recipes**:
  - Stellar Fuel: 10 Luminous Dust = 1 boost refill + 5s extended duration.
  - Phase Shifter: 5 Quantum Seeds + 1 Void Gem = 3 charges of 2s intangibility.
  - Plasma Lance: 10 Pyroclast Ore + 3 Pure Extract = Magma Caster upgrade.
  - Hull Patch: 5 Void Gems + 20 Luminous Dust = +25 max shields (one-time use).

### 8.4 Meta-Progression: The Starchart
- **Sector unlock**: 5 main levels, each ending with Star-Eater Pitcher. Defeating boss unlocks next sector + 2 side-levels (Lost Sectors from map fragments).
- **New Game+**: Enemies have 2× HP, 1.5× damage; Flora yields 2× resources; unlocks "Architect Mode" (level editor using collected assets).

---

## 9. Retro Visual Techniques for Levels

Inspired by classic shmups; each creates unforgettable depth.

1. **Multi-Layered Cloudscapes** (Thunder Force IV, Stage 2): 3–5 parallax cloud layers with varying opacity/speed. Foreground = large, detailed, fast, partially obscures ship. Mid-ground = slower, semi-transparent. Background = faint silhouettes. Lightning flashes illuminate layers from within.
2. **Waterfalls & Vertical Water** (Axelay, Stage 3): Mode 7-style pseudo-3D water surface curving into distance. Three waterfall layers at different speeds. Semi-transparent blue-tinted overlays simulate submersion. Bubble particles rise slowly.
3. **Planetary Horizons** (Gradius III, Stage 1): Single huge background layer scrolling incredibly slowly. Atmospheric haze with semi-transparent blue gradient at horizon. Stars scroll at different speed. Palette shifts from space black to atmospheric blue.
4. **Asteroid Fields with Depth** (Super R-Type, Stage 2): 3–4 depth layers at different scroll speeds. Individual asteroid rotation. Foreground asteroids darker/more detailed; distant ones smaller/lighter gray. Shot asteroids break into pieces scattering across layers.
5. **Industrial Megastructures** (R-Type, Stage 3): Foreground pistons/gears pass in front of ship. Walls = multiple parallax layers. Conveyor belts with animated textures moving opposite to scroll. Entire level is the boss — fly through its body.
6. **Atmospheric Re-Entry** (Gradius III, Stage 7): Transparent orange-red gradient overlay intensifying deeper. Ship tinted orange. Horizontal line distortion (heat haze). Background shifts from black to sky blue. Fire/plasma streams past ship.
7. **Nebulae & Energy Fields** (R-Type Final, Stage F-B): Transparent multi-colored overlays drifting in different directions. Energy particles float like dust. Nebula pulses with rhythmic brightness. Enemy fire tinted by nebula colors.

---

## 10. Audio Design Ideas

- **Procedural music**: Reactive to speed — music-box + soft synth harp base, gets happier/brighter as velocity increases.
- **FM synthesis patches**: One per flora type for distinct "voices".
- **3D spatialization**: Audio sources positioned in world space.
- **Environmental ambience**: Nebula hum, distant wind, re-entry rumble.
- **Creature sounds**: Space kitties meow, bunnies boop, flowers "boing", Jelly-Moss hums lullaby notes.
- **Power-up audio**: Each of the 15 magical power-ups has a unique chime/sound cue.
- **Victory fanfare**: Triumphant bark + landing whoosh + fairy bells + group cheer.

---

## 11. Technical Improvements

### 11.1 WASM & Memory Safety
- Add a simple allocator in AssemblyScript so JS writes into a dedicated pointer region instead of offset 0.
- Expose `allocObjects`, `freeObjects`, `getObjectPtr` in `assembly/index.ts`.
- Guard reallocation when `memory.grow` happens.
- Add tests covering memory bounds and collision correctness.

### 11.2 Particle System Overhaul
- Replace current particle arrays in `particles.ts` with a ring buffer/pool approach to avoid `Array.shift` on large counts.
- Move heavy geometry to `InstancedMesh` where possible (spore clouds, kelp, repeated flora).
- Target: performance > 5k particles.

### 11.3 Spore Clouds Optimization
- Convert `SporeCloud` from per-sprite `Mesh` to `InstancedMesh` (or particle pool) with GPU attributes for color/emissive and active state.
- Add collection mechanic and vacuum-tool integration.
- Add chain reaction visual/audio cues with cooldown and scoring.

### 11.4 Rendering & Assets
- Add an LRU texture cache for procedural assets to save memory in large scenes.
- All custom shaders <100 instructions, max 4 texture samples.
- Use LODs: 5000 / 2000 / 500 tris for flora instances.
- Frustum culling for spore clouds.

### 11.5 Audio Architecture
- Refactor audio hooks to a central `audioManager` for easy switching between SFX and procedural FM patches.
- 32 max voices with priority system for threats.
- FM synthesis: <5% CPU per source.

### 11.6 Dev Tooling
- `watch:wasm` script already added — ensure it rebuilds on AssemblyScript changes during dev and updates served files.
- Add `public/build/optimized.wat` copy for dev debugging if desired.

---

## 12. Performance Budgets

| System | Budget |
|--------|--------|
| Flora instances | 500 max per level, 3 LODs |
| Spore clouds | GPU instancing, 2000 particles, frustum culling |
| Active rigidbodies | 50 max (asteroids, debris) |
| Kinematic flora colliders | 100 max, simplified spheres |
| Rope physics (Vacuum Kelp) | 8-segment simplified springs, 30Hz |
| Audio voices | 32 max, priority system |
| FM synthesis | <5% CPU per source |
| Shaders | <100 instructions, max 4 texture samples |

---

## 13. Suggested Implementation Phases

### Phase 1: Combat Foundation (Weeks 1–4)
- Plasma Caster base firing, heat system, ammo UI.
- Destructible asteroids: 5 variants, 50–200 HP, fracture physics.
- Camera shake & hit stop prototype.
- Basic HUD: health, ammo, minimap.

### Phase 2: Flora Ecosystem (Weeks 5–8)
- Nebula Jelly-Moss: wobble shader, spore burst VFX, stealth mechanics.
- Void Root Balls: harpoon AI, sever mechanic, grapple physics.
- Spore Clouds: billboard system, chain reaction, collection.
- Resource pipeline: harvesting, inventory, basic crafting UI.

### Phase 3: Advanced Systems (Weeks 9–12)
- Solar Sails: thin-film shader, solar wind vector fields.
- Star-Eater Pitcher: boss AI, phase transitions, arena VFX.
- Industrial Tunnels: procedural piston patterns, speed challenge tracking.
- Shader suite: Chroma-Shift, Ghost Debris, full material library.

### Phase 4: Polish & Integration (Weeks 13–16)
- All flora: Vacuum Kelp rope physics, Ice Needle thermal, Magma Heart cycles.
- Artifacts: Derelict Buoy hacking, Grav-Lens simulation, Data Monolith puzzles.
- Audio: FM synthesis patches per flora, 3D spatialization.
- Optimization: instancing, LODs, occlusion culling for tunnels.

### Phase 5: Meta-Game (Weeks 17–20)
- Progression: upgrade trees, persistent unlocks, New Game+.
- Level Editor: "Architect Mode" with asset browser.
- Leaderboards: speed-run timers, resource collection totals.
- Final polish: balance pass, tutorial, accessibility options.

---

## 14. Already Implemented (Reference)

The following systems are already built and should be extended rather than rewritten:

- **Visual enhancements** (`geological.ts`, `main.ts`, `particles.ts`): Upgraded geometries (Icosahedron with subdivision), organic vertex deformation, glow auras, multi-layer crystals, MeshPhysicalMaterial with transmission/IOR/clearcoat for ice, procedural crack lines for magma, enhanced lighting (ambient 0.5, directional 0.8, rim light, accent point lights), tone mapping exposure 1.3, PCFSoftShadowMap, varied particle geometries.
- **Touch controls** (`touch_controls.ts`, `touch_settings.ts`): Three control modes (Follow Finger, Virtual Joystick, Tap to Move), 80px touch targets, haptic feedback, pastel colors, settings persistence in `localStorage`.
- **Tutorial system** (`tutorial_system.ts`): 8-step kid-friendly tutorial with speech bubbles, progress stars, encouragement messages, audio integration, save state.
- **Dog cockpit** (`dog_cockpit.ts`): Bone-based animation controller, 6 animation states (idle, thrust, collect, power-up, hit, victory), accessory system (tutu, cape, bow, glasses, crown), look-at targeting, happiness/excitement metrics.
- **Power-up manager** (`powerup_manager.ts`): Active effects array, duration tracking, UI integration.
- **WASM physics** (`assembly/index.ts`, `physics_utils.ts`): 2D circle collision (`allocAsteroids`, `checkCollision`) and 3D sphere collision (`allocSporeClouds`, `checkSporeCollision`).
- **Level configuration** (`level_config.ts`): 6 levels with distance, speed, background colors, sky colors, foliage density, asteroid rate, tunnel parameters.

---

## 15. Flight Feel & Gameplay Tightening (External Feedback)

> Polishing the flight model to match the visual complexity. The current physics are "smooth direct control" — no gravity, no inertia. The ship slides rather than flies. Here's how to tighten it.

### 15.1 Fix the Flight Angle & Descent Feel

#### Add "Space Drag" (Light Gravity)
- Give the ship a gentle, constant downward drift when idle (~2–4 units/sec) that the player must actively correct with thrust.
- Makes not pressing Space a conscious choice, not a neutral state.

#### Dramatize the Dive
- **Increase tilt range** during active descent from ±0.35 rad (~20°) up to ±0.8–1.0 rad (45–60°). Clamp only when actively holding the dive button.
- **Dive recovery lag**: When releasing A, the ship shouldn't snap upright instantly. Ease back to level over 200–400ms to sell mass.
- **Speed lines / particle intake**: When descending, spawn thin streak particles rushing up past the camera and increase the starfield parallax multiplier. Tie `speedMultiplier` to descent velocity too, not just horizontal auto-scroll.

#### Re-Entry Physics Integration
- Level 3 "Orbital Descent" already has `ReEntrySystem` (plasma, heat tinting) but the flight model doesn't change.
- Increase idle gravity drift to **8–10 units/sec** during re-entry.
- Tie the existing heat system to descent speed: diving fast builds more heat. Creates risk/reward — drop quickly to dodge asteroids, but risk overheating weapons.
- Use `AtmosphereSystem` transition to subtly darken the top of the screen so the player feels "sucked" downward.

### 15.2 Game Mechanics Polish

#### Give the 3-Hit Health System Texture
- **Shields**: First hit destroys shield (visible bubble pop VFX).
- **Weapon jam**: Second hit overheats/jams weapons for 2 seconds.
- **Death**: Third hit kills.
- Gives players panic/recovery moments instead of just a health-bar tick.

#### Grazing / Near-Miss Bonus
- If an asteroid passes within 1.5 units of the ship without hitting, award bonus score + brief audio chirp.
- The #1 mechanic that makes bullet-hell shmups feel exhilarating. Obstacle density is already high enough to support it.

#### Make Diving a Tactical Choice
- **Sonic Boom Dive**: Hold A for >0.6s while above a speed threshold → release a radial pulse that shatters small asteroids and weakens boss projectiles. Add a cooldown so it can't be spammed.
- **Dive Multiplier**: Descending through a narrow vertical gap (between two obstacles) grants a score multiplier stack, displayed as a UI combo counter. The `obstacleSystem` already spawns structured gaps — reward threading them.

#### Variable Auto-Scroll
- Auto-scroll speed is mostly fixed per level. Tie it to performance:
  - Keep ship near vertical center = speed slowly ramps up to a max (higher risk, higher score).
  - Take damage = speed drops sharply (knocked out of flow, punishing but fair).
- Makes "flight angle" matter more because staying centered becomes an active skill.

#### Boss Telegraphy
- The `bossManager` already applies a Y-axis pull force. Before activation, render warning vector lines on screen (targeting HUD locking onto player) for 1.5 seconds. Players need time to brace for the physics change.

### 15.3 What to Add Next

#### Immediate Adds (High Impact, Low Disruption)

**A. Barrel Roll / Emergency Dodge**
- Double-tap A or quick swipe down on touch triggers a 0.4s barrel roll.
- During roll: ship is slightly transparent / has afterimages (reuse existing juice effects), invincible to asteroids, destroys small enemies on contact.
- Fixes the "I had nowhere to go" problem in dense asteroid belts.

**B. Dog Companion Gameplay Loop**
- The `DogCockpitController` already has animations. Make it functional:
  - **Bark Blast**: Collect enough "Cores" → tap dog avatar (or bark button on touch) to clear screen of projectiles.
  - **Whine Warning**: Dog barks / ears perk when an off-screen asteroid approaches from behind or below — audio-visual telegraphy.

**C. Multi-Layer Cloudscapes (Thunder Force IV, Stage 2)**
- Level 1 or a new "Atmosphere Approach" level:
  - 3–4 parallax cloud layers with `THREE.MeshBasicNodeMaterial` / TSL opacity.
  - Foreground clouds partially obscure the ship (fly behind them).
  - Lightning flashes from within cloud layers using existing `CloudSystem` + volumetric lightning work.

#### Medium-Term Adds (New Level Mechanics)

**D. The Waterfall Dive Section (Axelay style)**
- Use existing `WaterfallSystem` and Mode 7-style geometry. A level transition where:
  - The player "dives" into a planet's ocean/waterfall.
  - Screen gets a semi-transparent blue overlay.
  - Bubble particles rise while the player descends.
  - Weapon heat cools faster underwater, but movement is slightly sluggish.

**E. Branching Path Level Design**
- Instead of purely linear, add vertical "gates":
  - *High Road*: Stay near Y=12, face fast asteroid waves, get score bonuses.
  - *Low Road*: Dive to Y=-8, enter an organic tunnel (`levelType: 'organic_tunnel'`) with different flora and slower boss sub-enemies.
- Gives level configs a reason to vary `tunnelHeight` and `levelType`.

**F. Creature Scanning / Space Journal**
- ~15 alien flora types and geological objects. Let the player "scan" them by proximity:
  - `space_friends.ts` already has friend-orbs. Extend this: fly close to a NebulaJellyMoss or ChromaShiftRock without shooting it to catalog it.
  - Unlock little bios in a pause menu. Gives completionists a reason to replay levels.

#### Polish Hooks (Juice & Feedback)

**G. Dive Impact Frames**
- When the player slams the dive button, add a 2-frame camera FOV bump (widen by 5°, snap back) and a quick low-pass audio sweep on the procedural engine sound. Makes descent feel violent.

**H. Velocity-Based Engine Audio**
- `audio_system.ts` is already procedural. Tie engine drone pitch to `currentSpeedY` magnitude. Diving should sound different from climbing.

### 15.4 Recommended Implementation Order

1. **Flight model**: Add light gravity drift, increase tilt range, ease-in recovery lag.
2. **Dive mechanics**: Implement Sonic Boom / dive multiplier using existing `keys.left` handler.
3. **Boss telegraphy**: Warning HUD lines before `pullForce` activates.
4. **Barrel roll**: New input gesture → 0.4s iframe + afterimages.
5. **Cloudscape level**: Layered parallax with occlusion.
6. **Dog bark blast**: Hook into existing `DogCockpitController` + power-up UI.

---

## 16. Flight Physics Polish — Gravity, Pitch, Roll & Camera (External Feedback)

> The current flight mechanics use Smooth Direct Control: the player dictates exact direction with constant acceleration/deceleration, and pitch is linearly tied to vertical speed (`targetPitch = -playerState.currentSpeedY * 0.025`). The ship feels like a cursor moving up and down. Here is how to add weight, momentum, and satisfying flight dynamics.

### 16.1 Natural Gravity & Gliding
- Instead of hovering perfectly still when the player releases controls, the ship should naturally succumb to a gentle gravitational pull.
- Creates a "thrust-to-climb, glide-to-descend" rhythm that is fundamentally more engaging.
- Recommended `CONFIG.player.gravity` start value: **8** (floaty) to **15** (heavy).

### 16.2 Dynamic Pitch, Roll, and "Nose Dive"
- Enhance rotation math so the ship doesn't just pitch up/down, but also **banks (rolls)** slightly when changing altitude.
- When descending fast, the nose should dip more aggressively using a non-linear curve (`power of 1.2`).
- **Pitch**: `targetPitch = -Math.sign(speedRatio) * Math.pow(Math.abs(speedRatio), 1.2) * 0.6`
- **Roll**: `targetRoll = playerState.currentSpeedY * 0.015`
- Smoothly interpolate: pitch at `0.12` lerp factor, roll at `0.08`.

### 16.3 Camera FOV / Look-Ahead Juice
- When diving (moving down quickly), the camera should pull back slightly or look further ahead to give a sense of speed and momentum.
- **Dynamic Z-Distance**: If `currentSpeedY < -5`, smoothly increase `cameraDistance` by +3 units.
- **Look-ahead**: `lookAheadX = 15 + speedFactor * 5`, `lookAheadY = playerState.currentSpeedY * 0.3`.

### 16.4 New Mechanics

#### A. The "Dog Dash" — Barrel Roll / Emergency Dodge
- Double-tap A or quick swipe down on touch triggers a 0.4s barrel roll.
- During roll: temporary invincibility frames (i-frames) to dodge through dense asteroid fields or enemy projectiles.

#### B. Near-Miss (Grazing) Bonus
- Reward players for flying dangerously close to obstacles without hitting them (within ~1.5 units).
- Could refill weapon Heat gauge faster or grant bonus Cores.
- This is the #1 mechanic that makes bullet-hell shmups feel exhilarating.

#### C. Thruster Overheat (Separate from Weapon Heat)
- Tie upward thrust to a stamina/heat bar.
- If the player climbs for too long, the engine sputters, forcing a descent.
- Adds resource management to vertical movement.

### 16.5 Implementation Snippets

#### Step 1: Update `CONFIG` in `main.ts`
```typescript
const CONFIG = {
    // ... existing colors/camera ...
    player: {
        maxSpeedY: 18,        // Maximum climbing speed
        maxDescentSpeed: 22,  // Allow faster falling than climbing
        acceleration: 40,     // Thrust power
        deceleration: 15,     // Air resistance when gliding
        gravity: 8,           // Natural downward pull
        responsiveness: 12,   // Smoothing factor for movement
    },
    // ...
};
```

#### Step 2: Update `updatePlayer` in `main.ts`
```typescript
function updatePlayer(delta: number) {
    if (!player) return;
    player.position.x += playerState.autoScrollSpeed * delta;

    // --- UPGRADED: Gravity and Momentum Flight ---
    let targetSpeed = 0;
    let isMovingUp = keys.jump || keys.right;
    let isMovingDown = keys.left;

    if (touchControls) {
        const touchInput = touchControls.getInput();
        touchControls.update();
        if (touchInput.vertical > 0.1) isMovingUp = true;
        if (touchInput.vertical < -0.1) isMovingDown = true;
        // ... (keep existing touch boost/fire logic)
    }

    if (isMovingUp) {
        targetSpeed = CONFIG.player.maxSpeedY;
    } else if (isMovingDown) {
        targetSpeed = -CONFIG.player.maxDescentSpeed;
    } else {
        targetSpeed = -CONFIG.player.gravity;
    }

    const accel = (targetSpeed !== -CONFIG.player.gravity && targetSpeed !== 0)
        ? CONFIG.player.acceleration
        : CONFIG.player.deceleration;

    playerState.currentSpeedY += (targetSpeed - playerState.currentSpeedY) * accel * delta;
    player.position.y += playerState.currentSpeedY * delta;

    // Soft boundaries
    if (player.position.y > 15) {
        player.position.y = 15;
        playerState.currentSpeedY = Math.min(0, playerState.currentSpeedY);
    } else if (player.position.y < -10) {
        player.position.y = -10;
        playerState.currentSpeedY = Math.max(0, playerState.currentSpeedY);
    }

    playerState.velocity.y = playerState.currentSpeedY;

    // --- UPGRADED: Visual Flight Angles (Pitch & Roll) ---
    const rocket = player.children[0];
    if (rocket) {
        const speedRatio = playerState.currentSpeedY / CONFIG.player.maxDescentSpeed;
        const targetPitch = -Math.sign(speedRatio) * Math.pow(Math.abs(speedRatio), 1.2) * 0.6;
        const targetRoll = playerState.currentSpeedY * 0.015;

        player.rotation.z += (targetPitch - player.rotation.z) * 0.12; // Pitch
        player.rotation.x += (targetRoll - player.rotation.x) * 0.08;  // Roll

        // Gentle hover bob (keep existing)
        const hoverY = Math.sin(Date.now() * 0.004) * 0.03;
        rocket.position.y = hoverY;

        // Engine VFX based on thrust vs glide
        if (rocket.userData.flame) {
            if (isMovingUp) {
                const flicker = 0.9 + Math.random() * 0.3;
                rocket.userData.flame.scale.set(flicker * 1.5, flicker * 3.0, flicker * 1.5);
                const exhaustPos = player.position.clone();
                exhaustPos.x -= 0.5; exhaustPos.y -= 0.5;
                particleSystem.emit(exhaustPos, 0xffaa00, 2, 5.0, 0.8, 0.2);
            } else if (isMovingDown) {
                const flicker = 0.4 + Math.random() * 0.2;
                rocket.userData.flame.scale.set(flicker, flicker, flicker);
            } else {
                const flicker = 0.5 + Math.random() * 0.2;
                rocket.userData.flame.scale.set(flicker, flicker * 1.5, flicker);
            }
        }
    }

    levelManager.checkProgress(player.position.x);
}
```

#### Step 3: Update `updateCamera` in `main.ts`
```typescript
function updateCamera(delta?: number) {
    if (!player) return;
    const d = delta || 0.016;

    const speedFactor = Math.abs(playerState.currentSpeedY) / CONFIG.player.maxSpeedY;
    const lookAheadX = 15 + speedFactor * 5;
    const lookAheadY = playerState.currentSpeedY * 0.3;

    const targetX = player.position.x + lookAheadX;
    const targetY = Math.max(player.position.y + 2 + lookAheadY, CONFIG.cameraHeight);

    const isFallingFast = playerState.currentSpeedY < -5;
    const targetDistance = isFallingFast ? CONFIG.cameraDistance + 3 : CONFIG.cameraDistance;

    camera.position.x += (targetX - camera.position.x) * 0.06;
    camera.position.y += (targetY - camera.position.y) * 0.04;
    camera.position.z += (targetDistance - camera.position.z) * 0.03;

    // ... (Keep existing screen shake and lookAt code)
}
```

---

## 17. Platformer-Style Flight Mechanics & Loop Polish (External Feedback)

> Structured recommendations for tightening the core loop around glide/dive states, stamina management, and angle-based level design. Note: Dog Dash is a side-scrolling shmup, but many of these principles (gravity curves, flight meter, wind zones) translate directly.

### 17.1 Quick Overview Matrix

| Category | Why it matters | What to do (high-level) | Implementation hints |
|----------|---------------|------------------------|----------------------|
| **Physics & Flight Feel** | Controls are the player’s primary feedback channel. | 1. Refine gravity curve for aerial state.<br>2. Add tilt-to-steer (or fixed angles).<br>3. Visual/audio cues for glide↔dive transitions. | Variable gravity: low while holding glide, higher when released. Clamp descent angle (e.g., –45° to +45°) and lerp toward it each frame. Play a subtle “whoosh” and animate ears/tail on angle change. |
| **Core Gameplay Loop** | Each dash/glide should feel rewarding and purposeful. | 1. Re-balance dash cooldown vs. flight duration.<br>2. Introduce risk-reward zones (narrow gaps requiring perfect glide).<br>3. Add stamina / “flight meter” that depletes with steep descents and replenishes on ground. | Store `flightMeter` (0–100). Drain at `drainRate` while gliding; refill at `regenRate` on ground. At 0, force a hard-landing animation + 0.5s stun. |
| **Polish & Content** | Fresh content keeps players engaged. | 1. New obstacle types that interact with flight (wind gusts, rotating blades).<br>2. Collectibles that modify flight (“Feather” = slower descent).<br>3. Level-specific challenges (time trials, “fly-only” sections).<br>4. UI/UX: flight meter HUD, angle indicator, tutorial prompts. | Semi-transparent arc HUD that fills as meter depletes. Faint angle line extending from nose. Particle wind trails that change color when descent angle exceeds a threshold (e.g., >30°). |

### 17.2 Flight Angle & Descent Mechanics

#### Separate “Glide” and “Dive” States

| State | Gravity | Max Angle | Controls |
|-------|---------|-----------|----------|
| **Glide** | `g_glide = 0.3 * g_normal` | ±30° | Hold Space → stay in glide. |
| **Dive** | `g_dive = 1.2 * g_normal` | ±60° | Release Space or press Down → transition to dive. |

**Why**: Low-gravity glide feels airy with fine-tuned horizontal control. Higher-gravity dive gives a way to quickly descend, adding depth to level design (e.g., “drop-through” platforms).

#### Implementation Sketch (Pseudo-JS/Phaser-style)

```typescript
class Dog extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'dog');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.state = 'ground'; // 'ground', 'glide', 'dive'
    this.flightMeter = 100;
    this.maxFlight = 100;
    this.glideGravity = 300;   // px/s²
    this.diveGravity  = 900;
    this.normalGravity = 600;
    this.body.setGravityY(this.normalGravity);
  }

  update(keys) {
    // ---------- Ground ----------
    if (this.body.blocked.down) {
      this.state = 'ground';
      this.body.setGravityY(this.normalGravity);
      this.recoverFlight();
    }

    // ---------- Initiate Glide ----------
    if (keys.space.isDown && this.state === 'ground' && this.flightMeter > 0) {
      this.state = 'glide';
      this.body.setGravityY(this.glideGravity);
    }

    // ---------- Dive ----------
    if (this.state === 'glide' && (keys.space.isUp || keys.down.isDown)) {
      this.state = 'dive';
      this.body.setGravityY(this.diveGravity);
    }

    // ---------- Flight Meter Drain ----------
    if (this.state !== 'ground') {
      this.flightMeter = Math.max(0, this.flightMeter - this.scene.time.delta / 1000 * 20);
      if (this.flightMeter === 0) this.forceLanding();
    }

    // ---------- Angle Clamping ----------
    const targetAngle = Phaser.Math.Clamp(this.body.velocity.y / 10, -45, 45);
    this.setAngle(Phaser.Math.Linear(this.angle, targetAngle, 0.15));
  }

  recoverFlight() {
    this.flightMeter = Math.min(this.maxFlight,
        this.flightMeter + this.scene.time.delta / 1000 * 30);
  }

  forceLanding() {
    this.setVelocityY(0);
    this.state = 'ground';
    this.body.setGravityY(this.normalGravity);
    this.scene.time.addEvent({ delay: 500, callback: () => this.clearTint() });
    this.setTint(0xff0000); // flash red to signal out-of-flight
  }
}
```

#### Angle-Based Visual Feedback
- **Trail particles**: Emit short “wind streak” whose length is proportional to descent angle.
- **Ear/tail animation**: Tilt dog’s ears/tail toward direction of travel.

```typescript
if (this.state !== 'ground') {
  const angleFactor = Math.abs(this.body.velocity.y) / 600; // 0–1 range
  this.trailEmitter.setScale(0.2 + 0.8 * angleFactor);
  this.trailEmitter.setAngle({ min: -5, max: 5 });
}
```

#### Audio Cues
- **Glide**: Soft “whoosh” loop, volume modulated by angle.
- **Dive**: Sharper “whoosh” plus low-frequency rumble.

### 17.3 Core Gameplay Loop & Balance

#### Dash ↔ Flight Trade-off

| Action | Cooldown | Effect |
|--------|----------|--------|
| **Dash** | 0.8s (reduced to 0.6s after first level) | Instant horizontal boost, breaks “soft” obstacles. |
| **Flight** | 1.5s after a dive ends (or after meter empties) | Prevents spamming glide to bypass entire sections. |

**Balancing tip**: Aim for ~15–20% of total level time spent airborne. If higher, increase cooldown or lower flight meter.

#### Stamina / Flight Meter as Risk-Reward
- **Collectible “Feather”**: +20% flight meter, temporary (lasts 8s).
- **Hazard “Wind Turbine”**: Drains flight meter faster when dog flies through it.
- Use the meter as a resource encouraging strategic use: glide over safe zones, dive through dangerous zones only when necessary.

#### Level Design Hooks
- **Wind Zones**: Rectangular area applying constant horizontal force (`body.velocity.x += windForce * delta`).
- **Rotating Blades**: Require precise dive (steeper angle) to slip through gaps.
- **Vertical Columns**: Only reachable via full-glide (no dive) to reward careful angle control.
- **Pro tip**: Tag obstacles with `requiredFlightState` (`'glide'`, `'dive'`, `'ground'`). In collision handler, check dog’s current state and allow passage or trigger a “hit” animation.

### 17.4 Polish, UI, and New Content

#### HUD Enhancements

| Element | Description |
|---------|-------------|
| **Flight Meter Arc** | Semi-transparent arc around the dog’s silhouette, filling clockwise as meter depletes. |
| **Angle Indicator** | Thin line extending from nose, green for shallow angles, orange/red for steep dives. |
| **Dash Cooldown Ring** | Small circular timer that fills when dash is ready. |

```typescript
function drawFlightHUD(ctx, dog) {
  const cx = dog.x, cy = dog.y - 30;
  const radius = 20;

  // Flight meter
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI/2,
          -Math.PI/2 + (dog.flightMeter / dog.maxFlight) * 2*Math.PI);
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Angle line
  const angleRad = Phaser.Math.DegToRad(dog.angle);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angleRad) * 30,
             cy + Math.sin(angleRad) * 30);
  ctx.strokeStyle = dog.state === 'dive' ? '#ff5555' : '#55ff55';
  ctx.lineWidth = 2;
  ctx.stroke();
}
```

#### New Power-Ups & Collectibles

| Power-Up | Effect | Duration |
|----------|--------|----------|
| **Feather** | Reduces gravity by 30% (glide feels lighter). | 8s |
| **Rocket Bone** | Single high-speed boost in any direction (useful for secret areas). | Instant |
| **Magnet Collar** | Attracts nearby coins for 5s. | 5s |
| **Time Freeze** | Pauses obstacles for 2s (allows perfect glide through tight gap). | 2s |

- Add a “Power-Up Wheel” UI element showing active power-up and remaining time.

#### Tutorial / Onboarding
- **First Level**: Only ground + dash, then a single glide tutorial with a visual arrow pointing “Hold Space to Glide”.
- **Second Level**: Introduce flight meter UI and a wind zone that pushes forward; teach counter-steering by tilting.
- **Optional “Advanced” Mode**: Unlocks after beating main campaign; adds angle-specific challenges (e.g., “Stay under 20° for the entire segment”).

#### Polish Touches
- **Screen Shake** on hard landings or when dash breaks a wall.
- **Dynamic Background Parallax** that reacts to flight speed (faster glide → faster background scroll).
- **Particle Burst** when flight meter hits zero (small “puff” of dust).
- **Adaptive Music**: Layer a subtle synth when airborne; fade out when on ground.
- **High-Score / Leaderboard**: Track “Longest Glide”, “Fastest Level Completion”, “Most Dashes”.

### 17.5 Testing & Iteration Workflow

1. **Create a “flight sandbox” level** (no enemies, just open space).
   - Play glide/dive transitions repeatedly.
   - Adjust `glideGravity`, `diveGravity`, and `flightMeterDrainRate` until descent feels responsive (quick correction possible but momentum preserved).

2. **Instrument with telemetry**:
   ```typescript
   console.log({
     level: currentLevel,
     flightTime: totalFlightSeconds,
     dashCount: dashUses,
     avgAngle: sumAngles / angleSamples,
   });
   ```
   - Use data to see if players over-use flight or avoid it entirely.

3. **A/B test dash cooldown** (0.8s vs. 0.6s). Gather feedback on perceived difficulty.

4. **Accessibility check**: Ensure flight meter is also represented by a sound cue (subtle beeping that speeds up as meter empties) for visually impaired players.

### 17.6 Suggested 4-Week Sprint Roadmap

| Week | Goal | Tasks |
|------|------|-------|
| **1** | Flight Core | Implement glide/dive states, flight meter, angle clamping, visual/audio feedback. |
| **2** | Balancing | Tune gravity values, dash cooldown, flight meter drain. Add simple wind zones for testing. |
| **3** | Polish UI | Add HUD arc, angle line, dash cooldown ring. Integrate particle trails and landing effects. |
| **4** | Content & QA | Add 2 new power-ups (Feather, Rocket Bone). Create a “flight challenge” level. Playtest, collect telemetry, iterate. |
| **Post-Sprint** | Live Update | Deploy, monitor analytics, plan next feature set (multiplayer races, level editor). |

### 17.7 TL;DR Action Checklist

- [ ] Separate glide & dive physics (different gravity, angle limits).
- [ ] Add a flight meter that drains with use and regenerates on ground.
- [ ] Clamp and lerp the dog’s rotation to give a smooth descent angle.
- [ ] Visual/audio cues for state changes (particle trails, ear/tail tilt, sound loops).
- [ ] Balance dash vs. flight (cooldowns, stamina).
- [ ] Introduce wind zones & angle-specific obstacles to make flight meaningful.
- [ ] HUD upgrades: arc meter, angle line, dash cooldown ring.
- [ ] New power-ups (Feather, Rocket Bone, Magnet Collar, Time Freeze).
- [ ] Tutorial level to teach glide/dive and flight meter.
- [ ] Polish touches: screen shake, parallax speed, landing puff, adaptive music.
- [ ] Telemetry & A/B testing to fine-tune values.

---

## 18. Big Brainstorm — Mechanics, Levels, Polish & Meta (External Feedback)

> A broad feature brainstorm organized by category. Each entry includes why it matters, a concrete design sketch, and a quick implementation tip. Cherry-pick, mix, or expand into full features.

### 18.1 New Gameplay Mechanics

| # | Mechanic | Core Loop Impact | Design Sketch | Implementation Hint |
|---|----------|-----------------|---------------|---------------------|
| **1A** | **Wind Currents / Updrafts** | Turns vertical space into a puzzle: ride currents to stay aloft or gain height without using the flight meter. | Draw semi-transparent “wind arrows” that push the dog upward or sideways while gliding. | `if (inWindZone) body.velocity.y += windForceY * dt; body.velocity.x += windForceX * dt;` |
| **1B** | **Momentum-Based Dash** | Adds skill depth: longer hold = farther dash (capped). | Press-and-hold → “charge bar” appears; release → dash distance = base + charge * multiplier. | Store `dashCharge` while key down, clamp to `maxCharge`, then set velocity on release. |
| **1C** | **Grappling Hook / Rope** | Vertical traversal tool that works only while airborne, encouraging gliding-hook combos. | Aim with mouse / right-stick → shoot rope; if it hits a platform, pull dog toward it (limited length). | Use a physics joint or manually lerp position toward anchor point. |
| **1D** | **Time-Shift Zones** | Temporary slow-motion makes precise angle control easier (or harder). | Enter blue-tinted zone → game speed 0.5×; flight meter drains slower, but obstacles also move slower. | Wrap main update loop in a `timeScale` factor; multiply all velocities and timers by it. |
| **1E** | **Ground-Bounce Pads** | Springboards that launch upward without consuming flight meter, but only usable on ground. | Landing on pad triggers high-arc bounce; chain bounce → glide → bounce again. | On collision: `body.velocity.y = -bounceStrength`; optionally give brief “no-dash” cooldown. |
| **1F** | **Enemy “Aerial Guard”** | Flying enemies that only attack when you’re gliding, forcing strategic altitude decisions. | Small drone shoots laser when `player.state === 'glide'`. | In enemy AI, check `player.state`; if glide, fire projectile. |
| **1G** | **Dynamic Obstacles** (rotating blades, moving walls) | Encourages angle-specific strategies (e.g., steep dive to slip under rotating blade). | Rotating blade with “safe window” aligned with a 30-degree descent corridor. | Use collision mask that only registers when `abs(player.angle) < safeAngle`. |
| **1H** | **Collectible “Air-Tokens”** | Currency spent to refill flight meter or purchase temporary upgrades (e.g., “Long Glide”). | Tokens float in air; each adds +10 to meter when collected. | Simple `onOverlap` that adds to `flightMeter` and destroys token. |
| **1I** | **Combo System** | Reward chaining dashes, glides, and dives without touching ground. | Each successful action adds combo multiplier boosting score and slightly increasing glide distance. | Increment `comboCount` on each action; reset on ground contact. Multiply score by `1 + comboCount*0.05`. |
| **1J** | **Environmental Hazards** (acid rain, snowstorms) | Adds variety: rain increases drag → fall slower; snow reduces ground friction → dash distance changes. | Toggle weather state; adjust gravity/drag coefficients. | Global `airDrag`, `groundFriction`; modify `body.setDrag` and gravity based on weather. |

### 18.2 Level & World Design Ideas

| # | Level Concept | What It Teaches / Showcases | Key Mechanics |
|---|--------------|----------------------------|---------------|
| **2A** | **Sky-Rail** | Long, narrow platform high above ground with gaps requiring precise glides. | Glide/dive, flight meter UI, angle indicator. |
| **2B** | **Wind Tunnel** | Corridor with alternating updrafts and downdrafts. | Wind currents, up/down forces. |
| **2C** | **Grapple Gauntlet** | Floating islands reachable only via grappling hook. | Grapple, dash, limited flight. |
| **2D** | **Time-Shift Temple** | Sections where player enters slow-motion zones. | Time-shift zones, dash timing. |
| **2E** | **Bounce-Back City** | Cityscape with spring pads on rooftops. | Bounce pads, dash, glide combos for speed runs. |
| **2F** | **Aerial Guard Patrol** | Drones patrol a corridor; stay low or fly high to avoid detection. | Strategic altitude control, risk-reward. |
| **2G** | **Weather-Warzone** | Dynamic weather changes mid-run (rain → snow). | Weather system, drag changes. |
| **2H** | **Secret Sky-Garden** | Hidden area reachable only by perfectly timed dive into narrow gap. | Reward for mastery; encourages exploration. |
| **2I** | **Combo Corridor** | Long stretch with no ground, forcing chain of glides, dives, and dashes. | Combo system, stamina management. |
| **2J** | **Boss Arena – The Zephyr** | Boss creates gusts and wind tunnels; must use wind to advantage. | Climactic integration of all mechanics. |

### 18.3 Visual & Audio Polish

| Idea | Why It Matters | Quick Implementation |
|------|---------------|----------------------|
| **Dynamic Trail Colors** | Instant visual feedback: blue (glide) → red (dive) → green (boost). | In particle emitter, set tint based on `player.state`. |
| **Dog’s Shadow Scaling** | Reinforces altitude perception: higher = smaller shadow. | `shadow.scale = clamp(1 - (player.y - groundY)/maxHeight, 0.3, 1);` |
| **Wind-Sound Layer** | Low-frequency rumble growing louder in wind zones; adds immersion. | Looping “wind” sound with `volume = windStrength / maxWind`. |
| **Impact Vibration** (Web API) | Haptic feedback on dash impact or hard landing (mobile browsers). | `navigator.vibrate([50, 20, 50]);` |
| **Animated UI Icons** | Flight meter pulses when low; dash icon glows when ready. | CSS/Canvas tweens changing alpha or scale. |
| **Day-Night Cycle** | Night levels dim background, add twinkling stars when gliding. | Interpolate background color on timer; spawn sparkle particles. |
| **Narrative Voice-Over** | Friendly “coach” dog gives tips (“Nice glide! Try a steeper dive!”). | Record short clips; trigger on key events. |
| **Retro “Pixel-Glow” Mode** | Toggleable neon outline shader — fun for streamers. | WebGL post-process filter or simple canvas outline. |
| **Score Pop-Ups** | Floating “+100” that fades out on collect/combo. | `scene.add.text(x, y, '+100', style).setDepth(10).setAlpha(1).setScale(1).setTween(...)` |
| **Ambient Music Layers** | Separate tracks for ground, glide, dive; cross-fade based on state. | Web Audio API: `musicGlide.gain.setValueAtTime(state==='glide'?1:0, audioCtx.currentTime);` |

### 18.4 Achievements & Rewards

| Achievement | Trigger | Reward |
|-------------|---------|--------|
| **Feather Light** | Complete a level without ever using dive. | Unlock feather trail cosmetic. |
| **Sky Diver** | Perform 50 dives in a single run. | Permanent +10% dive speed. |
| **Zero-Ground** | Finish a level without touching ground after first jump. | Bonus 500 coins. |
| **Wind Whisperer** | Ride 10 wind currents in one level. | Unlock wind-swoosh skin. |
| **Combo King** | Reach combo multiplier of 10. | Permanent score multiplier ×1.2. |
| **Master of Flight** | Finish game with >80% average flight-meter remaining. | Unlock hardcore mode (meter drains 2× as fast). |
| **Secret Garden Finder** | Discover hidden Sky-Garden. | Cosmetic “flower crown”. |
| **Boss Slayer – Zephyr** | Defeat final boss without using any power-ups. | Rare “Storm-Badge” avatar. |

**Implementation tip**: Store achievements in `localStorage` and display a small toast when unlocked.

### 18.5 Multiplayer & Social Features

| Feature | Gameplay Effect | How to Build (quick starter) |
|---------|----------------|-----------------------------|
| **Race Mode** | Two+ dogs race a timed course; first to finish wins. | WebSockets (e.g., Socket.io) sync positions; send `x, y, state` every 50ms. |
| **Co-Op “Rescue”** | One player controls dog, the other controls a wind-generator. | Second player’s input modifies global `windForceX/Y` applied to dog. |
| **Leaderboards** | Global ranking for fastest times, highest combos, most tokens. | Simple REST endpoint accepting `{playerId, score}` and returning top-10. |
| **Replay Sharing** | Record inputs (key presses + timestamps) and replay as “ghost”. | Store array of `{time, keyState}`; on playback, feed into game loop. |
| **Friend Challenges** | Send a challenge link loading same seed level with target time. | Encode level ID + target time in URL query string; show “beat this time?” banner. |

### 18.6 Metrics & Balancing Pipeline

#### Telemetry Hooks (client-side)
```typescript
function logEvent(name, data = {}) {
  fetch('/analytics', {
    method: 'POST',
    body: JSON.stringify({ event: name, data, ts: Date.now() }),
    headers: { 'Content-Type': 'application/json' }
  });
}
// Example usage:
logEvent('flight_start', { duration: 0, meter: dog.flightMeter });
logEvent('dash_used', { cooldownRemaining: dog.dashCooldown });
```

#### Key Metrics to Track
- Avg flight time per level (target: 10–20% of total time).
- Dash usage per minute (spots over-reliance).
- Combo streak distribution (how often players reach high combos).
- Failure points (where most deaths occur).

#### A/B Test Framework
- Randomly assign players to Version A (e.g., glide gravity = 0.3×) or Version B (0.4×).
- Compare completion rate, average score, and player-reported fun (post-level survey).
- Iterative loop: collect data → identify outliers → adjust constants → deploy → repeat.

### 18.7 Quick Code Snippets (Phaser-3-style)

#### Flight Meter UI (Arc)
```typescript
class FlightMeter {
  constructor(scene, x, y, radius = 30) {
    this.scene = scene;
    this.x = x; this.y = y; this.r = radius;
    this.graphics = scene.add.graphics({ x, y });
  }
  draw(percent) {
    this.graphics.clear();
    // background
    this.graphics.lineStyle(4, 0x555555, 0.5);
    this.graphics.arc(0, 0, this.r, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(270+360), false);
    this.graphics.strokePath();

    // foreground
    this.graphics.lineStyle(6, 0x00ffcc, 1);
    const endAngle = Phaser.Math.DegToRad(270 + 360 * percent);
    this.graphics.arc(0, 0, this.r, Phaser.Math.DegToRad(270), endAngle, false);
    this.graphics.strokePath();
  }
}
// Call meter.draw(dog.flightMeter / dog.maxFlight) each frame.
```

#### Wind Zone (Physics Modifier)
```typescript
class WindZone extends Phaser.GameObjects.Zone {
  constructor(scene, x, y, w, h, forceX, forceY) {
    super(scene, x, y, w, h);
    scene.add.existing(this);
    scene.physics.world.enable(this);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.force = new Phaser.Math.Vector2(forceX, forceY);
  }
  preUpdate() {
    const dogs = this.scene.dogs.getChildren();
    dogs.forEach(dog => {
      if (Phaser.Geom.Intersects.RectangleToRectangle(this.getBounds(), dog.getBounds())) {
        dog.body.velocity.x += this.force.x * this.scene.game.loop.delta / 1000;
        dog.body.velocity.y += this.force.y * this.scene.game.loop.delta / 1000;
      }
    });
  }
}
```

#### Grappling Hook (Simple)
```typescript
class Grapple {
  constructor(scene, dog) {
    this.scene = scene;
    this.dog = dog;
    this.line = scene.add.graphics();
    this.active = false;
  }
  shoot(targetX, targetY) {
    const hit = this.scene.physics.world.rayCast(this.dog.x, this.dog.y, targetX, targetY, 500);
    if (hit) {
      this.anchor = { x: hit.x, y: hit.y };
      this.active = true;
    }
  }
  update() {
    if (!this.active) return;
    const dir = new Phaser.Math.Vector2(this.anchor.x - this.dog.x, this.anchor.y - this.dog.y);
    const distance = dir.length();
    if (distance < 10) { this.active = false; return; }
    dir.normalize().scale(800 * this.scene.game.loop.delta / 1000);
    this.dog.body.velocity.add(dir);
    this.line.clear()
        .lineStyle(2, 0xffffff, 0.8)
        .strokeLineShape(new Phaser.Geom.Line(this.dog.x, this.dog.y, this.anchor.x, this.anchor.y));
  }
}
```

### 18.8 12-Week Sprint Roadmap

| Week | Milestone | Deliverables |
|------|-----------|-------------|
| **1** | Core Flight System | Glide/Dive states, flight meter, UI arc, angle indicator. |
| **2** | New Mechanics Integration | Wind zones, bounce pads, grappling hook (prototype). |
| **3** | Balance & Telemetry | Implement analytics, start A/B testing gravity values. |
| **4** | Level Design Pack 1 | Sky-Rail, Wind Tunnel, Bounce-Back City (basic). |
| **5** | Power-Ups & Tokens | Feather, Rocket Bone, Air-Tokens + UI icons. |
| **6** | Enemy & Hazard System | Aerial Guard drones, rotating blades, time-shift zones. |
| **7** | Visual & Audio Polish | Trail colors, dynamic shadows, wind sound layer, music cross-fade. |
| **8** | Combo & Scoring System | Combo counter, score multipliers, achievement triggers. |
| **9** | Multiplayer Prototype | Simple race mode using Socket.io (local testing). |
| **10** | Boss Fight “The Zephyr” | Full-screen boss with wind attacks, phases. |
| **11** | QA & Accessibility | Screen-reader labels, vibration support, color-blind mode. |
| **12** | Release Candidate & Marketing | Trailer, social assets, leaderboard backend, launch. |

### 18.9 TL;DR — What to Add Next

- [ ] Separate glide/dive physics (different gravity, angle limits).
- [ ] Flight meter UI (arc + angle line) + visual/audio cues.
- [ ] New mechanics: wind currents, momentum dash, grappling hook, time-shift zones, bounce pads, aerial enemies.
- [ ] Level concepts that showcase each mechanic.
- [ ] Combo & achievement system to reward mastery.
- [ ] Polish: dynamic trails, shadow scaling, haptic feedback, day/night cycle, music layers.
- [ ] Telemetry & A/B testing for fine-tuning.
- [ ] Optional multiplayer/race mode and leaderboards for replay value.

---

*Last consolidated: April 2026*
