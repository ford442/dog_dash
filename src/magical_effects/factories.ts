import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { MagicalEffect, MagicalEffectType } from './shared';
import { RainbowTrailEffect } from './rainbow_trail';
import { ButterflySwarmEffect } from './butterfly_swarm_effect';
import { HeartBubbleEffect } from './heart_bubble';
import { ConfettiBurstEffect, HeartRainEffect, StarCascadeEffect, RainbowSpiralEffect, SparkleFieldEffect } from './burst_effects';
import { createHeartShape } from './shared';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export function createRainbowTrail(
  target: THREE.Object3D,
  scene: THREE.Scene,
  audio: AudioSystem,
  duration: number = 10
): MagicalEffect {
  return new RainbowTrailEffect(target, scene, audio, duration);
}

export function createButterflySwarm(
  target: THREE.Object3D,
  scene: THREE.Scene,
  audio: AudioSystem,
  count: number = 8
): MagicalEffect {
  return new ButterflySwarmEffect(target, scene, audio, count, 15);
}

export function createHeartBubble(
  target: THREE.Object3D,
  scene: THREE.Scene,
  audio: AudioSystem,
  radius: number = 2
): MagicalEffect {
  return new HeartBubbleEffect(target, scene, audio, radius, 12);
}

export function spawnConfettiBurst(
  position: THREE.Vector3,
  scene: THREE.Scene
): void {
  const effect = new ConfettiBurstEffect(scene);
  effect.spawn(position);
  
  // Auto-update and cleanup
  const update = () => {
    if (effect.update(1/60)) {
      requestAnimationFrame(update);
    }
  };
  update();
}

export function spawnHeartRain(
  position: THREE.Vector3,
  scene: THREE.Scene,
  duration: number = 5
): void {
  const effect = new HeartRainEffect(scene);
  effect.spawn(position, duration);
  
  const update = () => {
    if (effect.update(1/60)) {
      requestAnimationFrame(update);
    }
  };
  update();
}

export function spawnStarCascade(
  position: THREE.Vector3,
  scene: THREE.Scene,
  duration: number = 5
): void {
  const effect = new StarCascadeEffect(scene);
  effect.spawn(position, duration);
  
  const update = () => {
    if (effect.update(1/60)) {
      requestAnimationFrame(update);
    }
  };
  update();
}

export function spawnRainbowSpiral(
  position: THREE.Vector3,
  scene: THREE.Scene,
  duration: number = 5
): void {
  const effect = new RainbowSpiralEffect(scene);
  effect.spawn(position, duration);
  
  const update = () => {
    if (effect.update(1/60)) {
      requestAnimationFrame(update);
    }
  };
  update();
}

export function spawnSparkleField(
  position: THREE.Vector3,
  scene: THREE.Scene,
  duration: number = 5
): void {
  const effect = new SparkleFieldEffect(scene);
  effect.spawn(position, duration);
  
  const update = () => {
    if (effect.update(1/60)) {
      requestAnimationFrame(update);
    }
  };
  update();
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export { createHeartShape };

// =============================================================================
// SHADER EFFECTS (TSL Helpers)
// =============================================================================

/**
 * Sparkle noise function for glittery effects
 * Can be used in custom shaders
 */
export const sparkleNoise = `
  float sparkleNoise(vec3 p, float time) {
    float n = sin(p.x * 10.0 + time) * sin(p.y * 10.0 + time * 1.3) * sin(p.z * 10.0 + time * 0.7);
    return smoothstep(0.7, 1.0, n);
  }
`;

/**
 * Rainbow hue shift
 */
export const rainbowShift = `
  vec3 rainbowShift(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
  }
`;

/**
 * Soft glow helper
 */
export const softGlow = `
  vec3 softGlow(vec3 color, float intensity) {
    return color + color * color * intensity;
  }
`;

/**
 * Heart distance field for masking
 */
export const heartShape = `
  float heartShape(vec2 p, float size) {
    p.y -= size * 0.25;
    float a = atan(p.x, p.y) / 3.141593;
    float r = length(p);
    float h = abs(a);
    float d = (13.0 * h - 22.0 * h * h + 10.0 * h * h * h) / (6.0 - 5.0 * h);
    return r - size * d;
  }
`;

// =============================================================================
// POWER-UP INTEGRATION
// =============================================================================

/**
 * Maps power-up types to magical effects
 */
export function getEffectForPowerUp(powerUpType: string): MagicalEffectType | null {
  const mapping: Record<string, MagicalEffectType> = {
    'rainbow_comet_tail': MagicalEffectType.RAINBOW_TRAIL,
    'bubblegum_shield': MagicalEffectType.HEART_BUBBLE,
    'butterfly_escort': MagicalEffectType.BUTTERFLY_SWARM,
    'twinkle_star_magnet': MagicalEffectType.STARDUST_FIELD,
    'unicorn_horn_blast': MagicalEffectType.GLITTER_BEAM,
    'best_friend_forever_aura': MagicalEffectType.SPARKLE_FIELD,
    'candy_cane_vortex': MagicalEffectType.CONFETTI_BURST,
    'puppy_hug_hug': MagicalEffectType.HEART_RAIN,
    'starlight_tiara': MagicalEffectType.STAR_CASCADE,
    'fairy_godmother_sparkle': MagicalEffectType.RAINBOW_SPIRAL
  };
  
  return mapping[powerUpType] || null;
}

import { EffectManager } from './effect_manager';

// Default export
export default EffectManager;
