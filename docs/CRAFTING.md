# Crafting (Plasma Caster economy)

The meta loop: **scan / destroy / sling → bag fills → craft at the Space Base → feel stronger next run.**

## Flow

1. **Harvest** — Tagged flora & geology roll drop tables in `src/resource_inventory.ts` on `destroy` / `scan` / `sling` events (routed through `game.resourceHarvester`, see `src/resource_harvester.ts`). Grants surface as the "Resource Pop" HUD pill.
2. **Bag** — Materials persist in `SaveData.resources` (`src/save_manager.ts`).
3. **Craft Bay** — The 🔨 Craft tab in the Space Base hub (`src/hub_screen.ts`) lists recipes from `src/crafting_system.ts`, disables cards you can't afford, and deducts via `SaveManager.spendMaterial`.
4. **Loadout** — Crafted charges queue in `SaveData.loadout` (recipeId → charges). Because launching a chapter reloads the page, the loadout lives in the save and is **consumed once at boot** by `applyCraftedLoadout()` (`src/main/loadout.ts`, called from `src/main/startup.ts`). Effects last one run.

## Recipes (v1)

| Recipe | Cost | Effect (next run) |
|---|---|---|
| 🚀 Stellar Fuel | 10× luminousDust | +1 max boost charge, +1.2s boost duration |
| 💥 Glitch Grenade ×3 | 6× luminousDust + 2× taintedExtract | 3 grenades — **G** key or tap the 💥 HUD counter for an AoE blast (`src/main/grenade.ts`) |
| 🛡️ Hull Patch | 8× luminousDust + 3× voidGem | +1 max heart |
| 🔥 Magma Lance | 8× pyroclastOre + 1× magmaCore | boss damage ×1.5 |
| ❄️ Cryo Rounds | 5× frostHeart + 3× pureExtract | blaster heat per shot −40% |
| 🌀 Phase Shifter | 4× quantumSeed + 1× voidGem | roll cooldown −50% + full boost charges |
| 🗝️ Architect Key | 1× architectKey + 2× quantumSeed | **Instant, permanent:** unlock all chapters |

`architectKey` drops rarely (3%) from destroyed fractured geodes — its only source.
Stacking: consumable recipes stack multiplicatively per charge (e.g. 2× Magma Lance → ×2.25 damage).

## Adding a recipe

1. Add a `RecipeId` + `RECIPES` entry in `src/crafting_system.ts` (icon, cost, kid-friendly copy).
2. Apply its effect in `applyCraftedLoadout()` (`src/main/loadout.ts`) — or apply instantly inside `craftRecipe()` for permanent unlocks (see Architect Key).
3. The craft bay card, cost chips, and disabled states render automatically.

Keep the economy shallow: 6–10 recipes max.
