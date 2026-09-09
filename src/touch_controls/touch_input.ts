/**
 * Touch input handling — gestures, joystick, and touch processing
 */

import { ControlMode, TouchPoint } from './types';
import { TouchControlsBase } from './touch_manager';

export abstract class TouchControlsInput extends TouchControlsBase {
    protected handleTouchStart(e: TouchEvent): void {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            this.processTouchStart(touch.identifier, touch.clientX, touch.clientY);
        }
    }

    protected handleTouchMove(e: TouchEvent): void {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            this.processTouchMove(touch.identifier, touch.clientX, touch.clientY);
        }
    }

    protected handleTouchEnd(e: TouchEvent): void {
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            this.processTouchEnd(touch.identifier);
        }
    }

    protected handleMouseDown(e: MouseEvent): void {
        this.processTouchStart(-1, e.clientX, e.clientY);
    }

    protected handleMouseMove(e: MouseEvent): void {
        this.processTouchMove(-1, e.clientX, e.clientY);
    }

    protected handleMouseUp(e: MouseEvent): void {
        this.processTouchEnd(-1);
    }

    protected processTouchStart(id: number, x: number, y: number): void {
        const now = Date.now();
        const isLeftSide = x < window.innerWidth / 2;
        const isRightSide = x >= window.innerWidth / 2;

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

        if (now - this.lastTapTime < this.doubleTapThreshold) {
            this.currentInput.boost = true;
            this.triggerHaptic(50);
            this.showBoostEffect(x, y);
        }
        this.lastTapTime = now;

        this.pauseHoldTimer = now + this.pauseHoldThreshold;

        if (this.visualFeedback.showTouchIndicator) {
            this.createTouchIndicator(id, x, y);
        }

        switch (this.mode) {
            case ControlMode.VIRTUAL_JOYSTICK:
                if (isLeftSide) {
                    touchPoint.isJoystick = true;
                    this.updateJoystickPositionAt(x, y);
                    this.showJoystick();
                } else if (isRightSide) {
                    if (this.isPointInButton(x, y, 'boost')) {
                        touchPoint.isButton = true;
                        this.currentInput.boost = true;
                        this.animateButton(this.boostButton);
                        this.triggerHaptic(30);
                    } else if (this.isPointInButton(x, y, 'bark')) {
                        touchPoint.isButton = true;
                        this.currentInput.bark = true;
                        this.animateButton(this.barkButton);
                        this.triggerHaptic(35);
                    } else if (this.isPointInButton(x, y, 'fire')) {
                        touchPoint.isButton = true;
                        this.currentInput.fire = true;
                        this.animateButton(this.fireButton);
                        this.triggerHaptic(30);
                    }
                }
                break;

            case ControlMode.FOLLOW_FINGER:
                this.targetRocketY = y;
                this.currentInput.active = true;
                this.updateFingerFollower(x, y);
                break;

            case ControlMode.TAP_TO_MOVE:
                if (y < this.rocketPosition.y - this.TOUCH_TARGET_SIZE) {
                    this.currentInput.vertical = 1;
                } else if (y > this.rocketPosition.y + this.TOUCH_TARGET_SIZE) {
                    this.currentInput.vertical = -1;
                }
                this.currentInput.active = true;
                break;
        }

        this.touches.set(id, touchPoint);
    }

    protected processTouchMove(id: number, x: number, y: number): void {
        const touch = this.touches.get(id);
        if (!touch) return;

        touch.x = x;
        touch.y = y;

        const moveDistance = Math.sqrt(
            Math.pow(x - touch.startX, 2) +
            Math.pow(y - touch.startY, 2)
        );
        if (moveDistance > 20) {
            this.pauseHoldTimer = 0;
        }

        this.updateTouchIndicator(id, x, y);

        switch (this.mode) {
            case ControlMode.VIRTUAL_JOYSTICK:
                if (touch.isJoystick) {
                    this.updateJoystickInput(x, y);
                }
                break;

            case ControlMode.FOLLOW_FINGER:
                this.targetRocketY = y;
                const deltaY = this.rocketPosition.y - y;
                this.currentInput.vertical = Math.max(-1, Math.min(1, deltaY / 100));
                this.updateFingerFollower(x, y);
                break;

            case ControlMode.TAP_TO_MOVE:
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

    protected processTouchEnd(id: number): void {
        const touch = this.touches.get(id);
        if (!touch) return;

        const dx = touch.x - touch.startX;
        const dy = touch.y - touch.startY;
        const duration = Date.now() - touch.startTime;

        if (Math.abs(dy) > this.swipeThreshold && Math.abs(dy) > Math.abs(dx)) {
            if (duration < 300) {
                if (dy < 0) {
                    this.triggerDodge('up');
                } else {
                    this.triggerRoll();
                }
            }
        }

        switch (this.mode) {
            case ControlMode.VIRTUAL_JOYSTICK:
                if (touch.isJoystick) {
                    this.currentInput.vertical = 0;
                    this.currentInput.horizontal = 0;
                    this.hideJoystick();
                }
                if (touch.isButton) {
                    this.currentInput.boost = false;
                    this.currentInput.bark = false;
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

        this.removeTouchIndicator(id);
        this.touches.delete(id);
        this.pauseHoldTimer = 0;
    }

    protected updateJoystickInput(x: number, y: number): void {
        const dx = x - this.joystickConfig.centerX;
        const dy = y - this.joystickConfig.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let normalizedX = 0;
        let normalizedY = 0;

        if (distance > this.joystickConfig.deadZone * this.joystickConfig.radius) {
            normalizedX = (dx / this.joystickConfig.maxDistance);
            normalizedY = -(dy / this.joystickConfig.maxDistance);
        }

        this.currentInput.horizontal = Math.max(-1, Math.min(1, normalizedX));
        this.currentInput.vertical = Math.max(-1, Math.min(1, normalizedY));

        this.updateJoystickKnob(dx, dy, distance);
    }

    protected updateJoystickPosition(): void {
        this.joystickConfig.centerX = this.JOYSTICK_SIZE;
        this.joystickConfig.centerY = window.innerHeight / 2;
    }

    protected updateJoystickPositionAt(x: number, y: number): void {
        const margin = this.JOYSTICK_SIZE;
        this.joystickConfig.centerX = Math.max(margin, Math.min(window.innerWidth / 2 - margin, x));
        this.joystickConfig.centerY = Math.max(margin, Math.min(window.innerHeight - margin, y));

        if (this.joystickBase) {
            this.joystickBase.style.left = `${this.joystickConfig.centerX - this.joystickConfig.radius}px`;
            this.joystickBase.style.top = `${this.joystickConfig.centerY - this.joystickConfig.radius}px`;
        }
    }

    protected isPointInButton(x: number, y: number, buttonType: 'boost' | 'bark' | 'fire'): boolean {
        const button = buttonType === 'boost'
            ? this.boostButton
            : buttonType === 'bark'
                ? this.barkButton
                : this.fireButton;
        if (!button) return false;

        const rect = button.getBoundingClientRect();
        const hitAreaMultiplier = this.HIT_AREA_MULTIPLIER;

        const expandedLeft = rect.left - (rect.width * (hitAreaMultiplier - 1) / 2);
        const expandedTop = rect.top - (rect.height * (hitAreaMultiplier - 1) / 2);
        const expandedRight = rect.right + (rect.width * (hitAreaMultiplier - 1) / 2);
        const expandedBottom = rect.bottom + (rect.height * (hitAreaMultiplier - 1) / 2);

        return x >= expandedLeft && x <= expandedRight && y >= expandedTop && y <= expandedBottom;
    }

    protected triggerDodge(direction: 'up' | 'down'): void {
        this.currentInput.vertical = direction === 'up' ? 1 : -1;
        this.currentInput.boost = true;
        this.triggerHaptic(40);

        setTimeout(() => {
            this.currentInput.boost = false;
        }, 200);
    }

    protected triggerRoll(): void {
        this.currentInput.roll = true;
        this.triggerHaptic(60);

        setTimeout(() => {
            this.currentInput.roll = false;
        }, 150);
    }

    protected triggerHaptic(duration: number): void {
        if (this.hapticAvailable && navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }

    // UI methods implemented in subclass
    protected abstract createTouchIndicator(id: number, x: number, y: number): void;
    protected abstract updateTouchIndicator(id: number, x: number, y: number): void;
    protected abstract removeTouchIndicator(id: number): void;
    protected abstract showBoostEffect(x: number, y: number): void;
    protected abstract updateFingerFollower(x: number, y: number): void;
    protected abstract hideFingerFollower(): void;
    protected abstract showJoystick(): void;
    protected abstract hideJoystick(): void;
    protected abstract updateJoystickKnob(dx: number, dy: number, distance: number): void;
    protected abstract animateButton(button: HTMLElement | null): void;
}
