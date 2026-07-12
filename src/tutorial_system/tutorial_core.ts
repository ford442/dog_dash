/**
 * Tutorial System core — state, public API, and lifecycle
 */

import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { DogCockpitController, DogAnimationState } from '../dog_cockpit';
import { HUDManager } from '../hud_system';
import { SpaceKitty } from '../space_friends';
import { TutorialStep, TUTORIAL_CONFIG, TutorialOrb } from './types';
import { saveTutorialCompletion } from './persistence';

export abstract class TutorialSystemCore {
    protected scene: THREE.Scene;
    protected hud: HUDManager;
    protected audio: AudioSystem;
    protected dogController: DogCockpitController;

    // State
    protected currentStep: TutorialStep = TutorialStep.WELCOME;
    protected isActive: boolean = false;
    protected isComplete: boolean = false;
    protected stepTimer: number = 0;
    protected encouragementTimer: number = 0;

    // Visual elements
    protected overlay?: HTMLDivElement;
    protected speechBubble?: HTMLDivElement;
    protected progressBar?: HTMLDivElement;
    protected controlButtons?: HTMLDivElement;
    protected highlightRing?: THREE.Mesh;
    protected cursorAnimation?: HTMLDivElement;
    protected encouragementText?: HTMLDivElement;

    // Tutorial objects
    protected tutorialOrbs: TutorialOrb[] = [];
    protected spaceKitty?: SpaceKitty;
    protected collectedOrbs: number = 0;
    protected targetOrbCount: number = 3;

    // Callbacks
    protected onCompleteCallback?: () => void;
    protected onSkipCallback?: () => void;

    // Encouragement messages
    protected encouragements = [
        "You're doing great! ⭐",
        "So good! Keep going! 🌟",
        "Wow, amazing! ✨",
        "You're a natural! 🎉",
        "Super star! 💫",
        "Perfect! 🌈",
        "Yay! 🎊"
    ];

    constructor(
        scene: THREE.Scene,
        hud: HUDManager,
        audio: AudioSystem,
        dogController: DogCockpitController
    ) {
        this.scene = scene;
        this.hud = hud;
        this.audio = audio;
        this.dogController = dogController;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    start(): void {
        if (this.isActive) return;

        this.isActive = true;
        this.currentStep = TutorialStep.WELCOME;
        this.stepTimer = 0;
        this.collectedOrbs = 0;

        this.createOverlay();
        this.createSpeechBubble();
        this.createProgressBar();
        this.createControlButtons();
        this.createHighlightRing();

        this.showStep(TutorialStep.WELCOME);

        console.log('🐕📚 Tutorial started! Let the magic begin! ✨');
    }

    nextStep(): void {
        if (!this.isActive || this.isComplete) return;

        const next = this.currentStep + 1;
        if (next >= TutorialStep.COMPLETE) {
            this.completeTutorial();
        } else {
            this.showStep(next as TutorialStep);
        }
    }

    skip(): void {
        if (!this.isActive) return;

        this.audio.play('ui_click');

        if (this.onSkipCallback) {
            this.onSkipCallback();
        }

        this.cleanup();
        this.isComplete = true;

        console.log('⏭️ Tutorial skipped');
    }

    update(delta: number): void {
        if (!this.isActive || this.isComplete) return;

        this.stepTimer += delta;
        this.encouragementTimer += delta;

        this.updateHighlightRing(delta);
        this.updateSpeechBubblePosition();

        this.handleStepLogic(delta);

        if (this.encouragementTimer >= TUTORIAL_CONFIG.encouragementInterval) {
            this.showEncouragement();
            this.encouragementTimer = 0;
        }

        this.updateTutorialObjects(delta);
    }

    isTutorialComplete(): boolean {
        return this.isComplete;
    }

    getCurrentStep(): TutorialStep {
        return this.currentStep;
    }

    onComplete(callback: () => void): void {
        this.onCompleteCallback = callback;
    }

    onSkip(callback: () => void): void {
        this.onSkipCallback = callback;
    }

    getIsActive(): boolean {
        return this.isActive;
    }

    // =========================================================================
    // STEP MANAGEMENT
    // =========================================================================

    protected showStep(step: TutorialStep): void {
        this.currentStep = step;
        this.stepTimer = 0;

        const content = TUTORIAL_CONFIG.stepContent[step];
        if (!content) return;

        this.dogController.triggerAnimation(content.dogAnimation, 3);

        this.playStepSounds(content.soundSequence);

        this.updateSpeechBubble(content.dogText, content.subText);

        this.updateProgressBar();

        this.setupStepVisuals(step);

        if (this.speechBubble) {
            this.speechBubble.classList.remove('tutorial-bounce');
            void this.speechBubble.offsetHeight;
            this.speechBubble.classList.add('tutorial-bounce');
        }
    }

    protected completeTutorial(): void {
        if (this.isComplete) return;

        this.isComplete = true;

        this.audio.playMagicSequence('spell_complete');

        this.showCompletionCelebration();

        saveTutorialCompletion();

        setTimeout(() => {
            if (this.onCompleteCallback) {
                this.onCompleteCallback();
            }
            this.cleanup();
        }, 2000);

        console.log('🎉 Tutorial complete! You\'re ready for the Moon! 🌙✨');
    }

    protected cleanup(): void {
        this.isActive = false;

        if (this.overlay) {
            this.overlay.remove();
            this.overlay = undefined;
        }
        if (this.speechBubble) {
            this.speechBubble.remove();
            this.speechBubble = undefined;
        }
        if (this.progressBar) {
            this.progressBar.remove();
            this.progressBar = undefined;
        }
        if (this.controlButtons) {
            this.controlButtons.remove();
            this.controlButtons = undefined;
        }

        this.clearTutorialObjects();
        if (this.highlightRing) {
            this.highlightRing.removeFromParent();
            this.highlightRing = undefined;
        }
        if (this.spaceKitty) {
            this.spaceKitty.group.removeFromParent();
            this.spaceKitty = undefined;
        }

        if (this.encouragementText) {
            this.encouragementText.remove();
        }

        this.dogController.triggerAnimation(DogAnimationState.IDLE);
    }

    reset(): void {
        this.cleanup();
        this.isComplete = false;
        this.currentStep = TutorialStep.WELCOME;
        this.collectedOrbs = 0;
    }

    protected abstract createOverlay(): void;
    protected abstract createSpeechBubble(): void;
    protected abstract createProgressBar(): void;
    protected abstract createControlButtons(): void;
    protected abstract createHighlightRing(): void;
    protected abstract updateHighlightRing(delta: number): void;
    protected abstract updateSpeechBubblePosition(): void;
    protected abstract handleStepLogic(delta: number): void;
    protected abstract showEncouragement(): void;
    protected abstract updateTutorialObjects(delta: number): void;
    protected abstract playStepSounds(sounds: readonly string[]): void;
    protected abstract updateSpeechBubble(mainText: string, subText: string): void;
    protected abstract updateProgressBar(): void;
    protected abstract setupStepVisuals(step: TutorialStep): void;
    protected abstract showCompletionCelebration(): void;
    protected abstract clearTutorialObjects(): void;
}
