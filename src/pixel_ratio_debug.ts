import { PIXEL_RATIO_PRESETS, type PixelRatioPresetName, indexForPixelRatio, pixelRatioForPreset } from './pixel_ratio';
import { RESOLUTION_RATIOS } from './pixel_ratio';

export function attachPixelRatioDebugSection(
    container: HTMLElement,
    apply: (name: PixelRatioPresetName) => void
): void {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.15);';
    const title = document.createElement('div');
    title.textContent = 'Pixel ratio';
    title.style.cssText = 'color:#9fdcff;font-size:11px;margin-bottom:4px;';
    wrap.appendChild(title);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:4px;';
    (Object.keys(PIXEL_RATIO_PRESETS) as PixelRatioPresetName[]).forEach((name) => {
        const btn = document.createElement('button');
        btn.textContent = `${name} ${PIXEL_RATIO_PRESETS[name]}`;
        btn.style.cssText = 'flex:1;font-size:10px;padding:4px;cursor:pointer;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:3px;';
        btn.onclick = () => apply(name);
        row.appendChild(btn);
    });
    wrap.appendChild(row);
    container.appendChild(wrap);
}

export { indexForPixelRatio, pixelRatioForPreset, RESOLUTION_RATIOS };
