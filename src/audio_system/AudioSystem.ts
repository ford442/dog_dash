/**
 * Audio System for Dog Dash
 */
import * as THREE from 'three';
import type { SoundType, SoundConfig, MusicLayer, SpatialSound, MusicState, MagicSequence } from './types';
import { SOUND_CONFIGS } from './sound_configs';
import { musicLayerMixin } from './mixins/music_layers';
import { proceduralMusicMixin } from './mixins/procedural_music';
import { spatialAudioMixin } from './mixins/spatial_audio';
import { mixingMixin } from './mixins/mixing';
import { engineSoundsMixin } from './mixins/engine_sounds';
import { reactiveSoundsMixin } from './mixins/reactive_sounds';
import { reactiveSoundsMixin2 } from './mixins/reactive_sounds_2';
import { gravityAudioMixin } from './mixins/gravity_audio';
import { cleanupMixin } from './mixins/cleanup';

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
    private readonly maxVoices: number = 32;
    private activeVoiceNodes: Array<{ osc?: OscillatorNode, source?: AudioBufferSourceNode, gain: GainNode, priority: number, endTime: number, timeoutId?: any }> = [];
    
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
    
    // ========== GRAVITY HUM ==========
    private gravHumOsc: OscillatorNode | null = null;
    private gravHumNoise: AudioBufferSourceNode | null = null;
    private gravHumNoiseFilter: BiquadFilterNode | null = null;
    private gravHumGain: GainNode | null = null;
    private gravHumActive: boolean = false;
    
    private droneNode: OscillatorNode | null = null;
    private droneGain: GainNode | null = null;
    private soundConfigs: Record<SoundType, SoundConfig> = SOUND_CONFIGS;

    constructor() {
        // Lazy init - create context on first user interaction
    }

    init() {
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

    resume() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(type: SoundType, volumeMultiplier: number = 1, priority: number = 5) {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        const config = this.soundConfigs[type];
        if (!config) return;

        // Cleanup expired voices
        const now = this.ctx.currentTime;
        this.activeVoiceNodes = this.activeVoiceNodes.filter(v => v.endTime > now);
        this.activeVoices = this.activeVoiceNodes.length;

        // Voice limiting: stop lowest priority sound if at capacity
        if (this.activeVoices >= this.maxVoices) {
            // Find lowest priority voice
            let lowestIdx = -1;
            let lowestPri = priority;
            for (let i = 0; i < this.activeVoiceNodes.length; i++) {
                if (this.activeVoiceNodes[i].priority < lowestPri) {
                    lowestIdx = i;
                    lowestPri = this.activeVoiceNodes[i].priority;
                }
            }

            if (lowestIdx !== -1) {
                // Stop it
                const voice = this.activeVoiceNodes[lowestIdx];
                if (voice.osc) { try { voice.osc.stop(); } catch(e){} voice.osc.disconnect(); }
                if (voice.source) { try { voice.source.stop(); } catch(e){} voice.source.disconnect(); }
                voice.gain.disconnect();
                if (voice.timeoutId) clearTimeout(voice.timeoutId);
                this.activeVoiceNodes.splice(lowestIdx, 1);
                this.activeVoices--;
            } else {
                // If this sound is lower priority than everything playing, skip it
                return;
            }
        }
        
        this.activeVoices++;

        const durationSecs = (config.decay || config.duration);

        if (config.noise) {
            this.playNoise(config, volumeMultiplier, priority, durationSecs);
        } else {
            this.playTone(config, volumeMultiplier, priority, durationSecs);
        }
    }

    playTone(config: SoundConfig, volumeMultiplier: number, priority: number, durationSecs: number) {
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
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(
            config.volume * volumeMultiplier, 
            this.ctx.currentTime + 0.01
        );
        gain.gain.exponentialRampToValueAtTime(
            0.001, 
            this.ctx.currentTime + durationSecs
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

        const voiceEntry = {
            osc,
            gain,
            priority,
            endTime: this.ctx.currentTime + durationSecs + 0.1,
            timeoutId: setTimeout(() => {
                osc.disconnect();
                gain.disconnect();
            }, durationSecs * 1000 + 100)
        };
        this.activeVoiceNodes.push(voiceEntry);

        // Play harmonics for magical sounds
        if (config.harmonics) {
            config.harmonics.forEach((harmonicFreq, index) => {
                this.playHarmonic(harmonicFreq, config, volumeMultiplier, index * 0.02, priority, durationSecs);
            });
        }
    }

    playHarmonic(frequency: number, config: SoundConfig, volumeMultiplier: number, delay: number, priority: number, baseDurationSecs: number) {
        if (!this.ctx || !this.sfxGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime + delay);

        const harmonicVolume = config.volume * volumeMultiplier * 0.3;
        const decay = baseDurationSecs * 0.8;

        gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(harmonicVolume, this.ctx.currentTime + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + decay);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(this.ctx.currentTime + delay);
        osc.stop(this.ctx.currentTime + config.duration + delay);

        const voiceEntry = {
            osc,
            gain,
            priority: priority - 1, // Harmonics are lower priority
            endTime: this.ctx.currentTime + config.duration + delay + 0.1,
            timeoutId: setTimeout(() => {
                osc.disconnect();
                gain.disconnect();
            }, (config.duration + delay) * 1000 + 100)
        };
        this.activeVoiceNodes.push(voiceEntry);
    }

    playNoise(config: SoundConfig, volumeMultiplier: number, priority: number, durationSecs: number) {
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

        const voiceEntry = {
            source: noise,
            gain,
            priority,
            endTime: this.ctx.currentTime + config.duration + 0.1,
            timeoutId: setTimeout(() => {
                noise.disconnect();
                gain.disconnect();
            }, config.duration * 1000 + 100)
        };
        this.activeVoiceNodes.push(voiceEntry);
    }

}

Object.assign(
    AudioSystem.prototype,
    musicLayerMixin,
    proceduralMusicMixin,
    spatialAudioMixin,
    mixingMixin,
    engineSoundsMixin,
    reactiveSoundsMixin,
    reactiveSoundsMixin2,
    gravityAudioMixin,
    cleanupMixin,
);
