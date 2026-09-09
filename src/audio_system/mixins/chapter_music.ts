/**
 * chapter_music.ts (mixin)
 * Adaptive per-chapter music runtime.
 *
 * Each chapter profile builds its own small graph:
 *
 *   layer gains ─┬─> chapterBus ─> chapterFilter ─> musicGain
 *   noise bed  ──┘                └─> delaySend ─> shared reverb
 *
 * Switching chapters builds a *second* graph and crossfades between them, so
 * a transition never cuts a sustaining oscillator — that is what produces
 * clicks. Old buses are torn down only after their fade has finished.
 *
 * Everything is procedural. No audio files.
 */

import {
    getChapterMusicProfile,
    scaleNote,
    HUB_MUSIC_PROFILE,
    type ChapterGraph,
    type ChapterMusicProfile,
    type MusicLayerId
} from '../chapter_music';
import { bindMixin } from '../types';

/** Crossfade bounds from the issue: 300–800 ms. */
const MIN_FADE_MS = 300;
const MAX_FADE_MS = 800;
const DEFAULT_FADE_MS = 550;

/** Steps per bar (16th notes). */
const STEPS_PER_BAR = 16;

/** Layers kept when reduced audio is on, in priority order. */
const REDUCED_LAYER_BUDGET = 2;

declare global {
    interface Window {
        /** Debug breadcrumb: id of the chapter music profile currently playing. */
        currentMusicProfileId?: string | null;
    }
}

type LayerGains = Map<string, GainNode>;

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

/** Base mix level per layer, before adaptive scaling. */
const LAYER_BASE_GAIN: Record<MusicLayerId | 'danger', number> = {
    pad: 0.16,
    arp: 0.10,
    bass: 0.14,
    chime: 0.09,
    drums: 0.11,
    whale: 0.18,
    danger: 0.0
};

export const chapterMusicMixin = bindMixin({

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/** Switch to a chapter's profile, crossfading from whatever is playing. */
setChapterMusic(level: number, fadeMs: number = DEFAULT_FADE_MS): void {
    this.applyChapterProfile(getChapterMusicProfile(level), fadeMs);
},

/** Switch to the cozy hub / pause bed. */
setHubMusic(fadeMs: number = DEFAULT_FADE_MS): void {
    this.applyChapterProfile(HUB_MUSIC_PROFILE, fadeMs);
},

applyChapterProfile(profile: ChapterMusicProfile, fadeMs: number = DEFAULT_FADE_MS): void {
    this.init();
    if (!this.ctx || !this.musicGain) return;

    // Re-selecting the live profile is a no-op, so level re-entry doesn't
    // restart a bed that is already correct.
    if (this.chapterGraph?.profile.id === profile.id) return;

    const fade = Math.max(MIN_FADE_MS, Math.min(MAX_FADE_MS, fadeMs)) / 1000;

    // The legacy ambient bed and a chapter bed both feed musicGain. Running
    // both smears the chapter's identity, so the chapter takes over.
    this.suspendLegacyMusicBed(fade);

    this.fadeOutChapterGraph(fade);
    this.chapterGraph = this.buildChapterGraph(profile, fade);
    this.chapterBpm = profile.bpm;
    this.startChapterSequencer();

    if (typeof window !== 'undefined') {
        window.currentMusicProfileId = profile.id;
    }
},

buildChapterGraph(profile: ChapterMusicProfile, fadeSecs: number): ChapterGraph | null {
    if (!this.ctx || !this.musicGain) return null;
    const now = this.ctx.currentTime;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = profile.filterHz ?? 6000;
    filter.Q.value = 0.7;
    filter.connect(this.musicGain);

    const bus = this.ctx.createGain();
    // Start silent and ramp up — never start a bus at full gain.
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + fadeSecs);
    bus.connect(filter);

    if (profile.delaySend && this.reverbNode) {
        const send = this.ctx.createGain();
        send.gain.value = profile.delaySend * 0.5;
        bus.connect(send);
        send.connect(this.reverbNode);
    }

    const layers: LayerGains = new Map();
    for (const id of this.activeChapterLayers(profile)) {
        const gain = this.ctx.createGain();
        gain.gain.value = LAYER_BASE_GAIN[id];
        gain.connect(bus);
        layers.set(id, gain);
    }

    if (profile.dangerLayer) {
        const gain = this.ctx.createGain();
        gain.gain.value = 0; // Silent until danger rises.
        gain.connect(bus);
        layers.set('danger', gain);
    }

    const noise = this.startChapterNoiseBed(profile, bus);

    return { profile, bus, filter, layers, noise, step: 0 };
},

/** Layers this profile should actually voice, honouring reduced audio. */
activeChapterLayers(profile: ChapterMusicProfile): MusicLayerId[] {
    return this.reducedAudio ? profile.layers.slice(0, REDUCED_LAYER_BUDGET) : profile.layers;
},

/** Filtered-noise bed (heat shimmer, industrial air). Skipped when reduced. */
startChapterNoiseBed(profile: ChapterMusicProfile, bus: GainNode): AudioBufferSourceNode | null {
    if (!this.ctx || !profile.noiseBed || this.reducedAudio) return null;

    const seconds = 2;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 620;
    bandpass.Q.value = 0.8;

    const gain = this.ctx.createGain();
    gain.gain.value = profile.noiseBed * 0.12;

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(bus);
    source.start(this.ctx.currentTime);

    return source;
},

/** Fades the live graph out and schedules its teardown. */
fadeOutChapterGraph(fadeSecs: number): void {
    const graph = this.chapterGraph;
    if (!graph || !this.ctx) return;

    const now = this.ctx.currentTime;
    graph.bus.gain.cancelScheduledValues(now);
    graph.bus.gain.setValueAtTime(graph.bus.gain.value, now);
    graph.bus.gain.linearRampToValueAtTime(0, now + fadeSecs);

    this.chapterGraph = null;

    // Tear down only once silent, with a margin for scheduled note tails.
    window.setTimeout(() => {
        try { graph.noise?.stop(); } catch { /* already stopped */ }
        graph.noise?.disconnect();
        graph.layers.forEach(gain => gain.disconnect());
        graph.bus.disconnect();
        graph.filter.disconnect();
    }, fadeSecs * 1000 + 2500);
},

/**
 * Silences the pre-chapter `musicLayerMixin` bed and stops its sequencer.
 * Layer gains are faded rather than cut so the handover is inaudible.
 */
suspendLegacyMusicBed(fadeSecs: number): void {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    for (const layer of this.musicLayers.values()) {
        if (!layer.gain) continue;
        layer.gain.gain.cancelScheduledValues(now);
        layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
        layer.gain.gain.linearRampToValueAtTime(0, now + fadeSecs);
        layer.active = false;
    }

    if (this.musicInterval !== null) {
        clearInterval(this.musicInterval);
        this.musicInterval = null;
    }
},

stopChapterMusic(fadeMs: number = DEFAULT_FADE_MS): void {
    this.fadeOutChapterGraph(Math.max(MIN_FADE_MS, fadeMs) / 1000);
    if (this.chapterInterval !== null) {
        clearInterval(this.chapterInterval);
        this.chapterInterval = null;
    }
    if (typeof window !== 'undefined') {
        window.currentMusicProfileId = null;
    }
},

// ---------------------------------------------------------------------------
// Sequencer
// ---------------------------------------------------------------------------

startChapterSequencer(): void {
    if (this.chapterInterval !== null) {
        clearInterval(this.chapterInterval);
    }
    const stepMs = (60 / this.chapterBpm) * 1000 / 4;
    this.chapterInterval = window.setInterval(() => this.stepChapterSequencer(), stepMs);
},

stepChapterSequencer(): void {
    const graph = this.chapterGraph;
    if (!graph || !this.ctx) return;

    const time = this.ctx.currentTime;
    const step = graph.step % STEPS_PER_BAR;
    const bar = Math.floor(graph.step / STEPS_PER_BAR);
    graph.step++;

    for (const id of graph.layers.keys()) {
        if (id === 'danger') continue;
        this.playChapterLayerStep(graph, id as MusicLayerId, step, bar, time);
    }

    if (graph.layers.has('danger') && this.chapterDynamics.danger > 0.05) {
        this.playChapterDangerStep(graph, step, time);
    }
},

/** Dispatch one 16th-note step for a layer. */
playChapterLayerStep(
    graph: ChapterGraph,
    layer: MusicLayerId,
    step: number,
    bar: number,
    time: number
): void {
    const { profile } = graph;
    const dest = graph.layers.get(layer);
    if (!dest) return;

    const wave = profile.timbre?.[layer] ?? 'sine';

    switch (layer) {
        case 'pad':
            // Sustained chord every two bars.
            if (step === 0 && bar % 2 === 0) {
                const degrees = [0, 2, 4];
                degrees.forEach((degree, i) => {
                    this.playChapterTone(dest, {
                        freq: scaleNote(profile.rootHz, profile.scale, degree) * 2,
                        wave,
                        time: time + i * 0.04,
                        attack: 0.9,
                        duration: 5.5,
                        peak: 0.5
                    });
                });
            }
            break;

        case 'bass':
            if (step === 0 || step === 8) {
                this.playChapterTone(dest, {
                    freq: scaleNote(profile.rootHz, profile.scale, step === 0 ? 0 : 4) / 2,
                    wave,
                    time,
                    attack: 0.02,
                    duration: 0.8,
                    peak: 0.8
                });
            }
            break;

        case 'arp':
            if (step % 2 === 0) {
                const degree = (step / 2 + bar) % 8;
                this.playChapterTone(dest, {
                    freq: scaleNote(profile.rootHz, profile.scale, degree) * 2,
                    wave,
                    time,
                    attack: 0.01,
                    duration: 0.28,
                    peak: 0.6
                });
            }
            break;

        case 'chime':
            // Sparse, music-box high register.
            if (step % 4 === 0 && Math.random() < 0.45) {
                const degree = 7 + Math.floor(Math.random() * 6);
                this.playChapterTone(dest, {
                    freq: scaleNote(profile.rootHz, profile.scale, degree) * 2,
                    wave,
                    time,
                    attack: 0.005,
                    duration: 1.6,
                    peak: 0.5
                });
            }
            break;

        case 'drums':
            if (step === 0 || step === 8) {
                this.playChapterKick(dest, time, profile.rootHz);
            } else if (step % 4 === 2) {
                this.playChapterHat(dest, time, 0.4);
            } else if (step % 8 === 5 && Math.random() < 0.5) {
                // Metallic hit — detuned square pair through a short decay.
                this.playChapterTone(dest, {
                    freq: scaleNote(profile.rootHz, profile.scale, 9) * 4,
                    wave: 'square',
                    time,
                    attack: 0.002,
                    duration: 0.22,
                    peak: 0.22
                });
            }
            break;

        case 'whale':
            // Very sparse, slow portamento call.
            if (step === 0 && bar % 4 === 0) {
                this.playChapterWhaleCall(dest, time, profile);
            }
            break;
    }
},

playChapterDangerStep(graph: ChapterGraph, step: number, time: number): void {
    const dest = graph.layers.get('danger');
    const kind = graph.profile.dangerLayer;
    if (!dest || !kind) return;

    const { profile } = graph;

    if (kind === 'staccato') {
        // Accented off-beat stabs.
        if (step % 4 === 3) {
            this.playChapterTone(dest, {
                freq: scaleNote(profile.rootHz, profile.scale, 1) * 2,
                wave: 'square',
                time,
                attack: 0.005,
                duration: 0.14,
                peak: 0.5
            });
        }
        return;
    }

    // dissonant-pad: a tritone held against the tonic.
    if (step === 0) {
        const tritone = profile.rootHz * Math.pow(2, 6 / 12);
        [profile.rootHz, tritone].forEach((freq, i) => {
            this.playChapterTone(dest, {
                freq: freq * 2,
                wave: 'sawtooth',
                time: time + i * 0.03,
                attack: 0.6,
                duration: 3.8,
                peak: 0.32
            });
        });
    }
},

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------

/**
 * One enveloped oscillator note. Envelopes always start from 0 and decay to a
 * small positive floor, which is what keeps transitions click-free.
 */
playChapterTone(
    dest: GainNode,
    opts: { freq: number; wave: OscillatorType; time: number; attack: number; duration: number; peak: number }
): void {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = opts.wave;
    osc.frequency.setValueAtTime(opts.freq, opts.time);

    gain.gain.setValueAtTime(0, opts.time);
    gain.gain.linearRampToValueAtTime(opts.peak, opts.time + opts.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.time + opts.duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(opts.time);
    osc.stop(opts.time + opts.duration + 0.05);
    osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
    };
},

playChapterKick(dest: GainNode, time: number, rootHz: number): void {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(Math.max(60, rootHz), time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, rootHz / 2.5), time + 0.12);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.9, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.35);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
},

playChapterHat(dest: GainNode, time: number, level: number): void {
    if (!this.ctx) return;

    const length = Math.floor(this.ctx.sampleRate * 0.05);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 6000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level * 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    source.connect(highpass);
    highpass.connect(gain);
    gain.connect(dest);
    source.start(time);
    source.onended = () => { source.disconnect(); highpass.disconnect(); gain.disconnect(); };
},

playChapterWhaleCall(dest: GainNode, time: number, profile: ChapterMusicProfile): void {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const start = scaleNote(profile.rootHz, profile.scale, 0) * 2;
    const peak = scaleNote(profile.rootHz, profile.scale, 4) * 2;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(start, time);
    osc.frequency.linearRampToValueAtTime(peak, time + 1.8);
    osc.frequency.linearRampToValueAtTime(start * 0.85, time + 4.2);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.55, time + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 4.5);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 4.6);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
},

// ---------------------------------------------------------------------------
// Adaptive response
// ---------------------------------------------------------------------------

/**
 * Feed gameplay state into the mix. Called once per frame from the game loop;
 * all values are 0..1 and are smoothed by `setTargetAtTime`, so a jittery
 * input never produces a jittery mix.
 *
 * - `speed`  raises arp/drums and nudges tempo
 * - `boost`  opens the chapter filter and lifts the whole bed
 * - `danger` fades in the profile's danger layer
 * - `quiet`  ducks drums and raises chimes (geode harbor, dream portal)
 */
updateAdaptiveMusic(input: { speed?: number; boost?: number; danger?: number; quiet?: number }): void {
    const graph = this.chapterGraph;
    if (!graph || !this.ctx) return;

    const speed = clamp01(input.speed ?? 0);
    const boost = clamp01(input.boost ?? 0);
    const danger = clamp01(input.danger ?? 0);
    const quiet = clamp01(input.quiet ?? 0);

    this.chapterDynamics = { speed, boost, danger, quiet };

    const now = this.ctx.currentTime;
    const smooth = 0.35;
    const energy = Math.max(speed, boost);

    for (const [id, gain] of graph.layers) {
        const base = LAYER_BASE_GAIN[id as MusicLayerId] ?? 0;
        let target: number;

        switch (id) {
            case 'danger':
                target = danger * 0.16;
                break;
            case 'drums':
                // Drums carry the energy, and duck hard in quiet zones.
                target = base * (0.55 + energy * 0.75) * (1 - quiet * 0.85);
                break;
            case 'arp':
                target = base * (0.5 + energy * 0.9) * (1 - quiet * 0.4);
                break;
            case 'chime':
                // Chimes come forward when everything else pulls back.
                target = base * (0.7 + quiet * 0.9);
                break;
            case 'bass':
                target = base * (0.7 + energy * 0.45) * (1 - quiet * 0.3);
                break;
            default:
                target = base * (0.85 + boost * 0.3);
                break;
        }

        gain.gain.setTargetAtTime(target, now, smooth);
    }

    // Boost opens the chapter filter; quiet closes it slightly.
    const baseFilter = graph.profile.filterHz ?? 6000;
    const filterTarget = baseFilter * (1 + boost * 0.6) * (1 - quiet * 0.25);
    graph.filter.frequency.setTargetAtTime(filterTarget, now, 0.4);

    // Tempo follows speed, but only as far as the profile allows.
    const targetBpm = graph.profile.bpm * (1 + graph.profile.baseTempoScale * energy);
    if (Math.abs(targetBpm - this.chapterBpm) > 1.5) {
        this.chapterBpm = targetBpm;
        this.startChapterSequencer();
    }
},

/**
 * Fewer layers, no noise bed — for `reducedAudio` or `prefers-reduced-motion`.
 * Rebuilds the current profile so the layer budget takes effect immediately.
 */
setReducedAudio(reduced: boolean): void {
    if (this.reducedAudio === reduced) return;
    this.reducedAudio = reduced;

    const profile = this.chapterGraph?.profile;
    if (!profile) return;

    // Force a rebuild: applyChapterProfile short-circuits on an identical id.
    this.fadeOutChapterGraph(MIN_FADE_MS / 1000);
    this.chapterGraph = this.buildChapterGraph(profile, MIN_FADE_MS / 1000);
    this.startChapterSequencer();
},

getChapterMusicId(): string | null {
    return this.chapterGraph?.profile.id ?? null;
},

getChapterMusicLabel(): string | null {
    return this.chapterGraph?.profile.label ?? null;
},

// ---------------------------------------------------------------------------
// Stingers
// ---------------------------------------------------------------------------

/** Chapter-complete flourish, picked by the profile's `victoryStinger`. */
playChapterCompleteStinger(): void {
    this.init();
    if (!this.ctx || !this.musicGain) return;

    const profile = this.chapterGraph?.profile;
    const stinger = profile?.victoryStinger ?? 'chime-rise';
    const root = profile?.rootHz ?? 261.63;
    const scale = profile?.scale ?? 'major';

    const bus = this.ctx.createGain();
    bus.gain.value = 0.5;
    bus.connect(this.musicGain);

    const now = this.ctx.currentTime;

    switch (stinger) {
        case 'brass-swell':
            [0, 4, 7].forEach((degree, i) => {
                this.playChapterTone(bus, {
                    freq: scaleNote(root, scale, degree) * 2,
                    wave: 'sawtooth',
                    time: now + i * 0.09,
                    attack: 0.25,
                    duration: 1.9,
                    peak: 0.4
                });
            });
            break;

        case 'whale-call':
            this.playChapterWhaleCall(bus, now, {
                ...(profile ?? HUB_MUSIC_PROFILE),
                rootHz: root,
                scale
            } as ChapterMusicProfile);
            break;

        case 'bubble-rise':
            for (let i = 0; i < 8; i++) {
                this.playChapterTone(bus, {
                    freq: scaleNote(root, scale, i + 4) * 2,
                    wave: 'sine',
                    time: now + i * 0.07,
                    attack: 0.01,
                    duration: 0.4,
                    peak: 0.35
                });
            }
            break;

        case 'chime-rise':
        default:
            [0, 2, 4, 7].forEach((degree, i) => {
                this.playChapterTone(bus, {
                    freq: scaleNote(root, scale, degree) * 4,
                    wave: 'sine',
                    time: now + i * 0.12,
                    attack: 0.008,
                    duration: 1.4,
                    peak: 0.38
                });
            });
            break;
    }

    window.setTimeout(() => bus.disconnect(), 5000);
}

});
