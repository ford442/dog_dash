import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { MagicalEffect, MagicalEffectType, BUTTERFLY_COLORS, randomRange } from './shared';

// =============================================================================
// BUTTERFLY SWARM EFFECT
// =============================================================================

interface Butterfly {
  mesh: THREE.Group;
  angle: number;
  radius: number;
  height: number;
  speed: number;
  wingSpeed: number;
  wingPhase: number;
  color: number;
  active: boolean;
  respawnTimer: number;
}

export class ButterflySwarmEffect extends MagicalEffect {
  type = MagicalEffectType.BUTTERFLY_SWARM;
  isActive = true;
  
  private target: THREE.Object3D;
  private scene: THREE.Scene;
  private audio: AudioSystem;
  
  private butterflies: Butterfly[] = [];
  private butterflyCount: number;
  private glitterParticles: THREE.Mesh[] = [];
  
  constructor(
    target: THREE.Object3D,
    scene: THREE.Scene,
    audio: AudioSystem,
    count: number = 8,
    duration: number = 15
  ) {
    super(duration);
    this.target = target;
    this.scene = scene;
    this.audio = audio;
    this.butterflyCount = count;
    
    this.createButterflies();
    audio.playMagicSound('shield');
  }
  
  private createButterflies(): void {
    for (let i = 0; i < this.butterflyCount; i++) {
      const butterfly = this.createButterflyMesh(i);
      
      this.butterflies.push({
        mesh: butterfly,
        angle: (i / this.butterflyCount) * Math.PI * 2,
        radius: 1.5 + Math.random() * 0.5,
        height: randomRange(-0.5, 0.5),
        speed: 0.5 + Math.random() * 0.5,
        wingSpeed: 8 + Math.random() * 4,
        wingPhase: Math.random() * Math.PI * 2,
        color: BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length],
        active: true,
        respawnTimer: 0
      });
      
      this.target.add(butterfly);
    }
  }
  
  private createButterflyMesh(index: number): THREE.Group {
    const group = new THREE.Group();
    
    const color = BUTTERFLY_COLORS[index % BUTTERFLY_COLORS.length];
    
    // Create wing shape
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.bezierCurveTo(0.3, 0.2, 0.4, 0.5, 0.2, 0.7);
    wingShape.bezierCurveTo(0, 0.8, -0.1, 0.5, 0, 0);
    
    const wingGeometry = new THREE.ShapeGeometry(wingShape);
    const wingMaterial = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    
    // Left wing
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.scale.set(0.8, 0.8, 0.8);
    leftWing.name = 'leftWing';
    group.add(leftWing);
    
    // Right wing (mirrored)
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.scale.set(-0.8, 0.8, 0.8);
    rightWing.name = 'rightWing';
    group.add(rightWing);
    
    // Body
    const bodyGeometry = new THREE.CapsuleGeometry(0.05, 0.3, 4, 8);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.z = Math.PI / 2;
    group.add(body);
    
    // Antennae
    const antennaGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1, 0.15, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1, -0.15, 0)
    ]);
    const antennaMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
    const antennae = new THREE.LineSegments(antennaGeometry, antennaMaterial);
    antennae.position.x = 0.15;
    group.add(antennae);
    
    return group;
  }
  
  update(dt: number): void {
    if (!this.isActive) return;
    
    this.timeRemaining -= dt;
    this.elapsed += dt;
    
    if (this.timeRemaining <= 0) {
      this.destroy();
      return;
    }
    
    const time = this.elapsed;
    
    this.butterflies.forEach((butterfly, i) => {
      if (!butterfly.active) {
        butterfly.respawnTimer -= dt;
        butterfly.mesh.visible = false;
        
        if (butterfly.respawnTimer <= 0) {
          this.respawnButterfly(butterfly);
        }
        return;
      }
      
      butterfly.mesh.visible = true;
      
      // Orbit around target
      butterfly.angle += butterfly.speed * dt;
      const offsetX = Math.cos(butterfly.angle) * butterfly.radius;
      const offsetY = Math.sin(butterfly.angle * 1.3) * butterfly.radius * 0.5 + butterfly.height;
      const offsetZ = Math.sin(butterfly.angle) * 0.5;
      
      butterfly.mesh.position.set(offsetX, offsetY, offsetZ);
      
      // Face direction of movement
      butterfly.mesh.rotation.z = butterfly.angle + Math.PI / 2;
      
      // Flap wings
      const leftWing = butterfly.mesh.getObjectByName('leftWing');
      const rightWing = butterfly.mesh.getObjectByName('rightWing');
      
      if (leftWing && rightWing) {
        const flap = Math.sin(time * butterfly.wingSpeed + butterfly.wingPhase);
        leftWing.rotation.y = flap * 0.5;
        rightWing.rotation.y = -flap * 0.5;
      }
      
      // Emit trail glitter occasionally
      if (Math.random() < 0.1) {
        this.emitGlitter(butterfly.mesh.position.clone().add(this.target.position));
      }
    });
    
    // Update glitter
    this.updateGlitter(dt);
  }
  
  /**
   * Consume a butterfly to block a hit
   */
  consumeButterfly(): boolean {
    const activeButterfly = this.butterflies.find(b => b.active);
    if (activeButterfly) {
      this.poofButterfly(activeButterfly);
      return true;
    }
    return false;
  }
  
  private poofButterfly(butterfly: Butterfly): void {
    butterfly.active = false;
    butterfly.respawnTimer = 3; // Respawn after 3 seconds
    
    // Create poof effect
    this.createPoofEffect(butterfly.mesh.position.clone().add(this.target.position));
    
    // Play sound
    this.audio.play('sparkle', 0.7);
  }
  
  private respawnButterfly(butterfly: Butterfly): void {
    butterfly.active = true;
    butterfly.respawnTimer = 0;
    
    // Play respawn sound
    this.audio.play('twinkle', 0.5);
  }
  
  private createPoofEffect(position: THREE.Vector3): void {
    // Create glitter burst
    for (let i = 0; i < 15; i++) {
      const geometry = new THREE.OctahedronGeometry(0.05, 0);
      const poofColor = BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)];
      const material = new THREE.MeshBasicMaterial({
        color: poofColor,
        transparent: true,
        opacity: 1
      });
      
      const particle = new THREE.Mesh(geometry, material);
      particle.position.copy(position);
      
      const angle = (i / 15) * Math.PI * 2;
      const speed = 1 + Math.random();
      particle.userData = {
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          randomRange(-0.5, 0.5)
        ),
        life: 0.5 + Math.random() * 0.3
      };
      
      this.scene.add(particle);
      this.glitterParticles.push(particle);
    }
  }
  
  private emitGlitter(position: THREE.Vector3): void {
    const geometry = new THREE.OctahedronGeometry(0.03, 0);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });
    
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(position);
    particle.userData = {
      velocity: new THREE.Vector3(randomRange(-0.5, 0.5), randomRange(-0.5, 0.5), 0),
      life: 0.3 + Math.random() * 0.2
    };
    
    this.scene.add(particle);
    this.glitterParticles.push(particle);
  }
  
  private updateGlitter(dt: number): void {
    for (let i = this.glitterParticles.length - 1; i >= 0; i--) {
      const particle = this.glitterParticles[i];
      const data = particle.userData;
      
      data.life -= dt;
      particle.position.add(data.velocity.clone().multiplyScalar(dt));
      particle.rotation.z += dt * 3;
      
      (particle.material as THREE.MeshBasicMaterial).opacity = data.life;
      
      if (data.life <= 0) {
        this.scene.remove(particle);
        particle.geometry.dispose();
        (particle.material as THREE.Material).dispose();
        this.glitterParticles.splice(i, 1);
      }
    }
  }
  
  destroy(): void {
    this.isActive = false;
    
    // Remove butterflies
    this.butterflies.forEach(b => {
      b.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.target.remove(b.mesh);
    });
    this.butterflies = [];
    
    // Clean up glitter
    this.glitterParticles.forEach(p => {
      this.scene.remove(p);
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    });
    this.glitterParticles = [];
  }
  
  /**
   * Update the target object for this effect
   */
  setTarget(target: THREE.Object3D): void {
    // Reparent butterflies to new target
    this.butterflies.forEach(b => {
      this.target.remove(b.mesh);
      target.add(b.mesh);
    });
    this.target = target;
  }
}
