import { bindMixin } from '../types';

/**
 * Procedural audio for the Artifacts hacking minigames (plan §III):
 * Morse transmission tones (440 Hz, dot/dash), input blips, and the
 * success / fail / alarm stingers. 100% synthesized — no audio files.
 */
export const hackingSoundsMixin = bindMixin({
    /**
     * Plays a single Morse symbol at the given start offset (seconds from now).
     * dot = 200 ms, dash = 600 ms (plan-aligned). Returns nothing; scheduling
     * of the whole sequence is done by the caller.
     */
    playMorseSymbol(isDash: boolean, startOffset = 0, frequency = 440): void {
        this.init();
        if (!this.ctx || !this.sfxGain) return;

        const start = this.ctx.currentTime + startOffset;
        const dur = isDash ? 0.6 : 0.2;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, start);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.22, start + 0.012);
        gain.gain.setValueAtTime(0.22, start + dur - 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        if (this.reverbSend) {
            const rv = this.ctx.createGain();
            rv.gain.value = 0.25;
            gain.connect(rv);
            rv.connect(this.reverbSend);
        }

        osc.start(start);
        osc.stop(start + dur + 0.05);
    },

    /** Short confirmation blip for a correct player input. */
    playHackBlip(correct = true): void {
        this.init();
        if (!this.ctx || !this.sfxGain) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = correct ? 'triangle' : 'square';
        const f = correct ? 660 : 180;
        osc.frequency.setValueAtTime(f, now);
        if (!correct) osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(correct ? 0.16 : 0.2, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (correct ? 0.12 : 0.22));

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.3);
    },

    /** Rising arpeggio when a hack is decoded successfully. */
    playHackSuccess(): void {
        this.init();
        if (!this.ctx || !this.sfxGain) return;
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
        notes.forEach((f, i) => {
            const t = now + i * 0.09;
            const osc = this.ctx!.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            const gain = this.ctx!.createGain();
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(gain);
            gain.connect(this.sfxGain!);
            osc.start(t);
            osc.stop(t + 0.4);
        });
    },

    /** Descending buzz when a hack fails. */
    playHackFail(): void {
        this.init();
        if (!this.ctx || !this.sfxGain) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.5);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.5);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.6);
    },

    /** Two-tone alarm klaxon (buoy hack failure raises local enemy spawns). */
    playHackAlarm(): void {
        this.init();
        if (!this.ctx || !this.sfxGain) return;
        const now = this.ctx.currentTime;
        for (let i = 0; i < 3; i++) {
            const t = now + i * 0.28;
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(740, t);
            osc.frequency.setValueAtTime(560, t + 0.14);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
            gain.gain.setValueAtTime(0.14, t + 0.24);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.27);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.28);
        }
    }
});
