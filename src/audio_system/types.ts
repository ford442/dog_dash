import * as THREE from 'three';

export type SoundType = 
    | 'shoot' 
    | 'explode' 
    | 'hit' 
    | 'powerup' 
    | 'boss_roar' 
    | 'boss_phase'
    | 'boss_suction'
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
    | 'hover_hum'
    | 'dog_bark'
    | 'dog_whine';

// Magic sound sequences for combos
export type MagicSequence = 'star_collect' | 'power_up' | 'shield_up' | 'spell_complete';

// Music State Machine
export type MusicState = 'AMBIENT' | 'ACTIVE' | 'BOOSTED' | 'VICTORY' | 'MENU';

// Pentatonic scale frequencies (C major pentatonic)
export const PENTATONIC_SCALE = [
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
export const ALTITUDE_CHORDS = [
    { root: 130.81, name: 'C3' }, // C3 - low altitude
    { root: 164.81, name: 'E3' }, // E3
    { root: 196.00, name: 'G3' }, // G3
    { root: 261.63, name: 'C4' }, // C4 - mid altitude
    { root: 329.63, name: 'E4' }, // E4
    { root: 392.00, name: 'G4' }, // G4
    { root: 523.25, name: 'C5' }, // C5 - high altitude
    { root: 659.25, name: 'E5' }, // E5
];

export interface SoundConfig {
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

export interface MusicLayer {
    name: string;
    gain: GainNode | null;
    oscillators: OscillatorNode[];
    active: boolean;
    baseFrequency: number;
}

export interface SpatialSound {
    position: { x: number; y: number; z: number };
    panner: PannerNode | null;
    gain: GainNode | null;
}

/** Shared `this` context for audio mixins merged onto {@link AudioSystem}. */
export interface AudioSystemHost {
    ctx: AudioContext | null;
    masterGain: GainNode | null;
    musicGain: GainNode | null;
    sfxGain: GainNode | null;
    engineActive: boolean;
    musicVolume: number;
    sfxVolume: number;
    masterVolume: number;
    isMuted: boolean;
    musicLayers: Map<string, MusicLayer>;
    currentMusicState: MusicState;
    bpm: number;
    baseBpm: number;
    musicStartTime: number;
    musicInterval: number | null;
    magicMusicTimeout: number | null;
    collectChain: number;
    lastCollectTime: number;
    chainTimeout: number;
    melodyQueue: number[];
    listenerPosition: { x: number; y: number; z: number };
    spatialSounds: Map<string, SpatialSound>;
    pannerNodes: PannerNode[];
    hoverNode: OscillatorNode | null;
    hoverGain: GainNode | null;
    hoverActive: boolean;
    activeVoices: number;
    maxVoices: number;
    activeVoiceNodes: Array<{ osc?: OscillatorNode; source?: AudioBufferSourceNode; gain: GainNode; priority: number; endTime: number; timeoutId?: ReturnType<typeof setTimeout> }>;
    reverbNode: DelayNode | null;
    reverbFeedback: GainNode | null;
    reverbFilter: BiquadFilterNode | null;
    reverbSend: GainNode | null;
    engineDroneNode: OscillatorNode | null;
    engineThrustNode: OscillatorNode | null;
    engineWhooshNode: AudioBufferSourceNode | null;
    engineWhooshBuffer: AudioBuffer | null;
    engineBaseGain: GainNode | null;
    engineThrustGain: GainNode | null;
    engineWhooshGain: GainNode | null;
    engineFilter: BiquadFilterNode | null;
    engineMasterGain: GainNode | null;
    lastEngineState: { speedY: number; up: boolean; down: boolean };
    isDucked: boolean;
    gravHumOsc: OscillatorNode | null;
    gravHumNoise: AudioBufferSourceNode | null;
    gravHumNoiseFilter: BiquadFilterNode | null;
    gravHumGain: GainNode | null;
    gravHumActive: boolean;
    droneNode: OscillatorNode | null;
    droneGain: GainNode | null;
    soundConfigs: Record<SoundType, SoundConfig>;

    init(): void;
    play(type: SoundType, volumeMultiplier?: number, priority?: number): void;
    playHarmonic(frequency: number, config: SoundConfig, volumeMultiplier: number, delay: number, priority: number, baseDurationSecs: number): void;
    playHarmonicWithPanner(frequency: number, config: SoundConfig, volumeMultiplier: number, delay: number, panner: PannerNode): void;
    playToneWithPanner(config: SoundConfig, volumeMultiplier: number, panner: PannerNode): void;
    playNoiseWithPanner(config: SoundConfig, volumeMultiplier: number, panner: PannerNode): void;
    applyDuck(duration: number, amount: number): void;
    playSequence(sequence: Array<{ sound: SoundType; delay: number; volume?: number }>): void;
    playMagicSequence(sequence: MagicSequence): void;
    mute(): void;
    unmute(): void;
    initMusicLayer(name: string, baseFreq: number, waveform: OscillatorType, initialVolume: number): void;
    setMusicState(state: MusicState): void;
    setMusicEnergy(energy: number): void;
    startMusicSequencer(): void;
    updateMusicSequence(): void;
    playAmbientNotes(time: number): void;
    playEnergyNotes(time: number): void;
    playMagicNotes(time: number): void;
    playVictoryNotes(time: number): void;
    activateMagicMusic(duration: number): void;
    setMasterVolume(volume: number): void;
    createPanner(): PannerNode | null;
    playStarJingle(): void;
    startEngineLayers(): void;
    stopEngine(): void;
    stopDrone(): void;
    stopHover(): void;
    stopGravityHum(): void;
    updateEngineState(currentSpeedY: number, isMovingUp: boolean, isMovingDown: boolean, isBoosting?: boolean): void;
}

/** @deprecated Use AudioSystemHost */
export type AudioSystemBase = AudioSystemHost;

/** @deprecated Use AudioSystemHost */
export type AudioMixinHost = AudioSystemHost;

export function bindMixin<T extends Record<string, (this: AudioSystemHost, ...args: any[]) => any>>(mixin: T): T {
    return mixin;
}

