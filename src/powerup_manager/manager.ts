import * as THREE from 'three';
import { ParticleSystem } from '../particles';
import { AudioSystem } from '../audio_system';
import {
    PowerUpType,
    POWER_UP_CONFIGS,
    DEFAULT_GAMEPLAY_MODIFIERS,
    mapEntriesToArray,
    mapValuesToArray,
    type PowerUpConfig,
    type GameplayModifiers,
} from './types';
import { PowerUpEffect, type ActiveEffectInfo } from './powerup_effect';
import {
    type PowerUpManagerVisualContext,
    createEffectVisuals,
    updateEffectPosition,
    emitTrailParticles,
    updateStarMagnetLines,
    removeEffectVisuals,
    cleanupAllVisuals,
} from './manager_visuals';

// =============================================================================
// POWER-UP MANAGER CLASS
// =============================================================================

export interface PowerUpManagerOptions {
    scene: THREE.Scene;
    particleSystem: ParticleSystem;
    audioSystem?: AudioSystem;
    rocket?: THREE.Group;
    dogController?: any; // Add dogController here
    onPowerUpStart?: (type: PowerUpType, config: PowerUpConfig) => void;
    onPowerUpEnd?: (type: PowerUpType, config: PowerUpConfig) => void;
    onOrbCountChange?: (count: number, needed: number) => void;
}

export class PowerUpManager {
    private scene: THREE.Scene;
    private particleSystem: ParticleSystem;
    private audioSystem?: AudioSystem;
    private rocket?: THREE.Group;
    private dogController?: any;
    
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
        this.dogController = options.dogController;
        
        this.activeEffects = new Map();
        this.effectMeshes = new Map();
        this.effectLights = new Map();
        
        this.orbCount = 0;
        this.orbsNeededForPowerUp = 3;  // Collect 3 orbs for random power-up
        
        this.onPowerUpStart = options.onPowerUpStart;
        this.onPowerUpEnd = options.onPowerUpEnd;
        this.onOrbCountChange = options.onOrbCountChange;
    }

    private getVisualContext(): PowerUpManagerVisualContext {
        const manager = this;
        return {
            scene: this.scene,
            particleSystem: this.particleSystem,
            rocket: this.rocket,
            effectMeshes: this.effectMeshes,
            effectLights: this.effectLights,
            get shieldMesh() { return manager.shieldMesh; },
            set shieldMesh(v: THREE.Mesh | undefined) { manager.shieldMesh = v; },
            get flowerCrownMesh() { return manager.flowerCrownMesh; },
            set flowerCrownMesh(v: THREE.Group | undefined) { manager.flowerCrownMesh = v; },
            starLines: this.starLines,
            butterflies: this.butterflies,
            get cometGlowMesh() { return manager.cometGlowMesh; },
            set cometGlowMesh(v: THREE.Mesh | undefined) { manager.cometGlowMesh = v; },
            cometTrailParticles: this.cometTrailParticles,
            get shieldBounceTime() { return manager.shieldBounceTime; },
            set shieldBounceTime(v: number) { manager.shieldBounceTime = v; },
            activeEffects: this.activeEffects,
            hasPowerUp: (type) => manager.hasPowerUp(type),
        };
    }

    /**
     * Update all active power-up effects
     * Call this in your main game loop
     */
    update(dt: number, rocketPosition?: THREE.Vector3): void {
        const ctx = this.getVisualContext();

        mapEntriesToArray(this.activeEffects).forEach(([type, effect]) => {
            effect.update(dt);
            
            if (rocketPosition) {
                updateEffectPosition(ctx, type, rocketPosition);
            }
            
            if (!effect.isActive) {
                this.cleanupEffect(type);
            }
        });
        
        if (rocketPosition) {
            emitTrailParticles(ctx, rocketPosition);
        }
        
        const modifiers = this.getCombinedModifiers();
        if (modifiers.sparkle && Math.random() < 0.3) {
            this.particleSystem.emit(
                rocketPosition!.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 0)),
                0xffd700,
                1,
                0.5,
                0.15,
                0.3
            );
        }
        
        updateStarMagnetLines(ctx, rocketPosition);
    }

    /**
     * Activate a power-up by type
     */
    activatePowerUp(type: PowerUpType): boolean {
        if (this.activeEffects.has(type)) {
            const existing = this.activeEffects.get(type)!;
            existing.activate();
            return true;
        }
        
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
        
        createEffectVisuals(this.getVisualContext(), type);
        
        if (this.audioSystem) {
            this.audioSystem.play('powerup');
        }

        const powerUpCfg = POWER_UP_CONFIGS[type];
        if (this.dogController) {
            this.dogController.triggerAnimation('power_up', 2.0);
        }
        if (this.rocket) {
            this.particleSystem.emit(
                this.rocket.position.clone(),
                powerUpCfg.color || 0xffd700,
                15,
                4.0,
                0.8,
                0.5
            );
        }
        
        if (this.onPowerUpStart) {
            this.onPowerUpStart(type, effect.config);
        }
        
        return true;
    }

    /**
     * Activate a random power-up (for orb collection reward)
     */
    activateRandomPowerUp(tier: 1 | 2 | 3 = 1): boolean {
        const available = Object.values(POWER_UP_CONFIGS)
            .filter(config => config.tier === tier)
            .map(config => config.type);
        
        if (available.length === 0) return false;
        
        const randomType = available[Math.floor(Math.random() * available.length)];
        return this.activatePowerUp(randomType);
    }

    /**
     * Called when an orb is collected
     * Returns true if a power-up was triggered
     */
    collectOrb(): boolean {
        this.orbCount++;
        
        if (this.orbCount >= this.orbsNeededForPowerUp) {
            this.orbCount = 0;
            this.activateRandomPowerUp(1);
            
            if (this.onOrbCountChange) {
                this.onOrbCountChange(0, this.orbsNeededForPowerUp);
            }
            
            return true;
        }
        
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
            
            if (mods.autoCollectRadius !== undefined) {
                combined.autoCollectRadius = Math.max(combined.autoCollectRadius, mods.autoCollectRadius);
            }
            if (mods.magnetRadius !== undefined) {
                combined.magnetRadius = Math.max(combined.magnetRadius, mods.magnetRadius);
            }
            if (mods.butterflyCharges !== undefined) {
                combined.butterflyCharges += mods.butterflyCharges;
            }
            
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
                
                if (this.butterflies.length > 0) {
                    const butterfly = this.butterflies.pop();
                    if (butterfly) {
                        this.scene.remove(butterfly);
                    }
                }
                
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
        cleanupAllVisuals(this.getVisualContext());
    }

    private onEffectActivate(_type: PowerUpType): void {
        // Effect-specific activation logic
    }

    private onEffectDeactivate(type: PowerUpType): void {
        this.cleanupEffect(type);
    }

    private cleanupEffect(type: PowerUpType): void {
        const effect = this.activeEffects.get(type);
        if (effect) {
            this.activeEffects.delete(type);
            
            removeEffectVisuals(this.getVisualContext(), type);
            
            if (this.onPowerUpEnd) {
                this.onPowerUpEnd(type, effect.config);
            }
        }
    }

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
            const worldPos = new THREE.Vector3();
            this.shieldMesh.getWorldPosition(worldPos);
            this.particleSystem.emit(worldPos, 0xff69b4, 8, 3.5, 0.5, 0.6);
            this.particleSystem.emit(worldPos, 0xffffff, 4, 2.5, 0.4, 0.4);
        }
    }

    /**
     * Set the dog controller reference
     */
    setDogController(dogController: any): void {
        this.dogController = dogController;
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
