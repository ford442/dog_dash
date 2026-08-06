import type { SoundType } from '../audio_system';

/** Minimal audio surface for combat, collectibles, and power-up feedback. */
export interface AudioPort {
    play(type: SoundType, volumeMultiplier?: number, priority?: number): void;
    /** Rising sling-combo charge hum (optional — not all audio backends implement it). */
    playSlingCharge?(combo: number): void;
}
