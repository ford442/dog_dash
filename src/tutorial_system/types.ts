/**
 * Tutorial System types and configuration
 */

import { DogAnimationState } from '../dog_cockpit';
import { CollectibleOrb, OrbType } from '../collectibles';
import { getAudioSystem } from './persistence';

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

export const TUTORIAL_CONFIG = {
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

export class TutorialOrb extends CollectibleOrb {
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
