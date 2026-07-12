/**
 * Touch controls helper utilities
 */

import { ControlMode, detectTouchDevice } from './types';
import { TouchControlsManager } from './touch_ui';

/**
 * Create and initialize the virtual joystick UI in a container
 */
export function createVirtualJoystickUI(container: HTMLElement): void {
    const manager = new TouchControlsManager();
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    container.appendChild(canvas);
    manager.initialize(canvas);
    manager.setMode(ControlMode.VIRTUAL_JOYSTICK);
    manager.show();
}

/**
 * Get touch control instructions for the current mode
 */
export function getControlInstructions(mode: ControlMode): string {
    switch (mode) {
        case ControlMode.FOLLOW_FINGER:
            return 'Touch and drag anywhere to fly the rocket! Double-tap for boost!';
        case ControlMode.VIRTUAL_JOYSTICK:
            return 'Left side: drag to move. Right side: buttons for boost and fire!';
        case ControlMode.TAP_TO_MOVE:
            return 'Tap above rocket to go up, below to go down. Hold to keep moving!';
    }
}

/**
 * Check if touch is the primary input method
 */
export function isTouchPrimary(): boolean {
    return detectTouchDevice() && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Auto-detect best control mode for device
 */
export function getRecommendedControlMode(): ControlMode {
    if (!detectTouchDevice()) {
        return ControlMode.FOLLOW_FINGER;
    }

    const screenWidth = window.innerWidth;

    if (screenWidth < 600) {
        return ControlMode.FOLLOW_FINGER;
    } else if (screenWidth < 1024) {
        return ControlMode.VIRTUAL_JOYSTICK;
    } else {
        return ControlMode.VIRTUAL_JOYSTICK;
    }
}
