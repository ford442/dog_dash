# Dog Dash — Development Plan (v0.2+)

## 🎯 Goal
Turn the already-beautiful WebGPU side-scroller into a **charming, addictive, polished indie space adventure** with the dog astronaut as the star.

## 📋 Quick-Win Priority List (do these first — biggest impact, smallest effort)

### 1. Audio (biggest missing piece — will 10× the feel)
- [ ] Rocket thrust whoosh (looped + pitch shift on thrust strength)
- [ ] Asteroid impact + glass-shatter on destroy
- [ ] Spore chain-reaction bubbly pop + echo
- [ ] Collectible "ting" + happy dog bark
- [ ] Background nebula hum + distant wind
- [ ] Victory fanfare (triumphant bark + landing whoosh)
- [ ] Shield / boost activation sound

**Implementation note**: Use Three.js Audio or Howler.js. Put in `audio_manager.ts`.

### 2. Dog Astronaut Cockpit Animation
- [ ] Tiny animated dog inside rocket:
  - Head turns toward mouse look
  - Tail wags on thrust
  - Ears perk on collectibles / power-ups
  - Happy/sad face on hit

**Hook**: Add bone animation to existing `rocket.glb` or new small GLB.

### 3. Collectibles + First Power-up
- [ ] Glowing Dog Treat Orbs (float, collect 3–5 = temp boost)
- [ ] **Dog Boost / Afterburner** (hold SHIFT or double-tap SPACE)
  - Short speed burst + bright flame trail (reuse re-entry shader)
  - Limited charges, recharges via orbs

### 4. One New Background Layer
- [ ] Dynamic Starfield Parallax (3–4 layers, speed scales with thrust)
- [ ] Occasional shooting stars

## 🛠 Next Batch (after quick wins)

### New Objects & Entities
- [ ] Alien Space Minnows / Swarms (harmless or nibble for 1 dmg)
- [ ] Wormhole Portals (teleport forward with 50% risk)
- [ ] Passing Space Whales (huge background silhouettes, slow sine movement)

### More Abilities / Power-ups
- [ ] Shield Bubble (absorbs 1 hit, rare bone-shield orb)
- [ ] Laser Sweep (mouse-click alternative — clears cone of small obstacles)

### Environmental & Animation Upgrades
- [ ] Asteroid variety: some explode into crystal shards (Chroma-Shift shader)
- [ ] Lightning Storm Clouds (zaps nearby asteroids when you fly close)
- [ ] Moon Approach Stage (lunar craters + low-gravity dust plumes)

### Polish & Juice
- [ ] Particle variety on asteroid breaks
- [ ] Screen shake on big hits / spore explosions
- [ ] Score / distance counter + high-score save (localStorage)
- [ ] Simple pause menu + restart

## 🚀 Future / Stretch Goals (post-MVP)
- Multiple levels with increasing difficulty
- Unlockable dog helmets / rocket skins
- Leaderboard (via some simple backend or itch.io)
- Mobile touch controls
- Procedural music that reacts to speed

---

## 🌟 Magical Whimsical Edition – Tailored for a 7-Year-Old Girl Player

**Core Fantasy**: The dog astronaut is her best friend on a magical dream journey to the Moon (maybe to deliver a special star or bring back moon candy for her). Everything is pastel, sparkly, friendly, and full of wonder.

### 1. Dreamy Scenery & Backgrounds (these will make her gasp "WOW!")
- **Pastel Rainbow Nebula**: swirling cotton-candy pinks, purples, teals, and soft golds with floating glitter particles that sparkle when the rocket flies through them.
- **Floating Flower Constellations**: giant glowing space flowers (daisies, tulips, lotuses) that bloom bigger when you fly close and release heart-shaped pollen clouds.
- **Candy Planet Ring**: a belt of colorful swirling lollipops, jellybeans, and gummy asteroids that bob and bounce.
- **Dreamy Cloud Castles**: fluffy pink and purple cloud platforms with tiny glowing windows and rainbow bridges in the far background.
- **Starlight Butterfly Swarms**: huge clouds of sparkling butterflies that follow the rocket and leave rainbow trails.
- **Moon Palace Approach**: when you near the end, the moon turns into a giant glowing crystal palace with heart-shaped craters and silver slide ladders.

### 2. New Cute Objects & Friends
- **Sparkle Stars / Magic Bones**: collect glowing pastel stars or bone-shaped lollipops that explode into confetti when picked up.
- **Space Kitties & Bunnies**: tiny friendly alien pets in astronaut helmets that wave at you and give bonus sparkles if you fly near.
- **Wish Lanterns**: floating paper lanterns that you can "pop" for a burst of colorful fireworks and a happy giggle sound.
- **Singing Crystal Geodes**: bigger, friendlier version of your current geodes — they hum lullaby notes and light up in rainbow colors.

### 3. Magical Abilities & Power-ups (she'll feel like a space princess)
- **Fairy Dog Wings**: temporary rainbow butterfly wings on the rocket — press SHIFT for a floaty glide + sparkly dust trail.
- **Magic Sprinkle Blast**: mouse-click now shoots a cone of glitter that turns nearby asteroids into floating flower petals (no damage, just pretty transformation).
- **Friendship Bubble Shield**: a giant heart-shaped bubble that protects the dog and makes everything slow down and sparkly for a few seconds.
- **Star Wand Boost**: collect 3 stars → wave the wand (auto or spacebar) to make the whole screen flash rainbow and give super speed with cheering sounds.

### 4. Animated Stuff & Juice (make it alive and bouncy)
- **Super-cute Dog Animations**: the dog now wears a tiny tutu or cape — ears flop happily, tail wags like crazy on boost, does a little happy dance when collecting stars, looks worried (but still adorable) on hit.
- **Dancing Jelly-Moss**: your existing moss now has tiny fairy lights and does a gentle sway dance to the background music.
- **Shooting Star Showers**: random colorful shooting stars that leave long glitter trails and sometimes drop extra collectibles.
- **Rocket Bow & Sparkles**: add a big pink bow on the rocket that flutters in the wind + constant gentle sparkle particles from the engines.

### 5. Audio – Pure Magic for Little Ears
- Playful dog barks + giggles (her own voice recorded if you want!).
- Twinkly chime music (think music-box + soft synth harp) that gets happier the faster you go.
- Sparkle "ting-ting-ting" on every collectible.
- Friendly whoosh sounds that sound like wind chimes.
- Cute creature sounds: space kitties meow, bunnies boop, flowers "boing" when you fly past.
- Victory: big group cheer of dog barks + fairy bells + a little girl's "Yay!" voice line.

### 6. Wild Bonus Notions (go as crazy as you want)
- **Secret Hide-and-Seek Stars**: tiny stars hiding behind flowers that play peek-a-boo when you look at them with the mouse.
- **Color-Changing Rocket Skins**: unlock a unicorn-horn rocket, rainbow rocket, or princess-crown rocket after a few runs.
- **Dream Portal Doors**: cute doorways in clouds that lead to "bonus dream rooms" full of floating toys and extra stars.
- **Thank-You Notes from the Moon**: at the end, the moon palace sends back floating thank-you cards with hearts and "You did it!" messages.
- **Cozy Pause Mode**: pause screen shows the dog curled up with a blanket and a storybook (maybe even a tiny picture of the 7-year-old girl).

---

## ✨ Magical Power-Ups Expansion (15 new ideas – all cute, empowering, and storybook-y)

**Design Rule**: Every power-up feels like a special gift from the moon or her dog best friend. Trigger by collecting 3–5 glowing pastel orbs (or rare "magic bone" icons). Short duration (8–15 seconds) so she can use them often and feel powerful. Visuals = max sparkles, rainbows, hearts, and gentle animations.

### Tier 1 – Super Easy Quick Wins (reuse existing code heavily)

1. **Rainbow Comet Tail**  
   Rocket gets a long flowing rainbow tail that auto-collects nearby stars and turns small asteroids into floating candy pieces.  
   *Visual*: Reuse spore-cloud particles but make them pastel and heart-shaped.  
   *Trigger*: Hold SPACE a little longer.

2. **Flower Crown Boost**  
   A giant glowing flower crown appears on the dog's helmet — gives gentle upward float + pollen trail that slows down obstacles (feels like flying through soft pillows).  
   *Visual*: Copy Jelly-Moss sway animation and tint it pink/purple.

3. **Bubblegum Shield**  
   (Upgrade to Friendship Bubble) Turns the shield into chewy pink bubblegum that bounces asteroids away with a "boing!" sound and leaves sticky sparkles.  
   *Visual*: Heart-shaped bubble with bubblegum stretch animation.

4. **Twinkle Star Magnet**  
   All collectibles on screen gently float toward the rocket like they're being pulled by magic.  
   *Visual*: Soft glowing lines + chime particles connecting stars to rocket.

### Tier 2 – Medium Fun (add one new tiny prefab)

5. **Unicorn Horn Blast**  
   A sparkly unicorn horn pops out of the rocket nose — mouse-click shoots a beam of stars that turns asteroids into dancing butterflies.  
   *Visual*: Reuse laser-sweep idea but with glitter beam and butterfly particles.

6. **Dream Cloud Carpet**  
   Summons a fluffy rainbow cloud under the rocket for 10 seconds — lets her "drive" on it like a magic carpet (auto-hover, ignores gravity for a bit).  
   *Visual*: New low-poly cloud mesh with your nebula shader tinted cotton-candy colors.

7. **Lullaby Lantern**  
   Releases a floating lantern that sings a soft tune and makes nearby obstacles gently sway and move aside (no crashing needed).  
   *Visual*: Wish-lantern prefab + soft glowing notes floating up.

8. **Puppy Hug Hug**  
   The dog gets a little animated hug animation and the whole screen gets a warm golden glow — doubles collectible value and gives 1 free "extra life" heart if you're low.  
   *Visual*: Tiny heart particles + dog tail-wag frenzy.

### Tier 3 – Wow-Factor Magic (still light on performance)

9. **Moonbeam Slide**  
   Creates a temporary silver slide from the rocket down to the bottom of the screen — slide down it for bonus speed and collectibles along the way.  
   *Visual*: Simple glowing line + particle trail (like your existing re-entry plasma but sparkly).

10. **Fairy Godmother Sparkle**  
    A tiny fairy version of the dog appears beside the rocket and waves a wand — randomly grants one of the other power-ups for free!  
    *Visual*: Mini dog fairy with wing flutter (reuse cockpit dog animation).

11. **Candy Cane Vortex**  
    Spins a swirling candy-cane tornado around the rocket that sucks in and pops small obstacles into jellybean confetti.  
    *Visual*: Reuse wormhole swirl shader but stripe it red/white and add candy particles.

12. **Starlight Tiara**  
    Places a glowing tiara on the dog — makes the rocket invincible AND leaves a trail of stars that stay on screen for extra points after the power-up ends.  
    *Visual*: Crown mesh + constant sparkle burst.

13. **Butterfly Escort**  
    A swarm of friendly space butterflies flies in formation around the rocket and blocks 2–3 hits automatically.  
    *Visual*: Starlight Butterfly Swarm you already planned — just make them protective.

14. **Magic Paintbrush**  
    Mouse-drag now "paints" a temporary rainbow bridge that the rocket can fly along (great for dodging tricky sections).  
    *Visual*: Simple line renderer with rainbow gradient + sparkle dots.

15. **Best Friend Forever Aura**  
    The dog and rocket glow with a big pink heart aura — time slows down a tiny bit, background music gets extra twinkly, and every collectible plays a little giggle sound. Feels like pure joy.  
    *Visual*: Soft pulsing hearts + slow-motion particle glow.

**Implementation Notes**:
- All triggered by the same orb-collector system you're already building.
- Add a simple `powerup_manager.ts` that holds an array of active effects (most are just temporary flags + particle emitters).
- Duration UI: Cute floating countdown hearts or stars above the rocket.
- Balance: Make the first 4 available in the first "level" so she unlocks magic right away and keeps wanting to play.

**Why these will make a 7-year-old squeal**: Every power-up has a name she can shout ("Unicorn Horn Blast!!"), looks like it came from a toy store, and makes her feel like she's helping her dog friend with real magic.

---

## 🎨 POWER-UP VISUALS – Full Dreamy Breakdown

**Style Guide**: Everything is soft pastel (cotton-candy pink, lavender, mint, sky blue, sunshine yellow). Heavy use of **sparkle particles**, **heart-shaped trails**, **gentle rainbow gradients**, and **slow floaty animations**. Dog astronaut reacts with happy wags, ear perks, and tiny happy dances. Rocket gets cute add-ons (bows, crowns, wings). TSL shaders get extra `sparkleNoise` + `rainbowShift` nodes.

### Tier 1 – Super Easy Quick Wins

1. **Rainbow Comet Tail**  
   A long, flowing rainbow ribbon streams behind the rocket like a magical scarf made of light. Each color band gently pulses and leaves tiny heart-shaped glitter dots that fade into sparkly dust. Small asteroids touched by the tail instantly turn into floating pastel candy pieces that bob away.  
   *Dog reaction*: Tail wags like crazy, eyes sparkle.  
   *Shader*: Reuse re-entry plasma but add `TSL.rainbowGradient` + `sparkleNoise` on a long trailing mesh.

2. **Flower Crown Boost**  
   Giant glowing flower crown (daisies + tulips in pink/purple/teal) pops onto the dog's helmet. Pollen trail = soft glowing dots that drift like snow and make nearby obstacles sway gently like they're in a breeze. Rocket feels like it's floating on pillows.  
   *Dog reaction*: Ears flop happily, little smile.  
   *Shader*: Copy Jelly-Moss sway + add petal particles with `softGlow` emissive.

3. **Bubblegum Shield**  
   Chewy pink heart-shaped bubblegum bubble wraps the whole rocket. Asteroids bounce off with stretchy "boing" lines of gum that snap back into sparkles. Bubble surface has tiny heart bubbles floating inside.  
   *Dog reaction*: Dog hugs the inside of the bubble and giggles.  
   *Shader*: Transparent bubble mesh with refraction + bubblegum stretch animation.

4. **Twinkle Star Magnet**  
   Soft glowing rainbow lines reach out from the rocket like gentle arms and pull stars toward it. Every collected star explodes into a mini firework of pastel sparkles that rain down.  
   *Dog reaction*: Head turns to watch the stars dance in.  
   *Shader*: Line renderer with `twinklePulse` + connecting particle beams.

### Tier 2 – Medium Fun

5. **Unicorn Horn Blast**  
   Sparkly pastel unicorn horn (gold tip, rainbow stripes) grows from rocket nose. Mouse-click shoots a cone beam of swirling stars that turns asteroids into dancing butterflies. Beam leaves a trail of hearts.  
   *Dog reaction*: Dog "boops" nose forward excitedly.  
   *Shader*: Cone particle emitter with unicorn glitter texture.

6. **Dream Cloud Carpet**  
   Fluffy rainbow cloud appears under the rocket like a magic carpet. Tiny cotton-candy edges glow and puff little clouds as you "drive." Auto-hover makes the rocket bob gently.  
   *Dog reaction*: Sits like on a magic carpet ride, tail swishing.  
   *Shader*: Low-poly cloud with your nebula shader tinted pastel.

7. **Lullaby Lantern**  
   Floating paper lantern (pink with heart patterns) drifts beside the rocket, singing soft glowing musical notes that make obstacles sway aside. Lantern has tiny fairy lights inside.  
   *Dog reaction*: Dog tilts head and listens with perked ears.

8. **Puppy Hug Hug**  
   Warm golden heart aura wraps everything. Screen gets a soft pink filter, collectibles glow bigger, and the dog gets animated hug arms around the rocket.  
   *Dog reaction*: Full happy dance + heart eyes.

### Tier 3 – Wow-Factor Magic

9. **Moonbeam Slide**  
   Silver sparkly slide beams down from the rocket like a playground slide made of moonlight. Rocket can slide down it super fast, collecting stars along glowing rails.  
   *Visual*: Glowing line with particle "slide dust" (like re-entry but silver + hearts).

10. **Fairy Godmother Sparkle**  
    Tiny fairy version of the dog (with glitter wings) appears beside the rocket, waves a wand, and randomly triggers another power-up with a burst of rainbow fireworks.  
    *Dog reaction*: Both dogs high-five in the air.

11. **Candy Cane Vortex**  
    Swirling red-and-white candy-cane tornado spins around the rocket, sucking in obstacles and popping them into jellybean confetti that rains down in slow motion.  
    *Shader*: Reuse wormhole swirl but candy-striped + extra sparkle.

12. **Starlight Tiara**  
    Glowing crystal tiara on the dog's helmet pulses with rainbow light. Rocket leaves a permanent trail of stars that stay on screen after the power-up ends.  
    *Dog reaction*: Dog looks extra proud and regal.

13. **Butterfly Escort**  
    Swarm of pastel space butterflies forms a protective circle around the rocket. Each butterfly has glowing wings that flap gently and block hits with a soft "poof" of glitter.

14. **Magic Paintbrush**  
    Mouse-drag leaves a temporary rainbow bridge made of glowing paint strokes. Bridge sparkles and has little heart footprints along it.  
    *Shader*: Line renderer with rainbow gradient + paint-drip particles.

15. **Best Friend Forever Aura**  
    Giant pulsing pink heart aura around the whole rocket + dog. Time slows just a tiny bit, background gets extra twinkly stars, and every collectible plays a tiny giggle animation. Feels like the whole universe is hugging you.  
    *Dog reaction*: Dog and rocket snuggle together in the heart glow.

---

## 📝 Notes / Tech Reminders
- Everything should reuse existing systems: `obstacle_system.ts`, `particles.ts`, `nebula.ts`, TSL shaders, level_config.
- Keep performance in mind (WebGPU is already buttery — don't add heavy stuff).
- Test on both desktop + mobile Chrome.

---

**Last updated**: April 2, 2026  
**Next milestone**: Audio + Dog animation + Dog Boost done → release v0.3 on itch.io
