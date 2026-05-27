/**
 * Audio System for Dog Dash
 * Uses Web Audio API for synthesis - no external files needed
 * Enhanced with magical, whimsical sounds for a young girl player
 * 
 * ADVANCED FEATURES:
 * - Layered Music System (base, energy, magic, victory layers)
 * - Procedural Music Elements (pentatonic melodies, altitude chords)
 * - Spatial Audio (3D positioned sounds)
 * - Music State Machine
 */

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

export class AudioSystem {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private musicGain: GainNode | null = null;
    private sfxGain: GainNode | null = null;
    private engineActive: boolean = false;
    
    // Volume settings (0-1)
    private musicVolume: number = 0.7;
    private sfxVolume: number = 0.8;
    private masterVolume: number = 0.7;
    private isMuted: boolean = false;
    
    // ========== LAYERED MUSIC SYSTEM ==========
    private musicLayers: Map<string, MusicLayer> = new Map();
    private currentMusicState: MusicState = 'AMBIENT';
    private bpm: number = 60; // Base BPM
    private baseBpm: number = 60;
    private musicStartTime: number = 0;
    private musicInterval: number | null = null;
    private magicMusicTimeout: number | null = null;
    
    // ========== PROCEDURAL MUSIC ==========
    private collectChain: number = 0;
    private lastCollectTime: number = 0;
    private chainTimeout: number = 1000; // ms between chain collects
    private melodyQueue: number[] = [];
    
    // ========== SPATIAL AUDIO ==========
    private listenerPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
    private spatialSounds: Map<string, SpatialSound> = new Map();
    private pannerNodes: PannerNode[] = [];
    
    // ========== HOVER SOUND ==========
    private hoverNode: OscillatorNode | null = null;
    private hoverGain: GainNode | null = null;
    private hoverActive: boolean = false;

    // ========== VOICE LIMITER ==========
    private activeVoices: number = 0;
    private readonly maxVoices: number = 8;

    // ========== REVERB ==========
    private reverbNode: DelayNode | null = null;
    private reverbFeedback: GainNode | null = null;
    private reverbFilter: BiquadFilterNode | null = null;
    private reverbSend: GainNode | null = null;

    // ========== ENHANCED ENGINE SYSTEM ==========
    private engineDroneNode: OscillatorNode | null = null;
    private engineThrustNode: OscillatorNode | null = null;
    private engineWhooshNode: AudioBufferSourceNode | null = null;
    private engineWhooshBuffer: AudioBuffer | null = null;
    private engineBaseGain: GainNode | null = null;
    private engineThrustGain: GainNode | null = null;
    private engineWhooshGain: GainNode | null = null;
    private engineFilter: BiquadFilterNode | null = null;
    private engineMasterGain: GainNode | null = null;
    private lastEngineState: { speedY: number; up: boolean; down: boolean } = { speedY: 0, up: false, down: false };

    // ========== DUCKING ==========
    private isDucked: boolean = false;

    // Sound configurations
    private soundConfigs: Record<SoundType, SoundConfig> = {
        shoot: {
            type: 'shoot',
            frequency: 800,
            duration: 0.1,
            waveform: 'square',
            volume: 0.3,
            slide: -400
        },
        explode: {
            type: 'explode',
            frequency: 100,
            duration: 0.3,
            waveform: 'sawtooth',
            volume: 0.4,
            noise: true
        },
        hit: {
            type: 'hit',
            frequency: 200,
            duration: 0.15,
            waveform: 'sawtooth',
            volume: 0.3,
            slide: -100
        },
        powerup: {
            type: 'powerup',
            frequency: 440,
            duration: 0.5,
            waveform: 'sine',
            volume: 0.3,
            slide: 440
        },
        boss_roar: {
            type: 'boss_roar',
            frequency: 80,
            duration: 2.0,
            waveform: 'sawtooth',
            volume: 0.5,
            slide: -40
        },
        engine: {
            type: 'engine',
            frequency: 60,
            duration: 0.1,
            waveform: 'sawtooth',
            volume: 0.1
        },
        alert: {
            type: 'alert',
            frequency: 880,
            duration: 0.2,
            waveform: 'square',
            volume: 0.3
        },
        ui_click: {
            type: 'ui_click',
            frequency: 1200,
            duration: 0.05,
            waveform: 'sine',
            volume: 0.2
        },
        boss_defeat: {
            type: 'boss_defeat',
            frequency: 200,
            duration: 1.5,
            waveform: 'sawtooth',
            volume: 0.4,
            slide: -150,
            noise: true
        },
        // New magical sounds - gentle and twinkly for a 7-year-old player
        twinkle: {
            type: 'twinkle',
            frequency: 880,
            duration: 0.4,
            waveform: 'sine',
            volume: 0.25,
            harmonics: [1760, 2640],
            decay: 0.3
        },
        giggle: {
            type: 'giggle',
            frequency: 600,
            duration: 0.35,
            waveform: 'triangle',
            volume: 0.3,
            slide: 150,
            decay: 0.25
        },
        sparkle: {
            type: 'sparkle',
            frequency: 1320,
            duration: 0.5,
            waveform: 'sine',
            volume: 0.2,
            harmonics: [1980, 2640, 3300],
            decay: 0.4
        },
        boing: {
            type: 'boing',
            frequency: 200,
            duration: 0.3,
            waveform: 'sine',
            volume: 0.35,
            slide: 300,
            decay: 0.25
        },
        whoosh: {
            type: 'whoosh',
            frequency: 400,
            duration: 0.6,
            waveform: 'sine',
            volume: 0.25,
            slide: -300,
            decay: 0.5
        },
        magic_cast: {
            type: 'magic_cast',
            frequency: 523.25,
            duration: 0.8,
            waveform: 'triangle',
            volume: 0.3,
            slide: 600,
            harmonics: [784, 1047],
            decay: 0.6
        },
        heart_pop: {
            type: 'heart_pop',
            frequency: 659.25,
            duration: 0.35,
            waveform: 'sine',
            volume: 0.3,
            slide: 200,
            harmonics: [988],
            decay: 0.3
        },
        // Advanced magical sounds
        wind_chime: {
            type: 'wind_chime',
            frequency: 1174.66, // D6
            duration: 0.8,
            waveform: 'sine',
            volume: 0.2,
            harmonics: [2349.32, 3520.00],
            decay: 0.7
        },
        harp_glissando: {
            type: 'harp_glissando',
            frequency: 523.25, // C5
            duration: 1.0,
            waveform: 'triangle',
            volume: 0.3,
            slide: 800,
            harmonics: [659.25, 783.99],
            decay: 0.8
        },
        choir_ahh: {
            type: 'choir_ahh',
            frequency: 392.00, // G4
            duration: 2.0,
            waveform: 'sine',
            volume: 0.25,
            harmonics: [588.00, 784.00, 980.00],
            decay: 1.5
        },
        magical_shimmer: {
            type: 'magical_shimmer',
            frequency: 880.00, // A5
            duration: 1.2,
            waveform: 'sine',
            volume: 0.2,
            harmonics: [1100, 1320, 1540, 1760],
            decay: 1.0
        },
        sparkle_cascade: {
            type: 'sparkle_cascade',
            frequency: 1318.51, // E6
            duration: 1.5,
            waveform: 'sine',
            volume: 0.25,
            harmonics: [1977.76, 2637.02, 3296.28],
            decay: 1.2
        },
        hover_hum: {
            type: 'hover_hum',
            frequency: 150,
            duration: 0.1,
            waveform: 'sine',
            volume: 0.1
        }
    };

    constructor() {
        // Lazy init - create context on first user interaction
    }

    private init() {
        if (this.ctx) return;
        
        try {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // Master gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.ctx.destination);
            
            // Separate gain nodes for music and SFX
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = this.musicVolume;
            this.musicGain.connect(this.masterGain);
            
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = this.sfxVolume;
            this.sfxGain.connect(this.masterGain);
            
            // Simple delay reverb for spacey feel
            this.reverbNode = this.ctx.createDelay(2.0);
            this.reverbNode.delayTime.value = 0.4;
            this.reverbFeedback = this.ctx.createGain();
            this.reverbFeedback.gain.value = 0.35;
            this.reverbFilter = this.ctx.createBiquadFilter();
            this.reverbFilter.type = 'lowpass';
            this.reverbFilter.frequency.value = 2500;
            this.reverbSend = this.ctx.createGain();
            this.reverbSend.gain.value = 0.12;

            this.reverbNode.connect(this.reverbFeedback);
            this.reverbFeedback.connect(this.reverbFilter);
            this.reverbFilter.connect(this.reverbNode);
            this.reverbNode.connect(this.reverbSend);
            this.reverbSend.connect(this.masterGain);
            
            console.log('🔊 Audio System initialized (with magic!) ✨');
        } catch (e) {
            console.warn('Audio not supported:', e);
        }
    }

    /**
     * Resume audio context (needed after user interaction)
     */
    resume() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Play a one-shot sound effect
     */
    play(type: SoundType, volumeMultiplier: number = 1, priority: number = 5) {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        const config = this.soundConfigs[type];
        if (!config) return;

        // Voice limiting: skip low-priority sounds when at capacity
        if (this.activeVoices >= this.maxVoices && priority < 8) return;
        this.activeVoices++;

        const duration = (config.decay || config.duration) * 1000 + 150;
        setTimeout(() => {
            this.activeVoices = Math.max(0, this.activeVoices - 1);
        }, duration);

        if (config.noise) {
            this.playNoise(config, volumeMultiplier);
        } else {
            this.playTone(config, volumeMultiplier);
        }
    }

    /**
     * Play synthesized tone
     */
    private playTone(config: SoundConfig, volumeMultiplier: number) {
        if (!this.ctx || !this.sfxGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = config.waveform;
        osc.frequency.setValueAtTime(config.frequency, this.ctx.currentTime);

        // Frequency slide
        if (config.slide) {
            osc.frequency.exponentialRampToValueAtTime(
                Math.max(20, config.frequency + config.slide),
                this.ctx.currentTime + config.duration
            );
        }

        // Envelope with custom decay if specified
        const decay = config.decay || config.duration;
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(
            config.volume * volumeMultiplier, 
            this.ctx.currentTime + 0.01
        );
        gain.gain.exponentialRampToValueAtTime(
            0.001, 
            this.ctx.currentTime + decay
        );

        osc.connect(gain);
        gain.connect(this.sfxGain);

        // Reverb send
        if (this.reverbSend) {
            const revGain = this.ctx.createGain();
            revGain.gain.value = 0.15;
            gain.connect(revGain);
            revGain.connect(this.reverbSend);
        }

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + config.duration);

        // Play harmonics for magical sounds
        if (config.harmonics) {
            config.harmonics.forEach((harmonicFreq, index) => {
                this.playHarmonic(harmonicFreq, config, volumeMultiplier, index * 0.02);
            });
        }

        // Cleanup
        setTimeout(() => {
            osc.disconnect();
            gain.disconnect();
        }, config.duration * 1000 + 100);
    }

    /**
     * Play a harmonic overtone for magical shimmer effect
     */
    private playHarmonic(frequency: number, config: SoundConfig, volumeMultiplier: number, delay: number) {
        if (!this.ctx || !this.sfxGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime + delay);

        const harmonicVolume = config.volume * volumeMultiplier * 0.3;
        const decay = (config.decay || config.duration) * 0.8;

        gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(harmonicVolume, this.ctx.currentTime + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + decay);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(this.ctx.currentTime + delay);
        osc.stop(this.ctx.currentTime + config.duration + delay);

        setTimeout(() => {
            osc.disconnect();
            gain.disconnect();
        }, (config.duration + delay) * 1000 + 100);
    }

    /**
     * Play noise burst (for explosions)
     */
    private playNoise(config: SoundConfig, volumeMultiplier: number) {
        if (!this.ctx || !this.sfxGain) return;

        const bufferSize = this.ctx.sampleRate * config.duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(config.frequency, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(
            20, 
            this.ctx.currentTime + config.duration
        );

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(config.volume * volumeMultiplier, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001, 
            this.ctx.currentTime + config.duration
        );

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        // Reverb send
        if (this.reverbSend) {
            const revGain = this.ctx.createGain();
            revGain.gain.value = 0.2;
            gain.connect(revGain);
            revGain.connect(this.reverbSend);
        }

        noise.start(this.ctx.currentTime);
    }

    // ============================================================
    // LAYERED MUSIC SYSTEM
    // ============================================================

    /**
     * Start the layered background music system
     */
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
    }

    /**
     * Initialize a music layer
     */
    private initMusicLayer(name: string, baseFreq: number, waveform: OscillatorType, initialVolume: number): void {
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
    }

    /**
     * Create an oscillator for a music layer
     */
    private createLayerOscillator(layer: MusicLayer, frequency: number, waveform: OscillatorType): OscillatorNode {
        if (!this.ctx) throw new Error('Audio context not initialized');

        const osc = this.ctx.createOscillator();
        osc.type = waveform;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
        osc.connect(layer.gain!);
        osc.start(this.ctx.currentTime);
        layer.oscillators.push(osc);

        return osc;
    }

    /**
     * Start the music sequencer for procedural generation
     */
    private startMusicSequencer(): void {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
        }

        // Sequencer runs every beat
        const beatInterval = (60 / this.bpm) * 1000;
        
        this.musicInterval = window.setInterval(() => {
            this.updateMusicSequence();
        }, beatInterval / 4); // Sixteenth notes
    }

    /**
     * Update the music sequence based on current state
     */
    private updateMusicSequence(): void {
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
    }

    /**
     * Play ambient layer notes
     */
    private playAmbientNotes(time: number): void {
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
    }

    /**
     * Play energy layer notes
     */
    private playEnergyNotes(time: number): void {
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
    }

    /**
     * Play magic layer notes
     */
    private playMagicNotes(time: number): void {
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
    }

    /**
     * Play victory layer notes
     */
    private playVictoryNotes(time: number): void {
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
    }

    /**
     * Set music energy level (0-1)
     * Crossfades between ambient and active layers
     */
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
    }

    /**
     * Activate magic music layer for a duration
     */
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
    }

    /**
     * Play victory music
     */
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
    }

    /**
     * Stop victory music and return to previous state
     */
    stopVictoryMusic(): void {
        if (!this.ctx) return;

        const victoryLayer = this.musicLayers.get('victory');
        if (victoryLayer?.gain) {
            victoryLayer.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 1.0);
        }

        this.setMusicState('AMBIENT');
    }

    /**
     * Set the music state
     */
    private setMusicState(state: MusicState): void {
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
    }

    /**
     * Get current music state
     */
    getMusicState(): MusicState {
        return this.currentMusicState;
    }

    // ============================================================
    // PROCEDURAL MUSIC ELEMENTS
    // ============================================================

    /**
     * Play a note when collecting an item
     * Pentatonic scale - always sounds good!
     * Chain collects create melodies
     */
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
            } as SoundConfig, 1, 0.05);
        }

        // 5 stars in a row = little jingle!
        if (this.collectChain >= 4) {
            setTimeout(() => this.playStarJingle(), 100);
            this.collectChain = 0;
            this.melodyQueue = [];
        }
    }

    /**
     * Play a celebratory jingle for 5-star chain
     */
    private playStarJingle(): void {
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
    }

    /**
     * Play chord based on altitude - "flight music"
     * Higher altitude = higher pitch chords
     */
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

    // ============================================================
    // SPATIAL AUDIO
    // ============================================================

    /**
     * Update listener position for spatial audio
     */
    updateListenerPosition(position: THREE.Vector3): void {
        this.init();
        if (!this.ctx) return;

        this.listenerPosition = { x: position.x, y: position.y, z: position.z };

        // Update Web Audio listener position
        const listener = this.ctx.listener;
        if (listener.positionX) {
            listener.positionX.setValueAtTime(position.x, this.ctx.currentTime);
            listener.positionY.setValueAtTime(position.y, this.ctx.currentTime);
            listener.positionZ.setValueAtTime(position.z, this.ctx.currentTime);
        }
    }

    /**
     * Create a panner node for 3D spatial audio
     */
    private createPanner(): PannerNode | null {
        if (!this.ctx) return null;

        const panner = this.ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 100;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 360;
        panner.coneOuterGain = 0;

        this.pannerNodes.push(panner);
        return panner;
    }

    /**
     * Play a sound at a specific 3D position
     */
    playSoundAtPosition(
        sound: SoundType, 
        position: THREE.Vector3,
        volumeMultiplier: number = 1
    ): void {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        const config = this.soundConfigs[sound];
        if (!config) return;

        // Create panner for spatial positioning
        const panner = this.createPanner();
        if (!panner) return;

        // Set panner position
        if (panner.positionX) {
            panner.positionX.setValueAtTime(position.x, this.ctx.currentTime);
            panner.positionY.setValueAtTime(position.y, this.ctx.currentTime);
            panner.positionZ.setValueAtTime(position.z, this.ctx.currentTime);
        }
        
        // Store position for potential updates
        const soundId = `${sound}_${Date.now()}_${Math.random()}`;
        this.spatialSounds.set(soundId, {
            position: { x: position.x, y: position.y, z: position.z },
            panner,
            gain: null
        });

        panner.connect(this.sfxGain);

        // Create sound source
        if (config.noise) {
            this.playNoiseWithPanner(config, volumeMultiplier, panner);
        } else {
            this.playToneWithPanner(config, volumeMultiplier, panner);
        }

        // Cleanup after sound finishes
        const duration = (config.decay || config.duration) * 1000 + 100;
        setTimeout(() => {
            this.spatialSounds.delete(soundId);
            panner.disconnect();
        }, duration);
    }

    /**
     * Play tone with spatial panner
     */
    private playToneWithPanner(config: SoundConfig, volumeMultiplier: number, panner: PannerNode): void {
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = config.waveform;
        osc.frequency.setValueAtTime(config.frequency, this.ctx.currentTime);

        if (config.slide) {
            osc.frequency.exponentialRampToValueAtTime(
                Math.max(20, config.frequency + config.slide),
                this.ctx.currentTime + config.duration
            );
        }

        const decay = config.decay || config.duration;
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(
            config.volume * volumeMultiplier, 
            this.ctx.currentTime + 0.01
        );
        gain.gain.exponentialRampToValueAtTime(
            0.001, 
            this.ctx.currentTime + decay
        );

        osc.connect(gain);
        gain.connect(panner);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + config.duration);

        // Add harmonics
        if (config.harmonics) {
            config.harmonics.forEach((harmonicFreq, index) => {
                this.playHarmonicWithPanner(harmonicFreq, config, volumeMultiplier, index * 0.02, panner);
            });
        }
    }

    /**
     * Play harmonic with spatial panner
     */
    private playHarmonicWithPanner(
        frequency: number, 
        config: SoundConfig, 
        volumeMultiplier: number, 
        delay: number,
        panner: PannerNode
    ): void {
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime + delay);

        const harmonicVolume = config.volume * volumeMultiplier * 0.3;
        const decay = (config.decay || config.duration) * 0.8;

        gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(harmonicVolume, this.ctx.currentTime + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + decay);

        osc.connect(gain);
        gain.connect(panner);

        osc.start(this.ctx.currentTime + delay);
        osc.stop(this.ctx.currentTime + config.duration + delay);
    }

    /**
     * Play noise with spatial panner (for explosions)
     */
    private playNoiseWithPanner(config: SoundConfig, volumeMultiplier: number, panner: PannerNode): void {
        if (!this.ctx) return;

        const bufferSize = this.ctx.sampleRate * config.duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(config.frequency, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(
            20, 
            this.ctx.currentTime + config.duration
        );

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(config.volume * volumeMultiplier, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001, 
            this.ctx.currentTime + config.duration
        );

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(panner);

        noise.start(this.ctx.currentTime);
    }

    /**
     * Play twinkling sound as you approach a collectible
     * Volume increases as you get closer
     */
    playApproachTwinkle(distance: number, maxDistance: number = 500): void {
        if (distance > maxDistance) return;

        const normalizedDist = 1 - (distance / maxDistance);
        const volume = normalizedDist * 0.3;

        // Only play occasionally
        if (Math.random() < normalizedDist * 0.3) {
            this.play('wind_chime', volume);
        }
    }

    // ============================================================
    // MIXING CONTROLS
    // ============================================================

    /**
     * Set master volume (0-1)
     */
    setMasterVolume(volume: number): void {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (!this.masterGain || !this.ctx) return;
        this.masterGain.gain.setTargetAtTime(
            this.isMuted ? 0 : this.masterVolume, 
            this.ctx.currentTime, 
            0.1
        );
    }

    /**
     * Set music volume (0-1)
     */
    setMusicVolume(volume: number): void {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (!this.musicGain || !this.ctx) return;
        this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.1);
    }

    /**
     * Set SFX volume (0-1)
     */
    setSFXVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        if (!this.sfxGain || !this.ctx) return;
        this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.1);
    }

    /**
     * Mute all audio
     */
    mute(): void {
        this.isMuted = true;
        if (!this.masterGain || !this.ctx) return;
        this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }

    /**
     * Unmute all audio
     */
    unmute(): void {
        this.isMuted = false;
        if (!this.masterGain || !this.ctx) return;
        this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.1);
    }

    /**
     * Check if audio is muted
     */
    isAudioMuted(): boolean {
        return this.isMuted;
    }

    /**
     * Get current volume settings
     */
    getVolumeSettings() {
        return {
            master: this.masterVolume,
            music: this.musicVolume,
            sfx: this.sfxVolume,
            muted: this.isMuted
        };
    }

    // ============================================================
    // EXISTING ENGINE & SOUND METHODS (maintaining compatibility)
    // ============================================================

    /**
     * Start engine hum (legacy, now uses layered system)
     */
    startEngine() {
        this.init();
        if (!this.ctx || !this.sfxGain || this.engineActive) return;
        this.startEngineLayers();
    }

    /**
     * Start layered engine sound system
     */
    private startEngineLayers() {
        if (!this.ctx || !this.sfxGain || this.engineActive) return;
        this.engineActive = true;

        // Create looping noise buffer for whoosh
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5;
        }
        this.engineWhooshBuffer = buffer;

        // Master engine gain
        this.engineMasterGain = this.ctx.createGain();
        this.engineMasterGain.gain.value = 1.0;
        this.engineMasterGain.connect(this.sfxGain);

        // Lowpass filter for whole engine
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 450;
        this.engineFilter.connect(this.engineMasterGain);

        // Base drone: sawtooth
        this.engineDroneNode = this.ctx.createOscillator();
        this.engineDroneNode.type = 'sawtooth';
        this.engineDroneNode.frequency.value = 55;
        this.engineBaseGain = this.ctx.createGain();
        this.engineBaseGain.gain.value = 0.04;
        this.engineDroneNode.connect(this.engineBaseGain);
        this.engineBaseGain.connect(this.engineFilter);
        this.engineDroneNode.start();

        // Thrust layer: triangle
        this.engineThrustNode = this.ctx.createOscillator();
        this.engineThrustNode.type = 'triangle';
        this.engineThrustNode.frequency.value = 140;
        this.engineThrustGain = this.ctx.createGain();
        this.engineThrustGain.gain.value = 0;
        this.engineThrustNode.connect(this.engineThrustGain);
        this.engineThrustGain.connect(this.engineFilter);
        this.engineThrustNode.start();

        // Whoosh layer: looping noise
        this.engineWhooshNode = this.ctx.createBufferSource();
        this.engineWhooshNode.buffer = this.engineWhooshBuffer;
        this.engineWhooshNode.loop = true;
        this.engineWhooshGain = this.ctx.createGain();
        this.engineWhooshGain.gain.value = 0;

        const whooshFilter = this.ctx.createBiquadFilter();
        whooshFilter.type = 'bandpass';
        whooshFilter.frequency.value = 500;
        whooshFilter.Q.value = 0.5;

        this.engineWhooshNode.connect(whooshFilter);
        whooshFilter.connect(this.engineWhooshGain);
        this.engineWhooshGain.connect(this.engineFilter);
        this.engineWhooshNode.start();
    }

    /**
     * Update engine pitch based on movement speed (legacy compatibility)
     */
    updateEngine(speedY: number) {
        this.updateEngineState(speedY, false, false);
    }

    /**
     * Update engine with full flight state (thrust, glide, dive)
     */
    updateEngineState(currentSpeedY: number, isMovingUp: boolean, isMovingDown: boolean, isBoosting: boolean = false) {
        this.init();
        if (!this.ctx) return;

        if (!this.engineActive) {
            this.startEngineLayers();
        }

        this.lastEngineState = { speedY: currentSpeedY, up: isMovingUp, down: isMovingDown };

        const now = this.ctx.currentTime;
        const absSpeed = Math.abs(currentSpeedY);
        const speedRatio = Math.min(absSpeed / 22, 1);

        // Base drone pitch + volume
        if (this.engineDroneNode) {
            const baseFreq = isBoosting ? 80 + absSpeed * 2.5 : 55 + absSpeed * 1.8;
            this.engineDroneNode.frequency.setTargetAtTime(baseFreq, now, 0.1);
        }
        if (this.engineBaseGain) {
            let baseVol = 0.035 + speedRatio * 0.035;
            if (isMovingUp) baseVol += 0.015;
            if (isBoosting) baseVol += 0.025;
            this.engineBaseGain.gain.setTargetAtTime(baseVol, now, 0.1);
        }

        // Thrust layer: brighter when moving up or boosting
        if (this.engineThrustNode) {
            const thrustFreq = isBoosting ? 400 + absSpeed * 8
                : (isMovingUp ? 240 + absSpeed * 6 : (isMovingDown ? 80 : 140));
            this.engineThrustNode.frequency.setTargetAtTime(thrustFreq, now, 0.1);
        }
        if (this.engineThrustGain) {
            let thrustVol = 0;
            if (isBoosting) {
                thrustVol = 0.1 + speedRatio * 0.06;
            } else if (isMovingUp) {
                thrustVol = 0.05 + speedRatio * 0.04;
            } else if (isMovingDown) {
                thrustVol = 0.008;
            } else {
                thrustVol = 0.012;
            }
            this.engineThrustGain.gain.setTargetAtTime(thrustVol, now, 0.15);
        }

        // Whoosh layer: louder on fast dives or boosting
        if (this.engineWhooshGain) {
            let whooshVol = 0;
            if (isBoosting) {
                whooshVol = 0.08 + speedRatio * 0.04;
            } else if (isMovingDown && currentSpeedY < -5) {
                whooshVol = 0.03 + (Math.abs(currentSpeedY) - 5) * 0.007;
            } else if (absSpeed > 12) {
                whooshVol = 0.015;
            }
            this.engineWhooshGain.gain.setTargetAtTime(Math.min(whooshVol, 0.15), now, 0.1);
        }

        // Filter opens wide when boosting or thrusting
        if (this.engineFilter) {
            const filterFreq = isBoosting
                ? 1200 + absSpeed * 40
                : (isMovingUp ? 700 + absSpeed * 25 : (isMovingDown ? 250 + absSpeed * 8 : 450));
            this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.2);
        }
    }

    /**
     * Stop engine
     */
    stopEngine() {
        this.engineActive = false;

        if (this.engineDroneNode) {
            try { this.engineDroneNode.stop(); } catch (e) {}
            this.engineDroneNode.disconnect();
            this.engineDroneNode = null;
        }
        if (this.engineBaseGain) {
            this.engineBaseGain.disconnect();
            this.engineBaseGain = null;
        }
        if (this.engineThrustNode) {
            try { this.engineThrustNode.stop(); } catch (e) {}
            this.engineThrustNode.disconnect();
            this.engineThrustNode = null;
        }
        if (this.engineThrustGain) {
            this.engineThrustGain.disconnect();
            this.engineThrustGain = null;
        }
        if (this.engineWhooshNode) {
            try { this.engineWhooshNode.stop(); } catch (e) {}
            this.engineWhooshNode.disconnect();
            this.engineWhooshNode = null;
        }
        if (this.engineWhooshGain) {
            this.engineWhooshGain.disconnect();
            this.engineWhooshGain = null;
        }
        if (this.engineFilter) {
            this.engineFilter.disconnect();
            this.engineFilter = null;
        }
        if (this.engineMasterGain) {
            this.engineMasterGain.disconnect();
            this.engineMasterGain = null;
        }

        if (this.hoverNode) {
            try { this.hoverNode.stop(); } catch (e) {}
            this.hoverNode.disconnect();
            this.hoverNode = null;
        }
        if (this.hoverGain) {
            this.hoverGain.disconnect();
            this.hoverGain = null;
        }
        this.hoverActive = false;
    }

    /**
     * Start hover hum
     */
    startHover(): void {
        this.init();
        if (!this.ctx || !this.sfxGain || this.hoverActive) return;

        this.hoverActive = true;

        this.hoverNode = this.ctx.createOscillator();
        this.hoverGain = this.ctx.createGain();

        this.hoverNode.type = 'sine';
        this.hoverNode.frequency.setValueAtTime(150, this.ctx.currentTime);

        this.hoverGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

        this.hoverNode.connect(this.hoverGain);
        this.hoverGain.connect(this.sfxGain);

        this.hoverNode.start(this.ctx.currentTime);
    }

    /**
     * Stop hover hum
     */
    stopHover(): void {
        if (!this.hoverNode) return;

        this.hoverActive = false;
        this.hoverNode.stop();
        this.hoverNode.disconnect();
        if (this.hoverGain) {
            this.hoverGain.disconnect();
        }
        this.hoverNode = null;
        this.hoverGain = null;
    }

    /**
     * Play whoosh sound for fast direction changes
     */
    playWhoosh(speed: number): void {
        const volume = Math.min(speed / 10, 1) * 0.5;
        this.play('whoosh', volume);
    }

    /**
     * Play shoot sound with variation
     */
    playShoot(variant: number = 0) {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        const baseFreq = 800 + variant * 100;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            baseFreq - 400, 
            this.ctx.currentTime + 0.1
        );

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.1);
    }

    /**
     * Play background drone (ambient) - maintained for compatibility
     */
    private droneNode: OscillatorNode | null = null;
    private droneGain: GainNode | null = null;

    startDrone(intensity: number = 0.5) {
        this.init();
        if (!this.ctx || !this.musicGain || this.droneNode) return;

        this.droneNode = this.ctx.createOscillator();
        this.droneGain = this.ctx.createGain();

        this.droneNode.type = 'sine';
        this.droneNode.frequency.setValueAtTime(40, this.ctx.currentTime);

        this.droneGain.gain.setValueAtTime(0.05 * intensity, this.ctx.currentTime);

        this.droneNode.connect(this.droneGain);
        this.droneGain.connect(this.musicGain);

        this.droneNode.start(this.ctx.currentTime);
    }

    updateDroneIntensity(intensity: number) {
        if (!this.ctx || !this.droneGain) return;
        this.droneGain.gain.setTargetAtTime(
            0.05 * intensity, 
            this.ctx.currentTime, 
            0.5
        );
    }

    stopDrone() {
        if (!this.droneNode) return;
        this.droneNode.stop();
        this.droneNode.disconnect();
        if (this.droneGain) this.droneGain.disconnect();
        this.droneNode = null;
        this.droneGain = null;
    }

    /**
     * Set master volume - maintained for compatibility
     */
    setVolume(volume: number) {
        this.setMasterVolume(volume);
    }

    /**
     * Play a magic sound by type - helper method for magical effects
     */
    playMagicSound(type: 'collect' | 'power' | 'shield' | 'spell' | 'happy') {
        switch (type) {
            case 'collect':
                this.play('twinkle', 0.8);
                setTimeout(() => this.play('sparkle', 0.6), 100);
                break;
            case 'power':
                this.play('heart_pop', 0.9);
                setTimeout(() => this.play('magic_cast', 0.7), 150);
                break;
            case 'shield':
                this.play('boing', 0.8);
                setTimeout(() => this.play('whoosh', 0.6), 100);
                break;
            case 'spell':
                this.play('magic_cast', 0.8);
                setTimeout(() => this.play('sparkle', 0.7), 200);
                setTimeout(() => this.play('twinkle', 0.5), 400);
                break;
            case 'happy':
                this.play('giggle', 0.8);
                setTimeout(() => this.play('twinkle', 0.6), 100);
                break;
        }
    }

    /**
     * Play a sequence of sounds with specified delays
     */
    playSequence(sequence: Array<{ sound: SoundType; delay: number; volume?: number }>) {
        this.init();
        if (!this.ctx) return;

        sequence.forEach(({ sound, delay, volume = 1 }) => {
            setTimeout(() => {
                this.play(sound, volume);
            }, delay * 1000);
        });
    }

    /**
     * Play a predefined magical sequence
     */
    playMagicSequence(sequence: MagicSequence) {
        switch (sequence) {
            case 'star_collect':
                this.playSequence([
                    { sound: 'twinkle', delay: 0, volume: 0.8 },
                    { sound: 'sparkle', delay: 0.1, volume: 0.6 },
                    { sound: 'twinkle', delay: 0.25, volume: 0.5 }
                ]);
                break;
            case 'power_up':
                this.playSequence([
                    { sound: 'magic_cast', delay: 0, volume: 0.7 },
                    { sound: 'heart_pop', delay: 0.2, volume: 0.9 },
                    { sound: 'sparkle', delay: 0.35, volume: 0.6 }
                ]);
                break;
            case 'shield_up':
                this.playSequence([
                    { sound: 'boing', delay: 0, volume: 0.8 },
                    { sound: 'whoosh', delay: 0.1, volume: 0.6 },
                    { sound: 'twinkle', delay: 0.3, volume: 0.5 }
                ]);
                break;
            case 'spell_complete':
                this.playSequence([
                    { sound: 'magic_cast', delay: 0, volume: 0.8 },
                    { sound: 'sparkle', delay: 0.15, volume: 0.7 },
                    { sound: 'sparkle', delay: 0.3, volume: 0.6 },
                    { sound: 'twinkle', delay: 0.45, volume: 0.5 },
                    { sound: 'giggle', delay: 0.5, volume: 0.4 }
                ]);
                break;
        }
    }

    /**
     * Play milestone sound (high scores, achievements)
     */
    playMilestone(): void {
        this.playSequence([
            { sound: 'magical_shimmer', delay: 0, volume: 0.8 },
            { sound: 'sparkle_cascade', delay: 0.3, volume: 0.7 },
            { sound: 'choir_ahh', delay: 0.5, volume: 0.6 }
        ]);
    }

    // ========== NEW REACTIVE AUDIO METHODS ==========

    toggleMute(): boolean {
        if (this.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
        return this.isMuted;
    }

    /**
     * Play impact sound based on collision speed
     */
    playImpact(speed: number) {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        const intensity = Math.min(Math.abs(speed) / 22, 1);

        // Voice limit
        if (this.activeVoices >= this.maxVoices) return;
        this.activeVoices++;
        setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 600);

        const now = this.ctx.currentTime;

        // Glass shatter: high-frequency noise burst
        const shatterSize = this.ctx.sampleRate * 0.15;
        const shatterBuffer = this.ctx.createBuffer(1, shatterSize, this.ctx.sampleRate);
        const shatterData = shatterBuffer.getChannelData(0);
        for (let i = 0; i < shatterSize; i++) {
            shatterData[i] = (Math.random() * 2 - 1);
        }
        const shatter = this.ctx.createBufferSource();
        shatter.buffer = shatterBuffer;

        const shatterFilter = this.ctx.createBiquadFilter();
        shatterFilter.type = 'highpass';
        shatterFilter.frequency.value = 2000 + intensity * 3000;

        const shatterGain = this.ctx.createGain();
        shatterGain.gain.setValueAtTime(0, now);
        shatterGain.gain.linearRampToValueAtTime(0.25 * intensity, now + 0.01);
        shatterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        shatter.connect(shatterFilter);
        shatterFilter.connect(shatterGain);
        shatterGain.connect(this.sfxGain);
        if (this.reverbSend) {
            const revGain = this.ctx.createGain();
            revGain.gain.value = 0.15;
            shatterGain.connect(revGain);
            revGain.connect(this.reverbSend);
        }
        shatter.start(now);

        // Low thud: sine sweep down
        const thud = this.ctx.createOscillator();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(150 + intensity * 100, now);
        thud.frequency.exponentialRampToValueAtTime(40, now + 0.3);

        const thudGain = this.ctx.createGain();
        thudGain.gain.setValueAtTime(0, now);
        thudGain.gain.linearRampToValueAtTime(0.3 * (0.5 + intensity * 0.5), now + 0.02);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        thud.connect(thudGain);
        thudGain.connect(this.sfxGain);
        thud.start(now);
        thud.stop(now + 0.35);

        // Volume ducking
        this.applyDuck(0.4, 0.5);
    }

    /**
     * Play collectible pickup sound (ting + dog bark)
     */
    playCollect() {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        // Voice limit
        if (this.activeVoices >= this.maxVoices) return;
        this.activeVoices++;
        setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 500);

        const now = this.ctx.currentTime;

        // Bright "ting"
        const ting = this.ctx.createOscillator();
        ting.type = 'sine';
        ting.frequency.setValueAtTime(880, now);
        ting.frequency.exponentialRampToValueAtTime(1760, now + 0.08);

        const tingGain = this.ctx.createGain();
        tingGain.gain.setValueAtTime(0, now);
        tingGain.gain.linearRampToValueAtTime(0.25, now + 0.01);
        tingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        ting.connect(tingGain);
        tingGain.connect(this.sfxGain);
        if (this.reverbSend) {
            const revGain = this.ctx.createGain();
            revGain.gain.value = 0.25;
            tingGain.connect(revGain);
            revGain.connect(this.reverbSend);
        }
        ting.start(now);
        ting.stop(now + 0.3);

        // Play harmonic sparkle
        setTimeout(() => {
            this.play('sparkle', 0.5, 6);
        }, 50);

        // Cute dog bark: quick pitch drop
        const bark = this.ctx.createOscillator();
        bark.type = 'triangle';
        bark.frequency.setValueAtTime(380, now + 0.08);
        bark.frequency.exponentialRampToValueAtTime(220, now + 0.18);

        const barkGain = this.ctx.createGain();
        barkGain.gain.setValueAtTime(0, now + 0.08);
        barkGain.gain.linearRampToValueAtTime(0.2, now + 0.09);
        barkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        bark.connect(barkGain);
        barkGain.connect(this.sfxGain);
        bark.start(now + 0.08);
        bark.stop(now + 0.22);

        // Duck engine briefly for bark clarity
        this.applyDuck(0.25, 0.55);
    }

    /**
     * Play boost / afterburner activation sound
     */
    playBoost() {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        // Voice limit
        if (this.activeVoices >= this.maxVoices) return;
        this.activeVoices++;
        setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 900);

        const now = this.ctx.currentTime;

        // Rising whoosh: noise with filter sweep up
        const whooshSize = this.ctx.sampleRate * 0.6;
        const whooshBuffer = this.ctx.createBuffer(1, whooshSize, this.ctx.sampleRate);
        const whooshData = whooshBuffer.getChannelData(0);
        for (let i = 0; i < whooshSize; i++) {
            whooshData[i] = (Math.random() * 2 - 1);
        }
        const whoosh = this.ctx.createBufferSource();
        whoosh.buffer = whooshBuffer;

        const whooshFilter = this.ctx.createBiquadFilter();
        whooshFilter.type = 'lowpass';
        whooshFilter.frequency.setValueAtTime(200, now);
        whooshFilter.frequency.linearRampToValueAtTime(2500, now + 0.5);

        const whooshGain = this.ctx.createGain();
        whooshGain.gain.setValueAtTime(0, now);
        whooshGain.gain.linearRampToValueAtTime(0.25, now + 0.1);
        whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        whoosh.connect(whooshFilter);
        whooshFilter.connect(whooshGain);
        whooshGain.connect(this.sfxGain);
        if (this.reverbSend) {
            const revGain = this.ctx.createGain();
            revGain.gain.value = 0.2;
            whooshGain.connect(revGain);
            revGain.connect(this.reverbSend);
        }
        whoosh.start(now);

        // Flame crackle: short noise bursts
        for (let i = 0; i < 4; i++) {
            const crackleSize = this.ctx.sampleRate * 0.08;
            const crackleBuffer = this.ctx.createBuffer(1, crackleSize, this.ctx.sampleRate);
            const crackleData = crackleBuffer.getChannelData(0);
            for (let j = 0; j < crackleSize; j++) {
                crackleData[j] = (Math.random() * 2 - 1);
            }
            const crackle = this.ctx.createBufferSource();
            crackle.buffer = crackleBuffer;

            const crackleFilter = this.ctx.createBiquadFilter();
            crackleFilter.type = 'bandpass';
            crackleFilter.frequency.value = 800 + i * 200;

            const crackleGain = this.ctx.createGain();
            const t = now + 0.05 + i * 0.08;
            crackleGain.gain.setValueAtTime(0, t);
            crackleGain.gain.linearRampToValueAtTime(0.15, t + 0.01);
            crackleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

            crackle.connect(crackleFilter);
            crackleFilter.connect(crackleGain);
            crackleGain.connect(this.sfxGain);
            crackle.start(t);
        }
    }

    /**
     * Play shield activation sound
     */
    playShieldActivate() {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        const now = this.ctx.currentTime;

        // Soft magical chime: bubble pop
        const pop = this.ctx.createOscillator();
        pop.type = 'sine';
        pop.frequency.setValueAtTime(400, now);
        pop.frequency.exponentialRampToValueAtTime(900, now + 0.1);

        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0, now);
        popGain.gain.linearRampToValueAtTime(0.25, now + 0.01);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        pop.connect(popGain);
        popGain.connect(this.sfxGain);
        if (this.reverbSend) {
            const revGain = this.ctx.createGain();
            revGain.gain.value = 0.3;
            popGain.connect(revGain);
            revGain.connect(this.reverbSend);
        }
        pop.start(now);
        pop.stop(now + 0.25);

        // Electric crackle: short noise burst
        const crackleSize = this.ctx.sampleRate * 0.1;
        const crackleBuffer = this.ctx.createBuffer(1, crackleSize, this.ctx.sampleRate);
        const crackleData = crackleBuffer.getChannelData(0);
        for (let i = 0; i < crackleSize; i++) {
            crackleData[i] = (Math.random() * 2 - 1);
        }
        const crackle = this.ctx.createBufferSource();
        crackle.buffer = crackleBuffer;

        const crackleFilter = this.ctx.createBiquadFilter();
        crackleFilter.type = 'highpass';
        crackleFilter.frequency.value = 3000;

        const crackleGain = this.ctx.createGain();
        crackleGain.gain.setValueAtTime(0, now + 0.05);
        crackleGain.gain.linearRampToValueAtTime(0.12, now + 0.06);
        crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        crackle.connect(crackleFilter);
        crackleFilter.connect(crackleGain);
        crackleGain.connect(this.sfxGain);
        crackle.start(now + 0.05);
    }

    /**
     * Play shield break sound
     */
    playShieldBreak() {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        const now = this.ctx.currentTime;

        // Bubble pop
        const pop = this.ctx.createOscillator();
        pop.type = 'sine';
        pop.frequency.setValueAtTime(600, now);
        pop.frequency.exponentialRampToValueAtTime(200, now + 0.12);

        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0, now);
        popGain.gain.linearRampToValueAtTime(0.25, now + 0.01);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        pop.connect(popGain);
        popGain.connect(this.sfxGain);
        pop.start(now);
        pop.stop(now + 0.2);

        // Electric crackle
        this.play('sparkle', 0.4, 6);

        this.applyDuck(0.3, 0.5);
    }

    /**
     * Play bubblegum shield bounce sound — springy cartoon boing
     */
    playBoing() {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        // Voice limit
        if (this.activeVoices >= this.maxVoices) return;
        this.activeVoices++;
        setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 400);

        const now = this.ctx.currentTime;

        // Springy sine sweep: low to high with quick decay
        const boing = this.ctx.createOscillator();
        boing.type = 'sine';
        boing.frequency.setValueAtTime(220, now);
        boing.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        boing.frequency.exponentialRampToValueAtTime(440, now + 0.18);

        const boingGain = this.ctx.createGain();
        boingGain.gain.setValueAtTime(0, now);
        boingGain.gain.linearRampToValueAtTime(0.3, now + 0.02);
        boingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        boing.connect(boingGain);
        boingGain.connect(this.sfxGain);
        if (this.reverbSend) {
            const revGain = this.ctx.createGain();
            revGain.gain.value = 0.2;
            boingGain.connect(revGain);
            revGain.connect(this.reverbSend);
        }
        boing.start(now);
        boing.stop(now + 0.35);

        // Tiny noise burst for "spring" texture
        const noiseSize = Math.floor(this.ctx.sampleRate * 0.05);
        const noiseBuffer = this.ctx.createBuffer(1, noiseSize, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseSize; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseSize);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 1200;
        noiseFilter.Q.value = 2;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.01);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);
        noise.start(now);
    }

    /**
     * Play rainbow comet tail activation sound
     */
    playCometActivate() {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        // Voice limit
        if (this.activeVoices >= this.maxVoices) return;
        this.activeVoices++;
        setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 1200);

        const now = this.ctx.currentTime;

        // Magical ascending arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
        notes.forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.08);

            gain.gain.setValueAtTime(0, now + i * 0.08);
            gain.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.5);

            osc.connect(gain);
            gain.connect(this.sfxGain!);

            // Reverb send
            if (this.reverbSend) {
                const revGain = this.ctx!.createGain();
                revGain.gain.value = 0.25;
                gain.connect(revGain);
                revGain.connect(this.reverbSend);
            }

            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.5);
        });

        // Sparkle shimmer
        setTimeout(() => {
            this.play('sparkle_cascade', 0.6);
        }, 400);
    }

    /**
     * Play barrel roll sound: sharp whoosh + metallic spin
     */
    playRoll() {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        // Voice limit
        if (this.activeVoices >= this.maxVoices) return;
        this.activeVoices++;
        setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 700);

        const now = this.ctx.currentTime;

        // Sharp whoosh: noise burst with highpass sweep
        const whooshSize = this.ctx.sampleRate * 0.35;
        const whooshBuffer = this.ctx.createBuffer(1, whooshSize, this.ctx.sampleRate);
        const whooshData = whooshBuffer.getChannelData(0);
        for (let i = 0; i < whooshSize; i++) {
            whooshData[i] = (Math.random() * 2 - 1);
        }
        const whoosh = this.ctx.createBufferSource();
        whoosh.buffer = whooshBuffer;

        const whooshFilter = this.ctx.createBiquadFilter();
        whooshFilter.type = 'highpass';
        whooshFilter.frequency.setValueAtTime(800, now);
        whooshFilter.frequency.exponentialRampToValueAtTime(3000, now + 0.2);

        const whooshGain = this.ctx.createGain();
        whooshGain.gain.setValueAtTime(0, now);
        whooshGain.gain.linearRampToValueAtTime(0.3, now + 0.02);
        whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        whoosh.connect(whooshFilter);
        whooshFilter.connect(whooshGain);
        whooshGain.connect(this.sfxGain);
        if (this.reverbSend) {
            const revGain = this.ctx.createGain();
            revGain.gain.value = 0.2;
            whooshGain.connect(revGain);
            revGain.connect(this.reverbSend);
        }
        whoosh.start(now);

        // Metallic spin: FM-like tone with fast frequency wobble
        const spin = this.ctx.createOscillator();
        spin.type = 'sawtooth';
        spin.frequency.setValueAtTime(300, now);
        spin.frequency.linearRampToValueAtTime(800, now + 0.1);
        spin.frequency.linearRampToValueAtTime(400, now + 0.25);

        const spinGain = this.ctx.createGain();
        spinGain.gain.setValueAtTime(0, now);
        spinGain.gain.linearRampToValueAtTime(0.15, now + 0.02);
        spinGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        const spinFilter = this.ctx.createBiquadFilter();
        spinFilter.type = 'bandpass';
        spinFilter.frequency.value = 1200;
        spinFilter.Q.value = 2.0;

        spin.connect(spinFilter);
        spinFilter.connect(spinGain);
        spinGain.connect(this.sfxGain);
        spin.start(now);
        spin.stop(now + 0.4);

        // Low rumble during roll
        const rumble = this.ctx.createOscillator();
        rumble.type = 'sine';
        rumble.frequency.setValueAtTime(50, now);
        rumble.frequency.linearRampToValueAtTime(80, now + 0.15);
        rumble.frequency.linearRampToValueAtTime(50, now + 0.3);

        const rumbleGain = this.ctx.createGain();
        rumbleGain.gain.setValueAtTime(0, now);
        rumbleGain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        rumble.connect(rumbleGain);
        rumbleGain.connect(this.sfxGain);
        rumble.start(now);
        rumble.stop(now + 0.35);
    }

    /**
     * Play tether latch sound — low thud + rising energy hum
     */
    playTetherLatch() {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        if (this.activeVoices >= this.maxVoices) return;
        this.activeVoices++;
        setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 500);

        const now = this.ctx.currentTime;

        // Impact thud: low sine burst
        const thud = this.ctx.createOscillator();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(120, now);
        thud.frequency.exponentialRampToValueAtTime(55, now + 0.18);

        const thudGain = this.ctx.createGain();
        thudGain.gain.setValueAtTime(0.55, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        thud.connect(thudGain);
        thudGain.connect(this.sfxGain);
        thud.start(now);
        thud.stop(now + 0.22);

        // Rising energy hum
        const hum = this.ctx.createOscillator();
        hum.type = 'sawtooth';
        hum.frequency.setValueAtTime(200, now + 0.05);
        hum.frequency.linearRampToValueAtTime(420, now + 0.35);

        const humFilter = this.ctx.createBiquadFilter();
        humFilter.type = 'bandpass';
        humFilter.frequency.value = 320;
        humFilter.Q.value = 3;

        const humGain = this.ctx.createGain();
        humGain.gain.setValueAtTime(0, now + 0.05);
        humGain.gain.linearRampToValueAtTime(0.12, now + 0.12);
        humGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        hum.connect(humFilter);
        humFilter.connect(humGain);
        humGain.connect(this.sfxGain);
        hum.start(now + 0.05);
        hum.stop(now + 0.45);
    }

    /**
     * Play tether release / sling whoosh — fast rising broadband sweep
     */
    playTetherRelease() {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        if (this.activeVoices >= this.maxVoices) return;
        this.activeVoices++;
        setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 600);

        const now = this.ctx.currentTime;

        // Fast rising broadband whoosh
        const bufSize = Math.floor(this.ctx.sampleRate * 0.5);
        const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

        const src = this.ctx.createBufferSource();
        src.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(250, now);
        filter.frequency.exponentialRampToValueAtTime(3500, now + 0.4);
        filter.Q.value = 1.8;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        if (this.reverbSend) {
            const revGain = this.ctx.createGain();
            revGain.gain.value = 0.25;
            gain.connect(revGain);
            revGain.connect(this.reverbSend);
        }
        src.start(now);
    }

    /**
     * Play graze / near-miss sound — bright, quick, satisfying chirp
     */
    playGraze(combo: number = 1) {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        // Voice limit — grazes can be frequent, so be selective at high combo
        if (this.activeVoices >= this.maxVoices && combo < 3) return;
        this.activeVoices++;
        setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 200);

        const now = this.ctx.currentTime;

        // Pitch rises slightly with combo
        const baseFreq = 1200 + Math.min(combo * 80, 600);

        // Bright chirp: short sine sweep up
        const chirp = this.ctx.createOscillator();
        chirp.type = 'sine';
        chirp.frequency.setValueAtTime(baseFreq, now);
        chirp.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.06);

        const chirpGain = this.ctx.createGain();
        chirpGain.gain.setValueAtTime(0, now);
        chirpGain.gain.linearRampToValueAtTime(0.2, now + 0.01);
        chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        chirp.connect(chirpGain);
        chirpGain.connect(this.sfxGain);
        if (this.reverbSend) {
            const revGain = this.ctx.createGain();
            revGain.gain.value = 0.15;
            chirpGain.connect(revGain);
            revGain.connect(this.reverbSend);
        }
        chirp.start(now);
        chirp.stop(now + 0.12);

        // Tiny sparkle overtone at high combos
        if (combo >= 3) {
            const overtone = this.ctx.createOscillator();
            overtone.type = 'triangle';
            overtone.frequency.setValueAtTime(baseFreq * 2, now + 0.02);
            const otGain = this.ctx.createGain();
            otGain.gain.setValueAtTime(0, now + 0.02);
            otGain.gain.linearRampToValueAtTime(0.08, now + 0.03);
            otGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            overtone.connect(otGain);
            otGain.connect(this.sfxGain);
            overtone.start(now + 0.02);
            overtone.stop(now + 0.1);
        }
    }

    /**
     * Apply temporary volume ducking to engine and music
     */
    private applyDuck(duration: number, amount: number) {
        if (this.isDucked || !this.ctx) return;
        this.isDucked = true;

        const now = this.ctx.currentTime;

        if (this.engineMasterGain) {
            this.engineMasterGain.gain.setTargetAtTime(amount, now, 0.05);
        }
        if (this.musicGain) {
            this.musicGain.gain.setTargetAtTime(this.musicVolume * amount, now, 0.05);
        }

        setTimeout(() => {
            if (this.engineMasterGain) {
                this.engineMasterGain.gain.setTargetAtTime(1.0, now + duration, 0.1);
            }
            if (this.musicGain) {
                this.musicGain.gain.setTargetAtTime(this.musicVolume, now + duration, 0.1);
            }
            this.isDucked = false;
        }, duration * 1000);
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopEngine();
        this.stopHover();
        this.stopDrone();
        
        // Stop all music layers
        this.musicLayers.forEach(layer => {
            layer.oscillators.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {}
            });
            if (layer.gain) {
                layer.gain.disconnect();
            }
        });
        this.musicLayers.clear();

        // Clear intervals
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
        }
        if (this.magicMusicTimeout) {
            clearTimeout(this.magicMusicTimeout);
        }

        // Cleanup spatial sounds
        this.spatialSounds.forEach(sound => {
            if (sound.panner) sound.panner.disconnect();
        });
        this.spatialSounds.clear();

        // Close context
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
    }
}

// Singleton instance
let audioSystem: AudioSystem | null = null;

export function getAudioSystem(): AudioSystem {
    if (!audioSystem) {
        audioSystem = new AudioSystem();
    }
    return audioSystem;
}

export function initAudioOnInteraction() {
    const handler = () => {
        const audio = getAudioSystem();
        audio.resume();
        audio.startEngine();
        audio.startDrone(0.3);
        audio.startBackgroundMusic(); // Start new layered music system
        
        // Remove listeners after first interaction
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', handler);
    };
    
    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
}
