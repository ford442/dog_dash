import type { SoundType, MagicSequence } from '../audio_system';

/** Minimal audio surface for combat, collectibles, friends, and feedback. */
export interface AudioPort {
    play(type: SoundType, volumeMultiplier?: number, priority?: number): void;
    /** Rising sling-combo charge hum (optional — not all audio backends implement it). */
    playSlingCharge?(combo: number): void;
    playSlingArcSurge(): void;
    /** Near-miss graze combo sting (optional). */
    playGraze?(combo: number): void;
    playPowerUpCue?(soundEffect: string): void;
    playCometActivate?(): void;
    playShieldActivate?(): void;
    playShieldBreak?(): void;
    activateMagicMusic?(durationMs: number): void;
    /** Timed sound sequence playback. */
    playSequence?(sequence: Array<{ sound: SoundType; delay: number; volume?: number }>): void;
    /** Stellar Seal Pup cheering clap sound. */
    playSealClap?(): void;
    /** Resonant bell/crystal chime tone arpeggiation. */
    playCrystalChime?(notes: number[], volumeMultiplier?: number, pitchShift?: number): void;
    /** Quick magic sound presets. */
    playMagicSound?(type: 'collect' | 'power' | 'shield' | 'spell' | 'happy', volume?: number): void;
    /** Play built-in magical melody sequence. */
    playMagicSequence?(sequence: MagicSequence): void;
}

