/**
 * Named render-scale presets. The FPS scaler steps through these — there is
 * no hidden 0.60 default.
 *
 * `quality` 1.0 — native DPR (capped at 2 in the renderer)
 * `default` 0.75 — the shipping default
 * `battery` 0.50 — aggressive downsample
 */

export const PIXEL_RATIO_PRESETS = {
    battery: 0.5,
    default: 0.75,
    quality: 1.0
} as const;

export type PixelRatioPresetName = keyof typeof PIXEL_RATIO_PRESETS;

/** FPS scaler ladder — named presets plus extra headroom steps. */
export const RESOLUTION_RATIOS = [0.5, 0.75, 1.0, 1.5, 2.0] as const;

export function defaultPixelRatioIndex(): number {
    return RESOLUTION_RATIOS.indexOf(PIXEL_RATIO_PRESETS.default);
}

export function parsePixelRatioPreset(
    search: string,
    fallback: PixelRatioPresetName = 'default'
): PixelRatioPresetName {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const raw = (params.get('quality') || params.get('pixelRatio') || '').toLowerCase();
    if (raw === 'battery' || raw === '0.5' || raw === '0.50') return 'battery';
    if (raw === 'quality' || raw === '1' || raw === '1.0') return 'quality';
    if (raw === 'default' || raw === '0.75') return 'default';
    return fallback;
}

export function pixelRatioForPreset(name: PixelRatioPresetName): number {
    return PIXEL_RATIO_PRESETS[name];
}

export function wantsOptionalPostFx(search = typeof window !== 'undefined' ? window.location.search : ''): boolean {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const fx = params.get('fx');
    return params.has('fx') && fx !== '0' && fx !== 'false';
}

export function indexForPixelRatio(ratio: number): number {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < RESOLUTION_RATIOS.length; i++) {
        const d = Math.abs(RESOLUTION_RATIOS[i]! - ratio);
        if (d < bestDist) {
            best = i;
            bestDist = d;
        }
    }
    return best;
}
