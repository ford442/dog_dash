// =============================================================================
// USAGE EXAMPLE (for integration with main.ts)
// =============================================================================

/*
// In main.ts:

import { PowerUpManager, PowerUpType } from './powerup_manager';
import { getAudioSystem } from './audio_system';

// Initialize
const powerUpManager = new PowerUpManager({
    scene,
    particleSystem,
    audioSystem: getAudioSystem(),
    rocket: player,  // The rocket group
    onPowerUpStart: (type, config) => {
        console.log(`Started: ${config.name}`);
        // Update UI
    },
    onPowerUpEnd: (type, config) => {
        console.log(`Ended: ${config.name}`);
        // Update UI
    },
    onOrbCountChange: (count, needed) => {
        console.log(`Orbs: ${count}/${needed}`);
        // Update orb collection UI
    }
});

// In game loop:
function gameLoop(dt: number) {
    // Update power-ups
    powerUpManager.update(dt, player?.position);
    
    // Get modifiers for physics/collection
    const modifiers = powerUpManager.getCombinedModifiers();
    
    // Apply gravity modifier
    const effectiveGravity = baseGravity * modifiers.gravityMultiplier;
    
    // Apply speed modifier
    const effectiveSpeed = baseSpeed * modifiers.speedMultiplier;
    
    // Check for auto-collection
    if (modifiers.autoCollectRadius > 0) {
        collectNearbyOrbs(player.position, modifiers.autoCollectRadius);
    }
    
    // Check for magnet effect
    if (modifiers.magnetRadius > 0) {
        pullStarsTowardPlayer(player.position, modifiers.magnetRadius);
    }
    
    // Check shield on hit
    if (playerHit && modifiers.shieldActive) {
        if (modifiers.shieldBouncesAsteroids) {
            bounceAsteroid();
            playBoingSound();
        }
        // Don't take damage
    }
    
    // Update UI with active effects
    const activeEffects = powerUpManager.getActiveEffects();
    updatePowerUpUI(activeEffects);
}

// When collecting an orb:
function onOrbCollected() {
    const powerUpTriggered = powerUpManager.collectOrb();
    if (powerUpTriggered) {
        // Particle burst, celebration!
    }
}

// Manual activation (for testing or special events):
powerUpManager.activatePowerUp(PowerUpType.RAINBOW_COMET_TAIL);
powerUpManager.activateRandomPowerUp(1);

// Check if power-up is active:
if (powerUpManager.hasPowerUp(PowerUpType.BUBBLEGUM_SHIELD)) {
    // Show shield visual
}

// On player hit:
function onPlayerHit() {
    // Check butterfly escort first
    if (powerUpManager.consumeButterflyCharge()) {
        // Butterfly protected the hit
        showButterflyPoof();
        return;  // No damage
    }
    
    // Check shield
    const modifiers = powerUpManager.getCombinedModifiers();
    if (modifiers.shieldActive) {
        if (modifiers.shieldBouncesAsteroids) {
            // Bounce the asteroid
        }
        return;  // No damage
    }
    
    // Take damage
    playerHealth--;
}
*/

import { PowerUpManager } from './manager';

export default PowerUpManager;

