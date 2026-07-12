import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { MagicalEffect, MagicalEffectType } from './shared';
import { RainbowTrailEffect } from './rainbow_trail';
import { ButterflySwarmEffect } from './butterfly_swarm_effect';
import { StardustFieldEffect } from './stardust_field';
import { HeartBubbleEffect } from './heart_bubble';
import { GlitterBeamEffect } from './glitter_beam';
import {
    ConfettiBurstEffect,
    HeartRainEffect,
    StarCascadeEffect,
    RainbowSpiralEffect,
    SparkleFieldEffect
} from './burst_effects';

// =============================================================================
// EFFECT MANAGER
// =============================================================================

export class EffectManager {
  private scene: THREE.Scene;
  private audio: AudioSystem;
  private target: THREE.Object3D;
  
  private activeEffects: Map<MagicalEffectType, MagicalEffect> = new Map();
  private ambientEffects: {
    confetti?: ConfettiBurstEffect;
    heartRain?: HeartRainEffect;
    starCascade?: StarCascadeEffect;
    rainbowSpiral?: RainbowSpiralEffect;
    sparkleField?: SparkleFieldEffect;
  } = {};
  
  constructor(scene: THREE.Scene, audio: AudioSystem, target: THREE.Object3D) {
    this.scene = scene;
    this.audio = audio;
    this.target = target;
    
    // Initialize ambient effects
    this.ambientEffects.confetti = new ConfettiBurstEffect(scene);
    this.ambientEffects.heartRain = new HeartRainEffect(scene);
    this.ambientEffects.starCascade = new StarCascadeEffect(scene);
    this.ambientEffects.rainbowSpiral = new RainbowSpiralEffect(scene);
    this.ambientEffects.sparkleField = new SparkleFieldEffect(scene);
  }
  
  /**
   * Activate a magical effect
   */
  activateEffect(type: MagicalEffectType, duration?: number): MagicalEffect {
    // Deactivate existing effect of same type
    if (this.activeEffects.has(type)) {
      this.deactivateEffect(type);
    }
    
    let effect: MagicalEffect;
    
    switch (type) {
      case MagicalEffectType.RAINBOW_TRAIL:
        effect = new RainbowTrailEffect(
          this.target,
          this.scene,
          this.audio,
          duration || 10
        );
        break;
        
      case MagicalEffectType.BUTTERFLY_SWARM:
        effect = new ButterflySwarmEffect(
          this.target,
          this.scene,
          this.audio,
          8,
          duration || 15
        );
        break;
        
      case MagicalEffectType.STARDUST_FIELD:
        effect = new StardustFieldEffect(
          this.target,
          this.scene,
          this.audio,
          40,
          duration || 12
        );
        break;
        
      case MagicalEffectType.HEART_BUBBLE:
        effect = new HeartBubbleEffect(
          this.target,
          this.scene,
          this.audio,
          2,
          duration || 12
        );
        break;
        
      case MagicalEffectType.GLITTER_BEAM:
        effect = new GlitterBeamEffect(
          this.target,
          this.scene,
          this.audio,
          duration || 8
        );
        break;
        
      default:
        throw new Error(`Unknown effect type: ${type}`);
    }
    
    this.activeEffects.set(type, effect);
    return effect;
  }
  
  /**
   * Deactivate a specific effect
   */
  deactivateEffect(type: MagicalEffectType): void {
    const effect = this.activeEffects.get(type);
    if (effect) {
      effect.destroy();
      this.activeEffects.delete(type);
    }
  }
  
  /**
   * Update all active effects
   */
  update(dt: number): void {
    // Update magical effects
    this.activeEffects.forEach((effect, type) => {
      effect.update(dt);
      
      if (!effect.isActive) {
        this.activeEffects.delete(type);
      }
    });
    
    // Update ambient effects
    Object.values(this.ambientEffects).forEach(effect => {
      if (effect) {
        effect.update(dt);
      }
    });
  }
  
  /**
   * Get list of all active effects
   */
  getActiveEffects(): MagicalEffect[] {
    return Array.from(this.activeEffects.values());
  }
  
  /**
   * Check if a specific effect is active
   */
  hasEffect(type: MagicalEffectType): boolean {
    return this.activeEffects.has(type);
  }
  
  /**
   * Get specific effect instance
   */
  getEffect<T extends MagicalEffect>(type: MagicalEffectType): T | undefined {
    return this.activeEffects.get(type) as T | undefined;
  }
  
  /**
   * Set/update the target object for effects
   * Call this when player mesh is loaded
   */
  setTarget(target: THREE.Object3D): void {
    this.target = target;
    // Update target for all active effects that need it
    this.activeEffects.forEach(effect => {
      if (effect instanceof RainbowTrailEffect || 
          effect instanceof ButterflySwarmEffect ||
          effect instanceof StardustFieldEffect ||
          effect instanceof HeartBubbleEffect) {
        effect.setTarget(target);
      }
    });
  }
  
  /**
   * Clear all active effects
   */
  clearAllEffects(): void {
    this.activeEffects.forEach(effect => effect.destroy());
    this.activeEffects.clear();
  }
  
  // =============================================================================
  // AMBIENT EFFECT TRIGGERS
  // =============================================================================
  
  spawnConfettiBurst(position: THREE.Vector3): void {
    this.ambientEffects.confetti?.spawn(position);
  }
  
  spawnHeartRain(position: THREE.Vector3, duration?: number): void {
    this.ambientEffects.heartRain?.spawn(position, duration);
  }
  
  spawnStarCascade(position: THREE.Vector3, duration?: number): void {
    this.ambientEffects.starCascade?.spawn(position, duration);
  }
  
  spawnRainbowSpiral(position: THREE.Vector3, duration?: number): void {
    this.ambientEffects.rainbowSpiral?.spawn(position, duration);
  }
  
  spawnSparkleField(position: THREE.Vector3, duration?: number): void {
    this.ambientEffects.sparkleField?.spawn(position, duration);
  }
}
