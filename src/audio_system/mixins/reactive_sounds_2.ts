import * as THREE from 'three';
import { bindMixin } from '../types';

export const reactiveSoundsMixin2 = bindMixin({
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
},

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
},

playSlingCharge(combo: number = 1) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    if (this.activeVoices >= this.maxVoices) return;
    this.activeVoices++;
    setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 400);

    const now = this.ctx.currentTime;

    // Base pitch rises with combo (220 Hz at ×1, up to ~660 Hz at ×7+)
    const baseFreq = Math.min(220 + combo * 60, 660);
    const gainAmt = Math.min(0.08 + combo * 0.015, 0.22);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 0.95, now);
    osc.frequency.linearRampToValueAtTime(baseFreq, now + 0.18);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.08, now + 0.35);

    // Harmonic overtone for richness
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 2, now);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gainAmt, now + 0.06);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    const gainNode2 = this.ctx.createGain();
    gainNode2.gain.setValueAtTime(0, now);
    gainNode2.gain.linearRampToValueAtTime(gainAmt * 0.35, now + 0.06);
    gainNode2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gainNode);
    gainNode.connect(this.sfxGain);
    osc2.connect(gainNode2);
    gainNode2.connect(this.sfxGain);

    if (this.reverbSend) {
        const revGain = this.ctx.createGain();
        revGain.gain.value = 0.3;
        gainNode.connect(revGain);
        revGain.connect(this.reverbSend);
    }

    osc.start(now);
    osc.stop(now + 0.4);
    osc2.start(now);
    osc2.stop(now + 0.3);
},

playSlingArcSurge() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    if (this.activeVoices >= this.maxVoices) return;
    this.activeVoices++;
    setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 900);

    const now = this.ctx.currentTime;

    // ── Low-end WHUMP ──────────────────────────────────────────────────
    const wumpOsc = this.ctx.createOscillator();
    wumpOsc.type = 'sine';
    wumpOsc.frequency.setValueAtTime(80, now);
    wumpOsc.frequency.exponentialRampToValueAtTime(28, now + 0.35);

    const wumpGain = this.ctx.createGain();
    wumpGain.gain.setValueAtTime(0.55, now);
    wumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    wumpOsc.connect(wumpGain);
    wumpGain.connect(this.sfxGain);
    wumpOsc.start(now);
    wumpOsc.stop(now + 0.38);

    // ── Soaring WHOOSH ─────────────────────────────────────────────────
    const bufSize = Math.floor(this.ctx.sampleRate * 0.75);
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = buffer;

    const whooshFilter = this.ctx.createBiquadFilter();
    whooshFilter.type = 'bandpass';
    whooshFilter.frequency.setValueAtTime(200, now + 0.05);
    whooshFilter.frequency.exponentialRampToValueAtTime(5000, now + 0.7);
    whooshFilter.Q.value = 1.4;

    const whooshGain = this.ctx.createGain();
    whooshGain.gain.setValueAtTime(0, now + 0.05);
    whooshGain.gain.linearRampToValueAtTime(0.4, now + 0.15);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    noiseSrc.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(this.sfxGain);

    if (this.reverbSend) {
        const revGain = this.ctx.createGain();
        revGain.gain.value = 0.5;
        whooshGain.connect(revGain);
        revGain.connect(this.reverbSend);
    }

    noiseSrc.start(now + 0.05);

    // ── Resonant rising tone — the "surge" identity ────────────────────
    const surgeOsc = this.ctx.createOscillator();
    surgeOsc.type = 'sawtooth';
    surgeOsc.frequency.setValueAtTime(180, now + 0.1);
    surgeOsc.frequency.exponentialRampToValueAtTime(900, now + 0.7);

    const surgeFilter = this.ctx.createBiquadFilter();
    surgeFilter.type = 'lowpass';
    surgeFilter.frequency.setValueAtTime(400, now + 0.1);
    surgeFilter.frequency.exponentialRampToValueAtTime(4000, now + 0.7);

    const surgeGain = this.ctx.createGain();
    surgeGain.gain.setValueAtTime(0, now + 0.1);
    surgeGain.gain.linearRampToValueAtTime(0.2, now + 0.25);
    surgeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    surgeOsc.connect(surgeFilter);
    surgeFilter.connect(surgeGain);
    surgeGain.connect(this.sfxGain);
    surgeOsc.start(now + 0.1);
    surgeOsc.stop(now + 0.8);
},

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
},

playSealClap() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    if (this.activeVoices >= this.maxVoices) return;
    this.activeVoices++;
    setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 300);

    const now = this.ctx.currentTime;

    // Two quick padded taps
    for (let i = 0; i < 2; i++) {
        const tap = this.ctx.createOscillator();
        tap.type = 'triangle';
        const t = now + i * 0.07;
        tap.frequency.setValueAtTime(320 - i * 40, t);
        tap.frequency.exponentialRampToValueAtTime(180, t + 0.05);

        const tapGain = this.ctx.createGain();
        tapGain.gain.setValueAtTime(0, t);
        tapGain.gain.linearRampToValueAtTime(0.18, t + 0.008);
        tapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        tap.connect(tapGain);
        tapGain.connect(this.sfxGain);
        tap.start(t);
        tap.stop(t + 0.07);
    }

    // Cute arf overtone
    const arf = this.ctx.createOscillator();
    arf.type = 'sine';
    arf.frequency.setValueAtTime(420, now + 0.1);
    arf.frequency.exponentialRampToValueAtTime(280, now + 0.22);

    const arfGain = this.ctx.createGain();
    arfGain.gain.setValueAtTime(0, now + 0.1);
    arfGain.gain.linearRampToValueAtTime(0.12, now + 0.11);
    arfGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    arf.connect(arfGain);
    arfGain.connect(this.sfxGain);
    arf.start(now + 0.1);
    arf.stop(now + 0.25);
},

applyDuck(duration: number, amount: number) {
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
},

/**
 * Dog bark variants — the space dog's voice, so repeated barks in one run
 * don't sound like a copy-paste. Procedural: pitch, count and spacing only.
 *
 * - `happy`   two rising yips (collect, greeting)
 * - `alert`   one sharp bark (danger, warning)
 * - `excited` three fast rising yips (combo, victory)
 * - `grumble` a low short woof (damage, grump)
 */
playDogBarkVariant(kind: 'happy' | 'alert' | 'excited' | 'grumble' = 'happy'): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const shapes: Record<string, { count: number; pitch: number; gap: number; volume: number }> = {
        happy:   { count: 2, pitch: 1.12, gap: 0.13, volume: 0.9 },
        alert:   { count: 1, pitch: 1.35, gap: 0.0,  volume: 1.1 },
        excited: { count: 3, pitch: 1.25, gap: 0.09, volume: 0.85 },
        grumble: { count: 1, pitch: 0.72, gap: 0.0,  volume: 0.8 }
    };
    const shape = shapes[kind] ?? shapes.happy;
    const config = this.soundConfigs.dog_bark;

    for (let i = 0; i < shape.count; i++) {
        const start = this.ctx.currentTime + i * shape.gap;
        // Each yip in a burst lifts slightly, the way a real yip-yip does.
        const freq = config.frequency * shape.pitch * (1 + i * 0.06);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = config.waveform;
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(
            Math.max(40, freq + (config.slide ?? -160)),
            start + config.duration
        );

        const peak = config.volume * shape.volume * this.sfxVolume;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + config.duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(start);
        osc.stop(start + config.duration + 0.05);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
}
});
