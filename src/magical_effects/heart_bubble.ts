import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { MagicalEffect, MagicalEffectType, randomRange } from './shared';

// =============================================================================
// HEART BUBBLE EFFECT
// =============================================================================

export class HeartBubbleEffect extends MagicalEffect {
  type = MagicalEffectType.HEART_BUBBLE;
  isActive = true;
  
  private target: THREE.Object3D;
  private scene: THREE.Scene;
  private audio: AudioSystem;
  
  private bubbleMesh?: THREE.Mesh;
  private bubbleInner?: THREE.Mesh;
  private shimmerParticles: THREE.Mesh[] = [];
  private wobblePhase: number = 0;
  private baseScale: number = 1;
  
  constructor(
    target: THREE.Object3D,
    scene: THREE.Scene,
    audio: AudioSystem,
    radius: number = 2,
    duration: number = 12
  ) {
    super(duration);
    this.target = target;
    this.scene = scene;
    this.audio = audio;
    this.baseScale = radius;
    
    this.createBubble();
    audio.playMagicSound('shield');
  }
  
  private createBubble(): void {
    // Outer bubble (transparent pink)
    const outerGeometry = new THREE.SphereGeometry(1, 32, 32);
    outerGeometry.scale(1, 0.9, 0.8); // Heart-like shape
    
    const outerMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff69b4,
      transparent: true,
      opacity: 0.25,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.3,
      thickness: 0.5,
      side: THREE.DoubleSide
    });
    
    this.bubbleMesh = new THREE.Mesh(outerGeometry, outerMaterial);
    this.bubbleMesh.scale.setScalar(this.baseScale);
    
    // Inner glow
    const innerGeometry = new THREE.SphereGeometry(0.95, 16, 16);
    innerGeometry.scale(1, 0.9, 0.8);
    
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb6c1,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide
    });
    
    this.bubbleInner = new THREE.Mesh(innerGeometry, innerMaterial);
    this.bubbleMesh.add(this.bubbleInner);
    
    this.target.add(this.bubbleMesh);
  }
  
  /**
   * Called when obstacle hits the bubble
   */
  onBounce(): void {
    this.wobblePhase = 1.0;
    this.audio.play('boing', 0.8);
    
    // Create shimmer effect
    this.createShimmerBurst();
  }
  
  private createShimmerBurst(): void {
    for (let i = 0; i < 20; i++) {
      const geometry = new THREE.PlaneGeometry(0.1, 0.1);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      });
      
      const shimmer = new THREE.Mesh(geometry, material);
      const angle = Math.random() * Math.PI * 2;
      const radius = this.baseScale * 0.9;
      shimmer.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.9,
        randomRange(-0.5, 0.5)
      );
      shimmer.lookAt(new THREE.Vector3(0, 0, 0));
      
      shimmer.userData = {
        life: 0.5 + Math.random() * 0.3,
        drift: new THREE.Vector3(randomRange(-0.5, 0.5), randomRange(-0.5, 0.5), 0)
      };
      
      this.bubbleMesh!.add(shimmer);
      this.shimmerParticles.push(shimmer);
    }
  }
  
  update(dt: number): void {
    if (!this.isActive || !this.bubbleMesh) return;
    
    this.timeRemaining -= dt;
    this.elapsed += dt;
    
    if (this.timeRemaining <= 0) {
      this.destroy();
      return;
    }
    
    // Gentle pulse
    const pulse = 1 + Math.sin(this.elapsed * 2) * 0.05;
    
    // Wobble from impacts
    if (this.wobblePhase > 0) {
      const wobble = Math.sin(this.wobblePhase * Math.PI * 4) * this.wobblePhase * 0.2;
      this.bubbleMesh.scale.set(
        this.baseScale * pulse * (1 + wobble),
        this.baseScale * pulse * (1 - wobble * 0.5),
        this.baseScale * pulse
      );
      this.wobblePhase -= dt * 2;
      if (this.wobblePhase < 0) this.wobblePhase = 0;
    } else {
      this.bubbleMesh.scale.setScalar(this.baseScale * pulse);
    }
    
    // Rotate slowly
    this.bubbleMesh.rotation.y += dt * 0.2;
    this.bubbleMesh.rotation.z = Math.sin(this.elapsed * 0.5) * 0.1;
    
    // Update shimmer particles
    this.updateShimmer(dt);
  }
  
  private updateShimmer(dt: number): void {
    for (let i = this.shimmerParticles.length - 1; i >= 0; i--) {
      const shimmer = this.shimmerParticles[i];
      const data = shimmer.userData;
      
      data.life -= dt;
      shimmer.position.add(data.drift.clone().multiplyScalar(dt));
      shimmer.rotation.z += dt * 2;
      (shimmer.material as THREE.MeshBasicMaterial).opacity = data.life;
      
      if (data.life <= 0) {
        this.bubbleMesh!.remove(shimmer);
        shimmer.geometry.dispose();
        (shimmer.material as THREE.Material).dispose();
        this.shimmerParticles.splice(i, 1);
      }
    }
  }
  
  destroy(): void {
    this.isActive = false;
    
    if (this.bubbleMesh) {
      this.target.remove(this.bubbleMesh);
      this.bubbleMesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.bubbleMesh = undefined;
    }
    
    this.shimmerParticles = [];
  }
  
  /**
   * Update the target object for this effect
   */
  setTarget(target: THREE.Object3D): void {
    if (this.bubbleMesh) {
      this.target.remove(this.bubbleMesh);
      target.add(this.bubbleMesh);
    }
    this.target = target;
  }
}
