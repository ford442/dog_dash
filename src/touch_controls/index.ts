export {
    ControlMode,
    DEFAULT_INPUT,
    detectTouchDevice
} from './types';
export type {
    TouchInput,
    TouchPoint,
    JoystickConfig,
    VisualFeedback
} from './types';
export { TouchControlsManager } from './touch_ui';
export {
    createVirtualJoystickUI,
    getControlInstructions,
    isTouchPrimary,
    getRecommendedControlMode
} from './helpers';
