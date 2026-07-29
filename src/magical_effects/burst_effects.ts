import * as THREE from 'three';
import { PASTEL_RAINBOW, STARDUST_COLORS, getRainbowColor, randomRange, createHeartShape } from './shared';

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
