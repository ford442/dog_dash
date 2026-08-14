import type { SoundType } from '../audio_system';

/** Minimal audio surface for combat, collectibles, and power-up feedback. */
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
}
