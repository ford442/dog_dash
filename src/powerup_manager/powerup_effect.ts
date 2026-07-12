import * as THREE from 'three';
import { ParticleSystem } from '../particles';
import {
    PowerUpType,
    POWER_UP_CONFIGS,
    type PowerUpConfig,
    type GameplayModifiers,
} from './types';

// =============================================================================
// POWER-UP EFFECT CLASS
// =============================================================================

export interface ActiveEffectInfo {
    type: PowerUpType;
    name: string;
    icon: string;
    timeRemaining: number;
    duration: number;
    progress: number;  // 0 to 1, where 1 = full duration remaining
}

export class PowerUpEffect {
    type: PowerUpType;
    config: PowerUpConfig;
    duration: number;
    timeRemaining: number;
    isActive: boolean;
    
    // Visual effect references
    visualMesh?: THREE.Group;
    particleTrail?: ParticleSystem;
    light?: THREE.PointLight;
    
    // Gameplay modifiers this effect provides
    modifiers: Partial<GameplayModifiers>;
    
    // Callbacks
    private onActivate?: () => void;
    private onUpdate?: (dt: number) => void;
    private onDeactivate?: () => void;

    constructor(
        type: PowerUpType,
        scene: THREE.Scene,
        particleSystem: ParticleSystem,
        onActivate?: () => void,
        onUpdate?: (dt: number) => void,
        onDeactivate?: () => void
    ) {
        this.type = type;
        this.config = POWER_UP_CONFIGS[type];
        this.duration = this.config.duration;
        this.timeRemaining = this.config.duration;
        this.isActive = false;
        this.modifiers = this.calculateModifiers();
        
        this.onActivate = onActivate;
        this.onUpdate = onUpdate;
        this.onDeactivate = onDeactivate;
    }

    /**
     * Calculate gameplay modifiers based on power-up type
     */
    private calculateModifiers(): Partial<GameplayModifiers> {
        switch (this.type) {
            case PowerUpType.RAINBOW_COMET_TAIL:
                return {
                    autoCollectRadius: 45,
                    asteroidsToCandy: true,
                    speedMultiplier: 1.2,
                    sparkle: true
                };
            case PowerUpType.FLOWER_CROWN_BOOST:
                return {
                    gravityMultiplier: -0.3,  // Gentle float upward
                    obstaclesSlowed: true,
                    obstacleSlowFactor: 0.6
                };
            case PowerUpType.BUBBLEGUM_SHIELD:
                return {
                    shieldActive: true,
                    shieldBouncesAsteroids: true
                };
            case PowerUpType.TWINKLE_STAR_MAGNET:
                return {
                    magnetRadius: 15
                };
            case PowerUpType.UNICORN_HORN_BLAST:
                return {
                    asteroidsToButterflies: true
                };
            case PowerUpType.DREAM_CLOUD_CARPET:
                return {
                    gravityMultiplier: 0,  // No gravity
                    speedMultiplier: 1.1
                };
            case PowerUpType.LULLABY_LANTERN:
                return {
                    obstaclesSlowed: true,
                    obstacleSlowFactor: 0.4
                };
            case PowerUpType.PUPPY_HUG_HUG:
                return {
                    doubleValue: true
                };
            case PowerUpType.MOONBEAM_SLIDE:
                return {
                    speedMultiplier: 1.5,
                    autoCollectRadius: 5
                };
            case PowerUpType.FAIRY_GODMOTHER_SPARKLE:
                return {
                    // Random bonus applied separately
                };
            case PowerUpType.CANDY_CANE_VORTEX:
                return {
                    autoCollectRadius: 10,
                    asteroidsToCandy: true
                };
            case PowerUpType.STARLIGHT_TIARA:
                return {
                    invincible: true,
                    doubleValue: true
                };
            case PowerUpType.BUTTERFLY_ESCORT:
                return {
                    butterflyCharges: 3
                };
            case PowerUpType.MAGIC_PAINTBRUSH:
                return {
                    // Special mouse interaction handled separately
                };
            case PowerUpType.BEST_FRIEND_FOREVER_AURA:
                return {
                    timeScale: 0.7,
                    doubleValue: true,
                    sparkle: true
                } as Partial<GameplayModifiers>;
            default:
                return {};
        }
    }

    /**
     * Activate the power-up effect
     */
    activate(): void {
        if (this.isActive) {
            // Reset duration if already active (stack refresh)
            this.timeRemaining = this.duration;
            return;
        }
        
        this.isActive = true;
        this.timeRemaining = this.duration;
        
        // Create visual effects
        this.createVisuals();
        
        // Play activation sound
        this.playActivationSound();
        
        // Call custom activate callback
        if (this.onActivate) {
            this.onActivate();
        }
        
        console.log(`✨ Power-up activated: ${this.config.name}`);
    }

    /**
     * Update the power-up effect (call every frame)
     */
    update(dt: number): void {
        if (!this.isActive) return;
        
        this.timeRemaining -= dt;
        
        // Update visual effects
        this.updateVisuals(dt);
        
        // Call custom update callback
        if (this.onUpdate) {
            this.onUpdate(dt);
        }
        
        // Check if expired
        if (this.timeRemaining <= 0) {
            this.deactivate();
        }
    }

    /**
     * Deactivate the power-up effect
     */
    deactivate(): void {
        if (!this.isActive) return;
        
        this.isActive = false;
        this.timeRemaining = 0;
        
        // Remove visual effects
        this.destroyVisuals();
        
        // Call custom deactivate callback
        if (this.onDeactivate) {
            this.onDeactivate();
        }
        
        console.log(`✨ Power-up ended: ${this.config.name}`);
    }

    /**
     * Create visual effects for this power-up
     * Override or extend this method for custom visuals
     */
    private createVisuals(): void {
        // Visual creation is handled by PowerUpManager to keep references
        // This method can be extended for power-up-specific visuals
    }

    /**
     * Update visual effects
     */
    private updateVisuals(dt: number): void {
        // Visual updates handled by PowerUpManager
    }

    /**
     * Remove visual effects
     */
    private destroyVisuals(): void {
        // Visual destruction handled by PowerUpManager
    }

    /**
     * Play activation sound effect
     */
    private playActivationSound(): void {
        // Sound playback handled by PowerUpManager with audio system reference
    }

    /**
     * Get effect info for UI display
     */
    getInfo(): ActiveEffectInfo {
        return {
            type: this.type,
            name: this.config.name,
            icon: this.config.icon,
            timeRemaining: Math.max(0, this.timeRemaining),
            duration: this.duration,
            progress: this.timeRemaining / this.duration
        };
    }
}

