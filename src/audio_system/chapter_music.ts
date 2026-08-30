/**
 * chapter_music.ts
 * Per-chapter music profiles — the sonic identity of each of the 6 levels.
 *
 * 100% procedural: every profile is a description of oscillators, envelopes
 * and filters. No audio files are referenced or shipped.
 *
 * The runtime that plays these lives in `mixins/chapter_music.ts`.
 */

/** Scale used to pick notes for a chapter. */
export type MusicScale =
    | 'major'
    | 'minor'
    | 'mixolydian'
    | 'pentatonic'
    | 'lydian'
    | 'phrygian'
    | 'whole-tone';

/** Voices a chapter can stack. Each maps to a generator in the runtime. */
export type MusicLayerId = 'pad' | 'arp' | 'bass' | 'chime' | 'drums' | 'whale';

/** Extra voice faded in when danger is high (dense obstacles, boss active). */
export type DangerLayerId = 'staccato' | 'dissonant-pad';

export interface ChapterMusicProfile {
    id: string;
    /** Human-readable identity, shown in the debug panel. */
    label: string;
    scale: MusicScale;
    /** Tonic in Hz. Layers transpose from here by octave. */
    rootHz: number;
    bpm: number;
    /** How hard player speed pushes tempo: `bpm * (1 + baseTempoScale * speed)`. */
    baseTempoScale: number;
    layers: MusicLayerId[];
    dangerLayer?: DangerLayerId;
    victoryStinger?: 'chime-rise' | 'brass-swell' | 'whale-call' | 'bubble-rise';
    /** Lowpass on the chapter bus, Hz. Low values read as "underwater"/muffled. */
    filterHz?: number;
    /** Echo send into the shared reverb/delay, 0..1. */
    delaySend?: number;
    /** Waveform overrides per layer. */
    timbre?: Partial<Record<MusicLayerId, OscillatorType>>;
    /** Filtered-noise bed level, 0..1 (heat shimmer, industrial air). */
    noiseBed?: number;
}

/** Semitone offsets from the tonic, per scale. */
export const SCALE_STEPS: Record<MusicScale, number[]> = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'pentatonic': [0, 2, 4, 7, 9],
    'lydian': [0, 2, 4, 6, 7, 9, 11],
    'phrygian': [0, 1, 3, 5, 7, 8, 10],
    'whole-tone': [0, 2, 4, 6, 8, 10]
};

/**
 * Frequency of scale degree `step` above `rootHz`. Steps beyond the scale
 * length wrap into higher octaves, so callers can just keep counting up.
 */
export function scaleNote(rootHz: number, scale: MusicScale, step: number): number {
    const steps = SCALE_STEPS[scale];
    const octave = Math.floor(step / steps.length);
    const degree = ((step % steps.length) + steps.length) % steps.length;
    const semitones = steps[degree] + octave * 12;
    return rootHz * Math.pow(2, semitones / 12);
}

/**
 * Chapter profiles, keyed by level index (matches `LEVEL_CONFIG`).
 *
 * | Level | Identity |
 * |-------|----------|
 * | 1 Neon Garden      | Soft music-box + pastel arp |
 * | 2 Asteroid Belt    | Sparse percussion + metallic hits |
 * | 3 Orbital Descent  | Rising tension filter, heat noise bed |
 * | 4 Rusty Gauntlet   | Industrial pulse, clanks |
 * | 5 Astral Leviathan | Deep whale pad, organic swells |
 * | 6 Aqua Expanse     | Bubbly delay, underwater LPF |
 */
export const CHAPTER_MUSIC: Record<number, ChapterMusicProfile> = {
    1: {
        id: 'neon-garden',
        label: 'Soft music-box + pastel arp',
        scale: 'pentatonic',
        rootHz: 261.63, // C4
        bpm: 92,
        baseTempoScale: 0.12,
        layers: ['pad', 'arp', 'chime'],
        dangerLayer: 'staccato',
        victoryStinger: 'chime-rise',
        filterHz: 5200,
        delaySend: 0.22,
        timbre: { pad: 'sine', arp: 'triangle', chime: 'sine' }
    },
    2: {
        id: 'asteroid-belt',
        label: 'Sparse percussion + metallic hits',
        scale: 'minor',
        rootHz: 220.00, // A3
        bpm: 104,
        baseTempoScale: 0.16,
        layers: ['pad', 'bass', 'drums'],
        dangerLayer: 'staccato',
        victoryStinger: 'brass-swell',
        filterHz: 3600,
        delaySend: 0.3,
        timbre: { pad: 'triangle', bass: 'square', drums: 'square' },
        noiseBed: 0.05
    },
    3: {
        id: 'orbital-descent',
        label: 'Rising tension filter, heat noise bed',
        scale: 'whole-tone',
        rootHz: 146.83, // D3
        bpm: 118,
        baseTempoScale: 0.2,
        layers: ['pad', 'bass', 'drums'],
        dangerLayer: 'dissonant-pad',
        victoryStinger: 'brass-swell',
        filterHz: 2400,
        delaySend: 0.18,
        timbre: { pad: 'sawtooth', bass: 'sawtooth', drums: 'triangle' },
        noiseBed: 0.16
    },
    4: {
        id: 'rusty-gauntlet',
        label: 'Industrial pulse, clanks',
        scale: 'phrygian',
        rootHz: 82.41, // E2
        bpm: 128,
        baseTempoScale: 0.18,
        layers: ['bass', 'drums', 'arp'],
        dangerLayer: 'staccato',
        victoryStinger: 'brass-swell',
        filterHz: 3000,
        delaySend: 0.12,
        timbre: { bass: 'square', drums: 'square', arp: 'sawtooth' },
        noiseBed: 0.1
    },
    5: {
        id: 'astral-leviathan',
        label: 'Deep whale pad, organic swells',
        scale: 'mixolydian',
        rootHz: 98.00, // G2
        bpm: 72,
        baseTempoScale: 0.08,
        layers: ['whale', 'pad', 'bass'],
        dangerLayer: 'dissonant-pad',
        victoryStinger: 'whale-call',
        filterHz: 1800,
        delaySend: 0.4,
        timbre: { pad: 'sine', bass: 'sine', whale: 'sine' }
    },
    6: {
        id: 'aqua-expanse',
        label: 'Bubbly delay, underwater LPF',
        scale: 'major',
        rootHz: 174.61, // F3
        bpm: 86,
        baseTempoScale: 0.1,
        layers: ['pad', 'bass', 'chime', 'arp'],
        dangerLayer: 'dissonant-pad',
        victoryStinger: 'bubble-rise',
        filterHz: 900,
        delaySend: 0.45,
        timbre: { pad: 'sine', bass: 'triangle', chime: 'sine', arp: 'sine' }
    }
};

/** Cozy bed used by the hub / pause screen, between chapters. */
export const HUB_MUSIC_PROFILE: ChapterMusicProfile = {
    id: 'cozy-hub',
    label: 'Cozy hub bed',
    scale: 'major',
    rootHz: 196.00, // G3
    bpm: 64,
    baseTempoScale: 0,
    layers: ['pad', 'chime'],
    filterHz: 2600,
    delaySend: 0.3,
    timbre: { pad: 'sine', chime: 'sine' }
};

export function getChapterMusicProfile(level: number): ChapterMusicProfile {
    return CHAPTER_MUSIC[level] ?? CHAPTER_MUSIC[1];
}

/** Live audio graph for one chapter profile (built by the chapter music mixin). */
export interface ChapterGraph {
    profile: ChapterMusicProfile;
    /** Per-profile master gain; crossfades carry this from 0→1 or 1→0. */
    bus: GainNode;
    /** Chapter lowpass — the "underwater" / "muffled" character control. */
    filter: BiquadFilterNode;
    /** Layer id (plus `'danger'`) → its gain node. */
    layers: Map<string, GainNode>;
    noise: AudioBufferSourceNode | null;
    /** Monotonic 16th-note counter driving the sequencer. */
    step: number;
}

/** Gameplay signals driving the adaptive mix, all 0..1. */
export interface ChapterDynamics {
    speed: number;
    boost: number;
    danger: number;
    quiet: number;
}
