# Power-Up Integration Status Matrix

Audit of all 16 `PowerUpType` entries after Tier 2–3 polish (July 2026).

Legend: **✅** wired end-to-end · **⚠️** partial / generic · **❌** missing

| # | Power-Up | Tier | Modifiers | Visuals | Composition hook | Audio cue | Dog reaction |
|---|----------|------|-----------|---------|------------------|-----------|--------------|
| 1 | Rainbow Comet Tail | 1 | ✅ candy + auto-collect | ✅ comet glow | ✅ RAINBOW_TRAIL | ✅ `powerup_rainbow` | ⚠️ POWER_UP |
| 2 | Flower Crown Boost | 1 | ✅ gravity + obstacle slow | ✅ flower crown | ✅ STARDUST_FIELD | ✅ `powerup_flower` | ⚠️ POWER_UP |
| 3 | Bubblegum Shield | 1 | ✅ shield bounce | ✅ heart bubble | ✅ HEART_BUBBLE | ✅ `powerup_shield` | ⚠️ POWER_UP |
| 4 | Twinkle Star Magnet | 1 | ✅ magnet pull | ⚠️ star lines | ✅ STARDUST_FIELD | ✅ `powerup_magnet` | ⚠️ POWER_UP |
| 5 | Unicorn Horn Blast | 2 | ✅ asteroids→butterflies | ⚠️ trail + beam | ✅ GLITTER_BEAM | ✅ `powerup_unicorn` | ⚠️ POWER_UP |
| 6 | Dream Cloud Carpet | 2 | ✅ zero-g + speed | ✅ cloud carpet | ✅ STARDUST_FIELD | ✅ `powerup_cloud` | ⚠️ POWER_UP |
| 7 | Lullaby Lantern | 2 | ✅ obstacle slow + sway | ✅ lantern glow | — | ✅ `powerup_lantern` | ✅ CURIOUS |
| 8 | Puppy Hug Hug | 2 | ✅ double value + extra life | ✅ golden heart aura | ✅ HEART_RAIN | ✅ `powerup_hug` | ✅ DELIGHTED |
| 9 | Fairy Dog Wings | 2 | ✅ glide + gravity | ✅ rainbow wings | — | ✅ `powerup_fairy` | ⚠️ POWER_UP |
| 10 | Moonbeam Slide | 3 | ✅ speed + auto-collect | ✅ silver slide beam | — | ✅ `powerup_moonbeam` | ⚠️ POWER_UP |
| 11 | Fairy Godmother Sparkle | 3 | ✅ random grant | ✅ fairy sparkle orb | ✅ RAINBOW_SPIRAL | ✅ `powerup_fairy` | ✅ DELIGHTED |
| 12 | Candy Cane Vortex | 3 | ✅ vortex pull + candy | ✅ spinning vortex | ✅ CONFETTI_BURST | ✅ `powerup_vortex` | ⚠️ POWER_UP |
| 13 | Starlight Tiara | 3 | ✅ invincible + double value | ✅ tiara mesh | ✅ STAR_CASCADE | ✅ `powerup_tiara` | ⚠️ POWER_UP |
| 14 | Butterfly Escort | 3 | ✅ 3 hit charges | ✅ orbiting butterflies | ✅ BUTTERFLY_SWARM | ✅ `powerup_butterfly` | ⚠️ POWER_UP |
| 15 | Magic Paintbrush | 3 | ✅ rainbow bridge paint | ✅ brush mesh | — | ✅ `powerup_paint` | ✅ CURIOUS |
| 16 | Best Friend Forever Aura | 3 | ✅ time slow + double + sparkle | ✅ heart aura ring | ✅ SPARKLE_FIELD | ✅ `powerup_bff` | ✅ DELIGHTED |

## Modifier consumption (runtime)

| Modifier | Consumed in |
|----------|-------------|
| `gravityMultiplier` | `player_update.ts` |
| `speedMultiplier` | `player_update.ts` |
| `autoCollectRadius` | `loop_combat/powerups.ts` |
| `magnetRadius` | `loop_combat/powerups.ts` |
| `shieldActive` / `shieldBouncesAsteroids` | `obstacle_system/` |
| `invincible` | `loop_combat/powerups.ts` + collision |
| `butterflyCharges` | `obstacle_setup.ts` |
| `doubleValue` | `startup_callbacks.ts` (score wrapper) |
| `obstaclesSlowed` / `obstacleSlowFactor` | `obstacle_system/manager.ts` |
| `asteroidsToCandy` | `loop_combat/powerups.ts` |
| `asteroidsToButterflies` | `loop_combat/weapons.ts` |
| `timeScale` | `loop_combat/index.ts` |
| `sparkle` | `powerup_manager/manager.ts` |
| Fairy Godmother grant | `powerup_hooks.ts` on activate |
| Magic Paintbrush bridge | `magic_paintbrush.ts` + `input_bindings.ts` |

## Central hook

All activation/deactivation side effects route through `src/powerup_manager/powerup_hooks.ts`, called from `create_game_systems.ts` and `startup_callbacks.ts`.
