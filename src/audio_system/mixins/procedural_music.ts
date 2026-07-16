import * as THREE from 'three';
import type { SoundConfig } from '../types';
import { bindMixin, PENTATONIC_SCALE, ALTITUDE_CHORDS } from '../types';

export const proceduralMusicMixin = bindMixin({
playNoteForCollect(pitch?: number): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const now = Date.now();
    
    // Check if this is part of a chain
    if (now - this.lastCollectTime < this.chainTimeout) {
        this.collectChain++;
    } else {
        this.collectChain = 0;
        this.melodyQueue = [];
    }
    this.lastCollectTime = now;

    // Determine pitch
    let noteFreq: number;
    if (pitch !== undefined && pitch >= 0 && pitch < PENTATONIC_SCALE.length) {
        noteFreq = PENTATONIC_SCALE[pitch];
    } else {
        // Cycle through pentatonic scale for melody
        noteFreq = PENTATONIC_SCALE[this.collectChain % PENTATONIC_SCALE.length];
    }

    this.melodyQueue.push(noteFreq);

    // Play the note
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(noteFreq, this.ctx.currentTime);

    // Louder and longer for chain collects
    const volume = 0.2 + Math.min(this.collectChain * 0.03, 0.15);
    const duration = 0.3 + Math.min(this.collectChain * 0.05, 0.3);

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);

    // Add sparkle effect for chains
    if (this.collectChain > 0) {
        this.playHarmonic(noteFreq * 2, { 
            volume: volume * 0.4, 
            duration, 
            decay: duration 
        } as SoundConfig, 1, 0.05, 3, duration);
    }

    // 5 stars in a row = little jingle!
    if (this.collectChain >= 4) {
        setTimeout(() => this.playStarJingle(), 100);
        this.collectChain = 0;
        this.melodyQueue = [];
    }
},

playStarJingle(): void {
    if (!this.ctx || !this.sfxGain) return;

    // Play ascending pentatonic arpeggio
    const arpeggio = [0, 2, 4, 7, 9]; // C, E, G, C, D
    
    arpeggio.forEach((scaleIndex, i) => {
        setTimeout(() => {
            const freq = PENTATONIC_SCALE[scaleIndex];
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);

            gain.gain.setValueAtTime(0, this.ctx!.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, this.ctx!.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.4);

            osc.connect(gain);
            gain.connect(this.sfxGain!);

            osc.start(this.ctx!.currentTime);
            osc.stop(this.ctx!.currentTime + 0.4);
        }, i * 80);
    });

    // Play magical shimmer
    setTimeout(() => this.play('magical_shimmer', 0.7), 500);
},

playChordForAltitude(altitude: number): void {
    this.init();
    if (!this.ctx || !this.musicGain) return;

    // Map altitude to chord index (0-7)
    const normalizedAlt = Math.max(0, Math.min(1, altitude / 1000));
    const chordIndex = Math.floor(normalizedAlt * (ALTITUDE_CHORDS.length - 1));
    const chord = ALTITUDE_CHORDS[chordIndex];

    // Play major triad
    const frequencies = [
        chord.root,
        chord.root * 1.25, // Major third
        chord.root * 1.5   // Perfect fifth
    ];

    frequencies.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);

        gain.gain.setValueAtTime(0, this.ctx!.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, this.ctx!.currentTime + 0.1 + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 2);

        osc.connect(gain);
        gain.connect(this.musicGain!);

        osc.start(this.ctx!.currentTime);
        osc.stop(this.ctx!.currentTime + 2);
    });
}
});
