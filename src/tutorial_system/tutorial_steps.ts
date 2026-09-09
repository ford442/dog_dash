/**
 * Tutorial System step logic and step-specific visuals
 */

import * as THREE from 'three';
import { DogAnimationState } from '../dog_cockpit';
import { OrbType } from '../collectibles';
import { PowerUpType } from '../hud_system';
import { SpaceKitty } from '../space_friends';
import { TutorialStep, TUTORIAL_CONFIG, TutorialOrb } from './types';
import { TutorialSystemUI } from './tutorial_ui';

export class TutorialSystem extends TutorialSystemUI {
    protected handleStepLogic(_delta: number): void {
        switch (this.currentStep) {
            case TutorialStep.WELCOME:
                if (this.stepTimer >= 3000) {
                    this.nextStep();
                }
                break;

            case TutorialStep.MOVEMENT:
                this.updateMovementHint();
                break;

            case TutorialStep.COLLECT_STARS:
                if (this.collectedOrbs >= this.targetOrbCount) {
                    this.nextStep();
                }
                break;

            case TutorialStep.POWER_UP_DEMO:
                if (this.stepTimer >= TUTORIAL_CONFIG.powerUpDemoDuration) {
                    this.nextStep();
                }
                break;

            case TutorialStep.AVOID_OBSTACLES:
                this.updateObstacleWarning();
                break;

            case TutorialStep.MEET_FRIENDS:
                this.checkKittyInteraction();
                break;

            case TutorialStep.GOAL:
                if (this.stepTimer >= 4000) {
                    this.nextStep();
                }
                break;

            case TutorialStep.COMPLETE:
                if (this.stepTimer >= 3000) {
                    this.completeTutorial();
                }
                break;
        }
    }

    protected setupStepVisuals(step: TutorialStep): void {
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

    protected playStepSounds(sounds: readonly string[]): void {
        sounds.forEach((sound, i) => {
            setTimeout(() => {
                if (this.isActive) {
                    this.audio.play(sound as any, 0.7);
                }
            }, i * 200);
        });
    }

    protected updateTutorialObjects(delta: number): void {
        const time = Date.now() * 0.001;

        this.tutorialOrbs.forEach(orb => {
            if (!orb.collected) {
                orb.update(delta, time);
            }
        });

        if (this.spaceKitty) {
            this.spaceKitty.update(delta, this.spaceKitty.position);
        }
    }

    protected clearTutorialObjects(): void {
        this.tutorialOrbs.forEach(orb => {
            orb.mesh.removeFromParent();
        });
        this.tutorialOrbs = [];

        if (this.cursorAnimation) {
            this.cursorAnimation.remove();
            if ((this.cursorAnimation as any).downArrow) {
                (this.cursorAnimation as any).downArrow.remove();
            }
            this.cursorAnimation = undefined;
        }

        this.hideHighlight();
    }

    private createMovementHint(): void {
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

        (this.cursorAnimation as any).downArrow = downArrow;
    }

    private updateMovementHint(): void {
        // Cursor animation is CSS-based
    }

    private createTutorialOrbs(): void {
        for (let i = 0; i < this.targetOrbCount; i++) {
            const x = 5 + i * 3;
            const y = (i % 2 === 0) ? 2 : -2;
            const orb = new TutorialOrb(this.scene, x, y, 0, OrbType.STAR, this.audio);
            this.tutorialOrbs.push(orb);
        }

        this.hud.updateOrbProgress(0, this.targetOrbCount);
    }

    private activatePowerUpDemo(): void {
        this.hud.showPowerUpIcon('speed_boost' as PowerUpType, 5);
        if (typeof this.audio.playMagicSound === 'function') {
            this.audio.playMagicSound('power');
        } else {
            this.audio.play('powerup');
        }
        this.createRainbowTrail();
    }

    private createRainbowTrail(): void {
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

            setTimeout(() => {
                orb.removeFromParent();
                geometry.dispose();
                material.dispose();
            }, TUTORIAL_CONFIG.powerUpDemoDuration);
        });
    }

    private createObstacleDemo(): void {
        const asteroidGeo = new THREE.IcosahedronGeometry(0.8, 1);
        const asteroidMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.9
        });
        const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
        asteroid.position.set(10, 0, 0);
        asteroid.name = 'tutorial_asteroid';
        this.scene.add(asteroid);

        const warningLight = new THREE.PointLight(0xFF4444, 1, 5);
        warningLight.position.copy(asteroid.position);
        warningLight.name = 'tutorial_warning_light';
        this.scene.add(warningLight);

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
        this.showHighlightAt(new THREE.Vector3(8, 2, 0));
    }

    private checkKittyInteraction(): void {
        if (!this.spaceKitty) return;

        if (this.stepTimer >= 2000 && !this.spaceKitty.hasWavedAtPlayer) {
            (this.spaceKitty as any).isWaving = true;
            (this.spaceKitty as any).hasWavedAtPlayer = true;
            if (typeof this.audio.playMagicSound === 'function') {
                this.audio.playMagicSound('happy');
            } else {
                this.audio.play('giggle');
            }

            setTimeout(() => this.nextStep(), 2000);
        }
    }

    collectOrb(index: number): void {
        if (index >= 0 && index < this.tutorialOrbs.length) {
            this.tutorialOrbs[index].collectForTutorial();
            this.collectedOrbs++;
            this.hud.updateOrbProgress(this.collectedOrbs, this.targetOrbCount);

            this.dogController.triggerAnimation(DogAnimationState.COLLECT, 1);

            if (this.collectedOrbs >= this.targetOrbCount) {
                this.nextStep();
            }
        }
    }

    forceStep(step: TutorialStep): void {
        this.showStep(step);
    }
}
