import * as THREE from 'three';

export type SoundType = 
    | 'shoot' 
    | 'explode' 
    | 'hit' 
    | 'powerup' 
    | 'boss_roar' 
    | 'engine' 
    | 'alert' 
    | 'ui_click'
    | 'boss_defeat'
    // New magical sounds
    | 'twinkle'
    | 'giggle'
    | 'sparkle'
    | 'boing'
    | 'whoosh'
    | 'magic_cast'
    | 'heart_pop'
    // Advanced magical sounds
    | 'wind_chime'
    | 'harp_glissando'
    | 'choir_ahh'
    | 'magical_shimmer'
    | 'sparkle_cascade'
    | 'hover_hum';

// Magic sound sequences for combos
export type MagicSequence = 'star_collect' | 'power_up' | 'shield_up' | 'spell_complete';

// Music State Machine
export type MusicState = 'AMBIENT' | 'ACTIVE' | 'BOOSTED' | 'VICTORY' | 'MENU';

// Pentatonic scale frequencies (C major pentatonic)
const PENTATONIC_SCALE = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
    1046.50 // C6
];

// Chord progressions for altitude-based harmony
const ALTITUDE_CHORDS = [
    { root: 130.81, name: 'C3' }, // C3 - low altitude
    { root: 164.81, name: 'E3' }, // E3
    { root: 196.00, name: 'G3' }, // G3
    { root: 261.63, name: 'C4' }, // C4 - mid altitude
    { root: 329.63, name: 'E4' }, // E4
    { root: 392.00, name: 'G4' }, // G4
    { root: 523.25, name: 'C5' }, // C5 - high altitude
    { root: 659.25, name: 'E5' }, // E5
];

interface SoundConfig {
    type: SoundType;
    frequency: number;
    duration: number;
    waveform: OscillatorType;
    volume: number;
    slide?: number;
    noise?: boolean;
    harmonics?: number[];
    decay?: number;
}

interface MusicLayer {
    name: string;
    gain: GainNode | null;
    oscillators: OscillatorNode[];
    active: boolean;
    baseFrequency: number;
}

interface SpatialSound {
    position: { x: number; y: number; z: number };
    panner: PannerNode | null;
    gain: GainNode | null;
}

