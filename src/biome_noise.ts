/**
 * biome_noise.ts
 *
 * Option B consumer of the experimental C++ WASM noise exports
 * (`fractalNoise2D` in cpp/src/noise.cpp — see docs/WASM_BACKENDS.md).
 * Streaming hosts (foliage/void-root scatter, spore-cloud spawn rate,
 * candy-belt gaps) sample a chunk-cached density value here instead of
 * pure `Math.random()`, so density varies organically and deterministically
 * per world X.
 *
 * C++ backend (`VITE_CPP_WASM=true` + game_cpp.wasm present): calls
 * `fractalNoise2D` once per streaming chunk, cached in a small ring buffer.
 * Default AssemblyScript backend: a tiny JS value-noise fallback keeps
 * `npm run dev` / CI green with no emsdk required.
 *
 * Mirrors the direct-singleton-import wiring used by `jelly_moss_softbody.ts`
 * (Option A) rather than growing `GameContext` with a noise field.
 */

import { WasmBackend, type WasmExports, type WasmHandle } from './wasm_loader';
import type { BiomeNoiseChannel, BiomeNoisePort } from './ports/biome_noise_port';

/** World-X size of one cached noise sample. Matches streaming-zone granularity, not per-vertex. */
const CHUNK_SIZE = 64;
const NOISE_SCALE = 0.015;
const OCTAVES = 4;
const LACUNARITY = 2.0;
const GAIN = 0.5;
const RING_BUFFER_SIZE = 64;

// Per-channel Y offset into the 2-D noise field so foliage/spore/candy don't move in lockstep.
const CHANNEL_OFFSET: Record<BiomeNoiseChannel, number> = {
    foliage: 0,
    spore: 311,
    candy: 977,
};

function hasFractalNoise(exports: WasmExports | null | undefined): boolean {
    return !!exports && typeof exports.fractalNoise2D === 'function';
}

/** Deterministic hash to [0, 1) — stand-in permutation for the JS fallback. */
function hash01(n: number): number {
    const s = Math.sin(n * 12.9898) * 43758.5453123;
    return s - Math.floor(s);
}

/** Smoothstep value noise (1-D): cheap, stable, never crashes. */
function jsValueNoise(x: number): number {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = hash01(xi);
    const b = hash01(xi + 1);
    const t = xf * xf * (3 - 2 * xf);
    return a + (b - a) * t;
}

/** JS fractal fallback shaped like cpp's octave-sum fBm, normalized to [0, 1]. */
function jsFractalNoise(x: number, seed: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < OCTAVES; i++) {
        value += jsValueNoise(x * frequency + seed) * amplitude;
        maxValue += amplitude;
        amplitude *= GAIN;
        frequency *= LACUNARITY;
    }
    return value / maxValue;
}

type RingEntry = { chunkIndex: number; value: number };

function makeRing(): (RingEntry | undefined)[] {
    return new Array(RING_BUFFER_SIZE);
}

/**
 * Chunk-cached biome density noise. Safe to call before `bindWasm()` runs —
 * defaults to the JS fallback until a C++ handle is bound.
 */
export class BiomeNoiseSystem implements BiomeNoisePort {
    private handle: WasmHandle | null = null;
    private useCpp = false;
    private runSeedOffset = 0;
    private rings: Record<BiomeNoiseChannel, (RingEntry | undefined)[]> = {
        foliage: makeRing(),
        spore: makeRing(),
        candy: makeRing(),
    };

    get backend(): 'cpp' | 'js' {
        return this.useCpp ? 'cpp' : 'js';
    }

    /** Mix active run seed into noise samples so identical worldX differs per run. */
    bindRunSeed(rngSeed: number): void {
        this.runSeedOffset = rngSeed >>> 0;
        this.rings = { foliage: makeRing(), spore: makeRing(), candy: makeRing() };
    }

    /** Bind (or clear) the active WASM handle. Falls back to JS when not C++ or noise exports are missing. */
    bindWasm(handle: WasmHandle | null): void {
        this.handle = handle;
        this.useCpp = handle?.backend === WasmBackend.Cpp && hasFractalNoise(handle.exports);
        this.rings = { foliage: makeRing(), spore: makeRing(), candy: makeRing() };
        this.publishBreadcrumb();
        if (this.useCpp) {
            console.log('[biome-noise] C++ fractalNoise2D active for streaming density');
        }
    }

    /** Chunk-cached noise sample in [0, 1] for worldX on the given channel. */
    sample(worldX: number, channel: BiomeNoiseChannel): number {
        const chunkIndex = Math.floor(worldX / CHUNK_SIZE);
        const ring = this.rings[channel];
        const slot = ((chunkIndex % RING_BUFFER_SIZE) + RING_BUFFER_SIZE) % RING_BUFFER_SIZE;
        const cached = ring[slot];
        if (cached && cached.chunkIndex === chunkIndex) {
            return cached.value;
        }

        const chunkX = chunkIndex * CHUNK_SIZE;
        const value = this.computeSample(chunkX, channel);
        ring[slot] = { chunkIndex, value };
        return value;
    }

    /** Density multiplier centered on 1.0 (e.g. spread=0.6 -> range [0.4, 1.6]). */
    densityMultiplier(worldX: number, channel: BiomeNoiseChannel, spread = 0.6): number {
        const s = this.sample(worldX, channel);
        return 1 + (s * 2 - 1) * spread;
    }

    private computeSample(chunkX: number, channel: BiomeNoiseChannel): number {
        const seed = CHANNEL_OFFSET[channel] + this.runSeedOffset;
        let raw: number;
        if (this.useCpp && this.handle) {
            try {
                raw = this.handle.exports.fractalNoise2D!(
                    chunkX * NOISE_SCALE,
                    seed * NOISE_SCALE,
                    OCTAVES,
                    LACUNARITY,
                    GAIN
                );
                raw = raw * 0.5 + 0.5; // [-1, 1] -> [0, 1]
            } catch (err) {
                console.warn('[biome-noise] fractalNoise2D failed, falling back to JS:', err);
                this.useCpp = false;
                this.publishBreadcrumb();
                raw = jsFractalNoise(chunkX * NOISE_SCALE, seed * NOISE_SCALE);
            }
        } else {
            raw = jsFractalNoise(chunkX * NOISE_SCALE, seed * NOISE_SCALE);
        }
        return Math.min(1, Math.max(0, raw));
    }

    private publishBreadcrumb(): void {
        if (typeof window === 'undefined') return;
        window.biomeNoiseBackend = this.backend;
    }
}

/** Shared instance used by streaming hosts (foliage, spore clouds, candy belt) and startup. */
export const biomeNoise = new BiomeNoiseSystem();

declare global {
    interface Window {
        biomeNoiseBackend?: 'cpp' | 'js';
    }
}
