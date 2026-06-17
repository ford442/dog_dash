/**
 * Magical Effects System for Dog Dash ✨🌈💖🦋
 * Advanced particle polish effects for a whimsical space adventure
 * Designed to delight a 7-year-old player with magical visuals
 */

import * as THREE from 'three';
import { AudioSystem } from './audio_system';

// =============================================================================
// MAGIC EDITION SHADERS
// =============================================================================

import {
  createPastelRainbowNebulaMaterial,
  createDynamicAuroraMaterial,
  createSolarSailsMaterial
} from '../shaders/magical_edition';

export const MagicalShaders = {
  createPastelRainbowNebulaMaterial,
  createDynamicAuroraMaterial,
  createSolarSailsMaterial
};

// =============================================================================
// EFFECT TYPE ENUM
// =============================================================================

export enum MagicalEffectType {
  // Main magical effects attached to rocket
  RAINBOW_TRAIL = 'rainbow_trail',
  BUTTERFLY_SWARM = 'butterfly_swarm',
  STARDUST_FIELD = 'stardust_field',
  HEART_BUBBLE = 'heart_bubble',
  GLITTER_BEAM = 'glitter_beam',
  
  // Ambient/celebration effects
  CONFETTI_BURST = 'confetti_burst',
  HEART_RAIN = 'heart_rain',
  STAR_CASCADE = 'star_cascade',
  RAINBOW_SPIRAL = 'rainbow_spiral',
  SPARKLE_FIELD = 'sparkle_field'
}

// =============================================================================
// COLOR PALETTES
// =============================================================================

const PASTEL_RAINBOW = [
  0xffb3ba, // Pastel Pink
  0xffdfba, // Pastel Peach
  0xffffba, // Pastel Yellow
  0xbaffc9, // Pastel Mint
  0xbae1ff, // Pastel Blue
  0xe6baff, // Pastel Lavender
];

const BUTTERFLY_COLORS = [
  0xffb6c1, // Light Pink
  0xdda0dd, // Plum
  0x87ceeb, // Sky Blue
  0x98fb98, // Pale Green
  0xf0e68c, // Khaki
  0xffa07a, // Light Salmon
];

const STARDUST_COLORS = [
  0xffffff, // Pure White
  0xfffacd, // Lemon Chiffon
  0xffec8b, // Light Goldenrod
  0xffd700, // Gold
  0xffa500, // Orange
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getRainbowColor(t: number): number {
  const hue = t % 1;
  return new THREE.Color().setHSL(hue, 0.8, 0.7).getHex();
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Heart shape distance field (for heart bubble)
function heartSDF(x: number, y: number): number {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y;
}

// =============================================================================
// MAGICAL EFFECT BASE CLASS
// =============================================================================

export abstract class MagicalEffect {
  abstract type: MagicalEffectType;
  abstract isActive: boolean;
  duration: number;
  
  timeRemaining: number;
  elapsed: number;
  
  constructor(duration: number = 10) {
    this.duration = duration;
    this.timeRemaining = duration;
    this.elapsed = 0;
  }
  
  abstract update(dt: number): void;
  abstract destroy(): void;
  
  /**
   * Check if effect should still be active
   */
  checkExpired(): boolean {
    if (this.duration > 0) {
      this.timeRemaining -= 0; // Subtracted in update
      return this.timeRemaining <= 0;
    }
    return false; // Infinite duration if 0 or negative
  }
  
  /**
   * Get progress from 0 (start) to 1 (end)
   */
  getProgress(): number {
    if (this.duration <= 0) return 0;
    return 1 - (this.timeRemaining / this.duration);
  }
}

// =============================================================================
// RAINBOW TRAIL EFFECT
// =============================================================================

interface TrailSegment {
  position: THREE.Vector3;
  color: number;
  size: number;
  life: number;
  maxLife: number;
}

export class RainbowTrailEffect extends MagicalEffect {
  type = MagicalEffectType.RAINBOW_TRAIL;
  isActive = true;
  duration: number;
  
  private target: THREE.Object3D;
  private scene: THREE.Scene;
  private audio: AudioSystem;
  
  private trailSegments: TrailSegment[] = [];
  private maxSegments: number = 50;
  private segmentMesh?: THREE.InstancedMesh;
  private sparkleTimer: number = 0;
  private heartTimer: number = 0;
  
  // Hearts and sparkles
  private hearts: THREE.Mesh[] = [];
  private sparkles: THREE.Mesh[] = [];
  
  constructor(
    target: THREE.Object3D,
    scene: THREE.Scene,
    audio: AudioSystem,
    duration: number = 10
  ) {
    super(duration);
    this.target = target;
    this.scene = scene;
    this.audio = audio;
    
    this.createTrailMesh();
    
    // Play activation sound
    audio.playMagicSound('power');
  }
  
  private createTrailMesh(): void {
    // Create ribbon-like segments using flattened spheres
    const geometry = new THREE.SphereGeometry(0.3, 8, 8);
    geometry.scale(1, 0.3, 1); // Flatten to look like a ribbon
    
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    
    this.segmentMesh = new THREE.InstancedMesh(geometry, material, this.maxSegments);
    this.segmentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.segmentMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxSegments * 3), 3
    );
    this.scene.add(this.segmentMesh);
  }
  
  update(dt: number): void {
    if (!this.isActive) return;
    
    this.timeRemaining -= dt;
    this.elapsed += dt;
    
    if (this.timeRemaining <= 0) {
      this.destroy();
      return;
    }
    
    // Add new segment at target position
    this.addSegment();
    
    // Update existing segments
    this.updateSegments(dt);
    
    // Emit hearts periodically
    this.heartTimer += dt;
    if (this.heartTimer > 0.3) {
      this.emitHeart();
      this.heartTimer = 0;
    }
    
    // Emit sparkles
    this.sparkleTimer += dt;
    if (this.sparkleTimer > 0.1) {
      this.emitSparkle();
      this.sparkleTimer = 0;
    }
    
    // Update hearts and sparkles
    this.updateHearts(dt);
    this.updateSparkles(dt);
    
    // Update instanced mesh
    this.updateInstancedMesh();
  }
  
  private addSegment(): void {
    if (this.trailSegments.length >= this.maxSegments) {
      this.trailSegments.shift();
    }
    
    const position = this.target.position.clone();
    position.x -= 0.5; // Slightly behind
    
    this.trailSegments.push({
      position: position,
      color: getRainbowColor(this.elapsed * 0.5),
      size: 0.8 + Math.sin(this.elapsed * 3) * 0.2,
      life: 1.0,
      maxLife: 1.0
    });
  }
  
  private updateSegments(dt: number): void {
    this.trailSegments.forEach(segment => {
      segment.life -= dt * 0.5;
      segment.position.x -= dt * 2; // Drift backward
    });
    
    // Remove dead segments
    this.trailSegments = this.trailSegments.filter(s => s.life > 0);
  }
  
  private updateInstancedMesh(): void {
    if (!this.segmentMesh) return;
    
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    
    this.trailSegments.forEach((segment, i) => {
      dummy.position.copy(segment.position);
      dummy.scale.setScalar(segment.size * segment.life);
      dummy.updateMatrix();
      this.segmentMesh!.setMatrixAt(i, dummy.matrix);
      
      color.setHex(segment.color);
      color.multiplyScalar(0.5 + segment.life * 0.5); // Fade with life
      this.segmentMesh!.setColorAt(i, color);
    });
    
    this.segmentMesh.count = this.trailSegments.length;
    this.segmentMesh.instanceMatrix.needsUpdate = true;
    if (this.segmentMesh.instanceColor) {
      this.segmentMesh.instanceColor.needsUpdate = true;
    }
  }
  
  private emitHeart(): void {
    const geometry = new THREE.ShapeGeometry(createHeartShape());
    const material = new THREE.MeshBasicMaterial({
      color: 0xff69b4,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    const heart = new THREE.Mesh(geometry, material);
    heart.position.copy(this.target.position);
    heart.position.x -= 1;
    heart.position.y += randomRange(-0.5, 0.5);
    heart.scale.setScalar(0.1);
    
    heart.userData = {
      velocity: new THREE.Vector3(-1, randomRange(0.5, 1.5), 0),
      life: 1.0,
      rotationSpeed: randomRange(-2, 2)
    };
    
    this.scene.add(heart);
    this.hearts.push(heart);
  }
  
  private emitSparkle(): void {
    const geometry = new THREE.OctahedronGeometry(0.08, 0);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    
    const sparkle = new THREE.Mesh(geometry, material);
    sparkle.position.copy(this.target.position);
    sparkle.position.x -= 0.8;
    sparkle.position.y += randomRange(-0.3, 0.3);
    sparkle.position.z += randomRange(-0.3, 0.3);
    
    sparkle.userData = {
      velocity: new THREE.Vector3(randomRange(-1, -0.5), randomRange(-0.5, 0.5), 0),
      life: 0.5 + Math.random() * 0.5,
      rotationSpeed: randomRange(5, 10)
    };
    
    this.scene.add(sparkle);
    this.sparkles.push(sparkle);
  }
  
  private updateHearts(dt: number): void {
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const heart = this.hearts[i];
      const data = heart.userData;
      
      data.life -= dt;
      heart.position.add(data.velocity.clone().multiplyScalar(dt));
      heart.rotation.z += data.rotationSpeed * dt;
      heart.scale.setScalar(0.1 * data.life);
      
      (heart.material as THREE.MeshBasicMaterial).opacity = data.life;
      
      if (data.life <= 0) {
        this.scene.remove(heart);
        heart.geometry.dispose();
        (heart.material as THREE.Material).dispose();
        this.hearts.splice(i, 1);
      }
    }
  }
  
  private updateSparkles(dt: number): void {
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sparkle = this.sparkles[i];
      const data = sparkle.userData;
      
      data.life -= dt;
      sparkle.position.add(data.velocity.clone().multiplyScalar(dt));
      sparkle.rotation.x += data.rotationSpeed * dt;
      sparkle.rotation.y += data.rotationSpeed * dt * 0.7;
      
      const scale = 0.5 + Math.sin(data.life * Math.PI) * 0.5;
      sparkle.scale.setScalar(scale);
      
      (sparkle.material as THREE.MeshBasicMaterial).opacity = data.life;
      
      if (data.life <= 0) {
        this.scene.remove(sparkle);
        sparkle.geometry.dispose();
        (sparkle.material as THREE.Material).dispose();
        this.sparkles.splice(i, 1);
      }
    }
  }
  
  destroy(): void {
    this.isActive = false;
    
    if (this.segmentMesh) {
      this.scene.remove(this.segmentMesh);
      this.segmentMesh.geometry.dispose();
      (this.segmentMesh.material as THREE.Material).dispose();
      this.segmentMesh = undefined;
    }
    
    this.hearts.forEach(h => {
      this.scene.remove(h);
      h.geometry.dispose();
      (h.material as THREE.Material).dispose();
    });
    this.hearts = [];
    
    this.sparkles.forEach(s => {
      this.scene.remove(s);
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    });
    this.sparkles = [];
  }
  
  /**
   * Update the target object for this effect
   */
  setTarget(target: THREE.Object3D): void {
    this.target = target;
  }
}

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
  duration: number;
  
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

// =============================================================================
// HEART BUBBLE EFFECT
// =============================================================================

export class HeartBubbleEffect extends MagicalEffect {
  type = MagicalEffectType.HEART_BUBBLE;
  isActive = true;
  duration: number;
  
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

// =============================================================================
// GLITTER BEAM EFFECT
// =============================================================================

export class GlitterBeamEffect extends MagicalEffect {
  type = MagicalEffectType.GLITTER_BEAM;
  isActive = true;
  duration: number;
  
  private target: THREE.Object3D;
  private scene: THREE.Scene;
  private audio: AudioSystem;
  
  private beamMesh?: THREE.Mesh;
  private sparkles: THREE.Mesh[] = [];
  private aimDirection: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  private beamLength: number = 20;
  private rainbowOffset: number = 0;
  
  // Mouse tracking
  private mouseTarget: THREE.Vector3 = new THREE.Vector3();
  private isMouseAiming: boolean = false;
  
  constructor(
    target: THREE.Object3D,
    scene: THREE.Scene,
    audio: AudioSystem,
    duration: number = 8
  ) {
    super(duration);
    this.target = target;
    this.scene = scene;
    this.audio = audio;
    
    this.createBeam();
    audio.playMagicSound('spell');
  }
  
  private createBeam(): void {
    // Create beam geometry (cylinder)
    const geometry = new THREE.CylinderGeometry(0.15, 0.3, 1, 16, 1, true);
    geometry.rotateZ(-Math.PI / 2); // Point along X axis
    geometry.translate(0.5, 0, 0); // Pivot at start
    
    // Rainbow gradient material
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.beamMesh = new THREE.Mesh(geometry, material);
    this.beamMesh.scale.x = this.beamLength;
    this.scene.add(this.beamMesh);
  }
  
  /**
   * Set aim direction (from mouse position)
   */
  setAimDirection(direction: THREE.Vector3): void {
    this.aimDirection.copy(direction).normalize();
    this.isMouseAiming = true;
  }
  
  /**
   * Set aim to follow mouse (for click-and-hold)
   */
  setMouseTarget(position: THREE.Vector3): void {
    this.mouseTarget.copy(position);
    this.isMouseAiming = true;
  }
  
  update(dt: number): void {
    if (!this.isActive || !this.beamMesh) return;
    
    this.timeRemaining -= dt;
    this.elapsed += dt;
    this.rainbowOffset += dt;
    
    if (this.timeRemaining <= 0) {
      this.destroy();
      return;
    }
    
    // Update beam position and rotation
    this.beamMesh.position.copy(this.target.position);
    
    if (this.isMouseAiming) {
      // Calculate angle to mouse target
      const angle = Math.atan2(
        this.mouseTarget.y - this.target.position.y,
        this.mouseTarget.x - this.target.position.x
      );
      this.beamMesh.rotation.z = angle;
    } else {
      // Default forward with slight sweep
      this.beamMesh.rotation.z = Math.sin(this.elapsed * 2) * 0.1;
    }
    
    // Cycle through rainbow colors
    const hue = (this.rainbowOffset * 0.5) % 1;
    const color = new THREE.Color().setHSL(hue, 1, 0.6);
    (this.beamMesh.material as THREE.MeshBasicMaterial).color = color;
    
    // Emit sparkles along beam
    this.emitBeamSparkles();
    
    // Update sparkles
    this.updateSparkles(dt);
  }
  
  private emitBeamSparkles(): void {
    if (Math.random() > 0.3) return;
    
    const sparklesPerFrame = 3;
    
    for (let i = 0; i < sparklesPerFrame; i++) {
      const geometry = new THREE.OctahedronGeometry(0.06, 0);
      
      // Varying colors along rainbow
      const hue = (this.rainbowOffset * 0.5 + i * 0.1) % 1;
      const color = new THREE.Color().setHSL(hue, 0.8, 0.7);
      
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9
      });
      
      const sparkle = new THREE.Mesh(geometry, material);
      
      // Position along beam
      const t = Math.random() * this.beamLength;
      const offset = randomRange(-0.2, 0.2);
      
      const beamDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(
        new THREE.Vector3(0, 0, 1),
        this.beamMesh!.rotation.z
      );
      const perpDir = new THREE.Vector3(-beamDir.y, beamDir.x, 0);
      
      sparkle.position.copy(this.target.position)
        .add(beamDir.multiplyScalar(t))
        .add(perpDir.multiplyScalar(offset));
      
      sparkle.userData = {
        life: 0.3 + Math.random() * 0.3,
        velocity: perpDir.multiplyScalar(randomRange(0.5, 1.5))
      };
      
      this.scene.add(sparkle);
      this.sparkles.push(sparkle);
    }
  }
  
  private updateSparkles(dt: number): void {
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sparkle = this.sparkles[i];
      const data = sparkle.userData;
      
      data.life -= dt;
      sparkle.position.add(data.velocity.clone().multiplyScalar(dt));
      sparkle.rotation.x += dt * 5;
      sparkle.rotation.y += dt * 3;
      
      const scale = data.life * 2;
      sparkle.scale.setScalar(scale);
      (sparkle.material as THREE.MeshBasicMaterial).opacity = data.life;
      
      if (data.life <= 0) {
        this.scene.remove(sparkle);
        sparkle.geometry.dispose();
        (sparkle.material as THREE.Material).dispose();
        this.sparkles.splice(i, 1);
      }
    }
  }
  
  /**
   * Called when beam hits an asteroid
   */
  onTransformAsteroid(position: THREE.Vector3): void {
    this.createFlowerBurst(position);
    this.audio.play('sparkle', 0.6);
  }
  
  private createFlowerBurst(position: THREE.Vector3): void {
    // Create flower petals
    const petalCount = 8;
    for (let i = 0; i < petalCount; i++) {
      const geometry = new THREE.CircleGeometry(0.15, 8);
      const color = PASTEL_RAINBOW[i % PASTEL_RAINBOW.length];
      const material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      
      const petal = new THREE.Mesh(geometry, material);
      petal.position.copy(position);
      
      const angle = (i / petalCount) * Math.PI * 2;
      const speed = 2 + Math.random();
      petal.userData = {
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          randomRange(-1, 1)
        ),
        life: 1.0,
        rotationAxis: new THREE.Vector3(randomRange(-1, 1), randomRange(-1, 1), randomRange(-1, 1)).normalize()
      };
      
      this.scene.add(petal);
      this.sparkles.push(petal);
    }
  }
  
  destroy(): void {
    this.isActive = false;
    
    if (this.beamMesh) {
      this.scene.remove(this.beamMesh);
      this.beamMesh.geometry.dispose();
      (this.beamMesh.material as THREE.Material).dispose();
      this.beamMesh = undefined;
    }
    
    this.sparkles.forEach(s => {
      this.scene.remove(s);
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    });
    this.sparkles = [];
  }
}

// =============================================================================
// PARTICLE PRESETS - CONFETTI BURST
// =============================================================================

interface ParticleData {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotationAxis: THREE.Vector3;
  rotationSpeed: number;
  life: number;
  gravity: number;
}

export class ConfettiBurstEffect {
  private scene: THREE.Scene;
  private particles: ParticleData[] = [];
  private isActive: boolean = false;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  spawn(position: THREE.Vector3, count: number = 30): void {
    this.isActive = true;
    
    const shapes = [
      () => new THREE.PlaneGeometry(0.1, 0.15),
      () => new THREE.CircleGeometry(0.06, 6),
      () => new THREE.BoxGeometry(0.08, 0.08, 0.02)
    ];
    
    for (let i = 0; i < count; i++) {
      const geometry = shapes[i % shapes.length]();
      const color = PASTEL_RAINBOW[Math.floor(Math.random() * PASTEL_RAINBOW.length)];
      
      const material = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.position.x += randomRange(-0.5, 0.5);
      mesh.position.y += randomRange(-0.5, 0.5);
      mesh.position.z += randomRange(-0.5, 0.5);
      
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 4;
      const elevation = randomRange(-0.5, 1);
      
      const particle: ParticleData = {
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          elevation * speed + 2,
          Math.sin(angle) * speed * 0.5
        ),
        rotationAxis: new THREE.Vector3(randomRange(-1, 1), randomRange(-1, 1), randomRange(-1, 1)).normalize(),
        rotationSpeed: randomRange(3, 8),
        life: 1.5 + Math.random() * 0.5,
        gravity: 2 + Math.random() * 2
      };
      
      this.scene.add(mesh);
      this.particles.push(particle);
    }
  }
  
  update(dt: number): boolean {
    if (!this.isActive) return false;
    
    let hasActiveParticles = false;
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }
      
      hasActiveParticles = true;
      
      // Physics
      p.velocity.y -= p.gravity * dt;
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      
      // Rotation
      p.mesh.rotateOnAxis(p.rotationAxis, p.rotationSpeed * dt);
      
      // Fade
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life;
    }
    
    if (!hasActiveParticles) {
      this.isActive = false;
    }
    
    return hasActiveParticles;
  }
}

// =============================================================================
// PARTICLE PRESETS - HEART RAIN
// =============================================================================

export class HeartRainEffect {
  private scene: THREE.Scene;
  private hearts: ParticleData[] = [];
  private isActive: boolean = false;
  private spawnTimer: number = 0;
  private duration: number = 5;
  private elapsed: number = 0;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  spawn(position: THREE.Vector3, duration: number = 5): void {
    this.isActive = true;
    this.duration = duration;
    this.elapsed = 0;
  }
  
  update(dt: number): boolean {
    if (!this.isActive) return false;
    
    this.elapsed += dt;
    
    if (this.elapsed < this.duration) {
      // Spawn new hearts
      this.spawnTimer += dt;
      if (this.spawnTimer > 0.1) {
        this.spawnHeart();
        this.spawnTimer = 0;
      }
    } else if (this.hearts.length === 0) {
      this.isActive = false;
      return false;
    }
    
    // Update hearts
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.life -= dt;
      
      if (h.life <= 0) {
        this.scene.remove(h.mesh);
        h.mesh.geometry.dispose();
        (h.mesh.material as THREE.Material).dispose();
        this.hearts.splice(i, 1);
        continue;
      }
      
      // Float down
      h.velocity.y -= h.gravity * dt;
      h.mesh.position.add(h.velocity.clone().multiplyScalar(dt));
      h.mesh.rotation.z += Math.sin(h.life * 3) * 0.02;
      
      // Fade
      (h.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, h.life * 2);
    }
    
    return this.isActive || this.hearts.length > 0;
  }
  
  private spawnHeart(): void {
    const geometry = new THREE.ShapeGeometry(createHeartShape(0.15));
    const colors = [0xff69b4, 0xff1493, 0xffb6c1, 0xffa0c9];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    const material = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    
    const heart = new THREE.Mesh(geometry, material);
    heart.position.set(
      randomRange(-8, 8),
      10 + randomRange(0, 5),
      randomRange(-2, 2)
    );
    
    const heartParticle: ParticleData = {
      mesh: heart,
      velocity: new THREE.Vector3(randomRange(-0.5, 0.5), randomRange(-1, -2), 0),
      rotationAxis: new THREE.Vector3(0, 0, 1),
      rotationSpeed: randomRange(-1, 1),
      life: 3 + Math.random(),
      gravity: 0.5
    };
    
    this.scene.add(heart);
    this.hearts.push(heartParticle);
  }
}

// =============================================================================
// PARTICLE PRESETS - STAR CASCADE
// =============================================================================

export class StarCascadeEffect {
  private scene: THREE.Scene;
  private stars: ParticleData[] = [];
  private isActive: boolean = false;
  private spawnTimer: number = 0;
  private duration: number = 5;
  private elapsed: number = 0;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  spawn(position: THREE.Vector3, duration: number = 5): void {
    this.isActive = true;
    this.duration = duration;
    this.elapsed = 0;
  }
  
  update(dt: number): boolean {
    if (!this.isActive) return false;
    
    this.elapsed += dt;
    
    if (this.elapsed < this.duration) {
      this.spawnTimer += dt;
      if (this.spawnTimer > 0.05) {
        this.spawnStar();
        this.spawnTimer = 0;
      }
    } else if (this.stars.length === 0) {
      this.isActive = false;
      return false;
    }
    
    // Update stars
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.life -= dt;
      
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        this.stars.splice(i, 1);
        continue;
      }
      
      // Trail motion
      s.mesh.position.add(s.velocity.clone().multiplyScalar(dt));
      s.velocity.y -= s.gravity * dt;
      s.mesh.rotation.z += s.rotationSpeed * dt;
      
      // Twinkle
      const twinkle = 0.5 + Math.sin(s.life * 10) * 0.5;
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = s.life * twinkle;
    }
    
    return this.isActive || this.stars.length > 0;
  }
  
  private spawnStar(): void {
    const geometry = new THREE.OctahedronGeometry(0.1, 0);
    const color = STARDUST_COLORS[Math.floor(Math.random() * STARDUST_COLORS.length)];
    
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9
    });
    
    const star = new THREE.Mesh(geometry, material);
    star.position.set(
      randomRange(-10, 10),
      12,
      randomRange(-3, 3)
    );
    
    const starParticle: ParticleData = {
      mesh: star,
      velocity: new THREE.Vector3(
        randomRange(-1, 1),
        randomRange(-3, -5),
        randomRange(-0.5, 0.5)
      ),
      rotationAxis: new THREE.Vector3(0, 0, 1),
      rotationSpeed: randomRange(3, 8),
      life: 2 + Math.random(),
      gravity: 1
    };
    
    this.scene.add(star);
    this.stars.push(starParticle);
  }
}

// =============================================================================
// PARTICLE PRESETS - RAINBOW SPIRAL
// =============================================================================

export class RainbowSpiralEffect {
  private scene: THREE.Scene;
  private particles: ParticleData[] = [];
  private isActive: boolean = false;
  private angle: number = 0;
  private duration: number = 5;
  private elapsed: number = 0;
  private centerPosition: THREE.Vector3 = new THREE.Vector3();
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  spawn(position: THREE.Vector3, duration: number = 5): void {
    this.isActive = true;
    this.duration = duration;
    this.elapsed = 0;
    this.centerPosition.copy(position);
    this.angle = 0;
  }
  
  update(dt: number): boolean {
    if (!this.isActive) return false;
    
    this.elapsed += dt;
    this.angle += dt * 3;
    
    if (this.elapsed < this.duration) {
      // Spawn spiral particles
      for (let i = 0; i < 3; i++) {
        this.spawnSpiralParticle(this.angle + i * 2);
      }
    }
    
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }
      
      // Spiral outward
      p.velocity.multiplyScalar(0.98); // Slow down
      p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
      p.mesh.rotation.z += p.rotationSpeed * dt;
      
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life;
    }
    
    if (this.elapsed >= this.duration && this.particles.length === 0) {
      this.isActive = false;
      return false;
    }
    
    return true;
  }
  
  private spawnSpiralParticle(spiralAngle: number): void {
    const geometry = new THREE.SphereGeometry(0.08, 8, 8);
    const hue = (spiralAngle / (Math.PI * 2)) % 1;
    const color = new THREE.Color().setHSL(hue, 0.9, 0.6);
    
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9
    });
    
    const particle = new THREE.Mesh(geometry, material);
    
    const radius = 0.5 + this.elapsed * 0.5;
    particle.position.set(
      this.centerPosition.x + Math.cos(spiralAngle) * radius,
      this.centerPosition.y + Math.sin(spiralAngle) * radius * 0.5,
      this.centerPosition.z + Math.sin(spiralAngle * 2) * 0.3
    );
    
    const velocityAngle = spiralAngle + Math.PI / 2;
    const particleData: ParticleData = {
      mesh: particle,
      velocity: new THREE.Vector3(
        Math.cos(velocityAngle) * 2,
        Math.sin(velocityAngle) * 2 + 1,
        randomRange(-0.5, 0.5)
      ),
      rotationAxis: new THREE.Vector3(0, 0, 1),
      rotationSpeed: randomRange(2, 5),
      life: 1 + Math.random() * 0.5,
      gravity: 0
    };
    
    this.scene.add(particle);
    this.particles.push(particleData);
  }
}

// =============================================================================
// PARTICLE PRESETS - SPARKLE FIELD
// =============================================================================

export class SparkleFieldEffect {
  private scene: THREE.Scene;
  private sparkles: THREE.Mesh[] = [];
  private isActive: boolean = false;
  private duration: number = 5;
  private elapsed: number = 0;
  private centerPosition: THREE.Vector3 = new THREE.Vector3();
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  spawn(position: THREE.Vector3, duration: number = 5): void {
    this.isActive = true;
    this.duration = duration;
    this.elapsed = 0;
    this.centerPosition.copy(position);
    
    // Create initial field of sparkles
    for (let i = 0; i < 50; i++) {
      this.createSparkle();
    }
  }
  
  update(dt: number): boolean {
    if (!this.isActive) return false;
    
    this.elapsed += dt;
    
    if (this.elapsed >= this.duration) {
      // Fade out all sparkles
      this.sparkles.forEach(s => {
        const mat = s.material as THREE.MeshBasicMaterial;
        mat.opacity -= dt;
      });
      
      // Remove faded sparkles
      for (let i = this.sparkles.length - 1; i >= 0; i--) {
        const s = this.sparkles[i];
        if ((s.material as THREE.MeshBasicMaterial).opacity <= 0) {
          this.scene.remove(s);
          s.geometry.dispose();
          (s.material as THREE.Material).dispose();
          this.sparkles.splice(i, 1);
        }
      }
      
      if (this.sparkles.length === 0) {
        this.isActive = false;
        return false;
      }
    } else {
      // Spawn new sparkles to maintain density
      if (this.sparkles.length < 60 && Math.random() < 0.3) {
        this.createSparkle();
      }
      
      // Update existing sparkles
      this.sparkles.forEach(s => {
        s.rotation.z += dt * 2;
        const twinkle = 0.3 + Math.sin(this.elapsed * 5 + s.userData.phase) * 0.3;
        (s.material as THREE.MeshBasicMaterial).opacity = twinkle;
        
        // Gentle drift
        s.position.x += Math.sin(this.elapsed + s.userData.phase) * dt * 0.5;
        s.position.y += Math.cos(this.elapsed + s.userData.phase) * dt * 0.3;
      });
    }
    
    return true;
  }
  
  private createSparkle(): void {
    const geometry = new THREE.OctahedronGeometry(0.05 + Math.random() * 0.05, 0);
    const color = STARDUST_COLORS[Math.floor(Math.random() * STARDUST_COLORS.length)];
    
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5
    });
    
    const sparkle = new THREE.Mesh(geometry, material);
    
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 5;
    sparkle.position.set(
      this.centerPosition.x + Math.cos(angle) * radius,
      this.centerPosition.y + Math.sin(angle) * radius * 0.6,
      this.centerPosition.z + randomRange(-2, 2)
    );
    
    sparkle.userData = {
      phase: Math.random() * Math.PI * 2
    };
    
    this.scene.add(sparkle);
    this.sparkles.push(sparkle);
  }
  
  destroy(): void {
    this.sparkles.forEach(s => {
      this.scene.remove(s);
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    });
    this.sparkles = [];
    this.isActive = false;
  }
}

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

function createHeartShape(size: number = 1): THREE.Shape {
  const shape = new THREE.Shape();
  const x = 0, y = 0;
  
  shape.moveTo(x, y);
  shape.bezierCurveTo(x, y + size * 0.3, x - size * 0.5, y + size * 0.7, x - size * 0.5, y + size);
  shape.bezierCurveTo(x - size * 0.5, y + size * 1.4, x, y + size * 1.7, x, y + size * 2);
  shape.bezierCurveTo(x, y + size * 1.7, x + size * 0.5, y + size * 1.4, x + size * 0.5, y + size);
  shape.bezierCurveTo(x + size * 0.5, y + size * 0.7, x, y + size * 0.3, x, y);
  
  return shape;
}

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

// Default export
export default EffectManager;
