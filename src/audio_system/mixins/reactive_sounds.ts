import * as THREE from 'three';
import { bindMixin } from '../types';

export const reactiveSoundsMixin = bindMixin({
toggleMute(): boolean {
    if (this.isMuted) {
        this.unmute();
    } else {
        this.mute();
    }
    return this.isMuted;
},

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
},

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
},

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
},

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
},

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
},

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
},

playWhaleSong() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    if (this.activeVoices >= this.maxVoices) return;
    this.activeVoices++;
    const duration = 4.5;
    setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, duration * 1000);

    const now = this.ctx.currentTime;

    // Low fundamental "moan" with a gentle pitch glide
    const fundamental = this.ctx.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(85, now);
    fundamental.frequency.linearRampToValueAtTime(110, now + duration * 0.5);
    fundamental.frequency.linearRampToValueAtTime(75, now + duration);

    // Higher overtone for the "cry" character
    const overtone = this.ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(85 * 2.5, now);
    overtone.frequency.linearRampToValueAtTime(110 * 2.5, now + duration * 0.5);
    overtone.frequency.linearRampToValueAtTime(75 * 2.5, now + duration);

    const fundamentalGain = this.ctx.createGain();
    fundamentalGain.gain.setValueAtTime(0, now);
    fundamentalGain.gain.linearRampToValueAtTime(0.18, now + duration * 0.3);
    fundamentalGain.gain.linearRampToValueAtTime(0.18, now + duration * 0.7);
    fundamentalGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.setValueAtTime(0, now);
    overtoneGain.gain.linearRampToValueAtTime(0.05, now + duration * 0.35);
    overtoneGain.gain.linearRampToValueAtTime(0.05, now + duration * 0.65);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    fundamental.connect(fundamentalGain);
    overtone.connect(overtoneGain);
    fundamentalGain.connect(this.sfxGain);
    overtoneGain.connect(this.sfxGain);

    if (this.reverbSend) {
        fundamentalGain.connect(this.reverbSend);
        overtoneGain.connect(this.reverbSend);
    }

    fundamental.start(now);
    overtone.start(now);
    fundamental.stop(now + duration);
    overtone.stop(now + duration);
},

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
},

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
});
