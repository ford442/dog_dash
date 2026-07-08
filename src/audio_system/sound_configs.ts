import type { SoundType, SoundConfig } from './types';

export const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
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
    };;
