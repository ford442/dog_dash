import * as THREE from 'three';
import type { MusicLayer, MusicState } from '../types';
import { bindMixin, PENTATONIC_SCALE } from '../types';

export const musicLayerMixin = bindMixin({
startBackgroundMusic(): void {
    this.init();
    if (!this.ctx || !this.musicGain) return;

    this.musicStartTime = this.ctx.currentTime;
    
    // Initialize music layers
    this.initMusicLayer('base', 60, 'sine', 0.15);      // Soft dreamy ambient
    this.initMusicLayer('energy', 110, 'triangle', 0);   // Adds when moving fast
    this.initMusicLayer('magic', 880, 'sine', 0);        // Adds when power-up active
    this.initMusicLayer('victory', 523.25, 'triangle', 0); // Triumph music
    
    // Start ambient base layer
    this.setMusicState('AMBIENT');
    
    // Start the music sequencer
    this.startMusicSequencer();
    
    console.log('🎵 Background music started');
},

initMusicLayer(name: string, baseFreq: number, waveform: OscillatorType, initialVolume: number): void {
    if (!this.ctx || !this.musicGain) return;

    const gain = this.ctx.createGain();
    gain.gain.value = initialVolume;
    gain.connect(this.musicGain);

    const layer: MusicLayer = {
        name,
        gain,
        oscillators: [],
        active: initialVolume > 0,
        baseFrequency: baseFreq
    };

    this.musicLayers.set(name, layer);
},

createLayerOscillator(layer: MusicLayer, frequency: number, waveform: OscillatorType): OscillatorNode {
    if (!this.ctx) throw new Error('Audio context not initialized');

    const osc = this.ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    osc.connect(layer.gain!);
    osc.start(this.ctx.currentTime);
    layer.oscillators.push(osc);

    return osc;
},

startMusicSequencer(): void {
    if (this.musicInterval) {
        clearInterval(this.musicInterval);
    }

    // Sequencer runs every beat
    const beatInterval = (60 / this.bpm) * 1000;
    
    this.musicInterval = window.setInterval(() => {
        this.updateMusicSequence();
    }, beatInterval / 4); // Sixteenth notes
},

updateMusicSequence(): void {
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    
    // Base layer - always playing soft ambient
    if (this.currentMusicState !== 'MENU') {
        this.playAmbientNotes(time);
    }

    // Energy layer - responds to movement
    if (this.currentMusicState === 'ACTIVE' || this.currentMusicState === 'BOOSTED') {
        this.playEnergyNotes(time);
    }

    // Magic layer - power-up active
    if (this.currentMusicState === 'BOOSTED') {
        this.playMagicNotes(time);
    }

    // Victory layer
    if (this.currentMusicState === 'VICTORY') {
        this.playVictoryNotes(time);
    }
},

playAmbientNotes(time: number): void {
    if (Math.random() > 0.3) return; // Sparse notes

    const layer = this.musicLayers.get('base');
    if (!layer || !this.ctx || !layer.gain) return;

    // Pentatonic notes for dreamy feel
    const note = PENTATONIC_SCALE[Math.floor(Math.random() * 5)];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(note / 2, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 2);

    osc.connect(gain);
    gain.connect(layer.gain);

    osc.start(time);
    osc.stop(time + 2);
},

playEnergyNotes(time: number): void {
    if (Math.random() > 0.5) return;

    const layer = this.musicLayers.get('energy');
    if (!layer || !this.ctx || !layer.gain) return;

    // Faster, rhythmic pattern
    const note = PENTATONIC_SCALE[Math.floor(Math.random() * 7) + 2];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.connect(gain);
    gain.connect(layer.gain);

    osc.start(time);
    osc.stop(time + 0.5);
},

playMagicNotes(time: number): void {
    if (Math.random() > 0.4) return;

    const layer = this.musicLayers.get('magic');
    if (!layer || !this.ctx || !layer.gain) return;

    // High sparkly notes
    const note = PENTATONIC_SCALE[Math.floor(Math.random() * 4) + 6];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(note, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);

    // Add harmonics
    const harmonic = this.ctx.createOscillator();
    const harmonicGain = this.ctx.createGain();
    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(note * 1.5, time);
    harmonicGain.gain.setValueAtTime(0, time);
    harmonicGain.gain.linearRampToValueAtTime(0.05, time + 0.02);
    harmonicGain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

    osc.connect(gain);
    harmonic.connect(harmonicGain);
    gain.connect(layer.gain);
    harmonicGain.connect(layer.gain);

    osc.start(time);
    harmonic.start(time);
    osc.stop(time + 0.8);
    harmonic.stop(time + 0.6);
},

playVictoryNotes(time: number): void {
    if (Math.random() > 0.3) return;

    const layer = this.musicLayers.get('victory');
    if (!layer || !this.ctx || !layer.gain) return;

    // Triumphant chord progression
    const baseNote = 523.25; // C5
    const chord = [baseNote, baseNote * 1.25, baseNote * 1.5]; // Major chord

    chord.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time + i * 0.05);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.12, time + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);

        osc.connect(gain);
        gain.connect(layer.gain!);

        osc.start(time);
        osc.stop(time + 1.5);
    });
},

setMusicEnergy(energy: number): void {
    if (!this.ctx) return;

    const baseLayer = this.musicLayers.get('base');
    const energyLayer = this.musicLayers.get('energy');

    if (baseLayer?.gain) {
        baseLayer.gain.gain.setTargetAtTime(
            0.15 * (1 - energy * 0.5), 
            this.ctx.currentTime, 
            0.3
        );
    }

    if (energyLayer?.gain) {
        energyLayer.gain.gain.setTargetAtTime(
            0.12 * energy, 
            this.ctx.currentTime, 
            0.3
        );
    }

    // Adjust BPM with energy
    this.bpm = this.baseBpm + energy * 40;
    
    // Restart sequencer with new tempo
    this.startMusicSequencer();
},

activateMagicMusic(duration: number): void {
    if (!this.ctx) return;

    const magicLayer = this.musicLayers.get('magic');
    if (!magicLayer?.gain) return;

    // Fade in magic layer
    magicLayer.gain.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.3);
    magicLayer.active = true;

    // Play harp glissando
    this.play('harp_glissando', 0.8);

    // Clear existing timeout
    if (this.magicMusicTimeout) {
        clearTimeout(this.magicMusicTimeout);
    }

    // Fade out after duration
    this.magicMusicTimeout = window.setTimeout(() => {
        if (magicLayer.gain && this.ctx) {
            magicLayer.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
        }
        magicLayer.active = false;
    }, duration * 1000);
},

playVictoryMusic(): void {
    if (!this.ctx) return;

    this.setMusicState('VICTORY');

    const victoryLayer = this.musicLayers.get('victory');
    if (victoryLayer?.gain) {
        victoryLayer.gain.gain.setTargetAtTime(0.25, this.ctx.currentTime, 0.5);
    }

    // Play choir sound
    this.play('choir_ahh', 1.0);

    // Play sparkle cascade
    setTimeout(() => this.play('sparkle_cascade', 0.9), 200);
},

stopVictoryMusic(): void {
    if (!this.ctx) return;

    const victoryLayer = this.musicLayers.get('victory');
    if (victoryLayer?.gain) {
        victoryLayer.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 1.0);
    }

    this.setMusicState('AMBIENT');
},

setMusicState(state: MusicState): void {
    this.currentMusicState = state;
    
    // Adjust layers based on state
    switch (state) {
        case 'AMBIENT':
            this.setMusicEnergy(0);
            break;
        case 'ACTIVE':
            this.setMusicEnergy(0.6);
            break;
        case 'BOOSTED':
            this.setMusicEnergy(0.8);
            this.activateMagicMusic(10);
            break;
        case 'MENU':
            this.setMusicEnergy(0.2);
            break;
    }
},

getMusicState(): MusicState {
    return this.currentMusicState;
}
});
