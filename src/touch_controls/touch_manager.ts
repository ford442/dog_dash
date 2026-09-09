/**
 * Touch controls core — initialization, public API, lifecycle
 */

import * as THREE from 'three';
import {
    ControlMode,
    TouchInput,
    TouchPoint,
    JoystickConfig,
    VisualFeedback,
    DEFAULT_INPUT,
    detectTouchDevice
} from './types';

export abstract class TouchControlsBase {
    protected canvas: HTMLCanvasElement | null = null;
    protected mode: ControlMode = ControlMode.FOLLOW_FINGER;
    protected currentInput: TouchInput = { ...DEFAULT_INPUT };
    protected touches: Map<number, TouchPoint> = new Map();
    protected joystickConfig: JoystickConfig;
    protected visualFeedback: VisualFeedback;

    // UI Elements
    protected joystickContainer: HTMLElement | null = null;
    protected joystickBase: HTMLElement | null = null;
    protected joystickKnob: HTMLElement | null = null;
    protected boostButton: HTMLElement | null = null;
    protected barkButton: HTMLElement | null = null;
    protected fireButton: HTMLElement | null = null;
    protected fingerFollower: HTMLElement | null = null;
    protected touchIndicators: Map<number, HTMLElement> = new Map();

    // State tracking
    protected isVisible: boolean = false;
    protected rocketPosition: THREE.Vector2 = new THREE.Vector2(0, 0);
    protected targetRocketY: number = 0;
    protected doubleTapTimer: number = 0;
    protected lastTapTime: number = 0;
    protected pauseHoldTimer: number = 0;
    protected isPaused: boolean = false;

    // Gesture detection
    protected gestureStartDistance: number = 0;
    protected gestureStartTime: number = 0;
    protected swipeThreshold: number = 50;
    protected doubleTapThreshold: number = 300;
    protected pauseHoldThreshold: number = 1000;

    // Kid-friendly settings
    protected readonly TOUCH_TARGET_SIZE = 80;
    protected readonly HIT_AREA_MULTIPLIER = 1.5;
    protected readonly JOYSTICK_SIZE = 180;
    protected readonly BUTTON_SIZE = 90;

    // Smoothing
    protected smoothedVertical: number = 0;
    protected smoothedHorizontal: number = 0;
    protected smoothingFactor: number = 0.15;

    // Haptic feedback
    protected hapticAvailable: boolean = false;

    // Event handlers
    protected boundTouchStart: (e: TouchEvent) => void;
    protected boundTouchMove: (e: TouchEvent) => void;
    protected boundTouchEnd: (e: TouchEvent) => void;
    protected boundMouseDown: (e: MouseEvent) => void;
    protected boundMouseMove: (e: MouseEvent) => void;
    protected boundMouseUp: (e: MouseEvent) => void;

    private boundHandleResize: () => void;

    constructor() {
        this.joystickConfig = {
            centerX: 100,
            centerY: window.innerHeight / 2,
            radius: this.JOYSTICK_SIZE / 2,
            deadZone: 0.15,
            maxDistance: this.JOYSTICK_SIZE / 2
        };

        this.visualFeedback = {
            showTouchIndicator: true,
            showJoystick: true,
            joystickOpacity: 0.7,
            buttonOpacity: 0.8
        };

        this.hapticAvailable = 'vibrate' in navigator;

        this.boundTouchStart = this.handleTouchStart.bind(this);
        this.boundTouchMove = this.handleTouchMove.bind(this);
        this.boundTouchEnd = this.handleTouchEnd.bind(this);
        this.boundMouseDown = this.handleMouseDown.bind(this);
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseUp = this.handleMouseUp.bind(this);
        this.boundHandleResize = this.handleResize.bind(this);
    }

    initialize(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;

        this.updateJoystickPosition();
        this.createUI();
        this.addEventListeners();

        if (detectTouchDevice()) {
            this.show();
        }

        window.addEventListener('resize', this.boundHandleResize);
    }

    setMode(mode: ControlMode): void {
        this.mode = mode;
        this.resetInput();
        this.updateUIForMode();
    }

    getInput(): TouchInput {
        return { ...this.currentInput };
    }

    update(): void {
        const now = Date.now();

        this.smoothedVertical += (this.currentInput.vertical - this.smoothedVertical) * this.smoothingFactor;
        this.smoothedHorizontal += (this.currentInput.horizontal - this.smoothedHorizontal) * this.smoothingFactor;

        this.currentInput.vertical = this.smoothedVertical;
        this.currentInput.horizontal = this.smoothedHorizontal;

        if (this.doubleTapTimer > 0) {
            this.doubleTapTimer -= 16;
        }

        if (this.pauseHoldTimer > 0 && this.pauseHoldTimer < now) {
            this.currentInput.pause = true;
            this.triggerHaptic(100);
            this.pauseHoldTimer = 0;
        }

        this.updateUIAnimations();
    }

    show(): void {
        this.isVisible = true;
        if (this.joystickContainer) {
            this.joystickContainer.style.opacity = '1';
            this.joystickContainer.style.pointerEvents = 'auto';
        }
        if (this.boostButton) {
            this.boostButton.style.opacity = String(this.visualFeedback.buttonOpacity);
        }
        if (this.fireButton) {
            this.fireButton.style.opacity = String(this.visualFeedback.buttonOpacity);
        }
        if (this.barkButton) {
            this.barkButton.style.opacity = String(this.visualFeedback.buttonOpacity);
        }
    }

    hide(): void {
        this.isVisible = false;
        if (this.joystickContainer) {
            this.joystickContainer.style.opacity = '0';
            this.joystickContainer.style.pointerEvents = 'none';
        }
        if (this.boostButton) {
            this.boostButton.style.opacity = '0';
        }
        if (this.fireButton) {
            this.fireButton.style.opacity = '0';
        }
        if (this.barkButton) {
            this.barkButton.style.opacity = '0';
        }
    }

    isTouchDevice(): boolean {
        return detectTouchDevice();
    }

    setRocketPosition(position: THREE.Vector3, screenPosition?: THREE.Vector2): void {
        if (screenPosition) {
            this.rocketPosition.copy(screenPosition);
        } else if (this.canvas) {
            this.rocketPosition.set(
                position.x + this.canvas.width / 2,
                this.canvas.height / 2 - position.y
            );
        }
    }

    destroy(): void {
        this.removeEventListeners();
        this.removeUI();
        window.removeEventListener('resize', this.boundHandleResize);
    }

    protected addEventListeners(): void {
        if (!this.canvas) return;

        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.boundTouchEnd, { passive: false });
        this.canvas.addEventListener('touchcancel', this.boundTouchEnd, { passive: false });

        this.canvas.addEventListener('mousedown', this.boundMouseDown);
        window.addEventListener('mousemove', this.boundMouseMove);
        window.addEventListener('mouseup', this.boundMouseUp);
    }

    protected removeEventListeners(): void {
        if (!this.canvas) return;

        this.canvas.removeEventListener('touchstart', this.boundTouchStart);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
        this.canvas.removeEventListener('touchend', this.boundTouchEnd);
        this.canvas.removeEventListener('touchcancel', this.boundTouchEnd);

        this.canvas.removeEventListener('mousedown', this.boundMouseDown);
        window.removeEventListener('mousemove', this.boundMouseMove);
        window.removeEventListener('mouseup', this.boundMouseUp);
    }

    protected handleResize(): void {
        this.updateJoystickPosition();
        this.updateUIForMode();
    }

    protected resetInput(): void {
        this.currentInput = { ...DEFAULT_INPUT };
        this.touches.clear();
    }

    protected abstract handleTouchStart(e: TouchEvent): void;
    protected abstract handleTouchMove(e: TouchEvent): void;
    protected abstract handleTouchEnd(e: TouchEvent): void;
    protected abstract handleMouseDown(e: MouseEvent): void;
    protected abstract handleMouseMove(e: MouseEvent): void;
    protected abstract handleMouseUp(e: MouseEvent): void;
    protected abstract createUI(): void;
    protected abstract updateUIForMode(): void;
    protected abstract updateUIAnimations(): void;
    protected abstract removeUI(): void;
    protected abstract updateJoystickPosition(): void;
    protected abstract triggerHaptic(duration: number): void;
}
