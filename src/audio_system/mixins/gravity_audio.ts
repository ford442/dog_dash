import * as THREE from 'three';
import type { SoundType, MagicSequence, MusicState, SoundConfig, MusicLayer } from '../types';

export const gravityAudioMixin = {
startGravityHum(): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    if (this.gravHumActive) return;

    this.gravHumActive = true;
    const now = this.ctx.currentTime;

    // Master gain for the whole hum voice
    this.gravHumGain = this.ctx.createGain();
    this.gravHumGain.gain.setValueAtTime(0, now);
    this.gravHumGain.connect(this.sfxGain);

    // Sine fundamental — gravitational resonance
    this.gravHumOsc = this.ctx.createOscillator();
    this.gravHumOsc.type = 'sine';
    this.gravHumOsc.frequency.setValueAtTime(60, now);
    this.gravHumOsc.connect(this.gravHumGain);
    this.gravHumOsc.start(now);

    // Pink-ish noise texture for "mass presence"
    const noiseLen = Math.floor(this.ctx.sampleRate * 2);
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < noiseLen; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        nd[i] = (b0 + b1 + b2 + white * 0.0168980) * 0.11;
    }
    this.gravHumNoise = this.ctx.createBufferSource();
    this.gravHumNoise.buffer = noiseBuf;
    this.gravHumNoise.loop = true;

    this.gravHumNoiseFilter = this.ctx.createBiquadFilter();
    this.gravHumNoiseFilter.type = 'lowpass';
    this.gravHumNoiseFilter.frequency.value = 120;
    this.gravHumNoiseFilter.Q.value = 3.0;

    this.gravHumNoise.connect(this.gravHumNoiseFilter);
    this.gravHumNoiseFilter.connect(this.gravHumGain);
    this.gravHumNoise.start(now);

    // Fade in
    this.gravHumGain.gain.linearRampToValueAtTime(0.08, now + 0.6);
},

updateGravityHum(distance: number, angularSpeed: number): void {
    if (!this.ctx || !this.gravHumActive || !this.gravHumOsc || !this.gravHumGain) return;

    const fieldRadius = 40; // matches GA_FIELD_RADIUS in geological.ts
    const proximity = Math.max(0, 1 - distance / fieldRadius); // 0 at edge, 1 at core

    // Pitch: 60 Hz at edge → ~160 Hz near core; boosted by angular speed
    const basePitch = 60 + proximity * 80 + Math.min(angularSpeed * 20, 40);
    this.gravHumOsc.frequency.setTargetAtTime(basePitch, this.ctx.currentTime, 0.15);

    // Volume: quiet hum at field edge, louder and more present at core
    const targetVol = 0.04 + proximity * 0.18 + Math.min(angularSpeed * 0.05, 0.06);
    this.gravHumGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);

    // Noise filter cutoff tracks proximity (deep rumble → richer harmonic)
    if (this.gravHumNoiseFilter) {
        this.gravHumNoiseFilter.frequency.setTargetAtTime(80 + proximity * 120, this.ctx.currentTime, 0.1);
    }
},

stopGravityHum(): void {
    if (!this.ctx || !this.gravHumActive) return;
    this.gravHumActive = false;

    const now = this.ctx.currentTime;
    const fadeTime = 0.8;

    if (this.gravHumGain) {
        this.gravHumGain.gain.setTargetAtTime(0, now, fadeTime * 0.3);
    }

    const osc = this.gravHumOsc;
    const noise = this.gravHumNoise;
    const gain = this.gravHumGain;
    const filter = this.gravHumNoiseFilter;

    setTimeout(() => {
        try { osc?.stop(); osc?.disconnect(); } catch (_) {}
        try { noise?.stop(); noise?.disconnect(); } catch (_) {}
        try { filter?.disconnect(); } catch (_) {}
        try { gain?.disconnect(); } catch (_) {}
    }, (fadeTime + 0.2) * 1000);

    this.gravHumOsc = null;
    this.gravHumNoise = null;
    this.gravHumNoiseFilter = null;
    this.gravHumGain = null;
},

playGravitySlingRelease(quality: 'perfect' | 'good' | 'ok' = 'good', combo: number = 1): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    if (this.activeVoices >= this.maxVoices) return;
    this.activeVoices++;
    setTimeout(() => { this.activeVoices = Math.max(0, this.activeVoices - 1); }, 800);

    const now = this.ctx.currentTime;
    const comboBoost = Math.min(combo * 0.15, 0.6); // 0 → 0.6 volume bonus

    // ── Broadband whoosh — sweeping noise burst ────────────────────────
    const bufLen = Math.floor(this.ctx.sampleRate * 0.6);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const bd = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) bd[i] = Math.random() * 2 - 1;

    const whooshSrc = this.ctx.createBufferSource();
    whooshSrc.buffer = buf;

    const whooshFilter = this.ctx.createBiquadFilter();
    whooshFilter.type = 'bandpass';
    const freqFloor = quality === 'perfect' ? 300 : quality === 'good' ? 200 : 150;
    const freqCeil  = quality === 'perfect' ? 8000 : quality === 'good' ? 5000 : 3000;
    whooshFilter.frequency.setValueAtTime(freqFloor, now);
    whooshFilter.frequency.exponentialRampToValueAtTime(freqCeil, now + 0.55);
    whooshFilter.Q.value = 1.2;

    const whooshVol = (quality === 'perfect' ? 0.45 : quality === 'good' ? 0.35 : 0.25) + comboBoost;
    const whooshGain = this.ctx.createGain();
    whooshGain.gain.setValueAtTime(0, now);
    whooshGain.gain.linearRampToValueAtTime(whooshVol, now + 0.05);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    whooshSrc.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(this.sfxGain);
    if (this.reverbSend) {
        const rv = this.ctx.createGain();
        rv.gain.value = 0.35;
        whooshGain.connect(rv);
        rv.connect(this.reverbSend);
    }
    whooshSrc.start(now);

    // ── Resonant ascending tone — "sling identity" ────────────────────
    if (quality !== 'ok') {
        const startFreq = quality === 'perfect' ? 220 : 160;
        const endFreq   = quality === 'perfect'
            ? Math.min(880 + combo * 40, 1760)
            : Math.min(600 + combo * 30, 1200);

        const tone = this.ctx.createOscillator();
        tone.type = quality === 'perfect' ? 'sine' : 'triangle';
        tone.frequency.setValueAtTime(startFreq, now + 0.02);
        tone.frequency.exponentialRampToValueAtTime(endFreq, now + 0.55);

        const toneFilter = this.ctx.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.setValueAtTime(startFreq * 2, now + 0.02);
        toneFilter.frequency.exponentialRampToValueAtTime(endFreq * 3, now + 0.55);

        const toneVol = (quality === 'perfect' ? 0.22 : 0.14) + comboBoost * 0.3;
        const toneGain = this.ctx.createGain();
        toneGain.gain.setValueAtTime(0, now + 0.02);
        toneGain.gain.linearRampToValueAtTime(toneVol, now + 0.08);
        toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        tone.connect(toneFilter);
        toneFilter.connect(toneGain);
        toneGain.connect(this.sfxGain);
        tone.start(now + 0.02);
        tone.stop(now + 0.65);
    }
}
} as const;
