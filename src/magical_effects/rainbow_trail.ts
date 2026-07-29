import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { MagicalEffect, MagicalEffectType, getRainbowColor, lerp, randomRange, createHeartShape } from './shared';

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
