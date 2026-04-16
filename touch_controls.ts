/**
 * Touch Controls System for Dog Dash
 * Kid-friendly touch controls for tablets and phones
 * Perfect for 7-year-old fingers! 📱✨👆
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
    /** Fire weapon */
    fire: boolean;
    /** Pause requested */
    pause: boolean;
    /** Whether there's any active touch */
    active: boolean;
}

/** Individual touch point data */
interface TouchPoint {
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
interface JoystickConfig {
    centerX: number;
    centerY: number;
    radius: number;
    deadZone: number;
    maxDistance: number;
}

/** Visual feedback options */
interface VisualFeedback {
    showTouchIndicator: boolean;
    showJoystick: boolean;
    joystickOpacity: number;
    buttonOpacity: number;
}

/** Default touch input state */
const DEFAULT_INPUT: TouchInput = {
    vertical: 0,
    horizontal: 0,
    boost: false,
    fire: false,
    pause: false,
    active: false
};

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

/**
 * Main touch controls manager class
 * Handles all touch input modes and visual feedback
 */
export class TouchControlsManager {
    private canvas: HTMLCanvasElement | null = null;
    private mode: ControlMode = ControlMode.FOLLOW_FINGER;
    private currentInput: TouchInput = { ...DEFAULT_INPUT };
    private touches: Map<number, TouchPoint> = new Map();
    private joystickConfig: JoystickConfig;
    private visualFeedback: VisualFeedback;
    
    // UI Elements
    private joystickContainer: HTMLElement | null = null;
    private joystickBase: HTMLElement | null = null;
    private joystickKnob: HTMLElement | null = null;
    private boostButton: HTMLElement | null = null;
    private fireButton: HTMLElement | null = null;
    private fingerFollower: HTMLElement | null = null;
    private touchIndicators: Map<number, HTMLElement> = new Map();
    
    // State tracking
    private isVisible: boolean = false;
    private rocketPosition: THREE.Vector2 = new THREE.Vector2(0, 0);
    private targetRocketY: number = 0;
    private doubleTapTimer: number = 0;
    private lastTapTime: number = 0;
    private pauseHoldTimer: number = 0;
    private isPaused: boolean = false;
    
    // Gesture detection
    private gestureStartDistance: number = 0;
    private gestureStartTime: number = 0;
    private swipeThreshold: number = 50;
    private doubleTapThreshold: number = 300;
    private pauseHoldThreshold: number = 1000;
    
    // Kid-friendly settings (large targets!)
    private readonly TOUCH_TARGET_SIZE = 80; // Minimum touch target size in pixels
    private readonly HIT_AREA_MULTIPLIER = 1.5; // 50% larger hit area
    private readonly JOYSTICK_SIZE = 180; // Large joystick for small fingers
    private readonly BUTTON_SIZE = 90; // Large buttons
    
    // Smoothing
    private smoothedVertical: number = 0;
    private smoothedHorizontal: number = 0;
    private smoothingFactor: number = 0.15;
    
    // Haptic feedback availability
    private hapticAvailable: boolean = false;
    
    // Event handlers (bound for proper removal)
    private boundTouchStart: (e: TouchEvent) => void;
    private boundTouchMove: (e: TouchEvent) => void;
    private boundTouchEnd: (e: TouchEvent) => void;
    private boundMouseDown: (e: MouseEvent) => void;
    private boundMouseMove: (e: MouseEvent) => void;
    private boundMouseUp: (e: MouseEvent) => void;

    constructor() {
        // Default joystick config (will be updated on init)
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
        
        // Check for haptic support
        this.hapticAvailable = 'vibrate' in navigator;
        
        // Bind event handlers
        this.boundTouchStart = this.handleTouchStart.bind(this);
        this.boundTouchMove = this.handleTouchMove.bind(this);
        this.boundTouchEnd = this.handleTouchEnd.bind(this);
        this.boundMouseDown = this.handleMouseDown.bind(this);
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseUp = this.handleMouseUp.bind(this);
    }

    /**
     * Initialize touch controls on the canvas
     */
    initialize(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        
        // Update joystick position for left side
        this.updateJoystickPosition();
        
        // Create UI elements
        this.createUI();
        
        // Add event listeners
        this.addEventListeners();
        
        // Show controls by default on touch devices
        if (detectTouchDevice()) {
            this.show();
        }
        
        // Handle resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * Set the control mode
     */
    setMode(mode: ControlMode): void {
        this.mode = mode;
        this.resetInput();
        this.updateUIForMode();
    }

    /**
     * Get current input state
     */
    getInput(): TouchInput {
        return { ...this.currentInput };
    }

    /**
     * Update loop - call this every frame
     */
    update(): void {
        const now = Date.now();
        
        // Smooth the input values
        this.smoothedVertical += (this.currentInput.vertical - this.smoothedVertical) * this.smoothingFactor;
        this.smoothedHorizontal += (this.currentInput.horizontal - this.smoothedHorizontal) * this.smoothingFactor;
        
        // Update input with smoothed values
        this.currentInput.vertical = this.smoothedVertical;
        this.currentInput.horizontal = this.smoothedHorizontal;
        
        // Update double tap timer
        if (this.doubleTapTimer > 0) {
            this.doubleTapTimer -= 16; // Approximate for 60fps
        }
        
        // Check for pause hold
        if (this.pauseHoldTimer > 0 && this.pauseHoldTimer < now) {
            this.currentInput.pause = true;
            this.triggerHaptic(100);
            this.pauseHoldTimer = 0;
        }
        
        // Update UI animations
        this.updateUIAnimations();
    }

    /**
     * Show touch controls
     */
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
    }

    /**
     * Hide touch controls
     */
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
    }

    /**
     * Check if this is a touch device
     */
    isTouchDevice(): boolean {
        return detectTouchDevice();
    }

    /**
     * Set the rocket's current position (for follow mode and tap-to-move)
     */
    setRocketPosition(position: THREE.Vector3, screenPosition?: THREE.Vector2): void {
        if (screenPosition) {
            this.rocketPosition.copy(screenPosition);
        } else if (this.canvas) {
            // Convert 3D position to screen space
            this.rocketPosition.set(
                position.x + this.canvas.width / 2,
                this.canvas.height / 2 - position.y
            );
        }
    }

    /**
     * Clean up and remove event listeners
     */
    destroy(): void {
        this.removeEventListeners();
        this.removeUI();
        window.removeEventListener('resize', this.handleResize.bind(this));
    }

    // ==================== PRIVATE METHODS ====================

    private addEventListeners(): void {
        if (!this.canvas) return;
        
        // Touch events
        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.boundTouchEnd, { passive: false });
        this.canvas.addEventListener('touchcancel', this.boundTouchEnd, { passive: false });
        
        // Mouse events (for testing on desktop)
        this.canvas.addEventListener('mousedown', this.boundMouseDown);
        window.addEventListener('mousemove', this.boundMouseMove);
        window.addEventListener('mouseup', this.boundMouseUp);
    }

    private removeEventListeners(): void {
        if (!this.canvas) return;
        
        this.canvas.removeEventListener('touchstart', this.boundTouchStart);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
        this.canvas.removeEventListener('touchend', this.boundTouchEnd);
        this.canvas.removeEventListener('touchcancel', this.boundTouchEnd);
        
        this.canvas.removeEventListener('mousedown', this.boundMouseDown);
        window.removeEventListener('mousemove', this.boundMouseMove);
        window.removeEventListener('mouseup', this.boundMouseUp);
    }

    private handleTouchStart(e: TouchEvent): void {
        e.preventDefault();
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            this.processTouchStart(touch.identifier, touch.clientX, touch.clientY);
        }
    }

    private handleTouchMove(e: TouchEvent): void {
        e.preventDefault();
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            this.processTouchMove(touch.identifier, touch.clientX, touch.clientY);
        }
    }

    private handleTouchEnd(e: TouchEvent): void {
        e.preventDefault();
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            this.processTouchEnd(touch.identifier);
        }
    }

    private handleMouseDown(e: MouseEvent): void {
        this.processTouchStart(-1, e.clientX, e.clientY);
    }

    private handleMouseMove(e: MouseEvent): void {
        this.processTouchMove(-1, e.clientX, e.clientY);
    }

    private handleMouseUp(e: MouseEvent): void {
        this.processTouchEnd(-1);
    }

    private processTouchStart(id: number, x: number, y: number): void {
        const now = Date.now();
        const isLeftSide = x < window.innerWidth / 2;
        const isRightSide = x >= window.innerWidth / 2;
        
        // Create touch point
        const touchPoint: TouchPoint = {
            id,
            x,
            y,
            startX: x,
            startY: y,
            startTime: now,
            isJoystick: false,
            isButton: false
        };
        
        // Check for double tap (anywhere on screen)
        if (now - this.lastTapTime < this.doubleTapThreshold) {
            this.currentInput.boost = true;
            this.triggerHaptic(50);
            this.showBoostEffect(x, y);
        }
        this.lastTapTime = now;
        
        // Start pause hold timer
        this.pauseHoldTimer = now + this.pauseHoldThreshold;
        
        // Create visual indicator
        if (this.visualFeedback.showTouchIndicator) {
            this.createTouchIndicator(id, x, y);
        }
        
        // Handle based on mode
        switch (this.mode) {
            case ControlMode.VIRTUAL_JOYSTICK:
                if (isLeftSide) {
                    touchPoint.isJoystick = true;
                    this.updateJoystickPositionAt(x, y);
                    this.showJoystick();
                } else if (isRightSide) {
                    // Check action buttons
                    if (this.isPointInButton(x, y, 'boost')) {
                        touchPoint.isButton = true;
                        this.currentInput.boost = true;
                        this.animateButton(this.boostButton);
                        this.triggerHaptic(30);
                    } else if (this.isPointInButton(x, y, 'fire')) {
                        touchPoint.isButton = true;
                        this.currentInput.fire = true;
                        this.animateButton(this.fireButton);
                        this.triggerHaptic(30);
                    }
                }
                break;
                
            case ControlMode.FOLLOW_FINGER:
                // Follow mode - track this touch for movement
                this.targetRocketY = y;
                this.currentInput.active = true;
                this.updateFingerFollower(x, y);
                break;
                
            case ControlMode.TAP_TO_MOVE:
                // Determine direction based on tap position relative to rocket
                if (y < this.rocketPosition.y - this.TOUCH_TARGET_SIZE) {
                    this.currentInput.vertical = 1; // Move up
                } else if (y > this.rocketPosition.y + this.TOUCH_TARGET_SIZE) {
                    this.currentInput.vertical = -1; // Move down
                }
                this.currentInput.active = true;
                break;
        }
        
        this.touches.set(id, touchPoint);
    }

    private processTouchMove(id: number, x: number, y: number): void {
        const touch = this.touches.get(id);
        if (!touch) return;
        
        touch.x = x;
        touch.y = y;
        
        // Cancel pause hold if moved too much
        const moveDistance = Math.sqrt(
            Math.pow(x - touch.startX, 2) + 
            Math.pow(y - touch.startY, 2)
        );
        if (moveDistance > 20) {
            this.pauseHoldTimer = 0;
        }
        
        // Update visual indicator
        this.updateTouchIndicator(id, x, y);
        
        // Handle based on mode
        switch (this.mode) {
            case ControlMode.VIRTUAL_JOYSTICK:
                if (touch.isJoystick) {
                    this.updateJoystickInput(x, y);
                }
                break;
                
            case ControlMode.FOLLOW_FINGER:
                this.targetRocketY = y;
                // Calculate relative movement
                const deltaY = this.rocketPosition.y - y;
                this.currentInput.vertical = Math.max(-1, Math.min(1, deltaY / 100));
                this.updateFingerFollower(x, y);
                break;
                
            case ControlMode.TAP_TO_MOVE:
                // Continuous movement while holding
                if (y < this.rocketPosition.y - this.TOUCH_TARGET_SIZE) {
                    this.currentInput.vertical = 1;
                } else if (y > this.rocketPosition.y + this.TOUCH_TARGET_SIZE) {
                    this.currentInput.vertical = -1;
                } else {
                    this.currentInput.vertical = 0;
                }
                break;
        }
    }

    private processTouchEnd(id: number): void {
        const touch = this.touches.get(id);
        if (!touch) return;
        
        // Check for swipe gesture
        const dx = touch.x - touch.startX;
        const dy = touch.y - touch.startY;
        const duration = Date.now() - touch.startTime;
        
        // Detect swipe up/down for dodge
        if (Math.abs(dy) > this.swipeThreshold && Math.abs(dy) > Math.abs(dx)) {
            if (duration < 300) { // Quick swipe
                if (dy < 0) {
                    this.triggerDodge('up');
                } else {
                    this.triggerDodge('down');
                }
            }
        }
        
        // Reset inputs based on mode
        switch (this.mode) {
            case ControlMode.VIRTUAL_JOYSTICK:
                if (touch.isJoystick) {
                    this.currentInput.vertical = 0;
                    this.currentInput.horizontal = 0;
                    this.hideJoystick();
                }
                if (touch.isButton) {
                    this.currentInput.boost = false;
                    this.currentInput.fire = false;
                }
                break;
                
            case ControlMode.FOLLOW_FINGER:
            case ControlMode.TAP_TO_MOVE:
                this.currentInput.vertical = 0;
                this.currentInput.active = false;
                this.hideFingerFollower();
                break;
        }
        
        // Remove touch indicator
        this.removeTouchIndicator(id);
        
        // Clear touch
        this.touches.delete(id);
        
        // Reset pause timer
        this.pauseHoldTimer = 0;
    }

    private updateJoystickInput(x: number, y: number): void {
        const dx = x - this.joystickConfig.centerX;
        const dy = y - this.joystickConfig.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate normalized input
        let normalizedX = 0;
        let normalizedY = 0;
        
        if (distance > this.joystickConfig.deadZone * this.joystickConfig.radius) {
            const clampedDistance = Math.min(distance, this.joystickConfig.maxDistance);
            normalizedX = (dx / this.joystickConfig.maxDistance);
            normalizedY = -(dy / this.joystickConfig.maxDistance); // Invert Y (up is positive)
        }
        
        this.currentInput.horizontal = Math.max(-1, Math.min(1, normalizedX));
        this.currentInput.vertical = Math.max(-1, Math.min(1, normalizedY));
        
        // Update joystick knob position
        this.updateJoystickKnob(dx, dy, distance);
    }

    private updateJoystickPosition(): void {
        this.joystickConfig.centerX = this.JOYSTICK_SIZE;
        this.joystickConfig.centerY = window.innerHeight / 2;
    }

    private updateJoystickPositionAt(x: number, y: number): void {
        // Keep joystick within bounds
        const margin = this.JOYSTICK_SIZE;
        this.joystickConfig.centerX = Math.max(margin, Math.min(window.innerWidth / 2 - margin, x));
        this.joystickConfig.centerY = Math.max(margin, Math.min(window.innerHeight - margin, y));
        
        // Update UI position
        if (this.joystickBase) {
            this.joystickBase.style.left = `${this.joystickConfig.centerX - this.joystickConfig.radius}px`;
            this.joystickBase.style.top = `${this.joystickConfig.centerY - this.joystickConfig.radius}px`;
        }
    }

    private handleResize(): void {
        this.updateJoystickPosition();
        this.updateUIForMode();
    }

    private resetInput(): void {
        this.currentInput = { ...DEFAULT_INPUT };
        this.touches.clear();
    }

    // ==================== UI CREATION ====================

    private createUI(): void {
        this.createJoystickUI();
        this.createActionButtons();
        this.createFingerFollower();
    }

    private createJoystickUI(): void {
        // Container
        this.joystickContainer = document.createElement('div');
        this.joystickContainer.id = 'touch-joystick-container';
        this.joystickContainer.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // Joystick base (pastel circle with glow)
        this.joystickBase = document.createElement('div');
        this.joystickBase.id = 'joystick-base';
        this.joystickBase.style.cssText = `
            position: absolute;
            width: ${this.JOYSTICK_SIZE}px;
            height: ${this.JOYSTICK_SIZE}px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,182,193,0.6) 0%, rgba(255,218,185,0.4) 50%, rgba(230,230,250,0.2) 100%);
            border: 3px solid rgba(255,182,193,0.8);
            box-shadow: 
                0 0 20px rgba(255,182,193,0.5),
                inset 0 0 20px rgba(255,255,255,0.3);
            transform: translate(-50%, -50%);
            left: ${this.joystickConfig.centerX}px;
            top: ${this.joystickConfig.centerY}px;
            display: none;
        `;
        
        // Joystick knob (smaller inner circle)
        this.joystickKnob = document.createElement('div');
        this.joystickKnob.id = 'joystick-knob';
        this.joystickKnob.style.cssText = `
            position: absolute;
            width: ${this.JOYSTICK_SIZE * 0.4}px;
            height: ${this.JOYSTICK_SIZE * 0.4}px;
            border-radius: 50%;
            background: radial-gradient(circle, #ffffff 0%, #ffdab9 100%);
            box-shadow: 0 4px 15px rgba(255,182,193,0.6);
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            transition: transform 0.05s ease-out;
        `;
        
        this.joystickBase.appendChild(this.joystickKnob);
        this.joystickContainer.appendChild(this.joystickBase);
        document.body.appendChild(this.joystickContainer);
    }

    private createActionButtons(): void {
        // Boost button (heart shape using CSS)
        this.boostButton = document.createElement('div');
        this.boostButton.id = 'touch-boost-btn';
        this.boostButton.innerHTML = '💖';
        this.boostButton.style.cssText = this.getButtonStyles('boost');
        this.boostButton.style.right = '40px';
        this.boostButton.style.bottom = '180px';
        
        // Fire button (star shape)
        this.fireButton = document.createElement('div');
        this.fireButton.id = 'touch-fire-btn';
        this.fireButton.innerHTML = '⭐';
        this.fireButton.style.cssText = this.getButtonStyles('fire');
        this.fireButton.style.right = '40px';
        this.fireButton.style.bottom = '60px';
        
        // Add labels
        const boostLabel = document.createElement('span');
        boostLabel.textContent = 'BOOST';
        boostLabel.style.cssText = this.getLabelStyles();
        this.boostButton.appendChild(boostLabel);
        
        const fireLabel = document.createElement('span');
        fireLabel.textContent = 'FIRE';
        fireLabel.style.cssText = this.getLabelStyles();
        this.fireButton.appendChild(fireLabel);
        
        document.body.appendChild(this.boostButton);
        document.body.appendChild(this.fireButton);
    }

    private getButtonStyles(type: 'boost' | 'fire'): string {
        const size = this.BUTTON_SIZE;
        const pastelColor = type === 'boost' 
            ? 'rgba(255,182,193,0.8)' // Pastel pink
            : 'rgba(173,216,230,0.8)'; // Pastel blue
        
        return `
            position: fixed;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: radial-gradient(circle, ${pastelColor} 0%, rgba(255,255,255,0.4) 100%);
            border: 3px solid rgba(255,255,255,0.9);
            box-shadow: 
                0 0 25px ${pastelColor},
                inset 0 0 15px rgba(255,255,255,0.5);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: ${size * 0.4}px;
            cursor: pointer;
            user-select: none;
            -webkit-user-select: none;
            z-index: 1000;
            opacity: ${this.visualFeedback.buttonOpacity};
            transition: transform 0.1s, box-shadow 0.2s;
        `;
    }

    private getLabelStyles(): string {
        return `
            position: absolute;
            bottom: -25px;
            font-size: 12px;
            color: rgba(255,255,255,0.9);
            font-weight: bold;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            letter-spacing: 1px;
        `;
    }

    private createFingerFollower(): void {
        this.fingerFollower = document.createElement('div');
        this.fingerFollower.id = 'finger-follower';
        this.fingerFollower.style.cssText = `
            position: fixed;
            width: ${this.TOUCH_TARGET_SIZE}px;
            height: ${this.TOUCH_TARGET_SIZE}px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,215,0,0.6) 0%, rgba(255,182,193,0.3) 50%, transparent 100%);
            border: 2px solid rgba(255,255,255,0.8);
            box-shadow: 
                0 0 30px rgba(255,215,0,0.5),
                inset 0 0 20px rgba(255,255,255,0.4);
            pointer-events: none;
            z-index: 999;
            opacity: 0;
            transform: translate(-50%, -50%);
            transition: opacity 0.2s ease;
        `;
        document.body.appendChild(this.fingerFollower);
    }

    private createTouchIndicator(id: number, x: number, y: number): void {
        const indicator = document.createElement('div');
        indicator.className = 'touch-indicator';
        indicator.dataset.touchId = String(id);
        indicator.style.cssText = `
            position: fixed;
            width: ${this.TOUCH_TARGET_SIZE * 0.8}px;
            height: ${this.TOUCH_TARGET_SIZE * 0.8}px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(173,216,230,0.6) 0%, transparent 70%);
            border: 2px solid rgba(255,255,255,0.6);
            pointer-events: none;
            z-index: 998;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%);
            animation: touchPulse 0.3s ease-out;
        `;
        
        // Add animation keyframes if not already added
        if (!document.getElementById('touch-animations')) {
            const style = document.createElement('style');
            style.id = 'touch-animations';
            style.textContent = `
                @keyframes touchPulse {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
                }
                @keyframes boostBurst {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(3); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(indicator);
        this.touchIndicators.set(id, indicator);
    }

    private updateTouchIndicator(id: number, x: number, y: number): void {
        const indicator = this.touchIndicators.get(id);
        if (indicator) {
            indicator.style.left = `${x}px`;
            indicator.style.top = `${y}px`;
        }
    }

    private removeTouchIndicator(id: number): void {
        const indicator = this.touchIndicators.get(id);
        if (indicator) {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
            this.touchIndicators.delete(id);
        }
    }

    // ==================== UI UPDATES ====================

    private updateJoystickKnob(dx: number, dy: number, distance: number): void {
        if (!this.joystickKnob) return;
        
        const maxDistance = this.joystickConfig.maxDistance * 0.5;
        const clampedDistance = Math.min(distance, this.joystickConfig.maxDistance);
        const scale = clampedDistance / this.joystickConfig.maxDistance;
        
        const knobX = (dx / distance) * maxDistance * scale || 0;
        const knobY = (dy / distance) * maxDistance * scale || 0;
        
        this.joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    }

    private showJoystick(): void {
        if (this.joystickBase) {
            this.joystickBase.style.display = 'block';
            this.joystickBase.style.animation = 'touchPulse 0.3s ease-out';
        }
    }

    private hideJoystick(): void {
        if (this.joystickBase) {
            this.joystickBase.style.display = 'none';
        }
        if (this.joystickKnob) {
            this.joystickKnob.style.transform = 'translate(-50%, -50%)';
        }
    }

    private updateFingerFollower(x: number, y: number): void {
        if (this.fingerFollower) {
            this.fingerFollower.style.left = `${x}px`;
            this.fingerFollower.style.top = `${y}px`;
            this.fingerFollower.style.opacity = '1';
        }
    }

    private hideFingerFollower(): void {
        if (this.fingerFollower) {
            this.fingerFollower.style.opacity = '0';
        }
    }

    private animateButton(button: HTMLElement | null): void {
        if (!button) return;
        
        button.style.transform = 'scale(0.9)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 100);
    }

    private showBoostEffect(x: number, y: number): void {
        const burst = document.createElement('div');
        burst.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,215,0,0.8) 0%, transparent 70%);
            pointer-events: none;
            z-index: 2000;
            transform: translate(-50%, -50%);
            animation: boostBurst 0.5s ease-out forwards;
        `;
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 500);
    }

    private updateUIForMode(): void {
        switch (this.mode) {
            case ControlMode.VIRTUAL_JOYSTICK:
                if (this.boostButton) this.boostButton.style.display = 'flex';
                if (this.fireButton) this.fireButton.style.display = 'flex';
                break;
            case ControlMode.FOLLOW_FINGER:
            case ControlMode.TAP_TO_MOVE:
                if (this.boostButton) this.boostButton.style.display = 'none';
                if (this.fireButton) this.fireButton.style.display = 'none';
                break;
        }
    }

    private updateUIAnimations(): void {
        // Update any continuous UI animations here
    }

    private removeUI(): void {
        this.joystickContainer?.remove();
        this.boostButton?.remove();
        this.fireButton?.remove();
        this.fingerFollower?.remove();
        this.touchIndicators.forEach(indicator => indicator.remove());
        this.touchIndicators.clear();
        document.getElementById('touch-animations')?.remove();
    }

    // ==================== HELPER METHODS ====================

    private isPointInButton(x: number, y: number, buttonType: 'boost' | 'fire'): boolean {
        const button = buttonType === 'boost' ? this.boostButton : this.fireButton;
        if (!button) return false;
        
        const rect = button.getBoundingClientRect();
        const hitAreaMultiplier = this.HIT_AREA_MULTIPLIER;
        
        // Expand hit area by 50% for kid-friendly targeting
        const expandedLeft = rect.left - (rect.width * (hitAreaMultiplier - 1) / 2);
        const expandedTop = rect.top - (rect.height * (hitAreaMultiplier - 1) / 2);
        const expandedRight = rect.right + (rect.width * (hitAreaMultiplier - 1) / 2);
        const expandedBottom = rect.bottom + (rect.height * (hitAreaMultiplier - 1) / 2);
        
        return x >= expandedLeft && x <= expandedRight && y >= expandedTop && y <= expandedBottom;
    }

    private triggerDodge(direction: 'up' | 'down'): void {
        // Quick boost in dodge direction
        this.currentInput.vertical = direction === 'up' ? 1 : -1;
        this.currentInput.boost = true;
        this.triggerHaptic(40);
        
        // Reset boost after short delay
        setTimeout(() => {
            this.currentInput.boost = false;
        }, 200);
    }

    private triggerHaptic(duration: number): void {
        if (this.hapticAvailable && navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }
}

/**
 * Create and initialize the virtual joystick UI in a container
 * Utility function for external use
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
        // Desktop - recommend keyboard but enable follow finger
        return ControlMode.FOLLOW_FINGER;
    }
    
    // Mobile/tablet
    const screenWidth = window.innerWidth;
    
    if (screenWidth < 600) {
        // Small phone - follow finger is easiest
        return ControlMode.FOLLOW_FINGER;
    } else if (screenWidth < 1024) {
        // Tablet - virtual joystick works well
        return ControlMode.VIRTUAL_JOYSTICK;
    } else {
        // Large tablet - any mode works
        return ControlMode.VIRTUAL_JOYSTICK;
    }
}
