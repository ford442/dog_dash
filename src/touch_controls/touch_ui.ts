/**
 * Touch controls UI — joystick, buttons, and visual feedback
 */

import { ControlMode } from './types';
import { TouchControlsInput } from './touch_input';

export class TouchControlsManager extends TouchControlsInput {
    protected createUI(): void {
        this.createJoystickUI();
        this.createActionButtons();
        this.createFingerFollower();
    }

    protected createJoystickUI(): void {
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

    protected createActionButtons(): void {
        this.boostButton = document.createElement('div');
        this.boostButton.id = 'touch-boost-btn';
        this.boostButton.innerHTML = '💖';
        this.boostButton.style.cssText = this.getButtonStyles('boost');
        this.boostButton.style.right = '40px';
        this.boostButton.style.bottom = '180px';

        this.barkButton = document.createElement('div');
        this.barkButton.id = 'touch-bark-btn';
        this.barkButton.innerHTML = '🐕';
        this.barkButton.style.cssText = this.getButtonStyles('bark');
        this.barkButton.style.right = '40px';
        this.barkButton.style.bottom = '120px';

        this.fireButton = document.createElement('div');
        this.fireButton.id = 'touch-fire-btn';
        this.fireButton.innerHTML = '⭐';
        this.fireButton.style.cssText = this.getButtonStyles('fire');
        this.fireButton.style.right = '40px';
        this.fireButton.style.bottom = '60px';

        const boostLabel = document.createElement('span');
        boostLabel.textContent = 'BOOST';
        boostLabel.style.cssText = this.getLabelStyles();
        this.boostButton.appendChild(boostLabel);

        const barkLabel = document.createElement('span');
        barkLabel.textContent = 'BARK';
        barkLabel.style.cssText = this.getLabelStyles();
        this.barkButton.appendChild(barkLabel);

        const fireLabel = document.createElement('span');
        fireLabel.textContent = 'FIRE';
        fireLabel.style.cssText = this.getLabelStyles();
        this.fireButton.appendChild(fireLabel);

        document.body.appendChild(this.boostButton);
        document.body.appendChild(this.barkButton);
        document.body.appendChild(this.fireButton);
    }

    private getButtonStyles(type: 'boost' | 'bark' | 'fire'): string {
        const size = this.BUTTON_SIZE;
        const pastelColor = type === 'boost'
            ? 'rgba(255,182,193,0.8)'
            : type === 'bark'
                ? 'rgba(255,204,136,0.85)'
                : 'rgba(173,216,230,0.8)';

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

    protected createFingerFollower(): void {
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

    protected createTouchIndicator(id: number, x: number, y: number): void {
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

    protected updateTouchIndicator(id: number, x: number, y: number): void {
        const indicator = this.touchIndicators.get(id);
        if (indicator) {
            indicator.style.left = `${x}px`;
            indicator.style.top = `${y}px`;
        }
    }

    protected removeTouchIndicator(id: number): void {
        const indicator = this.touchIndicators.get(id);
        if (indicator) {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
            this.touchIndicators.delete(id);
        }
    }

    protected updateJoystickKnob(dx: number, dy: number, distance: number): void {
        if (!this.joystickKnob) return;

        const maxDistance = this.joystickConfig.maxDistance * 0.5;
        const clampedDistance = Math.min(distance, this.joystickConfig.maxDistance);
        const scale = clampedDistance / this.joystickConfig.maxDistance;

        const knobX = (dx / distance) * maxDistance * scale || 0;
        const knobY = (dy / distance) * maxDistance * scale || 0;

        this.joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    }

    protected showJoystick(): void {
        if (this.joystickBase) {
            this.joystickBase.style.display = 'block';
            this.joystickBase.style.animation = 'touchPulse 0.3s ease-out';
        }
    }

    protected hideJoystick(): void {
        if (this.joystickBase) {
            this.joystickBase.style.display = 'none';
        }
        if (this.joystickKnob) {
            this.joystickKnob.style.transform = 'translate(-50%, -50%)';
        }
    }

    protected updateFingerFollower(x: number, y: number): void {
        if (this.fingerFollower) {
            this.fingerFollower.style.left = `${x}px`;
            this.fingerFollower.style.top = `${y}px`;
            this.fingerFollower.style.opacity = '1';
        }
    }

    protected hideFingerFollower(): void {
        if (this.fingerFollower) {
            this.fingerFollower.style.opacity = '0';
        }
    }

    protected animateButton(button: HTMLElement | null): void {
        if (!button) return;

        button.style.transform = 'scale(0.9)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 100);
    }

    protected showBoostEffect(x: number, y: number): void {
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

    protected updateUIForMode(): void {
        switch (this.mode) {
            case ControlMode.VIRTUAL_JOYSTICK:
                if (this.boostButton) this.boostButton.style.display = 'flex';
                if (this.barkButton) this.barkButton.style.display = 'flex';
                if (this.fireButton) this.fireButton.style.display = 'flex';
                break;
            case ControlMode.FOLLOW_FINGER:
            case ControlMode.TAP_TO_MOVE:
                if (this.boostButton) this.boostButton.style.display = 'none';
                if (this.barkButton) this.barkButton.style.display = 'none';
                if (this.fireButton) this.fireButton.style.display = 'none';
                break;
        }
    }

    protected updateUIAnimations(): void {
        // Update any continuous UI animations here
    }

    protected removeUI(): void {
        this.joystickContainer?.remove();
        this.boostButton?.remove();
        this.barkButton?.remove();
        this.fireButton?.remove();
        this.fingerFollower?.remove();
        this.touchIndicators.forEach(indicator => indicator.remove());
        this.touchIndicators.clear();
        document.getElementById('touch-animations')?.remove();
    }
}
