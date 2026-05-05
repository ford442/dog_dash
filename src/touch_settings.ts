/**
 * Touch Control Settings UI for Dog Dash
 * Kid-friendly settings panel for customizing touch controls
 */

import {
    TouchControlsManager,
    ControlMode,
    getControlInstructions,
    getRecommendedControlMode,
    isTouchPrimary,
    detectTouchDevice
} from './touch_controls';

export interface TouchSettings {
    mode: ControlMode;
    sensitivity: number; // 0.5 to 2.0
    joystickSize: 'small' | 'medium' | 'large';
    buttonSize: 'small' | 'medium' | 'large';
    hapticEnabled: boolean;
    visualFeedback: boolean;
    leftHanded: boolean;
}

export const DEFAULT_SETTINGS: TouchSettings = {
    mode: ControlMode.FOLLOW_FINGER,
    sensitivity: 1.0,
    joystickSize: 'large',
    buttonSize: 'large',
    hapticEnabled: true,
    visualFeedback: true,
    leftHanded: false
};

const SETTINGS_KEY = 'dog_dash_touch_settings';

/**
 * Load saved touch settings from localStorage
 */
export function loadTouchSettings(): TouchSettings {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.warn('Failed to load touch settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
}

/**
 * Save touch settings to localStorage
 */
export function saveTouchSettings(settings: TouchSettings): void {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn('Failed to save touch settings:', e);
    }
}

/**
 * Create the touch settings UI panel
 */
export function createTouchSettingsUI(
    touchManager: TouchControlsManager,
    onClose?: () => void
): HTMLElement {
    const settings = loadTouchSettings();
    
    // Container
    const panel = document.createElement('div');
    panel.id = 'touch-settings-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, rgba(45,45,68,0.98) 0%, rgba(26,26,46,0.98) 100%);
        border: 3px solid #e94560;
        border-radius: 20px;
        padding: 30px;
        z-index: 3000;
        min-width: 320px;
        max-width: 90vw;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 0 40px rgba(233,69,96,0.4);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    
    // Title
    const title = document.createElement('h2');
    title.textContent = '🎮 Touch Controls';
    title.style.cssText = `
        color: #e94560;
        text-align: center;
        margin: 0 0 25px 0;
        font-size: 28px;
        text-shadow: 0 0 20px rgba(233,69,96,0.5);
    `;
    panel.appendChild(title);
    
    // Device detection notice
    if (!detectTouchDevice()) {
        const notice = document.createElement('div');
        notice.textContent = '💡 No touch device detected. These settings are for tablets and phones!';
        notice.style.cssText = `
            background: rgba(255,204,0,0.2);
            border: 1px solid #ffcc00;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            color: #ffcc00;
            font-size: 14px;
            text-align: center;
        `;
        panel.appendChild(notice);
    }
    
    // Control Mode Section
    panel.appendChild(createSectionTitle('Control Mode'));
    
    const modeOptions = [
        { value: ControlMode.FOLLOW_FINGER, label: '👆 Follow Finger', icon: '✨' },
        { value: ControlMode.VIRTUAL_JOYSTICK, label: '🎮 Joystick', icon: '🕹️' },
        { value: ControlMode.TAP_TO_MOVE, label: '👆 Tap to Move', icon: '🎯' }
    ];
    
    const modeContainer = createButtonGroup();
    modeOptions.forEach(opt => {
        const btn = createModeButton(
            `${opt.icon} ${opt.label}`,
            settings.mode === opt.value,
            () => {
                settings.mode = opt.value;
                touchManager.setMode(opt.value);
                updateModeButtons();
                showInstructions(opt.value);
            }
        );
        btn.dataset.mode = String(opt.value);
        modeContainer.appendChild(btn);
    });
    panel.appendChild(modeContainer);
    
    // Instructions text
    const instructions = document.createElement('p');
    instructions.id = 'control-instructions';
    instructions.textContent = getControlInstructions(settings.mode);
    instructions.style.cssText = `
        color: #888;
        font-size: 14px;
        text-align: center;
        margin: 15px 0;
        font-style: italic;
        min-height: 40px;
    `;
    panel.appendChild(instructions);
    
    // Sensitivity slider
    panel.appendChild(createSectionTitle('Sensitivity'));
    const sensitivitySlider = createSlider(
        'Rocket Speed',
        settings.sensitivity,
        0.5,
        2.0,
        0.1,
        (value) => {
            settings.sensitivity = value;
        }
    );
    panel.appendChild(sensitivitySlider);
    
    // Size options (only for joystick mode)
    const sizeSection = document.createElement('div');
    sizeSection.id = 'size-options';
    
    panel.appendChild(createSectionTitle('Button Size'));
    const sizeOptions = [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large 👍' }
    ];
    
    const sizeContainer = createButtonGroup();
    sizeOptions.forEach(opt => {
        const btn = createModeButton(
            opt.label,
            settings.joystickSize === opt.value,
            () => {
                settings.joystickSize = opt.value as 'small' | 'medium' | 'large';
                settings.buttonSize = opt.value as 'small' | 'medium' | 'large';
                updateSizeButtons();
            }
        );
        btn.dataset.size = opt.value;
        sizeContainer.appendChild(btn);
    });
    panel.appendChild(sizeContainer);
    
    // Toggles
    panel.appendChild(createSectionTitle('Options'));
    
    const toggleContainer = document.createElement('div');
    toggleContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 15px;
    `;
    
    // Haptic toggle
    const hapticToggle = createToggle(
        '🔊 Haptic Feedback',
        settings.hapticEnabled,
        (checked) => {
            settings.hapticEnabled = checked;
        }
    );
    toggleContainer.appendChild(hapticToggle);
    
    // Visual feedback toggle
    const visualToggle = createToggle(
        '✨ Visual Effects',
        settings.visualFeedback,
        (checked) => {
            settings.visualFeedback = checked;
        }
    );
    toggleContainer.appendChild(visualToggle);
    
    // Left-handed mode toggle
    const leftHandToggle = createToggle(
        '👋 Left-Handed Mode',
        settings.leftHanded,
        (checked) => {
            settings.leftHanded = checked;
        }
    );
    toggleContainer.appendChild(leftHandToggle);
    
    panel.appendChild(toggleContainer);
    
    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 15px;
        margin-top: 25px;
    `;
    
    // Auto-detect button
    const autoBtn = createActionButton(
        '🔮 Auto-Detect',
        '#4488ff',
        () => {
            const recommended = getRecommendedControlMode();
            settings.mode = recommended;
            updateModeButtons();
            showInstructions(recommended);
        }
    );
    buttonContainer.appendChild(autoBtn);
    
    // Save button
    const saveBtn = createActionButton(
        '💾 Save',
        '#e94560',
        () => {
            saveTouchSettings(settings);
            touchManager.setMode(settings.mode);
            if (onClose) onClose();
            panel.remove();
        }
    );
    buttonContainer.appendChild(saveBtn);
    
    // Cancel button
    const cancelBtn = createActionButton(
        '❌ Cancel',
        '#666',
        () => {
            if (onClose) onClose();
            panel.remove();
        }
    );
    buttonContainer.appendChild(cancelBtn);
    
    panel.appendChild(buttonContainer);
    
    // Helper functions
    function updateModeButtons(): void {
        modeContainer.querySelectorAll('button').forEach(btn => {
            const isSelected = Number(btn.dataset.mode) === settings.mode;
            btn.style.background = isSelected 
                ? 'linear-gradient(135deg, #e94560 0%, #b83650 100%)'
                : 'rgba(61,61,92,0.8)';
            btn.style.borderColor = isSelected ? '#e94560' : '#4d4d6c';
        });
    }
    
    function updateSizeButtons(): void {
        sizeContainer.querySelectorAll('button').forEach(btn => {
            const isSelected = btn.dataset.size === settings.joystickSize;
            btn.style.background = isSelected 
                ? 'linear-gradient(135deg, #4488ff 0%, #3366cc 100%)'
                : 'rgba(61,61,92,0.8)';
            btn.style.borderColor = isSelected ? '#4488ff' : '#4d4d6c';
        });
    }
    
    function showInstructions(mode: ControlMode): void {
        instructions.textContent = getControlInstructions(mode);
        instructions.style.animation = 'none';
        instructions.offsetHeight; // Trigger reflow
        instructions.style.animation = 'pulse 0.5s ease';
    }
    
    // Initialize button states
    updateModeButtons();
    updateSizeButtons();
    
    return panel;
}

// ==================== UI COMPONENTS ====================

function createSectionTitle(text: string): HTMLElement {
    const title = document.createElement('h3');
    title.textContent = text;
    title.style.cssText = `
        color: #ffcc00;
        font-size: 16px;
        margin: 20px 0 10px 0;
        text-transform: uppercase;
        letter-spacing: 2px;
    `;
    return title;
}

function createButtonGroup(): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = `
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
    `;
    return group;
}

function createModeButton(
    label: string,
    selected: boolean,
    onClick: () => void
): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
        padding: 12px 20px;
        border: 2px solid ${selected ? '#e94560' : '#4d4d6c'};
        border-radius: 10px;
        background: ${selected 
            ? 'linear-gradient(135deg, #e94560 0%, #b83650 100%)' 
            : 'rgba(61,61,92,0.8)'};
        color: white;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
    `;
    
    btn.addEventListener('mouseenter', () => {
        if (!selected) {
            btn.style.background = 'rgba(233,69,96,0.3)';
        }
    });
    
    btn.addEventListener('mouseleave', () => {
        if (!selected) {
            btn.style.background = 'rgba(61,61,92,0.8)';
        }
    });
    
    btn.addEventListener('click', onClick);
    
    return btn;
}

function createSlider(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void
): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
        background: rgba(61,61,92,0.5);
        padding: 15px;
        border-radius: 10px;
    `;
    
    const labelRow = document.createElement('div');
    labelRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
    `;
    
    const nameLabel = document.createElement('span');
    nameLabel.textContent = label;
    nameLabel.style.color = '#fff';
    
    const valueLabel = document.createElement('span');
    valueLabel.textContent = `${value.toFixed(1)}x`;
    valueLabel.style.color = '#ffcc00';
    valueLabel.style.fontWeight = 'bold';
    
    labelRow.appendChild(nameLabel);
    labelRow.appendChild(valueLabel);
    container.appendChild(labelRow);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
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
    
    // Custom thumb styles
    const thumbStyles = `
        -webkit-appearance: none;
        appearance: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        cursor: pointer;
        border: 3px solid #e94560;
    `;
    
    // Add thumb styles via inline style injection for the slider
    slider.addEventListener('input', (e) => {
        const newValue = parseFloat((e.target as HTMLInputElement).value);
        valueLabel.textContent = `${newValue.toFixed(1)}x`;
        onChange(newValue);
    });
    
    container.appendChild(slider);
    
    // Add custom CSS for slider thumb
    const styleId = 'touch-slider-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #touch-settings-panel input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #fff;
                box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                cursor: pointer;
                border: 3px solid #e94560;
            }
            #touch-settings-panel input[type="range"]::-moz-range-thumb {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #fff;
                box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                cursor: pointer;
                border: 3px solid #e94560;
            }
        `;
        document.head.appendChild(style);
    }
    
    return container;
}

function createToggle(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void
): HTMLElement {
    const container = document.createElement('label');
    container.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        padding: 10px;
        background: rgba(61,61,92,0.5);
        border-radius: 10px;
        transition: background 0.2s;
    `;
    
    container.addEventListener('mouseenter', () => {
        container.style.background = 'rgba(61,61,92,0.8)';
    });
    
    container.addEventListener('mouseleave', () => {
        container.style.background = 'rgba(61,61,92,0.5)';
    });
    
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    labelSpan.style.cssText = `
        color: #fff;
        font-size: 14px;
    `;
    
    const toggle = document.createElement('div');
    toggle.style.cssText = `
        width: 50px;
        height: 28px;
        background: ${checked ? '#e94560' : '#3d3d5c'};
        border-radius: 14px;
        position: relative;
        transition: background 0.3s;
    `;
    
    const knob = document.createElement('div');
    knob.style.cssText = `
        width: 22px;
        height: 22px;
        background: #fff;
        border-radius: 50%;
        position: absolute;
        top: 3px;
        left: ${checked ? '25px' : '3px'};
        transition: left 0.3s;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;
    
    toggle.appendChild(knob);
    
    // Hidden checkbox for accessibility
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.style.cssText = `
        position: absolute;
        opacity: 0;
        pointer-events: none;
    `;
    
    checkbox.addEventListener('change', (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        toggle.style.background = isChecked ? '#e94560' : '#3d3d5c';
        knob.style.left = isChecked ? '25px' : '3px';
        onChange(isChecked);
    });
    
    // Click on label/toggle toggles checkbox
    container.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
            checkbox.click();
        }
    });
    
    container.appendChild(labelSpan);
    container.appendChild(toggle);
    container.appendChild(checkbox);
    
    return container;
}

function createActionButton(
    label: string,
    color: string,
    onClick: () => void
): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
        flex: 1;
        padding: 15px;
        border: none;
        border-radius: 10px;
        background: ${color};
        color: white;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: transform 0.1s, box-shadow 0.2s;
        font-family: inherit;
        box-shadow: 0 4px 0 ${color}88;
    `;
    
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = `0 6px 0 ${color}88`;
    });
    
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = `0 4px 0 ${color}88`;
    });
    
    btn.addEventListener('mousedown', () => {
        btn.style.transform = 'translateY(2px)';
        btn.style.boxShadow = `0 2px 0 ${color}88`;
    });
    
    btn.addEventListener('mouseup', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = `0 4px 0 ${color}88`;
    });
    
    btn.addEventListener('click', onClick);
    
    return btn;
}

/**
 * Show the touch settings panel
 */
export function showTouchSettings(
    touchManager: TouchControlsManager,
    onClose?: () => void
): void {
    // Remove existing panel if any
    const existing = document.getElementById('touch-settings-panel');
    if (existing) existing.remove();
    
    // Create and show new panel
    const panel = createTouchSettingsUI(touchManager, onClose);
    document.body.appendChild(panel);
    
    // Animate in
    panel.style.opacity = '0';
    panel.style.transform = 'translate(-50%, -50%) scale(0.9)';
    requestAnimationFrame(() => {
        panel.style.transition = 'opacity 0.3s, transform 0.3s';
        panel.style.opacity = '1';
        panel.style.transform = 'translate(-50%, -50%) scale(1)';
    });
}

/**
 * Quick toggle button for touch control settings
 */
export function createTouchSettingsButton(
    touchManager: TouchControlsManager
): HTMLElement {
    const btn = document.createElement('button');
    btn.innerHTML = '🎮';
    btn.title = 'Touch Controls Settings';
    btn.style.cssText = `
        position: fixed;
        top: 20px;
        right: 80px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e94560 0%, #b83650 100%);
        border: 2px solid rgba(255,255,255,0.5);
        color: white;
        font-size: 24px;
        cursor: pointer;
        z-index: 1001;
        box-shadow: 0 4px 15px rgba(233,69,96,0.4);
        transition: transform 0.2s, box-shadow 0.2s;
    `;
    
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.1)';
        btn.style.boxShadow = '0 6px 20px rgba(233,69,96,0.6)';
    });
    
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '0 4px 15px rgba(233,69,96,0.4)';
    });
    
    btn.addEventListener('click', () => {
        showTouchSettings(touchManager);
    });
    
    return btn;
}
