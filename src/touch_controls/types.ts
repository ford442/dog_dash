/**
 * Touch controls types and default state
 */

import * as THREE from 'three';

/** Control mode options for touch input */
export enum ControlMode {
    /** Rocket smoothly follows finger position */
    FOLLOW_FINGER,
    /** Virtual joystick on left, action buttons on right */
    VIRTUAL_JOYSTICK,
    /** Tap above/below rocket to move */
    TAP_TO_MOVE
}

/** Current touch input state */
export interface TouchInput {
    /** Vertical movement: -1 (down) to 1 (up) */
    vertical: number;
    /** Horizontal movement: -1 (left) to 1 (right) */
    horizontal: number;
    /** Boost activated */
    boost: boolean;
    /** Barrel roll activated */
    roll: boolean;
    /** Fire weapon */
    fire: boolean;
    /** Pause requested */
    pause: boolean;
    /** Whether there's any active touch */
    active: boolean;
}

/** Individual touch point data */
export interface TouchPoint {
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    startTime: number;
    isJoystick: boolean;
    isButton: boolean;
}

/** Virtual joystick configuration */
export interface JoystickConfig {
    centerX: number;
    centerY: number;
    radius: number;
    deadZone: number;
    maxDistance: number;
}

/** Visual feedback options */
export interface VisualFeedback {
    showTouchIndicator: boolean;
    showJoystick: boolean;
    joystickOpacity: number;
    buttonOpacity: number;
}

/** Default touch input state */
export const DEFAULT_INPUT: TouchInput = {
    vertical: 0,
    horizontal: 0,
    boost: false,
    roll: false,
    fire: false,
    pause: false,
    active: false
};

/** Rocket screen position for follow/tap modes */
export type RocketScreenPosition = THREE.Vector2;

/**
 * Detect if device supports touch
 */
export function detectTouchDevice(): boolean {
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - old IE touch detection
        (window.DocumentTouch && document instanceof window.DocumentTouch)
    );
}
