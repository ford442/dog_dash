# Chapter Music

Each of the 6 chapters has its own **sonic identity** — a scale, tempo, layer
stack and filter character that make Neon Garden unmistakable from Rusty
Gauntlet. Everything is synthesised at runtime through the Web Audio API.

> **No audio files.** Nothing in `public/` is a sound asset, and nothing here
> loads one. A profile is a description of oscillators, envelopes and filters.

## Where things live

| Piece | File |
|-------|------|
| Profile type, the 6 chapter profiles, hub bed, scale maths | `src/audio_system/chapter_music.ts` |
| Runtime: graph, crossfade, sequencer, adaptive mix | `src/audio_system/mixins/chapter_music.ts` |
| Gameplay → mix signals | `src/main/music_update.ts` |
| Persisted levels + reduced-audio preference | `src/audio_settings.ts`, `src/save_manager.ts` |
| Shared volume UI (touch settings + pause) | `src/ui_audio_settings.ts` |

## The six identities

| Level | Profile | Scale | BPM | Layers | Character |
|-------|---------|-------|-----|--------|-----------|
| 1 Neon Garden | `neon-garden` | pentatonic | 92 | pad, arp, chime | Soft music-box + pastel arp |
| 2 Asteroid Belt | `asteroid-belt` | minor | 104 | pad, bass, drums | Sparse percussion + metallic hits |
| 3 Orbital Descent | `orbital-descent` | whole-tone | 118 | pad, bass, drums | Rising tension filter, heat noise bed |
| 4 Rusty Gauntlet | `rusty-gauntlet` | phrygian | 128 | bass, drums, arp | Industrial pulse, clanks |
| 5 Astral Leviathan | `astral-leviathan` | mixolydian | 72 | whale, pad, bass | Deep whale pad, organic swells |
| 6 Aqua Expanse | `aqua-expanse` | major | 86 | pad, bass, chime, arp | Bubbly delay, underwater LPF |

`HUB_MUSIC_PROFILE` is the cozy bed for the hub and post-victory.

`tests/unit/chapter_music.test.ts` asserts the six are actually distinguishable:
no two chapters may share the same scale + tempo + layer stack.

## Signal flow

```
layer gains ─┬─> chapterBus ─> chapterFilter ─> musicGain ─> masterGain
noise bed  ──┘        └─> delaySend ─> shared reverb
```

One graph per profile. Switching chapters builds a **second** graph and
crossfades between them (300–800 ms), so a transition never cuts a sustaining
oscillator — that is what causes clicks. The old graph is torn down only once
its fade has finished, with a margin for scheduled note tails.

## Adaptive mix

`updateChapterMusicDynamics()` runs once per frame and samples four 0..1
signals; `updateAdaptiveMusic` smooths all of them with `setTargetAtTime`, so a
jittery frame never yields a jittery mix.

| Signal | Sampled from | Effect |
|--------|--------------|--------|
| `speed` | `playerState.autoScrollSpeed` (6→20) | Raises arp/drums, nudges tempo up to `bpm × (1 + baseTempoScale)` |
| `boost` | `boostSystem.isBoosting()` | Opens the chapter filter, lifts the bed |
| `danger` | Obstacles within 60 units ahead; a boss forces ≥ 0.85 | Fades in the profile's `dangerLayer` |
| `quiet` | Dream portal active, or near a Fractured Geode harbor | Ducks drums, brings chimes forward |

Danger always wins over quiet — a boss inside a harbor is not a calm moment.

## Accessibility

- **Master / Music / Sound Effects** sliders appear in the touch settings sheet
  and (collapsed) in the pause menu. Both surfaces use the same
  `createAudioSettingsPanel()`, so they cannot drift apart.
- **Simpler Music** trims the layer stack to two voices and drops noise beds.
  It is forced on when the OS reports `prefers-reduced-motion`, which we treat
  as a request for a calmer mix as well as calmer visuals.
- All four settings persist through `save_manager` (`SaveData.audio`) and are
  restored at startup by `loadAndApplyAudioSettings()`. Saves predating this
  field pick up the defaults without losing progress.

## Debug

`window.currentMusicProfileId` holds the id of the profile currently playing.
`debugSystem.getMusicProfileId()` reads it for the debug panel.

## Adding or tuning a chapter

1. Edit or add the profile in `src/audio_system/chapter_music.ts`.
2. Keep it distinguishable — the identity test will fail if a chapter
   duplicates another's scale + tempo + layer stack.
3. If you need a new voice, add it to `MusicLayerId` and give it a case in
   `playChapterLayerStep`. Keep note density low: the sequencer runs at 16th
   notes and every note allocates an oscillator.
4. Never reach for an audio file. If a texture seems impossible procedurally,
   raise it as its own issue rather than adding an asset.
