import * as THREE from 'three';
import type { SoundType, SoundConfig } from '../types';
import { bindMixin } from '../types';

export const spatialAudioMixin = bindMixin({
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
},

createPanner(): PannerNode | null {
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
},

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
},

playToneWithPanner(config: SoundConfig, volumeMultiplier: number, panner: PannerNode): void {
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
},

playHarmonicWithPanner(
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
},

playNoiseWithPanner(config: SoundConfig, volumeMultiplier: number, panner: PannerNode): void {
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
},

playApproachTwinkle(distance: number, maxDistance: number = 500): void {
    if (distance > maxDistance) return;

    const normalizedDist = 1 - (distance / maxDistance);
    const volume = normalizedDist * 0.3;

    // Only play occasionally
    if (Math.random() < normalizedDist * 0.3) {
        this.play('wind_chime', volume);
    }
},

playCrystalChime(notes: number[], volume = 0.32, pitchShift = 1.0): void {
    this.init();
    if (!this.ctx || !this.sfxGain || notes.length === 0) return;

    notes.forEach((freq, i) => {
        const delay = i * 0.065;
        const noteVol = volume * (1 - i * 0.07);

        setTimeout(() => {
            if (!this.ctx || !this.sfxGain) return;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const noteFreq = Math.max(80, freq * pitchShift);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(noteFreq, this.ctx.currentTime);

            const harm = this.ctx.createOscillator();
            const harmGain = this.ctx.createGain();
            harm.type = 'sine';
            harm.frequency.setValueAtTime(noteFreq * 2.01, this.ctx.currentTime);
            harmGain.gain.setValueAtTime(0, this.ctx.currentTime);
            harmGain.gain.linearRampToValueAtTime(noteVol * 0.12, this.ctx.currentTime + 0.02);
            harmGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.4);

            const duration = 1.1 + i * 0.08;
            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(noteVol, this.ctx.currentTime + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            osc.connect(gain);
            harm.connect(harmGain);
            gain.connect(this.sfxGain);
            harmGain.connect(this.sfxGain);

            if (this.reverbSend) {
                const rev = this.ctx.createGain();
                rev.gain.value = 0.22;
                gain.connect(rev);
                rev.connect(this.reverbSend);
                harmGain.connect(rev);
            }

            osc.start(this.ctx.currentTime);
            harm.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + duration);
            harm.stop(this.ctx.currentTime + duration);
        }, delay * 1000);
    });
}
});
