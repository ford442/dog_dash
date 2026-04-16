/**
 * Tutorial System for Dog Dash 🐕📚✨
 * A gentle, magical introduction to the game for a 7-year-old girl
 * The dog teaches the player through fun, interactive steps!
 */

import * as THREE from 'three';
import { AudioSystem } from './audio_system';
import { DogCockpitController, DogAnimationState } from './dog_cockpit';
import { HUDManager } from './hud_system';
import { SaveManager } from './save_manager';
import { CollectibleOrb, OrbType } from './collectibles';
import { PowerUpType } from './hud_system';
import { SpaceKitty } from './space_friends';

// =============================================================================
// TUTORIAL STEP ENUM
// =============================================================================

export enum TutorialStep {
    WELCOME = 0,
    MOVEMENT = 1,
    COLLECT_STARS = 2,
    POWER_UP_DEMO = 3,
    AVOID_OBSTACLES = 4,
    MEET_FRIENDS = 5,
    GOAL = 6,
    COMPLETE = 7
}

// =============================================================================
// TUTORIAL CONFIGURATION
// =============================================================================

const TUTORIAL_CONFIG = {
    // Timing
    stepAutoAdvanceDelay: 8000,      // Auto-advance after 8 seconds (kid-friendly pace)
    powerUpDemoDuration: 5000,       // 5 seconds to play with power-up
    encouragementInterval: 3000,     // Encouragement every 3 seconds
    
    // Visual styling
    pastelOverlayColor: 'rgba(255, 230, 240, 0.15)',
    speechBubbleColor: '#FFF0F5',
    speechBubbleBorder: '#FFB6C1',
    highlightRingColor: 0xFFB6C1,
    progressStarColor: 0xFFD700,
    
    // Positions
    speechBubbleOffset: { x: 2, y: 1.5, z: 0 },
    
    // Text content for each step
    stepContent: {
        [TutorialStep.WELCOME]: {
            dogText: "Hi! I'm your space dog best friend! 🐕",
            subText: "Let's go on a magical adventure to the Moon! 🌙✨",
            dogAnimation: DogAnimationState.IDLE,
            soundSequence: ['giggle', 'twinkle'] as const
        },
        [TutorialStep.MOVEMENT]: {
            dogText: "Move your mouse (or finger) up and down to fly! 🖱️",
            subText: "Try it now! See the arrow? Follow it! ⬆️⬇️",
            dogAnimation: DogAnimationState.THRUST,
            soundSequence: ['whoosh'] as const
        },
        [TutorialStep.COLLECT_STARS]: {
            dogText: "Collect sparkly stars for magic powers! ⭐",
            subText: "Collect 3 stars to get a special surprise! 🎁",
            dogAnimation: DogAnimationState.COLLECT,
            soundSequence: ['sparkle', 'twinkle'] as const
        },
        [TutorialStep.POWER_UP_DEMO]: {
            dogText: "Wow! Rainbow wings! You can fly super fast! 🌈",
            subText: "Try it out! Feel the magic! ✨",
            dogAnimation: DogAnimationState.POWER_UP,
            soundSequence: ['magic_cast', 'heart_pop'] as const
        },
        [TutorialStep.AVOID_OBSTACLES]: {
            dogText: "Watch out for space rocks! ☄️",
            subText: "But gummy candies are bouncy and fun! 🍬",
            dogAnimation: DogAnimationState.IDLE,
            soundSequence: ['boing'] as const
        },
        [TutorialStep.MEET_FRIENDS]: {
            dogText: "Look! A space kitty! Say hi! 🐱",
            subText: "Space friends give you bonuses! 💕",
            dogAnimation: DogAnimationState.COLLECT,
            soundSequence: ['giggle', 'twinkle'] as const
        },
        [TutorialStep.GOAL]: {
            dogText: "Fly all the way to the Moon! 🚀",
            subText: "Collect stars, avoid rocks, have fun! 🌟",
            dogAnimation: DogAnimationState.VICTORY,
            soundSequence: ['magic_cast', 'sparkle'] as const
        },
        [TutorialStep.COMPLETE]: {
            dogText: "You're ready! Let's go! 🎉",
            subText: "Have the best space adventure ever! 🌙✨",
            dogAnimation: DogAnimationState.VICTORY,
            soundSequence: ['spell_complete'] as const
        }
    }
};

// =============================================================================
// TUTORIAL ORBS FOR PRACTICE
// =============================================================================

class TutorialOrb extends CollectibleOrb {
    tutorialCollected: boolean = false;
    
    collectForTutorial(): void {
        if (this.tutorialCollected) return;
        this.tutorialCollected = true;
        
        // Visual collection effect
        this.mesh.scale.setScalar(0.1);
        if (this.glowLight) {
            this.glowLight.intensity = 5;
        }
        
        // Play sound
        const audio = getAudioSystem();
        audio.playMagicSound('collect');
    }
}

// =============================================================================
// TUTORIAL SYSTEM CLASS
// =============================================================================

export class TutorialSystem {
    private scene: THREE.Scene;
    private hud: HUDManager;
    private audio: AudioSystem;
    private dogController: DogCockpitController;
    
    // State
    private currentStep: TutorialStep = TutorialStep.WELCOME;
    private isActive: boolean = false;
    private isComplete: boolean = false;
    private stepTimer: number = 0;
    private encouragementTimer: number = 0;
    
    // Visual elements
    private overlay?: HTMLDivElement;
    private speechBubble?: HTMLDivElement;
    private progressBar?: HTMLDivElement;
    private controlButtons?: HTMLDivElement;
    private highlightRing?: THREE.Mesh;
    private cursorAnimation?: HTMLDivElement;
    private encouragementText?: HTMLDivElement;
    
    // Tutorial objects
    private tutorialOrbs: TutorialOrb[] = [];
    private spaceKitty?: SpaceKitty;
    private collectedOrbs: number = 0;
    private targetOrbCount: number = 3;
    
    // Callbacks
    private onCompleteCallback?: () => void;
    private onSkipCallback?: () => void;
    
    // Encouragement messages
    private encouragements = [
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

    /**
     * Start the tutorial sequence
     */
    start(): void {
        if (this.isActive) return;
        
        this.isActive = true;
        this.currentStep = TutorialStep.WELCOME;
        this.stepTimer = 0;
        this.collectedOrbs = 0;
        
        // Create UI elements
        this.createOverlay();
        this.createSpeechBubble();
        this.createProgressBar();
        this.createControlButtons();
        this.createHighlightRing();
        
        // Show first step
        this.showStep(TutorialStep.WELCOME);
        
        console.log('🐕📚 Tutorial started! Let the magic begin! ✨');
    }

    /**
     * Advance to the next tutorial step
     */
    nextStep(): void {
        if (!this.isActive || this.isComplete) return;
        
        const next = this.currentStep + 1;
        if (next >= TutorialStep.COMPLETE) {
            this.completeTutorial();
        } else {
            this.showStep(next as TutorialStep);
        }
    }

    /**
     * Skip the tutorial entirely
     */
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

    /**
     * Update the tutorial system (call every frame)
     */
    update(delta: number): void {
        if (!this.isActive || this.isComplete) return;
        
        this.stepTimer += delta;
        this.encouragementTimer += delta;
        
        // Update visual elements
        this.updateHighlightRing(delta);
        this.updateSpeechBubblePosition();
        
        // Handle step-specific logic
        this.handleStepLogic(delta);
        
        // Show encouragement periodically
        if (this.encouragementTimer >= TUTORIAL_CONFIG.encouragementInterval) {
            this.showEncouragement();
            this.encouragementTimer = 0;
        }
        
        // Update tutorial objects
        this.updateTutorialObjects(delta);
    }

    /**
     * Check if tutorial is complete
     */
    isTutorialComplete(): boolean {
        return this.isComplete;
    }

    /**
     * Get current tutorial step
     */
    getCurrentStep(): TutorialStep {
        return this.currentStep;
    }

    /**
     * Set callback for when tutorial completes
     */
    onComplete(callback: () => void): void {
        this.onCompleteCallback = callback;
    }

    /**
     * Set callback for when tutorial is skipped
     */
    onSkip(callback: () => void): void {
        this.onSkipCallback = callback;
    }

    /**
     * Check if tutorial is currently active
     */
    getIsActive(): boolean {
        return this.isActive;
    }

    // =========================================================================
    // STEP MANAGEMENT
    // =========================================================================

    private showStep(step: TutorialStep): void {
        this.currentStep = step;
        this.stepTimer = 0;
        
        const content = TUTORIAL_CONFIG.stepContent[step];
        if (!content) return;
        
        // Update dog animation
        this.dogController.triggerAnimation(content.dogAnimation, 3);
        
        // Play sound sequence
        this.playStepSounds(content.soundSequence);
        
        // Update speech bubble
        this.updateSpeechBubble(content.dogText, content.subText);
        
        // Update progress bar
        this.updateProgressBar();
        
        // Handle step-specific setup
        this.setupStepVisuals(step);
        
        // Add bounce animation to bubble
        if (this.speechBubble) {
            this.speechBubble.classList.remove('tutorial-bounce');
            void this.speechBubble.offsetHeight; // Trigger reflow
            this.speechBubble.classList.add('tutorial-bounce');
        }
    }

    private handleStepLogic(delta: number): void {
        switch (this.currentStep) {
            case TutorialStep.WELCOME:
                // Just show welcome, auto-advance
                if (this.stepTimer >= 3000) {
                    this.nextStep();
                }
                break;
                
            case TutorialStep.MOVEMENT:
                // Show cursor animation pointing up/down
                this.updateMovementHint();
                break;
                
            case TutorialStep.COLLECT_STARS:
                // Check if all orbs collected
                if (this.collectedOrbs >= this.targetOrbCount) {
                    this.nextStep();
                }
                break;
                
            case TutorialStep.POWER_UP_DEMO:
                // Auto-advance after power-up demo duration
                if (this.stepTimer >= TUTORIAL_CONFIG.powerUpDemoDuration) {
                    this.nextStep();
                }
                break;
                
            case TutorialStep.AVOID_OBSTACLES:
                // Show asteroid warning
                this.updateObstacleWarning();
                break;
                
            case TutorialStep.MEET_FRIENDS:
                // Check if player near kitty
                this.checkKittyInteraction();
                break;
                
            case TutorialStep.GOAL:
                // Auto-advance after showing goal
                if (this.stepTimer >= 4000) {
                    this.nextStep();
                }
                break;
                
            case TutorialStep.COMPLETE:
                // Auto-complete after showing final message
                if (this.stepTimer >= 3000) {
                    this.completeTutorial();
                }
                break;
        }
    }

    private setupStepVisuals(step: TutorialStep): void {
        // Clear previous step objects
        this.clearTutorialObjects();
        
        switch (step) {
            case TutorialStep.MOVEMENT:
                this.createMovementHint();
                break;
                
            case TutorialStep.COLLECT_STARS:
                this.createTutorialOrbs();
                break;
                
            case TutorialStep.POWER_UP_DEMO:
                this.activatePowerUpDemo();
                break;
                
            case TutorialStep.AVOID_OBSTACLES:
                this.createObstacleDemo();
                break;
                
            case TutorialStep.MEET_FRIENDS:
                this.createSpaceKitty();
                break;
        }
    }

    // =========================================================================
    // VISUAL ELEMENT CREATION
    // =========================================================================

    private createOverlay(): void {
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
        
        // Add CSS animation
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

    private createSpeechBubble(): void {
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
        
        // Dog icon
        const dogIcon = document.createElement('div');
        dogIcon.id = 'tutorial-dog-icon';
        dogIcon.style.cssText = `
            font-size: 40px;
            margin-bottom: 10px;
            animation: tutorial-bounce 2s ease-in-out infinite;
        `;
        dogIcon.textContent = '🐕';
        
        // Main text
        const mainText = document.createElement('div');
        mainText.id = 'tutorial-main-text';
        mainText.style.cssText = `
            font-size: 22px;
            color: #5D4E6D;
            font-weight: bold;
            margin-bottom: 10px;
            line-height: 1.4;
        `;
        
        // Sub text
        const subText = document.createElement('div');
        subText.id = 'tutorial-sub-text';
        subText.style.cssText = `
            font-size: 16px;
            color: #8B7B8B;
            line-height: 1.4;
        `;
        
        // Speech bubble tail
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

    private updateSpeechBubble(mainText: string, subText: string): void {
        const mainEl = document.getElementById('tutorial-main-text');
        const subEl = document.getElementById('tutorial-sub-text');
        
        if (mainEl) mainEl.textContent = mainText;
        if (subEl) subEl.textContent = subText;
    }

    private updateSpeechBubblePosition(): void {
        // Speech bubble stays fixed at bottom center
        // Could be made to follow dog position in future
    }

    private createProgressBar(): void {
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

    private updateProgressBar(): void {
        if (!this.progressBar) return;
        
        // Clear existing stars
        const existingStars = this.progressBar.querySelectorAll('.tutorial-star');
        existingStars.forEach(s => s.remove());
        
        // Add stars for each step
        const totalSteps = Object.keys(TutorialStep).length / 2 - 1; // Exclude COMPLETE
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

    private createControlButtons(): void {
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
        
        // Skip button
        const skipBtn = this.createButton('Skip', '#FFB6C1', () => this.skip());
        
        // Next button
        const nextBtn = this.createButton('Next ➡️', '#98FB98', () => this.nextStep());
        nextBtn.id = 'tutorial-next-btn';
        
        this.controlButtons.appendChild(skipBtn);
        this.controlButtons.appendChild(nextBtn);
        document.body.appendChild(this.controlButtons);
    }

    private createButton(text: string, color: string, onClick: () => void): HTMLButtonElement {
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

    private createHighlightRing(): void {
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

    private updateHighlightRing(delta: number): void {
        if (!this.highlightRing || !this.highlightRing.visible) return;
        
        const time = Date.now() * 0.001;
        const scale = 1 + Math.sin(time * 3) * 0.1;
        this.highlightRing.scale.setScalar(scale);
        
        // Fade in/out
        const targetOpacity = 0.6;
        const material = this.highlightRing.material as THREE.MeshBasicMaterial;
        material.opacity = THREE.MathUtils.lerp(
            material.opacity,
            targetOpacity,
            delta * 3
        );
    }

    private showHighlightAt(position: THREE.Vector3): void {
        if (!this.highlightRing) return;
        this.highlightRing.position.copy(position);
        this.highlightRing.visible = true;
        (this.highlightRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    private hideHighlight(): void {
        if (this.highlightRing) {
            this.highlightRing.visible = false;
        }
    }

    // =========================================================================
    // STEP-SPECIFIC VISUALS
    // =========================================================================

    private createMovementHint(): void {
        // Create cursor animation showing up/down movement
        this.cursorAnimation = document.createElement('div');
        this.cursorAnimation.style.cssText = `
            position: fixed;
            left: 80px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 40px;
            z-index: 55;
            animation: tutorial-cursor-up 1.5s ease-in-out infinite;
            pointer-events: none;
        `;
        this.cursorAnimation.textContent = '👆';
        document.body.appendChild(this.cursorAnimation);
        
        // Add down arrow below
        const downArrow = document.createElement('div');
        downArrow.style.cssText = `
            position: fixed;
            left: 80px;
            top: calc(50% + 50px);
            transform: translateY(-50%);
            font-size: 40px;
            z-index: 55;
            animation: tutorial-cursor-down 1.5s ease-in-out infinite;
            animation-delay: 0.75s;
            pointer-events: none;
        `;
        downArrow.textContent = '👇';
        document.body.appendChild(downArrow);
        
        // Store reference for cleanup
        (this.cursorAnimation as any).downArrow = downArrow;
    }

    private updateMovementHint(): void {
        // Cursor animation is CSS-based
    }

    private createTutorialOrbs(): void {
        // Create 3 tutorial orbs in a line
        for (let i = 0; i < this.targetOrbCount; i++) {
            const x = 5 + i * 3;
            const y = (i % 2 === 0) ? 2 : -2;
            const orb = new TutorialOrb(this.scene, x, y, 0, OrbType.STAR);
            this.tutorialOrbs.push(orb);
        }
        
        // Update HUD to show orb progress
        this.hud.updateOrbProgress(0, this.targetOrbCount);
    }

    private activatePowerUpDemo(): void {
        // Show power-up effect on HUD
        this.hud.showPowerUpIcon('speed_boost' as PowerUpType, 5);
        
        // Play power-up sound
        this.audio.playMagicSound('power');
        
        // Create rainbow trail effect (visual only for tutorial)
        this.createRainbowTrail();
    }

    private createRainbowTrail(): void {
        // Create a visual rainbow trail behind the dog
        const trailColors = [0xFF69B4, 0xFFA500, 0xFFFF00, 0x00FF00, 0x00BFFF, 0x9370DB];
        
        trailColors.forEach((color, i) => {
            const geometry = new THREE.SphereGeometry(0.3, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.6
            });
            const orb = new THREE.Mesh(geometry, material);
            orb.position.set(-1 - i * 0.5, Math.sin(i) * 0.3, 0);
            this.scene.add(orb);
            
            // Animate and remove after delay
            setTimeout(() => {
                orb.removeFromParent();
                geometry.dispose();
                material.dispose();
            }, TUTORIAL_CONFIG.powerUpDemoDuration);
        });
    }

    private createObstacleDemo(): void {
        // Create a slow-moving asteroid demonstration
        const asteroidGeo = new THREE.IcosahedronGeometry(0.8, 1);
        const asteroidMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.9
        });
        const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
        asteroid.position.set(10, 0, 0);
        asteroid.name = 'tutorial_asteroid';
        this.scene.add(asteroid);
        
        // Add warning glow
        const warningLight = new THREE.PointLight(0xFF4444, 1, 5);
        warningLight.position.copy(asteroid.position);
        warningLight.name = 'tutorial_warning_light';
        this.scene.add(warningLight);
        
        // Animate asteroid slowly across screen
        let progress = 0;
        const animateAsteroid = () => {
            if (!this.isActive || this.currentStep !== TutorialStep.AVOID_OBSTACLES) {
                asteroid.removeFromParent();
                warningLight.removeFromParent();
                asteroidGeo.dispose();
                asteroidMat.dispose();
                return;
            }
            
            progress += 0.005;
            asteroid.position.x = 10 - progress * 15;
            asteroid.rotation.x += 0.01;
            asteroid.rotation.y += 0.02;
            warningLight.position.copy(asteroid.position);
            
            if (progress < 1) {
                requestAnimationFrame(animateAsteroid);
            } else {
                this.nextStep();
                asteroid.removeFromParent();
                warningLight.removeFromParent();
            }
        };
        animateAsteroid();
    }

    private updateObstacleWarning(): void {
        // Visual warning is handled in createObstacleDemo
    }

    private createSpaceKitty(): void {
        this.spaceKitty = new SpaceKitty(this.scene, 8, 2);
        
        // Highlight the kitty
        this.showHighlightAt(new THREE.Vector3(8, 2, 0));
    }

    private checkKittyInteraction(): void {
        if (!this.spaceKitty) return;
        
        // Simulate kitty waving after a moment
        if (this.stepTimer >= 2000 && !this.spaceKitty.hasWavedAtPlayer) {
            // Trigger waving animation manually
            (this.spaceKitty as any).isWaving = true;
            (this.spaceKitty as any).hasWavedAtPlayer = true;
            this.audio.playMagicSound('happy');
            
            // Advance after wave
            setTimeout(() => this.nextStep(), 2000);
        }
    }

    // =========================================================================
    // ENCOURAGEMENT SYSTEM
    // =========================================================================

    private showEncouragement(): void {
        if (this.currentStep === TutorialStep.COMPLETE) return;
        
        // Pick random encouragement
        const message = this.encouragements[Math.floor(Math.random() * this.encouragements.length)];
        
        // Create floating text
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
        
        // Remove after animation
        setTimeout(() => encouragement.remove(), 2000);
        
        // Play happy sound occasionally
        if (Math.random() < 0.3) {
            this.audio.playMagicSound('happy');
        }
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    private playStepSounds(sounds: readonly string[]): void {
        sounds.forEach((sound, i) => {
            setTimeout(() => {
                if (this.isActive) {
                    this.audio.play(sound as any, 0.7);
                }
            }, i * 200);
        });
    }

    private updateTutorialObjects(delta: number): void {
        const time = Date.now() * 0.001;
        
        // Update orbs
        this.tutorialOrbs.forEach(orb => {
            if (!orb.collected) {
                orb.update(delta, time);
                
                // Check collection (simplified for tutorial)
                // In real game, this would check player collision
            }
        });
        
        // Update kitty with player position (for tutorial, use kitty's position as player pos)
        if (this.spaceKitty) {
            this.spaceKitty.update(delta, this.spaceKitty.position);
        }
    }

    private clearTutorialObjects(): void {
        // Remove tutorial orbs
        this.tutorialOrbs.forEach(orb => {
            orb.mesh.removeFromParent();
        });
        this.tutorialOrbs = [];
        
        // Remove cursor animations
        if (this.cursorAnimation) {
            this.cursorAnimation.remove();
            if ((this.cursorAnimation as any).downArrow) {
                (this.cursorAnimation as any).downArrow.remove();
            }
            this.cursorAnimation = undefined;
        }
        
        // Hide highlight
        this.hideHighlight();
    }

    private completeTutorial(): void {
        if (this.isComplete) return;
        
        this.isComplete = true;
        
        // Play completion sound
        this.audio.playMagicSequence('spell_complete');
        
        // Show final celebration
        this.showCompletionCelebration();
        
        // Save tutorial completion
        saveTutorialCompletion();
        
        // Callback
        setTimeout(() => {
            if (this.onCompleteCallback) {
                this.onCompleteCallback();
            }
            this.cleanup();
        }, 2000);
        
        console.log('🎉 Tutorial complete! You\'re ready for the Moon! 🌙✨');
    }

    private showCompletionCelebration(): void {
        // Create celebration overlay
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
        
        // Remove after delay
        setTimeout(() => {
            celebration.style.animation = 'tutorial-fade-out 0.5s ease-out forwards';
            setTimeout(() => celebration.remove(), 500);
        }, 2000);
    }

    private cleanup(): void {
        this.isActive = false;
        
        // Remove UI elements
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
        
        // Remove 3D objects
        this.clearTutorialObjects();
        if (this.highlightRing) {
            this.highlightRing.removeFromParent();
            this.highlightRing = undefined;
        }
        if (this.spaceKitty) {
            this.spaceKitty.group.removeFromParent();
            this.spaceKitty = undefined;
        }
        
        // Remove encouragement text if present
        if (this.encouragementText) {
            this.encouragementText.remove();
        }
        
        // Reset dog animation
        this.dogController.triggerAnimation(DogAnimationState.IDLE);
    }

    // =========================================================================
    // DEBUG/TESTING METHODS
    // =========================================================================

    /**
     * Mark an orb as collected (for tutorial progression)
     */
    collectOrb(index: number): void {
        if (index >= 0 && index < this.tutorialOrbs.length) {
            this.tutorialOrbs[index].collectForTutorial();
            this.collectedOrbs++;
            this.hud.updateOrbProgress(this.collectedOrbs, this.targetOrbCount);
            
            // Trigger dog collect animation
            this.dogController.triggerAnimation(DogAnimationState.COLLECT, 1);
            
            if (this.collectedOrbs >= this.targetOrbCount) {
                this.nextStep();
            }
        }
    }

    /**
     * Force a specific tutorial step (for testing)
     */
    forceStep(step: TutorialStep): void {
        this.showStep(step);
    }

    /**
     * Reset tutorial progress (for testing)
     */
    reset(): void {
        this.cleanup();
        this.isComplete = false;
        this.currentStep = TutorialStep.WELCOME;
        this.collectedOrbs = 0;
    }
}

// =============================================================================
// SAVE MANAGER INTEGRATION
// =============================================================================

const TUTORIAL_COMPLETED_KEY = 'dog_dash_tutorial_completed';

/**
 * Check if tutorial should be shown
 */
export function shouldShowTutorial(saveManager: SaveManager): boolean {
    try {
        const completed = localStorage.getItem(TUTORIAL_COMPLETED_KEY);
        return completed !== 'true';
    } catch (e) {
        // If localStorage fails, show tutorial to be safe
        return true;
    }
}

/**
 * Mark tutorial as completed in save data
 */
function saveTutorialCompletion(): void {
    try {
        localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    } catch (e) {
        console.warn('Could not save tutorial completion:', e);
    }
}

/**
 * Reset tutorial completion (for testing or replay)
 */
export function resetTutorialCompletion(): void {
    try {
        localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
    } catch (e) {
        console.warn('Could not reset tutorial completion:', e);
    }
}

// =============================================================================
// AUDIO SYSTEM HELPER (for sounds)
// =============================================================================

function getAudioSystem(): AudioSystem {
    return new AudioSystem();
}
