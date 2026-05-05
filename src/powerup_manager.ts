/**
 * Power-Up Manager for Dog Dash
 * Manages magical power-ups for a whimsical space adventure
 * 
 * Designed for easy extension - add new power-ups by:
 * 1. Adding to PowerUpType enum
 * 2. Adding configuration to POWER_UP_CONFIGS
 * 3. Implementing visual effects in PowerUpEffect.createVisuals()
 */

import * as THREE from 'three';
import { ParticleSystem } from './particles';
import { AudioSystem } from './audio_system';

// =============================================================================
// POWER-UP TYPE DEFINITIONS
// =============================================================================

export enum PowerUpType {
    // Tier 1 - Easy Quick Wins (available from start)
    RAINBOW_COMET_TAIL = 'rainbow_comet_tail',
    FLOWER_CROWN_BOOST = 'flower_crown_boost',
    BUBBLEGUM_SHIELD = 'bubblegum_shield',
    TWINKLE_STAR_MAGNET = 'twinkle_star_magnet',
    
    // Tier 2 - Medium Fun (unlockable)
    UNICORN_HORN_BLAST = 'unicorn_horn_blast',
    DREAM_CLOUD_CARPET = 'dream_cloud_carpet',
    LULLABY_LANTERN = 'lullaby_lantern',
    PUPPY_HUG_HUG = 'puppy_hug_hug',
    
    // Tier 3 - Wow-Factor Magic (rare/powerful)
    MOONBEAM_SLIDE = 'moonbeam_slide',
    FAIRY_GODMOTHER_SPARKLE = 'fairy_godmother_sparkle',
    CANDY_CANE_VORTEX = 'candy_cane_vortex',
    STARLIGHT_TIARA = 'starlight_tiara',
    BUTTERFLY_ESCORT = 'butterfly_escort',
    MAGIC_PAINTBRUSH = 'magic_paintbrush',
    BEST_FRIEND_FOREVER_AURA = 'best_friend_forever_aura'
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface PowerUpConfig {
    type: PowerUpType;
    name: string;
    description: string;
    duration: number;           // Duration in seconds
    color: number;              // Primary color (hex)
    secondaryColor: number;     // Secondary/accent color (hex)
    soundEffect: string;        // Sound to play on activation
    tier: 1 | 2 | 3;           // Unlock tier
    icon: string;               // Emoji/icon for UI
}

export const POWER_UP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
    // Tier 1
    [PowerUpType.RAINBOW_COMET_TAIL]: {
        type: PowerUpType.RAINBOW_COMET_TAIL,
        name: 'Rainbow Comet Tail',
        description: 'Long rainbow trail that auto-collects nearby stars and turns asteroids into candy!',
        duration: 12,
        color: 0xff6b6b,      // Pastel red
        secondaryColor: 0x48dbfb, // Pastel cyan
        soundEffect: 'powerup_rainbow',
        tier: 1,
        icon: '🌈'
    },
    [PowerUpType.FLOWER_CROWN_BOOST]: {
        type: PowerUpType.FLOWER_CROWN_BOOST,
        name: 'Flower Crown Boost',
        description: 'Gentle upward float with pollen trail that slows obstacles!',
        duration: 8,
        color: 0xffb6c1,      // Light pink
        secondaryColor: 0xdda0dd, // Plum
        soundEffect: 'powerup_flower',
        tier: 1,
        icon: '🌸'
    },
    [PowerUpType.BUBBLEGUM_SHIELD]: {
        type: PowerUpType.BUBBLEGUM_SHIELD,
        name: 'Bubblegum Shield',
        description: 'Pink heart bubble that bounces asteroids with a "boing!" sound!',
        duration: 12,
        color: 0xff69b4,      // Hot pink
        secondaryColor: 0xff1493, // Deep pink
        soundEffect: 'powerup_shield',
        tier: 1,
        icon: '🫧'
    },
    [PowerUpType.TWINKLE_STAR_MAGNET]: {
        type: PowerUpType.TWINKLE_STAR_MAGNET,
        name: 'Twinkle Star Magnet',
        description: 'Pulls stars toward your rocket with magical rainbow lines!',
        duration: 10,
        color: 0xffd700,      // Gold
        secondaryColor: 0xff69b4, // Hot pink
        soundEffect: 'powerup_magnet',
        tier: 1,
        icon: '✨'
    },
    
    // Tier 2
    [PowerUpType.UNICORN_HORN_BLAST]: {
        type: PowerUpType.UNICORN_HORN_BLAST,
        name: 'Unicorn Horn Blast',
        description: 'Shoots a beam of stars that transforms asteroids into butterflies!',
        duration: 8,
        color: 0xffb6c1,
        secondaryColor: 0x9370db,
        soundEffect: 'powerup_unicorn',
        tier: 2,
        icon: '🦄'
    },
    [PowerUpType.DREAM_CLOUD_CARPET]: {
        type: PowerUpType.DREAM_CLOUD_CARPET,
        name: 'Dream Cloud Carpet',
        description: 'Ride on a fluffy rainbow cloud - auto-hover mode!',
        duration: 10,
        color: 0xe6e6fa,
        secondaryColor: 0xffb6c1,
        soundEffect: 'powerup_cloud',
        tier: 2,
        icon: '☁️'
    },
    [PowerUpType.LULLABY_LANTERN]: {
        type: PowerUpType.LULLABY_LANTERN,
        name: 'Lullaby Lantern',
        description: 'Singing lantern makes obstacles gently sway aside!',
        duration: 12,
        color: 0xffd700,
        secondaryColor: 0xffa500,
        soundEffect: 'powerup_lantern',
        tier: 2,
        icon: '🏮'
    },
    [PowerUpType.PUPPY_HUG_HUG]: {
        type: PowerUpType.PUPPY_HUG_HUG,
        name: 'Puppy Hug Hug',
        description: 'Golden heart aura doubles collectible value + extra life!',
        duration: 10,
        color: 0xffd700,
        secondaryColor: 0xff69b4,
        soundEffect: 'powerup_hug',
        tier: 2,
        icon: '🤗'
    },
    
    // Tier 3
    [PowerUpType.MOONBEAM_SLIDE]: {
        type: PowerUpType.MOONBEAM_SLIDE,
        name: 'Moonbeam Slide',
        description: 'Silver slide from rocket for super speed and bonus stars!',
        duration: 8,
        color: 0xc0c0c0,
        secondaryColor: 0xffffff,
        soundEffect: 'powerup_moonbeam',
        tier: 3,
        icon: '🌙'
    },
    [PowerUpType.FAIRY_GODMOTHER_SPARKLE]: {
        type: PowerUpType.FAIRY_GODMOTHER_SPARKLE,
        name: 'Fairy Godmother Sparkle',
        description: 'Tiny fairy dog grants a random power-up for free!',
        duration: 5,
        color: 0xffd700,
        secondaryColor: 0xff69b4,
        soundEffect: 'powerup_fairy',
        tier: 3,
        icon: '🧚'
    },
    [PowerUpType.CANDY_CANE_VORTEX]: {
        type: PowerUpType.CANDY_CANE_VORTEX,
        name: 'Candy Cane Vortex',
        description: 'Swirling tornado that pops obstacles into jellybean confetti!',
        duration: 10,
        color: 0xff0000,
        secondaryColor: 0xffffff,
        soundEffect: 'powerup_vortex',
        tier: 3,
        icon: '🍭'
    },
    [PowerUpType.STARLIGHT_TIARA]: {
        type: PowerUpType.STARLIGHT_TIARA,
        name: 'Starlight Tiara',
        description: 'Invincible! Leave a trail of permanent bonus stars!',
        duration: 8,
        color: 0xffd700,
        secondaryColor: 0x00ffff,
        soundEffect: 'powerup_tiara',
        tier: 3,
        icon: '👑'
    },
    [PowerUpType.BUTTERFLY_ESCORT]: {
        type: PowerUpType.BUTTERFLY_ESCORT,
        name: 'Butterfly Escort',
        description: 'Swarm of butterflies blocks 2-3 hits automatically!',
        duration: 15,
        color: 0xffb6c1,
        secondaryColor: 0x9370db,
        soundEffect: 'powerup_butterfly',
        tier: 3,
        icon: '🦋'
    },
    [PowerUpType.MAGIC_PAINTBRUSH]: {
        type: PowerUpType.MAGIC_PAINTBRUSH,
        name: 'Magic Paintbrush',
        description: 'Paint rainbow bridges with your mouse!',
        duration: 12,
        color: 0xff69b4,
        secondaryColor: 0x00ff00,
        soundEffect: 'powerup_paint',
        tier: 3,
        icon: '🎨'
    },
    [PowerUpType.BEST_FRIEND_FOREVER_AURA]: {
        type: PowerUpType.BEST_FRIEND_FOREVER_AURA,
        name: 'Best Friend Forever Aura',
        description: 'Time slows, everything sparkles, pure joy!',
        duration: 10,
        color: 0xff69b4,
        secondaryColor: 0xffd700,
        soundEffect: 'powerup_bff',
        tier: 3,
        icon: '💖'
    }
};

// =============================================================================
// GAMEPLAY EFFECTS INTERFACE
// =============================================================================

export interface GameplayModifiers {
    // Movement modifiers
    gravityMultiplier: number;       // 0 = no gravity, 1 = normal, -0.5 = float up
    speedMultiplier: number;         // Movement speed modifier
    autoCollectRadius: number;       // Radius for auto-collecting orbs/stars
    
    // Defense modifiers
    shieldActive: boolean;           // Shield protects from damage
    shieldBouncesAsteroids: boolean; // Asteroids bounce off instead of damage
    invincible: boolean;             // Complete invincibility
    butterflyCharges: number;        // Butterfly escort charges
    
    // Collection modifiers
    magnetRadius: number;            // Radius to pull collectibles
    doubleValue: boolean;            // Double collectible value
    
    // Obstacle modifiers
    obstaclesSlowed: boolean;        // Obstacles move slower
    obstacleSlowFactor: number;      // How much slower (0.5 = half speed)
    asteroidsToCandy: boolean;       // Touching asteroids turns them to candy
    asteroidsToButterflies: boolean; // Shooting asteroids makes butterflies
    
    // Time modifiers
    timeScale: number;               // Game time scale (0.5 = half speed)
    
    // Visual modifiers
    sparkle: boolean;                // Extra sparkles everywhere
}

export const DEFAULT_GAMEPLAY_MODIFIERS: GameplayModifiers = {
    gravityMultiplier: 1,
    speedMultiplier: 1,
    autoCollectRadius: 0,
    shieldActive: false,
    shieldBouncesAsteroids: false,
    invincible: false,
    butterflyCharges: 0,
    magnetRadius: 0,
    doubleValue: false,
    obstaclesSlowed: false,
    obstacleSlowFactor: 1,
    asteroidsToCandy: false,
    asteroidsToButterflies: false,
    timeScale: 1,
    sparkle: false
};

// =============================================================================
// MAP ITERATION HELPERS (for ES5 compatibility)
// =============================================================================

function mapValuesToArray<T>(map: Map<any, T>): T[] {
    const result: T[] = [];
    map.forEach((value) => result.push(value));
    return result;
}

function mapEntriesToArray<K, V>(map: Map<K, V>): [K, V][] {
    const result: [K, V][] = [];
    map.forEach((value, key) => result.push([key, value]));
    return result;
}

function mapKeysToArray<K>(map: Map<K, any>): K[] {
    const result: K[] = [];
    map.forEach((_, key) => result.push(key));
    return result;
}

// =============================================================================
// VISUAL EFFECTS
// =============================================================================

export interface TrailConfig {
    color: number;
    secondaryColor?: number;
    particleCount: number;
    particleSize: number;
    lifetime: number;
    rainbow: boolean;
    sparkle: boolean;
}

export const TRAIL_CONFIGS: Record<PowerUpType, TrailConfig> = {
    [PowerUpType.RAINBOW_COMET_TAIL]: {
        color: 0xff6b6b,
        secondaryColor: 0x48dbfb,
        particleCount: 45,
        particleSize: 0.45,
        lifetime: 2.5,
        rainbow: true,
        sparkle: true
    },
    [PowerUpType.FLOWER_CROWN_BOOST]: {
        color: 0xffb6c1,
        secondaryColor: 0xdda0dd,
        particleCount: 15,
        particleSize: 0.2,
        lifetime: 1.0,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.BUBBLEGUM_SHIELD]: {
        color: 0xff69b4,
        secondaryColor: 0xff1493,
        particleCount: 10,
        particleSize: 0.25,
        lifetime: 0.8,
        rainbow: false,
        sparkle: false
    },
    [PowerUpType.TWINKLE_STAR_MAGNET]: {
        color: 0xffd700,
        secondaryColor: 0xff69b4,
        particleCount: 12,
        particleSize: 0.2,
        lifetime: 0.6,
        rainbow: true,
        sparkle: true
    },
    // Defaults for other power-ups (customize as needed)
    [PowerUpType.UNICORN_HORN_BLAST]: {
        color: 0xffb6c1,
        secondaryColor: 0x9370db,
        particleCount: 15,
        particleSize: 0.3,
        lifetime: 1.0,
        rainbow: true,
        sparkle: true
    },
    [PowerUpType.DREAM_CLOUD_CARPET]: {
        color: 0xe6e6fa,
        secondaryColor: 0xffb6c1,
        particleCount: 10,
        particleSize: 0.4,
        lifetime: 1.2,
        rainbow: false,
        sparkle: false
    },
    [PowerUpType.LULLABY_LANTERN]: {
        color: 0xffd700,
        secondaryColor: 0xffa500,
        particleCount: 8,
        particleSize: 0.2,
        lifetime: 1.5,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.PUPPY_HUG_HUG]: {
        color: 0xffd700,
        secondaryColor: 0xff69b4,
        particleCount: 20,
        particleSize: 0.25,
        lifetime: 1.0,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.MOONBEAM_SLIDE]: {
        color: 0xc0c0c0,
        secondaryColor: 0xffffff,
        particleCount: 15,
        particleSize: 0.3,
        lifetime: 1.0,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.FAIRY_GODMOTHER_SPARKLE]: {
        color: 0xffd700,
        secondaryColor: 0xff69b4,
        particleCount: 25,
        particleSize: 0.2,
        lifetime: 0.8,
        rainbow: true,
        sparkle: true
    },
    [PowerUpType.CANDY_CANE_VORTEX]: {
        color: 0xff0000,
        secondaryColor: 0xffffff,
        particleCount: 30,
        particleSize: 0.25,
        lifetime: 1.2,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.STARLIGHT_TIARA]: {
        color: 0xffd700,
        secondaryColor: 0x00ffff,
        particleCount: 20,
        particleSize: 0.3,
        lifetime: 2.0,
        rainbow: true,
        sparkle: true
    },
    [PowerUpType.BUTTERFLY_ESCORT]: {
        color: 0xffb6c1,
        secondaryColor: 0x9370db,
        particleCount: 15,
        particleSize: 0.2,
        lifetime: 1.0,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.MAGIC_PAINTBRUSH]: {
        color: 0xff69b4,
        secondaryColor: 0x00ff00,
        particleCount: 12,
        particleSize: 0.25,
        lifetime: 1.5,
        rainbow: true,
        sparkle: true
    },
    [PowerUpType.BEST_FRIEND_FOREVER_AURA]: {
        color: 0xff69b4,
        secondaryColor: 0xffd700,
        particleCount: 30,
        particleSize: 0.3,
        lifetime: 1.2,
        rainbow: true,
        sparkle: true
    }
};

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

// =============================================================================
// POWER-UP MANAGER CLASS
// =============================================================================

export interface PowerUpManagerOptions {
    scene: THREE.Scene;
    particleSystem: ParticleSystem;
    audioSystem?: AudioSystem;
    rocket?: THREE.Group;
    onPowerUpStart?: (type: PowerUpType, config: PowerUpConfig) => void;
    onPowerUpEnd?: (type: PowerUpType, config: PowerUpConfig) => void;
    onOrbCountChange?: (count: number, needed: number) => void;
}

export class PowerUpManager {
    private scene: THREE.Scene;
    private particleSystem: ParticleSystem;
    private audioSystem?: AudioSystem;
    private rocket?: THREE.Group;
    
    // Active effects
    activeEffects: Map<PowerUpType, PowerUpEffect>;
    
    // Visual effect containers
    private effectMeshes: Map<PowerUpType, THREE.Group>;
    private effectLights: Map<PowerUpType, THREE.PointLight>;
    private shieldMesh?: THREE.Mesh;
    private flowerCrownMesh?: THREE.Group;
    private starLines: THREE.Line[] = [];
    private butterflies: THREE.Group[] = [];
    private cometGlowMesh?: THREE.Mesh;
    private cometTrailParticles: THREE.Mesh[] = [];
    private shieldBounceTime = 0;
    
    // Orb collection for triggering power-ups
    orbCount: number;
    orbsNeededForPowerUp: number;
    
    // Callbacks
    private onPowerUpStart?: (type: PowerUpType, config: PowerUpConfig) => void;
    private onPowerUpEnd?: (type: PowerUpType, config: PowerUpConfig) => void;
    private onOrbCountChange?: (count: number, needed: number) => void;

    constructor(options: PowerUpManagerOptions) {
        this.scene = options.scene;
        this.particleSystem = options.particleSystem;
        this.audioSystem = options.audioSystem;
        this.rocket = options.rocket;
        
        this.activeEffects = new Map();
        this.effectMeshes = new Map();
        this.effectLights = new Map();
        
        this.orbCount = 0;
        this.orbsNeededForPowerUp = 3;  // Collect 3 orbs for random power-up
        
        this.onPowerUpStart = options.onPowerUpStart;
        this.onPowerUpEnd = options.onPowerUpEnd;
        this.onOrbCountChange = options.onOrbCountChange;
    }

    /**
     * Update all active power-up effects
     * Call this in your main game loop
     */
    update(dt: number, rocketPosition?: THREE.Vector3): void {
        // Update each active effect
        mapEntriesToArray(this.activeEffects).forEach(([type, effect]) => {
            effect.update(dt);
            
            // Update visual positions to follow rocket
            if (rocketPosition) {
                this.updateEffectPosition(type, rocketPosition);
            }
            
            // Check if expired
            if (!effect.isActive) {
                this.cleanupEffect(type);
            }
        });
        
        // Emit trail particles for active effects
        if (rocketPosition) {
            this.emitTrailParticles(rocketPosition);
        }
        
        // Apply visual modifiers
        const modifiers = this.getCombinedModifiers();
        if (modifiers.sparkle && Math.random() < 0.3) {
            // Emit extra sparkles
            this.particleSystem.emit(
                rocketPosition!.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 0)),
                0xffd700,
                1,
                0.5,
                0.15,
                0.3
            );
        }
        
        // Update star magnet lines
        this.updateStarMagnetLines(rocketPosition);
    }

    /**
     * Activate a power-up by type
     */
    activatePowerUp(type: PowerUpType): boolean {
        // Check if already active
        if (this.activeEffects.has(type)) {
            const existing = this.activeEffects.get(type)!;
            existing.activate();  // Refresh duration
            return true;
        }
        
        // Create new effect
        const effect = new PowerUpEffect(
            type,
            this.scene,
            this.particleSystem,
            () => this.onEffectActivate(type),
            undefined,
            () => this.onEffectDeactivate(type)
        );
        
        effect.activate();
        this.activeEffects.set(type, effect);
        
        // Create visual effects
        this.createEffectVisuals(type);
        
        // Play sound
        if (this.audioSystem) {
            this.audioSystem.play('powerup');
        }
        
        // Callback
        if (this.onPowerUpStart) {
            this.onPowerUpStart(type, effect.config);
        }
        
        return true;
    }

    /**
     * Activate a random power-up (for orb collection reward)
     */
    activateRandomPowerUp(tier: 1 | 2 | 3 = 1): boolean {
        // Get available power-ups for this tier
        const available = Object.values(POWER_UP_CONFIGS)
            .filter(config => config.tier === tier)
            .map(config => config.type);
        
        if (available.length === 0) return false;
        
        // Pick random
        const randomType = available[Math.floor(Math.random() * available.length)];
        return this.activatePowerUp(randomType);
    }

    /**
     * Called when an orb is collected
     * Returns true if a power-up was triggered
     */
    collectOrb(): boolean {
        this.orbCount++;
        
        // Check if we should trigger a power-up
        if (this.orbCount >= this.orbsNeededForPowerUp) {
            this.orbCount = 0;
            this.activateRandomPowerUp(1);  // Always tier 1 from orbs
            
            // Notify
            if (this.onOrbCountChange) {
                this.onOrbCountChange(0, this.orbsNeededForPowerUp);
            }
            
            return true;
        }
        
        // Notify of progress
        if (this.onOrbCountChange) {
            this.onOrbCountChange(this.orbCount, this.orbsNeededForPowerUp);
        }
        
        return false;
    }

    /**
     * Trigger power-up from orb count (manual check)
     */
    triggerFromOrbs(orbCount: number): boolean {
        if (orbCount >= this.orbsNeededForPowerUp) {
            return this.activateRandomPowerUp(1);
        }
        return false;
    }

    /**
     * Check if a specific power-up is currently active
     */
    hasPowerUp(type: PowerUpType): boolean {
        const effect = this.activeEffects.get(type);
        return effect ? effect.isActive : false;
    }

    /**
     * Get list of all currently active effects (for UI)
     */
    getActiveEffects(): ActiveEffectInfo[] {
        const effects: ActiveEffectInfo[] = [];
        mapValuesToArray(this.activeEffects).forEach((effect) => {
            if (effect.isActive) {
                effects.push(effect.getInfo());
            }
        });
        return effects;
    }

    /**
     * Get combined gameplay modifiers from all active effects
     */
    getCombinedModifiers(): GameplayModifiers {
        const combined: GameplayModifiers = { ...DEFAULT_GAMEPLAY_MODIFIERS };
        
        mapValuesToArray(this.activeEffects).forEach((effect) => {
            if (!effect.isActive) return;
            
            const mods = effect.modifiers;
            
            // Apply multiplicative modifiers
            if (mods.gravityMultiplier !== undefined) {
                combined.gravityMultiplier *= mods.gravityMultiplier;
            }
            if (mods.speedMultiplier !== undefined) {
                combined.speedMultiplier *= mods.speedMultiplier;
            }
            if (mods.obstacleSlowFactor !== undefined) {
                combined.obstacleSlowFactor *= mods.obstacleSlowFactor;
            }
            if (mods.timeScale !== undefined) {
                combined.timeScale *= mods.timeScale;
            }
            
            // Apply additive modifiers
            if (mods.autoCollectRadius !== undefined) {
                combined.autoCollectRadius = Math.max(combined.autoCollectRadius, mods.autoCollectRadius);
            }
            if (mods.magnetRadius !== undefined) {
                combined.magnetRadius = Math.max(combined.magnetRadius, mods.magnetRadius);
            }
            if (mods.butterflyCharges !== undefined) {
                combined.butterflyCharges += mods.butterflyCharges;
            }
            
            // Apply boolean modifiers (OR logic)
            if (mods.shieldActive) combined.shieldActive = true;
            if (mods.shieldBouncesAsteroids) combined.shieldBouncesAsteroids = true;
            if (mods.invincible) combined.invincible = true;
            if (mods.obstaclesSlowed) combined.obstaclesSlowed = true;
            if (mods.asteroidsToCandy) combined.asteroidsToCandy = true;
            if (mods.asteroidsToButterflies) combined.asteroidsToButterflies = true;
            if (mods.sparkle) combined.sparkle = true;
            if (mods.doubleValue) combined.doubleValue = true;
        });
        
        return combined;
    }

    /**
     * Get current orb progress
     */
    getOrbProgress(): { current: number; needed: number; progress: number } {
        return {
            current: this.orbCount,
            needed: this.orbsNeededForPowerUp,
            progress: this.orbCount / this.orbsNeededForPowerUp
        };
    }

    /**
     * Consume one butterfly charge (for hit protection)
     * Returns true if a charge was consumed
     */
    consumeButterflyCharge(): boolean {
        const butterflyEffect = this.activeEffects.get(PowerUpType.BUTTERFLY_ESCORT);
        if (butterflyEffect && butterflyEffect.isActive) {
            const mods = butterflyEffect.modifiers;
            if (mods.butterflyCharges && mods.butterflyCharges > 0) {
                mods.butterflyCharges--;
                
                // Remove a butterfly visually
                if (this.butterflies.length > 0) {
                    const butterfly = this.butterflies.pop();
                    if (butterfly) {
                        this.scene.remove(butterfly);
                    }
                }
                
                // If no more charges, end the effect
                if (mods.butterflyCharges <= 0) {
                    butterflyEffect.deactivate();
                }
                
                return true;
            }
        }
        return false;
    }

    /**
     * Clear all active effects
     */
    clearAll(): void {
        mapEntriesToArray(this.activeEffects).forEach(([type, effect]) => {
            effect.deactivate();
        });
        this.activeEffects.clear();
        this.cleanupAllVisuals();
    }

    // =============================================================================
    // PRIVATE HELPER METHODS
    // =============================================================================

    private onEffectActivate(type: PowerUpType): void {
        // Effect-specific activation logic
    }

    private onEffectDeactivate(type: PowerUpType): void {
        // Effect-specific deactivation logic
        this.cleanupEffect(type);
    }

    private cleanupEffect(type: PowerUpType): void {
        const effect = this.activeEffects.get(type);
        if (effect) {
            this.activeEffects.delete(type);
            
            // Remove visuals
            this.removeEffectVisuals(type);
            
            // Callback
            if (this.onPowerUpEnd) {
                this.onPowerUpEnd(type, effect.config);
            }
        }
    }

    // =============================================================================
    // VISUAL EFFECTS CREATION
    // =============================================================================

    private createEffectVisuals(type: PowerUpType): void {
        const config = POWER_UP_CONFIGS[type];
        
        switch (type) {
            case PowerUpType.BUBBLEGUM_SHIELD:
                this.createBubblegumShield(config);
                break;
            case PowerUpType.FLOWER_CROWN_BOOST:
                this.createFlowerCrown(config);
                break;
            case PowerUpType.TWINKLE_STAR_MAGNET:
                this.createStarMagnetEffect(config);
                break;
            case PowerUpType.BUTTERFLY_ESCORT:
                this.createButterflyEscort(config);
                break;
            case PowerUpType.RAINBOW_COMET_TAIL:
                this.createRainbowCometGlow(config);
                break;
            case PowerUpType.STARLIGHT_TIARA:
                this.createStarlightTiara(config);
                break;
        }
        
        // Add a point light for glow
        this.createEffectLight(type, config.color);
    }

    private createBubblegumShield(config: PowerUpConfig): void {
        if (!this.rocket) return;
        
        // Create heart-shaped bubble
        const shape = new THREE.Shape();
        const x = 0, y = 0;
        shape.moveTo(x + 0.25, y + 0.25);
        shape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
        shape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
        shape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
        shape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
        shape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
        shape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);
        
        const geometry = new THREE.SphereGeometry(1.8, 32, 32);
        const material = new THREE.MeshPhysicalMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.4,
            roughness: 0.1,
            metalness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide
        });
        
        this.shieldMesh = new THREE.Mesh(geometry, material);
        this.shieldMesh.scale.set(1, 1, 0.7);  // Slightly flattened
        
        // Wrap in a group to match the effectMeshes type
        const shieldGroup = new THREE.Group();
        shieldGroup.add(this.shieldMesh);
        this.rocket.add(shieldGroup);
        
        this.effectMeshes.set(PowerUpType.BUBBLEGUM_SHIELD, shieldGroup);
    }

    private createFlowerCrown(config: PowerUpConfig): void {
        if (!this.rocket) return;
        
        const crownGroup = new THREE.Group();
        
        // Create flower petals around the rocket
        const petalCount = 8;
        for (let i = 0; i < petalCount; i++) {
            const angle = (i / petalCount) * Math.PI * 2;
            const petal = new THREE.Mesh(
                new THREE.SphereGeometry(0.3, 8, 8),
                new THREE.MeshBasicMaterial({
                    color: i % 2 === 0 ? config.color : config.secondaryColor,
                    transparent: true,
                    opacity: 0.8
                })
            );
            petal.position.set(
                Math.cos(angle) * 1.2,
                Math.sin(angle) * 1.2,
                0.5
            );
            crownGroup.add(petal);
        }
        
        this.flowerCrownMesh = crownGroup;
        this.rocket.add(crownGroup);
        
        this.effectMeshes.set(PowerUpType.FLOWER_CROWN_BOOST, crownGroup);
    }

    private createStarMagnetEffect(config: PowerUpConfig): void {
        // Star magnet uses lines that will be updated in updateStarMagnetLines
        // Just initialize the array
        this.starLines = [];
    }

    private createButterflyEscort(config: PowerUpConfig): void {
        if (!this.rocket) return;
        
        // Create butterflies orbiting the rocket
        const butterflyCount = 6;
        for (let i = 0; i < butterflyCount; i++) {
            const butterfly = new THREE.Group();
            
            // Simple butterfly shape using two wings
            const wingGeo = new THREE.CircleGeometry(0.2, 6);
            const wingMat = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? config.color : config.secondaryColor,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            });
            
            const leftWing = new THREE.Mesh(wingGeo, wingMat);
            leftWing.position.x = -0.15;
            leftWing.rotation.y = 0.3;
            
            const rightWing = new THREE.Mesh(wingGeo, wingMat);
            rightWing.position.x = 0.15;
            rightWing.rotation.y = -0.3;
            
            butterfly.add(leftWing);
            butterfly.add(rightWing);
            
            // Position in orbit
            const angle = (i / butterflyCount) * Math.PI * 2;
            butterfly.userData = {
                orbitAngle: angle,
                orbitRadius: 2 + Math.random() * 0.5,
                orbitSpeed: 1 + Math.random() * 0.5,
                wingSpeed: 10 + Math.random() * 5
            };
            
            this.rocket.add(butterfly);
            this.butterflies.push(butterfly);
        }
        
        // Store reference to parent group for butterfly effect
        if (this.butterflies.length > 0 && this.butterflies[0].parent) {
            const parentGroup = new THREE.Group();
            parentGroup.name = 'butterfly_escort_container';
            this.effectMeshes.set(PowerUpType.BUTTERFLY_ESCORT, parentGroup);
        }
    }

    private createStarlightTiara(config: PowerUpConfig): void {
        if (!this.rocket) return;
        
        const tiaraGroup = new THREE.Group();
        
        // Create tiara crown shape
        const spikeCount = 5;
        for (let i = 0; i < spikeCount; i++) {
            const height = i === 2 ? 0.6 : 0.3;  // Center spike is tallest
            const spike = new THREE.Mesh(
                new THREE.ConeGeometry(0.1, height, 8),
                new THREE.MeshBasicMaterial({
                    color: config.color,
                    transparent: true,
                    opacity: 0.9
                })
            );
            spike.position.set((i - 2) * 0.3, 1.5 + height / 2, 0);
            tiaraGroup.add(spike);
            
            // Add gem at the top
            const gem = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.08),
                new THREE.MeshBasicMaterial({ color: config.secondaryColor })
            );
            gem.position.set((i - 2) * 0.3, 1.5 + height, 0);
            tiaraGroup.add(gem);
        }
        
        this.rocket.add(tiaraGroup);
        this.effectMeshes.set(PowerUpType.STARLIGHT_TIARA, tiaraGroup);
    }

    private createRainbowCometGlow(config: PowerUpConfig): void {
        if (!this.rocket) return;

        // Soft pastel glow sphere around the rocket
        const geometry = new THREE.SphereGeometry(1.5, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.25,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });

        this.cometGlowMesh = new THREE.Mesh(geometry, material);
        this.rocket.add(this.cometGlowMesh);

        // Store reference
        const glowGroup = new THREE.Group();
        glowGroup.add(this.cometGlowMesh);
        this.effectMeshes.set(PowerUpType.RAINBOW_COMET_TAIL, glowGroup);
    }

    private createEffectLight(type: PowerUpType, color: number): void {
        if (!this.rocket) return;
        
        const light = new THREE.PointLight(color, 1, 10);
        light.position.set(0, 0, 0);
        this.rocket.add(light);
        this.effectLights.set(type, light);
    }

    // =============================================================================
    // VISUAL EFFECTS UPDATES
    // =============================================================================

    private updateEffectPosition(type: PowerUpType, rocketPosition: THREE.Vector3): void {
        // Meshes are attached to rocket, so they move automatically
        // Update specific animations here
        
        switch (type) {
            case PowerUpType.BUBBLEGUM_SHIELD:
                if (this.shieldMesh) {
                    const now = Date.now() * 0.001;
                    // Gentle idle pulse
                    let scale = 1 + Math.sin(now * 3) * 0.06;
                    // Wobble rotation
                    this.shieldMesh.rotation.z = Math.sin(now * 2.5) * 0.08;
                    this.shieldMesh.rotation.x = Math.cos(now * 1.8) * 0.05;
                    // Bounce reaction: strong elastic pulse
                    if (this.shieldBounceTime > 0) {
                        const bounce = Math.sin(this.shieldBounceTime * Math.PI * 8) * 0.25 * this.shieldBounceTime;
                        scale += bounce;
                        this.shieldBounceTime -= 0.016;
                        if (this.shieldBounceTime < 0) this.shieldBounceTime = 0;
                    }
                    this.shieldMesh.scale.set(scale, scale, scale * 0.7);
                }
                break;
            case PowerUpType.FLOWER_CROWN_BOOST:
                if (this.flowerCrownMesh) {
                    // Rotate crown
                    this.flowerCrownMesh.rotation.z += 0.02;
                }
                break;
            case PowerUpType.RAINBOW_COMET_TAIL:
                if (this.cometGlowMesh) {
                    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.15;
                    this.cometGlowMesh.scale.set(pulse, pulse, pulse);
                    const pastelColors = [0xff6b6b, 0xfeca57, 0x48dbfb, 0xff9ff3, 0x54a0ff];
                    const colorIndex = Math.floor((Date.now() * 0.002) % pastelColors.length);
                    (this.cometGlowMesh.material as THREE.MeshBasicMaterial).color.setHex(pastelColors[colorIndex]);
                }
                break;
            case PowerUpType.BUTTERFLY_ESCORT:
                // Update butterfly orbits
                this.butterflies.forEach(butterfly => {
                    const data = butterfly.userData;
                    data.orbitAngle += data.orbitSpeed * 0.02;
                    butterfly.position.x = Math.cos(data.orbitAngle) * data.orbitRadius;
                    butterfly.position.y = Math.sin(data.orbitAngle) * data.orbitRadius;
                    butterfly.position.z = Math.sin(data.orbitAngle * 2) * 0.5;
                    
                    // Flap wings
                    butterfly.children[0].rotation.y = 0.3 + Math.sin(Date.now() * 0.01 * data.wingSpeed) * 0.3;
                    butterfly.children[1].rotation.y = -0.3 - Math.sin(Date.now() * 0.01 * data.wingSpeed) * 0.3;
                });
                break;
        }
    }

    private emitTrailParticles(rocketPosition: THREE.Vector3): void {
        mapEntriesToArray(this.activeEffects).forEach(([type, effect]) => {
            if (!effect.isActive) return;
            
            const trailConfig = TRAIL_CONFIGS[type];
            
            // Emit particles at rocket position (slightly behind)
            const emitPos = rocketPosition.clone();
            emitPos.x -= 1;  // Behind the rocket
            
            // Determine color (rainbow cycling if needed)
            let color = trailConfig.color;
            if (trailConfig.rainbow) {
                if (type === PowerUpType.RAINBOW_COMET_TAIL) {
                    // Specific pastel rainbow colors: red → yellow → cyan → pink → blue
                    const rainbowColors = [0xff6b6b, 0xfeca57, 0x48dbfb, 0xff9ff3, 0x54a0ff];
                    const colorIndex = Math.floor((Date.now() * 0.003) % rainbowColors.length);
                    color = rainbowColors[colorIndex];
                } else {
                    const hue = (Date.now() * 0.001) % 1;
                    const rainbowColor = new THREE.Color().setHSL(hue, 1, 0.5);
                    color = rainbowColor.getHex();
                }
            }
            
            // Emit particles
            this.particleSystem.emit(
                emitPos,
                color,
                Math.floor(trailConfig.particleCount / 10),  // Emit a few per frame
                1.0,
                trailConfig.particleSize,
                0.5
            );
            
            // Extra dramatic trail for Rainbow Comet Tail
            if (type === PowerUpType.RAINBOW_COMET_TAIL) {
                const secondaryPos = rocketPosition.clone();
                secondaryPos.x -= 1.5;
                secondaryPos.y += (Math.random() - 0.5) * 0.5;
                const pastelColors = [0xff6b6b, 0xfeca57, 0x48dbfb, 0xff9ff3, 0x54a0ff];
                const secColor = pastelColors[Math.floor((Date.now() * 0.003 + 2) % pastelColors.length)];
                this.particleSystem.emit(secondaryPos, secColor, 2, 0.8, 0.35, 0.4);
            }
        });
    }

    private updateStarMagnetLines(rocketPosition?: THREE.Vector3): void {
        if (!rocketPosition) return;
        if (!this.hasPowerUp(PowerUpType.TWINKLE_STAR_MAGNET)) {
            // Clean up any existing lines
            this.starLines.forEach(line => this.scene.remove(line));
            this.starLines = [];
            return;
        }
        
        // Star magnet lines are drawn to nearby collectibles
        // This would need collectible positions passed in
        // For now, create decorative lines extending outward
        
        const config = POWER_UP_CONFIGS[PowerUpType.TWINKLE_STAR_MAGNET];
        
        // Clean up old lines periodically
        if (this.starLines.length > 5) {
            const oldLine = this.starLines.shift();
            if (oldLine) this.scene.remove(oldLine);
        }
        
        // Create new line occasionally
        if (Math.random() < 0.1) {
            const angle = Math.random() * Math.PI * 2;
            const length = 3 + Math.random() * 5;
            const endPos = new THREE.Vector3(
                rocketPosition.x + Math.cos(angle) * length,
                rocketPosition.y + Math.sin(angle) * length,
                rocketPosition.z
            );
            
            const geometry = new THREE.BufferGeometry().setFromPoints([
                rocketPosition.clone(),
                endPos
            ]);
            
            const material = new THREE.LineBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: 0.5
            });
            
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
            this.starLines.push(line);
        }
        
        // Fade out lines
        this.starLines.forEach((line, index) => {
            const mat = line.material as THREE.LineBasicMaterial;
            mat.opacity -= 0.02;
            if (mat.opacity <= 0) {
                this.scene.remove(line);
                this.starLines.splice(index, 1);
            }
        });
    }

    // =============================================================================
    // VISUAL EFFECTS CLEANUP
    // =============================================================================

    private removeEffectVisuals(type: PowerUpType): void {
        // Remove mesh
        const mesh = this.effectMeshes.get(type);
        if (mesh && this.rocket) {
            this.rocket.remove(mesh);
        }
        this.effectMeshes.delete(type);
        
        // Remove light
        const light = this.effectLights.get(type);
        if (light && this.rocket) {
            this.rocket.remove(light);
            this.effectLights.delete(type);
        }
        
        // Special cleanup for specific effects
        switch (type) {
            case PowerUpType.BUBBLEGUM_SHIELD:
                this.shieldMesh = undefined;
                break;
            case PowerUpType.FLOWER_CROWN_BOOST:
                this.flowerCrownMesh = undefined;
                break;
            case PowerUpType.RAINBOW_COMET_TAIL:
                this.cometGlowMesh = undefined;
                this.cometTrailParticles.forEach(p => {
                    if (p.parent) p.parent.remove(p);
                });
                this.cometTrailParticles = [];
                break;
            case PowerUpType.BUTTERFLY_ESCORT:
                this.butterflies.forEach(b => {
                    if (b.parent) b.parent.remove(b);
                });
                this.butterflies = [];
                break;
        }
    }

    private cleanupAllVisuals(): void {
        mapKeysToArray(this.effectMeshes).forEach((type) => {
            this.removeEffectVisuals(type);
        });
        this.starLines.forEach(line => this.scene.remove(line));
        this.starLines = [];
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Set the rocket reference (for attaching visuals)
     */
    setRocket(rocket: THREE.Group): void {
        this.rocket = rocket;
    }

    /**
     * Set the audio system reference
     */
    setAudioSystem(audioSystem: AudioSystem): void {
        this.audioSystem = audioSystem;
    }

    /**
     * Trigger a visual bounce reaction on the shield
     */
    triggerShieldBounce(): void {
        this.shieldBounceTime = 0.35;
        if (this.shieldMesh) {
            // Emit extra pink sparkles from shield surface
            const worldPos = new THREE.Vector3();
            this.shieldMesh.getWorldPosition(worldPos);
            this.particleSystem.emit(worldPos, 0xff69b4, 8, 3.5, 0.5, 0.6);
            this.particleSystem.emit(worldPos, 0xffffff, 4, 2.5, 0.4, 0.4);
        }
    }

    /**
     * Get the number of orbs needed for next power-up
     */
    getOrbsNeeded(): number {
        return this.orbsNeededForPowerUp;
    }

    /**
     * Set the number of orbs needed for a power-up
     */
    setOrbsNeeded(count: number): void {
        this.orbsNeededForPowerUp = count;
    }

    /**
     * Reset orb count
     */
    resetOrbCount(): void {
        this.orbCount = 0;
        if (this.onOrbCountChange) {
            this.onOrbCountChange(0, this.orbsNeededForPowerUp);
        }
    }

    /**
     * Get power-up configuration
     */
    static getConfig(type: PowerUpType): PowerUpConfig {
        return POWER_UP_CONFIGS[type];
    }

    /**
     * Get all power-up configurations
     */
    static getAllConfigs(): Record<PowerUpType, PowerUpConfig> {
        return { ...POWER_UP_CONFIGS };
    }

    /**
     * Get power-ups by tier
     */
    static getPowerUpsByTier(tier: 1 | 2 | 3): PowerUpConfig[] {
        return Object.values(POWER_UP_CONFIGS).filter(config => config.tier === tier);
    }
}

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

export default PowerUpManager;
