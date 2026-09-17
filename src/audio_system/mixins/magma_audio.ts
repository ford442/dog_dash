import { bindMixin } from '../types';

export const magmaAudioMixin = bindMixin({
updateMagmaRumble(intensity: number): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const level = Math.max(0, Math.min(1, intensity));
    if (level <= 0.02) {
        this.stopMagmaRumble();
        return;
    }

    const now = this.ctx.currentTime;
    if (!this.magmaRumbleActive) {
        this.magmaRumbleActive = true;
        this.magmaRumbleGain = this.ctx.createGain();
        this.magmaRumbleGain.gain.setValueAtTime(0, now);
        this.magmaRumbleGain.connect(this.sfxGain);

        this.magmaRumbleOsc = this.ctx.createOscillator();
        this.magmaRumbleOsc.type = 'sawtooth';
        this.magmaRumbleOsc.frequency.setValueAtTime(42, now);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 90;
        this.magmaRumbleOsc.connect(filter);
        filter.connect(this.magmaRumbleGain);
        this.magmaRumbleOsc.start(now);
    }

    if (this.magmaRumbleOsc && this.magmaRumbleGain) {
        this.magmaRumbleOsc.frequency.setTargetAtTime(36 + level * 50, now, 0.12);
        this.magmaRumbleGain.gain.setTargetAtTime(0.02 + level * 0.1, now, 0.1);
    }
},

stopMagmaRumble(): void {
    if (!this.ctx || !this.magmaRumbleActive) return;
    this.magmaRumbleActive = false;
    const now = this.ctx.currentTime;
    if (this.magmaRumbleGain) {
        this.magmaRumbleGain.gain.cancelScheduledValues(now);
        this.magmaRumbleGain.gain.setTargetAtTime(0.0001, now, 0.08);
    }
    const osc = this.magmaRumbleOsc;
    const gain = this.magmaRumbleGain;
    this.magmaRumbleOsc = null;
    this.magmaRumbleGain = null;
    window.setTimeout(() => {
        try { osc?.stop(); } catch { /* already stopped */ }
        try { osc?.disconnect(); } catch { /* */ }
        try { gain?.disconnect(); } catch { /* */ }
    }, 250);
}
});
