import * as THREE from 'three';
import type { SoundType, MagicSequence, SoundConfig, MusicLayer } from '../types';
import { bindMixin } from '../types';

export const engineSoundsMixin = bindMixin({
startEngine() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.engineActive) return;
    this.startEngineLayers();
},

startEngineLayers() {
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
},

updateEngine(speedY: number) {
    this.updateEngineState(speedY, false, false);
},

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
        // Tie pitch distinctly: diving (speedY < 0) drops pitch to simulate deep boom/sweep
        const baseFreq = isBoosting ? 80 + absSpeed * 2.5 : (currentSpeedY < -10 ? 30 + (22 - absSpeed) * 1.5 : 55 + absSpeed * 1.8);
        this.engineDroneNode.frequency.setTargetAtTime(baseFreq, now, currentSpeedY < -10 ? 0.3 : 0.1);
    }
    if (this.engineBaseGain) {
        let baseVol = 0.035 + speedRatio * 0.035;
        if (isMovingUp) baseVol += 0.015;
        if (isBoosting) baseVol += 0.025;
        // distinct boom for fast diving
        if (currentSpeedY < -15) baseVol += 0.04;
        this.engineBaseGain.gain.setTargetAtTime(baseVol, now, 0.1);
    }

    // Thrust layer: brighter when moving up or boosting
    if (this.engineThrustNode) {
        const thrustFreq = isBoosting ? 400 + absSpeed * 8
            : (isMovingUp ? 240 + absSpeed * 6 : (currentSpeedY < -10 ? 60 : 140));
        this.engineThrustNode.frequency.setTargetAtTime(thrustFreq, now, 0.1);
    }
    if (this.engineThrustGain) {
        let thrustVol = 0;
        if (isBoosting) {
            thrustVol = 0.1 + speedRatio * 0.06;
        } else if (isMovingUp) {
            thrustVol = 0.05 + speedRatio * 0.04;
        } else if (currentSpeedY < -15) {
            // sonic boom resonance
            thrustVol = 0.06;
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
        } else if (currentSpeedY < -10) {
            whooshVol = 0.05 + (absSpeed - 10) * 0.015; // distinct sweep
        } else if (absSpeed > 12) {
            whooshVol = 0.015;
        }
        this.engineWhooshGain.gain.setTargetAtTime(Math.min(whooshVol, 0.2), now, 0.1);
    }

    // Whoosh pitch tracks thrust strength, so hard thrust reads as *harder*
    // rather than just louder. Dives pitch down into a rush instead.
    if (this.engineWhooshNode) {
        const thrustStrength = isBoosting ? 1 : (isMovingUp ? 0.55 : 0);
        const divePitch = currentSpeedY < -10 ? -0.25 * speedRatio : 0;
        const rate = 0.85 + thrustStrength * 0.5 + speedRatio * 0.2 + divePitch;
        this.engineWhooshNode.playbackRate.setTargetAtTime(
            Math.max(0.5, Math.min(2, rate)),
            now,
            0.12
        );
    }

    // Filter opens wide when boosting or thrusting, or creates a deep sweep when diving
    if (this.engineFilter) {
        const filterFreq = isBoosting
            ? 1200 + absSpeed * 40
            : (isMovingUp ? 700 + absSpeed * 25 : (currentSpeedY < -10 ? 150 + absSpeed * 5 : 450));
        this.engineFilter.frequency.setTargetAtTime(filterFreq, now, currentSpeedY < -10 ? 0.4 : 0.2);
    }
},

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
},

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
},

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
},

playWhoosh(speed: number): void {
    const volume = Math.min(speed / 10, 1) * 0.5;
    this.play('whoosh', volume);
},

playFlora(size: number, energy: number): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    // Voice limit check for manual nodes (FM needs 2 nodes)
    const now = this.ctx.currentTime;
    this.activeVoiceNodes = this.activeVoiceNodes.filter(v => v.endTime > now);
    if (this.activeVoiceNodes.length >= this.maxVoices - 1) return;

    // Carrier oscillator
    const carrier = this.ctx.createOscillator();
    const carrierGain = this.ctx.createGain();
    
    // Modulator oscillator
    const modulator = this.ctx.createOscillator();
    const modulatorGain = this.ctx.createGain();

    // Base frequency varies by flora size (smaller = higher pitch)
    const baseFreq = 400 + (1.0 - size) * 800;
    
    // FM Synthesis setup
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(baseFreq, now);

    modulator.type = 'sine';
    // The harmonicity ratio (modulator freq / carrier freq)
    // Adjust based on energy for different timbers (bell-like vs metallic)
    const ratio = 1.414 + energy * 0.5; 
    modulator.frequency.setValueAtTime(baseFreq * ratio, now);

    // Modulation index (depth)
    const modulationIndex = 2 + energy * 3;
    modulatorGain.gain.setValueAtTime(baseFreq * ratio * modulationIndex, now);

    // Connect modulator to carrier frequency
    modulator.connect(modulatorGain);
    modulatorGain.connect(carrier.frequency);

    // Envelope for carrier (the actual sound envelope)
    const duration = 0.5 + size * 0.5;
    carrierGain.gain.setValueAtTime(0, now);
    carrierGain.gain.linearRampToValueAtTime(0.2 + energy * 0.1, now + 0.05);
    carrierGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Routing
    carrier.connect(carrierGain);
    carrierGain.connect(this.sfxGain);

    if (this.reverbSend) {
        const revGain = this.ctx.createGain();
        revGain.gain.value = 0.3;
        carrierGain.connect(revGain);
        revGain.connect(this.reverbSend);
    }

    // Start/Stop
    carrier.start(now);
    modulator.start(now);
    carrier.stop(now + duration);
    modulator.stop(now + duration);

    // Track voices
    this.activeVoiceNodes.push({
        osc: carrier,
        gain: carrierGain,
        priority: 6,
        endTime: now + duration + 0.1
    });
    this.activeVoiceNodes.push({
        osc: modulator,
        gain: modulatorGain,
        priority: 6,
        endTime: now + duration + 0.1
    });
},

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
},

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
},

updateDroneIntensity(intensity: number) {
    if (!this.ctx || !this.droneGain) return;
    this.droneGain.gain.setTargetAtTime(
        0.05 * intensity, 
        this.ctx.currentTime, 
        0.5
    );
},

stopDrone() {
    if (!this.droneNode) return;
    this.droneNode.stop();
    this.droneNode.disconnect();
    if (this.droneGain) this.droneGain.disconnect();
    this.droneNode = null;
    this.droneGain = null;
},

setVolume(volume: number) {
    this.setMasterVolume(volume);
},

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
},

playSequence(sequence: Array<{ sound: SoundType; delay: number; volume?: number }>) {
    this.init();
    if (!this.ctx) return;

    sequence.forEach(({ sound, delay, volume = 1 }) => {
        setTimeout(() => {
            this.play(sound, volume);
        }, delay * 1000);
    });
},

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
},

playMilestone(): void {
    this.playSequence([
        { sound: 'magical_shimmer', delay: 0, volume: 0.8 },
        { sound: 'sparkle_cascade', delay: 0.3, volume: 0.7 },
        { sound: 'choir_ahh', delay: 0.5, volume: 0.6 }
    ]);
}
});
