import { bindMixin } from '../types';

/**
 * Extractor Beam hum — a soft two-oscillator siphon tone. Pitch rises with
 * siphon progress so the player hears the moss "filling the bag". Procedural
 * only (no audio files), modelled on the magma rumble lifecycle.
 */
export const extractorAudioMixin = bindMixin({
updateExtractorHum(intensity: number, progress: number): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const level = Math.max(0, Math.min(1, intensity));
    if (level <= 0.02) {
        this.stopExtractorHum();
        return;
    }

    const now = this.ctx.currentTime;
    if (!this.extractorHumActive) {
        this.extractorHumActive = true;
        this.extractorHumGain = this.ctx.createGain();
        this.extractorHumGain.gain.setValueAtTime(0, now);
        this.extractorHumGain.connect(this.sfxGain);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 900;
        filter.Q.value = 2.5;
        filter.connect(this.extractorHumGain);

        this.extractorHumOsc = this.ctx.createOscillator();
        this.extractorHumOsc.type = 'triangle';
        this.extractorHumOsc.frequency.setValueAtTime(330, now);
        this.extractorHumOsc.connect(filter);

        // Gentle wobble so the hum feels liquid, not electrical.
        this.extractorHumLfo = this.ctx.createOscillator();
        this.extractorHumLfo.frequency.value = 6;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 12;
        this.extractorHumLfo.connect(lfoGain);
        lfoGain.connect(this.extractorHumOsc.frequency);

        this.extractorHumOsc.start(now);
        this.extractorHumLfo.start(now);
    }

    if (this.extractorHumOsc && this.extractorHumGain) {
        const p = Math.max(0, Math.min(1, progress));
        this.extractorHumOsc.frequency.setTargetAtTime(330 + p * 330, now, 0.1);
        this.extractorHumGain.gain.setTargetAtTime(0.015 + level * 0.05, now, 0.08);
    }
},

stopExtractorHum(): void {
    if (!this.ctx || !this.extractorHumActive) return;
    this.extractorHumActive = false;
    const now = this.ctx.currentTime;
    if (this.extractorHumGain) {
        this.extractorHumGain.gain.cancelScheduledValues(now);
        this.extractorHumGain.gain.setTargetAtTime(0.0001, now, 0.06);
    }
    const osc = this.extractorHumOsc;
    const lfo = this.extractorHumLfo;
    const gain = this.extractorHumGain;
    this.extractorHumOsc = null;
    this.extractorHumLfo = null;
    this.extractorHumGain = null;
    window.setTimeout(() => {
        try { osc?.stop(); } catch { /* already stopped */ }
        try { lfo?.stop(); } catch { /* already stopped */ }
        try { osc?.disconnect(); } catch { /* */ }
        try { lfo?.disconnect(); } catch { /* */ }
        try { gain?.disconnect(); } catch { /* */ }
    }, 200);
}
});
