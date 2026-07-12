import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { MagicalEffect, MagicalEffectType, STARDUST_COLORS, randomRange } from './shared';

// =============================================================================
// STARDUST FIELD EFFECT
// =============================================================================

interface StardustParticle {
  mesh: THREE.Mesh;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
  verticalOffset: number;
  sizePhase: number;
}

export class StardustFieldEffect extends MagicalEffect {
  type = MagicalEffectType.STARDUST_FIELD;
  isActive = true;
  duration: number;
  
  private target: THREE.Object3D;
  private scene: THREE.Scene;
  private audio: AudioSystem;
  
  private particles: StardustParticle[] = [];
  private particleCount: number;
  private auraLight?: THREE.PointLight;
  
  // Speed tracking for intensity
  private lastPosition: THREE.Vector3;
  private speed: number = 0;
  
  constructor(
    target: THREE.Object3D,
    scene: THREE.Scene,
    audio: AudioSystem,
    count: number = 40,
    duration: number = 12
  ) {
    super(duration);
    this.target = target;
    this.scene = scene;
    this.audio = audio;
    this.particleCount = count;
    this.lastPosition = target.position.clone();
    
    this.createParticles();
    this.createAuraLight();
    audio.playMagicSound('spell');
  }
  
  private createParticles(): void {
    const geometry = new THREE.OctahedronGeometry(0.08, 0);
    
    for (let i = 0; i < this.particleCount; i++) {
      const color = STARDUST_COLORS[Math.floor(Math.random() * STARDUST_COLORS.length)];
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
      });
      
      const mesh = new THREE.Mesh(geometry.clone(), material);
      
      const particle: StardustParticle = {
        mesh,
        orbitRadius: 1.2 + Math.random() * 1.5,
        orbitSpeed: 0.5 + Math.random() * 1.0,
        orbitAngle: (i / this.particleCount) * Math.PI * 2 + Math.random() * 0.5,
        verticalOffset: randomRange(-1, 1),
        sizePhase: Math.random() * Math.PI * 2
      };
      
      this.particles.push(particle);
      this.scene.add(mesh);
    }
  }
  
  private createAuraLight(): void {
    this.auraLight = new THREE.PointLight(0xffd700, 0.5, 8);
    this.scene.add(this.auraLight);
  }
  
  update(dt: number): void {
    if (!this.isActive) return;
    
    this.timeRemaining -= dt;
    this.elapsed += dt;
    
    if (this.timeRemaining <= 0) {
      this.destroy();
      return;
    }
    
    // Calculate speed
    const displacement = this.target.position.distanceTo(this.lastPosition);
    this.speed = THREE.MathUtils.lerp(this.speed, displacement / dt, 0.1);
    this.lastPosition.copy(this.target.position);
    
    // Intensity based on speed (0.5 to 2.0)
    const intensity = 0.5 + Math.min(this.speed / 10, 1.5);
    
    const time = this.elapsed;
    
    // Update aura light
    if (this.auraLight) {
      this.auraLight.position.copy(this.target.position);
      this.auraLight.intensity = 0.3 + Math.sin(time * 2) * 0.2 + this.speed * 0.05;
    }
    
    // Update particles
    this.particles.forEach((particle, i) => {
      // Swirl around target
      const swirlOffset = i * 0.5;
      const swirlSpeed = particle.orbitSpeed * intensity;
      
      particle.orbitAngle += swirlSpeed * dt;
      
      const x = Math.cos(particle.orbitAngle) * particle.orbitRadius;
      const y = Math.sin(particle.orbitAngle * 1.5 + swirlOffset) * particle.orbitRadius * 0.5 + particle.verticalOffset;
      const z = Math.sin(particle.orbitAngle) * particle.orbitRadius * 0.5;
      
      particle.mesh.position.copy(this.target.position).add(new THREE.Vector3(x, y, z));
      
      // Twinkle size
      const twinkle = 0.5 + Math.sin(time * 3 + particle.sizePhase) * 0.5;
      particle.mesh.scale.setScalar(intensity * (0.5 + twinkle * 0.5));
      
      // Rotate
      particle.mesh.rotation.x += dt * 2;
      particle.mesh.rotation.y += dt * 1.5;
      
      // Fade based on intensity
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 + intensity * 0.25;
    });
  }
  
  destroy(): void {
    this.isActive = false;
    
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    });
    this.particles = [];
    
    if (this.auraLight) {
      this.scene.remove(this.auraLight);
      this.auraLight = undefined;
    }
  }
  
  /**
   * Update the target object for this effect
   */
  setTarget(target: THREE.Object3D): void {
    this.target = target;
  }
}
