/**
 * audio_settings.ts
 * Bridge between persisted audio preferences (`save_manager`) and the live
 * `AudioSystem`.
 *
 * Kept outside `audio_system/` on purpose: the audio system stays a pure
 * Web Audio module with no storage dependency, and this module owns the
 * "load it, apply it, save it" round trip.
 */

import { getAudioSystem } from './audio_system';
import { getSaveManager, type AudioSettings } from './save_manager';

/**
 * True when the OS asks for reduced motion. We treat that as a request for a
 * calmer mix too — fewer simultaneous layers is both a sensory and a perf win.
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

/** Effective reduced-audio state: the saved preference OR the OS hint. */
export function shouldReduceAudio(settings: AudioSettings): boolean {
    return settings.reducedAudio || prefersReducedMotion();
}

/** Pushes settings into the live audio system. Safe before audio init. */
export function applyAudioSettings(settings: AudioSettings): void {
    const audio = getAudioSystem();
    audio.setMasterVolume(settings.master);
    audio.setMusicVolume(settings.music);
    audio.setSFXVolume(settings.sfx);
    audio.setReducedAudio(shouldReduceAudio(settings));
}

/** Loads persisted preferences and applies them. Call once at startup. */
export function loadAndApplyAudioSettings(): AudioSettings {
    const settings = getSaveManager().getAudioSettings();
    applyAudioSettings(settings);
    return settings;
}

/** Applies a partial change, persists it, and returns the merged result. */
export function updateAudioSettings(update: Partial<AudioSettings>): AudioSettings {
    const settings = getSaveManager().setAudioSettings(update);
    applyAudioSettings(settings);
    return settings;
}

export type { AudioSettings };
