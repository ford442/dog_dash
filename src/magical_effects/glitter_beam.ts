import * as THREE from 'three';
import { AudioSystem } from '../audio_system';
import { MagicalEffect, MagicalEffectType, getRainbowColor, randomRange } from './shared';

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
