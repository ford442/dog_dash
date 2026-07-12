import * as THREE from 'three';
import { DogAccessory, DogAnimationState, AccessoryUnlock } from './types';
import { DogCockpitController } from './controller';

// ============================================================================
// ACCESSORY UNLOCK CONFIGURATION
// ============================================================================

/** Configuration for unlocking accessories via save manager progression */
export const ACCESSORY_UNLOCKS: { [key: string]: AccessoryUnlock } = {
    tutu: {
        type: DogAccessory.TUTU,
        name: 'Sparkle Tutu',
        description: 'A magical pink tutu for the brave space pup!',
        cost: 50
    },
    cape: {
        type: DogAccessory.CAPE,
        name: 'Hero Cape',
        description: 'A heroic cape for the galaxy protector!',
        cost: 100,
        requirement: () => {
            // Require defeating first boss
            const saveManager = (window as any).saveManager;
            return saveManager?.getStats().bossesDefeated >= 1;
        }
    },
    bow: {
        type: DogAccessory.BOW,
        name: 'Cute Bow',
        description: 'A cute red bow for your space adventurer!',
        cost: 25
    },
    glasses: {
        type: DogAccessory.GLASSES,
        name: 'Cool Shades',
        description: 'Stylish glasses for the coolest dog in space!',
        cost: 75,
        requirement: () => {
            // Require collecting 100 cores total
            const saveManager = (window as any).saveManager;
            return saveManager?.getStats().totalCoresCollected >= 100;
        }
    },
    crown: {
        type: DogAccessory.CROWN,
        name: 'Royal Crown',
        description: 'A golden crown fit for the queen of the galaxy!',
        cost: 200,
        requirement: () => {
            // Require completing all levels
            const saveManager = (window as any).saveManager;
            return saveManager?.getStats().runsCompleted >= 1;
        }
    }
};

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Helper to integrate with the game save manager
 * Unlocks accessories based on progression
 */
export function checkAccessoryUnlocks(saveManager: any): DogAccessory[] {
    const unlocked: DogAccessory[] = [];

    Object.values(ACCESSORY_UNLOCKS).forEach(unlock => {
        if (!unlock.requirement || unlock.requirement()) {
            unlocked.push(unlock.type);
        }
    });

    return unlocked;
}

/**
 * Create the integration with main.ts
 * Usage example showing how to hook into the game loop
 */
export function createDogCockpitIntegration(
    dogController: DogCockpitController,
    player: THREE.Group,
    playerState: any,
    keys: { jump: boolean; [key: string]: boolean }
) {
    return {
        /**
         * Call this after the rocket GLB is loaded
         */
        initialize: () => {
            const rocketRoot = player.children[0];
            if (rocketRoot) {
                dogController.initialize(rocketRoot as THREE.Group);

                // Equip any previously unlocked accessories
                const unlocked = checkAccessoryUnlocks((window as any).saveManager);
                unlocked.forEach(acc => dogController.createAccessory(acc));
            }
        },

        /**
         * Call this in the game loop update
         */
        update: (deltaTime: number) => {
            // Check for thrust state
            if (keys.jump) {
                dogController.triggerAnimation(DogAnimationState.THRUST);
            }

            // Update the controller
            dogController.update(deltaTime, playerState);
        },

        /**
         * Call this when collecting an item
         */
        onCollect: (itemType?: string) => {
            dogController.triggerAnimation(DogAnimationState.COLLECT, 0.5);
        },

        /**
         * Call this when activating a power-up
         */
        onPowerUp: (powerUpType?: string) => {
            dogController.triggerAnimation(DogAnimationState.POWER_UP, 2.0);
        },

        /**
         * Call this when taking damage
         */
        onHit: () => {
            dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
        },

        /**
         * Call this when winning the game
         */
        onVictory: () => {
            dogController.triggerAnimation(DogAnimationState.VICTORY, 5.0);
        },

        /**
         * Toggle an accessory on/off
         */
        toggleAccessory: (type: DogAccessory) => {
            return dogController.toggleAccessory(type);
        }
    };
}
