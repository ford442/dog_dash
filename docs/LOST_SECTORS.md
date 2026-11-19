# Lost Sectors & Quantum Compass

The payoff for Derelict Buoy hacks (plan §III). Each hacked buoy gives a
persistent **map fragment** (`SaveManager.addMapFragment`):

| Fragments | What opens |
|-----------|------------|
| 3 (`LOST_SECTOR_FRAGMENTS`) | Space Base gains a **📡 Lost Sector** tab with two authored secret chapters |
| 5 (`QUANTUM_COMPASS_FRAGMENTS`) | The **🧭 Quantum Compass** HUD pip, on every run from then on |

Both thresholds live in `src/lost_sector/constants.ts`, and
`src/main/artifact_update.ts` toasts them when a hack crosses them. The tab
stays hidden until the save reaches 3 fragments (`?debug` always shows it),
so the sectors are a real secret.

These are **authored** chapters, not Endless Dash. Endless shuffles
campaign systems from a seed. A Lost Sector is a hand-written `LevelConfig`.

## The two sectors

| Id | Level slot | Biome / twin | Length | Objective | Identity |
|----|-----------|--------------|--------|-----------|----------|
| `lost-garden` | 301 | crystalline / ch. 6 | 2000 m | scan 10 | **Architect Garden**: prismatic crystals, quantum mirrors and 25 singing geodes. Two grav-lens chains (4 + 3 lenses). Tier 2 + tier 3 Data Monoliths give extra Architect lore, blueprint fragments and cores. No boss. |
| `lost-kelp` | 302 | biological / ch. 5 | 2300 m | boss | **Kelp Cathedral**: a dim organic tunnel (fog 0.03) packed with vacuum kelp (28) and ice-needle matrices (14). It teaches the energy-drain verb. A reused **Nebula Kraken** gate waits at x 1500, and the Kraken gate is the sector's only Kraken. |

Configs: `src/lost_sector/configs.ts` (`LOST_SECTORS`). String ids keep
campaign 1–6 and `LEVEL_CONFIG` untouched. A sector runs as one chapter in
its own level slot (301+), clear of the campaign (1–6), Endless (101+) and
the Architect Lab (200), so no `levelIndex === N` set piece fires. Each
sector borrows music and the ambient-creature table from its twin chapter.

## Flow

```
hub tab ─► lostSectorRunSeed(id, fresh rngSeed) ─► pending run seed + location.reload()
(hub_tab.ts)  (run.ts)                                         │
                                                               ▼
beginGameplay: unknown id / < 3 fragments ──► HUD notice, fly the campaign
                    │ ok (or ?debug)
                    ▼
startRun: createLostSectorRunLayout ─► JourneyLayout (mode 'lost', one chapter 0 → distance)
```

- **Run seed:** `campaignId: 'lost'` plus a `{ kind: 'lost_sector', sectorId }`
  modifier. The codec only checks the shape. `resolveLostSector` checks the
  id against `LOST_SECTOR_IDS`.
- **Hub launch reloads the page**, the same pattern Endless and the
  Architect Lab use. `startRun()` still calls `geologicalWorld.reset()`
  before spawning, so the sector starts from a clean world either way.
- **Finish line:** the end of the span (`loop_finish.ts` uses
  `hasFinishLine()`, the same rule as Architect sandboxes). Finishing a sector:
  - banks the run's cores;
  - records the first clear in `SaveData.lostSectorsCompleted` (✅ in the hub);
  - shows a sector-complete card with "Fly it again" and "Back to Lost Sectors".

  It never sets a high score, unlocks a campaign chapter or opens the Moon map.
- **Retry** re-queues the same seed (`restart_run.ts`), so a retry races its ghost.

### Seeded buoys

Buoy spots drift ±40 m on X and ±2 on Y per run seed, everywhere buoys
spawn: campaign chapters 4–5, Endless and the sectors. The draws come from
their own `'artifacts'` gameplay stream, so no other system's rolls shift. The
fragment **count** is persistent and does not depend on the seed. Players
cannot memorise the network, and a seed still replays exactly.

## Quantum Compass

`src/quantum_compass/`: a small pip under the cores display:
`🧭 ➤ Frost Heart · 42m`.

- **Targets:** anything with `userData.rareResource === true`, or a species
  on the allowlist (`RARE_SPECIES` in `picker.ts`):
  - magma heart (the "Magma Core" target);
  - ice-needle cluster (the "Frost Heart" target);
  - fractured geode;
  - unhacked Derelict Buoy.
- **No scene walk:** while the compass is on, `spatial_fill.ts` appends those
  props to the gameplay spatial hash on their own `CollisionLayer.Rare` layer.
  The compass then runs one layer-masked `SpatialIndex.query` (radius
  `COMPASS_RANGE` = 80) every 12 sim steps. With the compass off, nothing is
  added, so the hash is exactly what it was before.
- **Picker:** `pickNearestRare` is pure and unit-tested. It picks the nearest
  of N, skips anything more than 4 m behind the player and anything with a
  non-finite position, and keeps the earlier candidate on a tie.
- **Visual-only:** it reads the hash and writes only DOM, so replays are
  unaffected.
- **Motion:** the arrow is a static rotation. With
  `prefers-reduced-motion`, the rotation transition is dropped too.

## Adding a sector

1. Add the id to `LostSectorId` / `LOST_SECTOR_IDS` and give it a slot in
   `LOST_SECTOR_LEVEL_INDEX` (301+).
2. Add a `LOST_SECTORS` entry: icon, title, blurb, biome, twin chapter and an
   authored `LevelConfig` with `distance` set to the chapter length.
3. Reuse a boss (`bossEncounter`). Do not author a new one.
4. Run `npm run check`:
   - `check:env-registry` checks the slot, the entry and that every env flag
     has a manifest loader;
   - `tests/unit/lost_sector.test.ts` keeps the sector under its biome's
     campaign decoration worst case;
   - `tests/replay/lost_sector.test.ts` flies both sectors to the finish.

## Later

Endless Dash can treat Lost Sectors as locked biomes until the campaign flag
is set. `lostSectorUnlockState` is the read it would use.
