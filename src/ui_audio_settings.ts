/**
 * ui_audio_settings.ts
 * Shared audio controls panel — master / music / SFX levels plus the
 * reduced-audio accessibility toggle.
 *
 * Used by both the touch settings sheet and the pause menu so the two never
 * drift apart. Every change is applied live and persisted through
 * `audio_settings.ts` → `save_manager`.
 */

import {
    loadAndApplyAudioSettings,
    prefersReducedMotion,
    updateAudioSettings
} from './audio_settings';

function createVolumeRow(
    label: string,
    value: number,
    onChange: (value: number) => void
): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
        background: rgba(61,61,92,0.5);
        padding: 12px 15px;
        border-radius: 10px;
        margin-bottom: 10px;
    `;

    const labelRow = document.createElement('div');
    labelRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
    `;

    const nameLabel = document.createElement('span');
    nameLabel.textContent = label;
    nameLabel.style.color = '#fff';

    const valueLabel = document.createElement('span');
    valueLabel.textContent = `${Math.round(value * 100)}%`;
    valueLabel.style.color = '#ffcc00';
    valueLabel.style.fontWeight = 'bold';

    labelRow.appendChild(nameLabel);
    labelRow.appendChild(valueLabel);
    container.appendChild(labelRow);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    slider.value = String(value);
    slider.setAttribute('aria-label', label);
    slider.style.cssText = `
        width: 100%;
        height: 10px;
        -webkit-appearance: none;
        appearance: none;
        background: linear-gradient(90deg, #e94560 0%, #ffcc00 100%);
        border-radius: 5px;
        outline: none;
        cursor: pointer;
    `;

    slider.addEventListener('input', (event) => {
        const next = parseFloat((event.target as HTMLInputElement).value);
        valueLabel.textContent = `${Math.round(next * 100)}%`;
        onChange(next);
    });

    container.appendChild(slider);
    return container;
}

function createCheckboxRow(
    label: string,
    hint: string,
    checked: boolean,
    onChange: (checked: boolean) => void
): HTMLElement {
    const row = document.createElement('label');
    row.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 10px;
        background: rgba(61,61,92,0.5);
        padding: 12px 15px;
        border-radius: 10px;
        cursor: pointer;
        color: #fff;
    `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.style.cssText = 'width: 20px; height: 20px; cursor: pointer; margin-top: 2px;';
    checkbox.addEventListener('change', () => onChange(checkbox.checked));

    const text = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = label;
    const sub = document.createElement('div');
    sub.textContent = hint;
    sub.style.cssText = 'font-size: 12px; color: #b8b8d0; margin-top: 3px;';
    text.appendChild(title);
    text.appendChild(sub);

    row.appendChild(checkbox);
    row.appendChild(text);
    return row;
}

/**
 * Builds the audio controls block. Reads current values from the save file,
 * so it always opens showing what is actually playing.
 */
export function createAudioSettingsPanel(): HTMLElement {
    const settings = loadAndApplyAudioSettings();

    const panel = document.createElement('div');
    panel.style.cssText = 'display: flex; flex-direction: column;';

    panel.appendChild(createVolumeRow('🔊 Master', settings.master, (value) => {
        updateAudioSettings({ master: value });
    }));
    panel.appendChild(createVolumeRow('🎵 Music', settings.music, (value) => {
        updateAudioSettings({ music: value });
    }));
    panel.appendChild(createVolumeRow('💥 Sound Effects', settings.sfx, (value) => {
        updateAudioSettings({ sfx: value });
    }));

    const hint = prefersReducedMotion()
        ? 'Fewer music layers. Already on: your device asks for reduced motion.'
        : 'Fewer music layers — calmer, and lighter on slow devices.';

    panel.appendChild(createCheckboxRow(
        '🎚️ Simpler Music',
        hint,
        settings.reducedAudio,
        (checked) => { updateAudioSettings({ reducedAudio: checked }); }
    ));

    return panel;
}
