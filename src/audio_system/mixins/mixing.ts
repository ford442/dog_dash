import * as THREE from 'three';
import type { SoundType, MagicSequence, MusicState, SoundConfig, MusicLayer } from '../types';

export const mixingMixin = {
setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume, 
        this.ctx.currentTime, 
        0.1
    );
},

setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (!this.musicGain || !this.ctx) return;
    this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.1);
},

setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (!this.sfxGain || !this.ctx) return;
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.1);
},

mute(): void {
    this.isMuted = true;
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
},

unmute(): void {
    this.isMuted = false;
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.1);
},

isAudioMuted(): boolean {
    return this.isMuted;
},

getVolumeSettings() {
    return {
        master: this.masterVolume,
        music: this.musicVolume,
        sfx: this.sfxVolume,
        muted: this.isMuted
    };
}
} as const;
