/**
 * boot_failure.ts
 * Blocking fatal screen shown when the WebGPU boot probe fails.
 *
 * This is deliberately a dead end. There is no "continue anyway" button and no
 * degraded renderer behind it — a WebGL path is deferred to a later issue
 * wave. The screen's job is to make the failure legible enough that a Chrome
 * result and an Edge result can be compared side by side.
 */

import type { WebGpuProbeResult } from './webgpu_probe';

const OVERLAY_ID = 'webgpu-boot-failure';

const STAGE_EXPLANATIONS: Record<string, string> = {
    'skipped': 'GPU boot was skipped by the ?skip_gpu_boot flag. Nothing was rendered on purpose.',
    'no-navigator-gpu': 'This browser build does not expose WebGPU at all. Update the browser, or enable WebGPU in its flags.',
    'insecure-context': 'WebGPU is only available over https or on localhost. Open the page from a secure origin.',
    'adapter': 'The browser exposes WebGPU but could not give us a GPU adapter. This is usually a driver, blocklist, or headless-environment issue.',
    'device': 'An adapter was found but refused to hand out a device. Check for driver crashes or exhausted GPU resources.',
    'canvas-context': 'The GPU is fine, but the canvas would not accept a WebGPU context.'
};

/** Removes the fatal screen, if one is up. */
export function hideBootFailure(): void {
    document.getElementById(OVERLAY_ID)?.remove();
}

/**
 * Renders the blocking failure screen. Safe to call more than once — it
 * replaces any screen already showing.
 */
export function showBootFailure(result: WebGpuProbeResult): void {
    hideBootFailure();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'WebGPU unavailable');
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: #12121c;
        color: #f4f4ff;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        overflow: auto;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
        max-width: 720px;
        width: 100%;
        background: #1c1c2b;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 14px;
        padding: 28px 30px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.55);
    `;

    const heading = document.createElement('h1');
    heading.textContent = '🐕 Space Dash needs WebGPU';
    heading.style.cssText = 'margin: 0 0 6px; font-size: 26px;';

    const subtitle = document.createElement('p');
    subtitle.textContent = `${result.browser} could not start WebGPU, so the game did not launch.`;
    subtitle.style.cssText = 'margin: 0 0 18px; color: #b9b9d4; font-size: 15px;';

    const reason = document.createElement('p');
    reason.textContent = result.reason;
    reason.style.cssText = `
        margin: 0 0 12px;
        padding: 12px 14px;
        background: rgba(233,69,96,0.14);
        border-left: 3px solid #e94560;
        border-radius: 6px;
        font-size: 14px;
        line-height: 1.5;
    `;

    const advice = document.createElement('p');
    advice.textContent = STAGE_EXPLANATIONS[result.stage] ?? '';
    advice.style.cssText = 'margin: 0 0 20px; color: #b9b9d4; font-size: 14px; line-height: 1.55;';

    const note = document.createElement('p');
    note.textContent = 'There is no WebGL fallback: a WebGL renderer is deferred to a later release, '
        + 'so that WebGPU failures stay visible instead of being hidden behind a different renderer.';
    note.style.cssText = 'margin: 0 0 20px; color: #8b8ba7; font-size: 13px; line-height: 1.55;';

    const detailsLabel = document.createElement('p');
    detailsLabel.textContent = 'Probe details (include this in a bug report):';
    detailsLabel.style.cssText = 'margin: 0 0 8px; font-size: 13px; color: #b9b9d4;';

    const json = document.createElement('pre');
    json.id = 'webgpu-probe-json';
    json.textContent = JSON.stringify(result, null, 2);
    json.style.cssText = `
        margin: 0 0 16px;
        padding: 14px;
        background: #101019;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        line-height: 1.5;
        max-height: 260px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
    `;

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy details';
    copyBtn.style.cssText = buttonStyle('#e94560');
    copyBtn.addEventListener('click', () => {
        const payload = JSON.stringify(result, null, 2);
        void navigator.clipboard?.writeText(payload)
            .then(() => { copyBtn.textContent = 'Copied ✓'; })
            .catch(() => { copyBtn.textContent = 'Copy failed — select the text above'; });
    });

    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Try again';
    retryBtn.style.cssText = buttonStyle('#3d3d5c');
    // A reload is the only honest retry: the probe is memoised for the page's
    // lifetime precisely so nothing re-requests a device after a failure.
    retryBtn.addEventListener('click', () => window.location.reload());

    buttons.appendChild(copyBtn);
    buttons.appendChild(retryBtn);

    card.append(heading, subtitle, reason, advice, note, detailsLabel, json, buttons);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

function buttonStyle(background: string): string {
    return `
        background: ${background};
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 11px 18px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
    `;
}
