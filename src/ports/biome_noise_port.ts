/** Streaming systems that sample chunk-cached biome density noise. */
export type BiomeNoiseChannel = 'foliage' | 'spore' | 'candy';

/**
 * Deterministic per-chunk density noise for streaming world generation.
 * Backed by the experimental C++ WASM `fractalNoise2D` export when
 * `VITE_CPP_WASM=true` and `game_cpp.wasm` is loaded; otherwise a JS
 * value-noise fallback. Never throws — always returns a stable value in
 * [0, 1] for a given world X + channel so callers can multiply spawn
 * counts or gate spawn probability without extra null checks.
 */
export interface BiomeNoisePort {
    readonly backend: 'cpp' | 'js';
    /** Chunk-cached fractal noise sample in [0, 1] for worldX on the given channel. */
    sample(worldX: number, channel: BiomeNoiseChannel): number;
    /** Density multiplier centered on 1.0 (e.g. spread=0.6 -> range [0.4, 1.6]). */
    densityMultiplier(worldX: number, channel: BiomeNoiseChannel, spread?: number): number;
}
