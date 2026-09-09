/**
 * Tutorial System UI — overlays, speech bubbles, progress, controls
 */

import * as THREE from 'three';
import { TutorialStep, TUTORIAL_CONFIG } from './types';
import { TutorialSystemCore } from './tutorial_core';

export abstract class TutorialSystemUI extends TutorialSystemCore {
    protected createOverlay(): void {
        this.overlay = document.createElement('div');
        this.overlay.id = 'tutorial-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${TUTORIAL_CONFIG.pastelOverlayColor};
            backdrop-filter: blur(2px);
            z-index: 50;
            pointer-events: none;
            animation: tutorial-fade-in 0.5s ease-out;
        `;
        document.body.appendChild(this.overlay);

        if (!document.getElementById('tutorial-styles')) {
            const styles = document.createElement('style');
            styles.id = 'tutorial-styles';
            styles.textContent = `
                @keyframes tutorial-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes tutorial-fade-out {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes tutorial-bounce {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-10px) scale(1.02); }
                }
                @keyframes tutorial-pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }
                @keyframes tutorial-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                @keyframes tutorial-cursor-up {
                    0%, 100% { transform: translateY(0); opacity: 1; }
                    50% { transform: translateY(-20px); opacity: 0.5; }
                }
                @keyframes tutorial-cursor-down {
                    0%, 100% { transform: translateY(0); opacity: 1; }
                    50% { transform: translateY(20px); opacity: 0.5; }
                }
                @keyframes tutorial-ring-pulse {
                    0% { transform: scale(0.8); opacity: 0.8; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
            `;
            document.head.appendChild(styles);
        }
    }

    protected createSpeechBubble(): void {
        this.speechBubble = document.createElement('div');
        this.speechBubble.id = 'tutorial-speech-bubble';
        this.speechBubble.style.cssText = `
            position: fixed;
            bottom: 180px;
            left: 50%;
            transform: translateX(-50%);
            background: ${TUTORIAL_CONFIG.speechBubbleColor};
            border: 4px solid ${TUTORIAL_CONFIG.speechBubbleBorder};
            border-radius: 30px;
            padding: 20px 30px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(255, 182, 193, 0.4),
                        inset 0 2px 0 rgba(255,255,255,0.8);
            z-index: 60;
            font-family: 'Segoe UI', 'Comic Sans MS', cursive, sans-serif;
            animation: tutorial-float 3s ease-in-out infinite;
        `;

        const dogIcon = document.createElement('div');
        dogIcon.id = 'tutorial-dog-icon';
        dogIcon.style.cssText = `
            font-size: 40px;
            margin-bottom: 10px;
            animation: tutorial-bounce 2s ease-in-out infinite;
        `;
        dogIcon.textContent = '🐕';

        const mainText = document.createElement('div');
        mainText.id = 'tutorial-main-text';
        mainText.style.cssText = `
            font-size: 22px;
            color: #5D4E6D;
            font-weight: bold;
            margin-bottom: 10px;
            line-height: 1.4;
        `;

        const subText = document.createElement('div');
        subText.id = 'tutorial-sub-text';
        subText.style.cssText = `
            font-size: 16px;
            color: #8B7B8B;
            line-height: 1.4;
        `;

        const tail = document.createElement('div');
        tail.style.cssText = `
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 20px solid transparent;
            border-right: 20px solid transparent;
            border-top: 20px solid ${TUTORIAL_CONFIG.speechBubbleBorder};
        `;

        const tailInner = document.createElement('div');
        tailInner.style.cssText = `
            position: absolute;
            bottom: -14px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 16px solid transparent;
            border-right: 16px solid transparent;
            border-top: 16px solid ${TUTORIAL_CONFIG.speechBubbleColor};
        `;

        this.speechBubble.appendChild(dogIcon);
        this.speechBubble.appendChild(mainText);
        this.speechBubble.appendChild(subText);
        this.speechBubble.appendChild(tail);
        this.speechBubble.appendChild(tailInner);

        document.body.appendChild(this.speechBubble);
    }

    protected updateSpeechBubble(mainText: string, subText: string): void {
        const mainEl = document.getElementById('tutorial-main-text');
        const subEl = document.getElementById('tutorial-sub-text');

        if (mainEl) mainEl.textContent = mainText;
        if (subEl) subEl.textContent = subText;
    }

    protected updateSpeechBubblePosition(): void {
        // Speech bubble stays fixed at bottom center
    }

    protected createProgressBar(): void {
        this.progressBar = document.createElement('div');
        this.progressBar.id = 'tutorial-progress';
        this.progressBar.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: rgba(255, 255, 255, 0.9);
            border: 3px solid #FFB6C1;
            border-radius: 20px;
            padding: 10px 15px;
            z-index: 60;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 15px rgba(255, 182, 193, 0.3);
        `;

        const label = document.createElement('span');
        label.style.cssText = `
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            color: #8B7B8B;
            font-weight: 600;
        `;
        label.textContent = 'Tutorial:';

        this.progressBar.appendChild(label);
        document.body.appendChild(this.progressBar);
    }

    protected updateProgressBar(): void {
        if (!this.progressBar) return;

        const existingStars = this.progressBar.querySelectorAll('.tutorial-star');
        existingStars.forEach(s => s.remove());

        const totalSteps = Object.keys(TutorialStep).length / 2 - 1;
        for (let i = 0; i < totalSteps; i++) {
            const star = document.createElement('span');
            star.className = 'tutorial-star';
            star.style.cssText = `
                font-size: ${i === this.currentStep ? 24 : 18}px;
                opacity: ${i <= this.currentStep ? 1 : 0.3};
                transition: all 0.3s ease;
                ${i === this.currentStep ? 'animation: tutorial-pulse 1s ease-in-out infinite;' : ''}
            `;
            star.textContent = i <= this.currentStep ? '⭐' : '⚪';
            this.progressBar.appendChild(star);
        }
    }

    protected createControlButtons(): void {
        this.controlButtons = document.createElement('div');
        this.controlButtons.id = 'tutorial-controls';
        this.controlButtons.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            display: flex;
            gap: 10px;
            z-index: 60;
        `;

        const skipBtn = this.createButton('Skip', '#FFB6C1', () => this.skip());
        const nextBtn = this.createButton('Next ➡️', '#98FB98', () => this.nextStep());
        nextBtn.id = 'tutorial-next-btn';

        this.controlButtons.appendChild(skipBtn);
        this.controlButtons.appendChild(nextBtn);
        document.body.appendChild(this.controlButtons);
    }

    protected createButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.style.cssText = `
            padding: 12px 24px;
            font-size: 16px;
            font-weight: bold;
            background: ${color};
            border: 3px solid white;
            border-radius: 20px;
            color: #5D4E6D;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
            font-family: 'Segoe UI', sans-serif;
        `;
        btn.textContent = text;
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
        });
        btn.addEventListener('click', () => {
            this.audio.play('ui_click');
            onClick();
        });
        return btn;
    }

    protected createHighlightRing(): void {
        const geometry = new THREE.RingGeometry(1, 1.3, 32);
        const material = new THREE.MeshBasicMaterial({
            color: TUTORIAL_CONFIG.highlightRingColor,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });
        this.highlightRing = new THREE.Mesh(geometry, material);
        this.highlightRing.rotation.x = Math.PI / 2;
        this.highlightRing.visible = false;
        this.scene.add(this.highlightRing);
    }

    protected updateHighlightRing(delta: number): void {
        if (!this.highlightRing || !this.highlightRing.visible) return;

        const time = Date.now() * 0.001;
        const scale = 1 + Math.sin(time * 3) * 0.1;
        this.highlightRing.scale.setScalar(scale);

        const targetOpacity = 0.6;
        const material = this.highlightRing.material as THREE.MeshBasicMaterial;
        material.opacity = THREE.MathUtils.lerp(
            material.opacity,
            targetOpacity,
            delta * 3
        );
    }

    protected showHighlightAt(position: THREE.Vector3): void {
        if (!this.highlightRing) return;
        this.highlightRing.position.copy(position);
        this.highlightRing.visible = true;
        (this.highlightRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    protected hideHighlight(): void {
        if (this.highlightRing) {
            this.highlightRing.visible = false;
        }
    }

    protected showEncouragement(): void {
        if (this.currentStep === TutorialStep.COMPLETE) return;

        const message = this.encouragements[Math.floor(Math.random() * this.encouragements.length)];

        const encouragement = document.createElement('div');
        encouragement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 32px;
            font-weight: bold;
            color: #FF69B4;
            text-shadow: 2px 2px 0 #FFF, 0 0 20px rgba(255, 182, 193, 0.8);
            z-index: 70;
            pointer-events: none;
            animation: tutorial-float 2s ease-out forwards;
            font-family: 'Comic Sans MS', cursive, sans-serif;
        `;
        encouragement.textContent = message;
        document.body.appendChild(encouragement);

        setTimeout(() => encouragement.remove(), 2000);

        if (Math.random() < 0.3) {
            if (typeof this.audio.playMagicSound === 'function') {
                this.audio.playMagicSound('happy');
            } else {
                this.audio.play('giggle');
            }
        }
    }

    protected showCompletionCelebration(): void {
        const celebration = document.createElement('div');
        celebration.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(255,182,193,0.9), rgba(230,230,250,0.9));
            z-index: 100;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            animation: tutorial-fade-in 0.5s ease-out;
        `;

        celebration.innerHTML = `
            <div style="font-size: 80px; margin-bottom: 20px; animation: tutorial-bounce 1s ease-in-out infinite;">
                🎉🐕🌙
            </div>
            <h1 style="font-size: 42px; color: #5D4E6D; margin: 0 0 20px 0; text-shadow: 2px 2px 0 #FFF;">
                You're Ready! ✨
            </h1>
            <p style="font-size: 24px; color: #8B7B8B; text-align: center;">
                Have the best space adventure ever! 🚀💫
            </p>
        `;

        document.body.appendChild(celebration);

        setTimeout(() => {
            celebration.style.animation = 'tutorial-fade-out 0.5s ease-out forwards';
            setTimeout(() => celebration.remove(), 500);
        }, 2000);
    }
}
