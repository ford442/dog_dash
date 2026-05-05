import * as THREE from 'three';
import { ParticleSystem } from './particles';

export type BossPhase = 'entering' | 'phase1' | 'phase2' | 'phase3' | 'defeated';

export interface BossConfig {
    spawnX: number;
    arenaWidth: number;
    health: number;
}

export class StarEaterBoss {
    scene: THREE.Scene;
    group: THREE.Group;
    config: BossConfig;
    
    // State
    phase: BossPhase = 'entering';
    health: number;
    maxHealth: number;
    isActive: boolean = false;
    time: number = 0;
    
    // Visual components
    mouth: THREE.Mesh;
    jaw: THREE.Mesh;
    uvula: THREE.Mesh;
    teeth: THREE.Mesh[] = [];
    accretionDisk: THREE.Points;
    glowLight: THREE.PointLight;
    
    // Attack timers
    debrisTimer: number = 0;
    mouthOpenTimer: number = 0;
    weakPointExposed: boolean = false;
    weakPointTimer: number = 0;
    
    // Pull force
    pullStrength: number = 0;
    
    // Callbacks
    onDefeated: () => void;
    onPlayerHit: () => void;
    getPlayerPosition: () => THREE.Vector3 | null;
    spawnDebris: (pos: THREE.Vector3) => void;

    constructor(
        scene: THREE.Scene,
        config: BossConfig,
        callbacks: {
            onDefeated: () => void;
            onPlayerHit: () => void;
            getPlayerPosition: () => THREE.Vector3 | null;
            spawnDebris: (pos: THREE.Vector3) => void;
        }
    ) {
        this.scene = scene;
        this.config = config;
        this.health = config.health;
        this.maxHealth = config.health;
        this.onDefeated = callbacks.onDefeated;
        onPlayerHit: callbacks.onPlayerHit;
        this.getPlayerPosition = callbacks.getPlayerPosition;
        this.spawnDebris = callbacks.spawnDebris;
        
        this.group = new THREE.Group();
        this.createVisuals();
        this.group.visible = false;
        scene.add(this.group);
    }

    private createVisuals() {
        // Main body - dark organic mass
        const bodyGeo = new THREE.CapsuleGeometry(6, 12, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x1a0a2e,
            roughness: 0.9,
            metalness: 0.1,
            emissive: 0x330066,
            emissiveIntensity: 0.3
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = Math.PI / 2;
        this.group.add(body);

        // Mouth opening - the dangerous part
        const mouthGeo = new THREE.ConeGeometry(5, 8, 32, 1, true);
        const mouthMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 1,
            side: THREE.DoubleSide,
            emissive: 0xff0044,
            emissiveIntensity: 0.5
        });
        this.mouth = new THREE.Mesh(mouthGeo, mouthMat);
        this.mouth.rotation.z = -Math.PI / 2;
        this.mouth.position.x = 8;
        this.group.add(this.mouth);

        // Lower jaw (animated)
        const jawGeo = new THREE.ConeGeometry(4.5, 6, 32, 1, true);
        const jawMat = new THREE.MeshStandardMaterial({
            color: 0x1a0a2e,
            roughness: 0.8,
            side: THREE.DoubleSide
        });
        this.jaw = new THREE.Mesh(jawGeo, jawMat);
        this.jaw.rotation.z = -Math.PI / 2;
        this.jaw.position.x = 7;
        this.jaw.position.y = -2;
        this.group.add(this.jaw);

        // Uvula (weak point) - exposed when mouth opens
        const uvulaGeo = new THREE.SphereGeometry(1.5, 16, 16);
        const uvulaMat = new THREE.MeshStandardMaterial({
            color: 0xff0044,
            emissive: 0xff0044,
            emissiveIntensity: 2,
            roughness: 0.3
        });
        this.uvula = new THREE.Mesh(uvulaGeo, uvulaMat);
        this.uvula.position.set(10, 0, 0);
        this.uvula.visible = false;
        this.group.add(this.uvula);

        // Teeth - reflective crystalline
        for (let i = 0; i < 8; i++) {
            const toothGeo = new THREE.ConeGeometry(0.4, 1.5, 8);
            const toothMat = new THREE.MeshStandardMaterial({
                color: 0xccffff,
                roughness: 0.1,
                metalness: 0.9,
                emissive: 0x44aaff,
                emissiveIntensity: 0.3
            });
            const tooth = new THREE.Mesh(toothGeo, toothMat);
            
            const angle = (i / 8) * Math.PI;
            const radius = 4;
            tooth.position.set(
                6 + Math.cos(angle) * radius * 0.3,
                Math.sin(angle) * radius,
                0
            );
            tooth.rotation.z = angle - Math.PI / 2;
            
            this.teeth.push(tooth);
            this.group.add(tooth);
        }

        // Accretion disk particles
        const diskGeo = new THREE.BufferGeometry();
        const particleCount = 2000;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 8 + Math.random() * 12;
            const height = (Math.random() - 0.5) * 2;
            
            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = height;
            positions[i * 3 + 2] = Math.sin(angle) * radius;
            
            // Purple/pink colors
            colors[i * 3] = 0.8 + Math.random() * 0.2;
            colors[i * 3 + 1] = 0.2 + Math.random() * 0.3;
            colors[i * 3 + 2] = 0.6 + Math.random() * 0.4;
        }
        
        diskGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        diskGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const diskMat = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.8
        });
        
        this.accretionDisk = new THREE.Points(diskGeo, diskMat);
        this.group.add(this.accretionDisk);

        // Glow light
        this.glowLight = new THREE.PointLight(0xff0044, 3, 50);
        this.glowLight.position.set(8, 0, 0);
        this.group.add(this.glowLight);
    }

    activate(startX: number) {
        this.isActive = true;
        this.group.visible = true;
        this.group.position.set(startX + 50, 0, -20);
        this.phase = 'entering';
        this.health = this.maxHealth;
        this.time = 0;
        console.log('👹 Star-Eater Pitcher ACTIVATED!');
    }

    update(delta: number): { pullForce: number; isSnapping: boolean } {
        if (!this.isActive) return { pullForce: 0, isSnapping: false };
        
        this.time += delta;
        const result = { pullForce: 0, isSnapping: false };

        // Accretion disk rotation
        this.accretionDisk.rotation.y += delta * 0.2;
        this.accretionDisk.rotation.x = Math.sin(this.time * 0.5) * 0.1;

        // Teeth rotation (disco effect)
        this.teeth.forEach((tooth, i) => {
            tooth.rotation.z += delta * (0.5 + i * 0.1);
        });

        switch (this.phase) {
            case 'entering':
                this.updateEntering(delta);
                break;
            case 'phase1':
                result.pullForce = this.updatePhase1(delta);
                break;
            case 'phase2':
                result.pullForce = this.updatePhase2(delta);
                result.isSnapping = this.checkMouthSnap();
                break;
            case 'phase3':
                result.pullForce = this.updatePhase3(delta);
                break;
            case 'defeated':
                this.updateDefeated(delta);
                break;
        }

        // Update glow intensity based on phase
        const pulse = Math.sin(this.time * 3) * 0.3 + 0.7;
        this.glowLight.intensity = 2 + pulse * 2;
        
        return result;
    }

    private updateEntering(delta: number) {
        // Move boss into position
        const targetX = this.config.spawnX + 30;
        this.group.position.x += (targetX - this.group.position.x) * delta;
        
        // Fade in
        const dist = Math.abs(targetX - this.group.position.x);
        if (dist < 1) {
            this.phase = 'phase1';
            console.log('👹 Boss entering Phase 1 - SUCTION');
        }
    }

    private updatePhase1(delta: number): number {
        // Phase 1: Moderate pull, debris every 4s, uvula exposed 2s every 8s
        
        // Pull force ramps from 5 to 8 over 10s
        this.pullStrength = THREE.MathUtils.lerp(5, 8, Math.min(1, this.time / 10));
        
        // Mouth opens and closes
        const mouthOpen = Math.sin(this.time * 0.8) * 0.5 + 0.5;
        this.mouth.scale.y = 0.3 + mouthOpen * 0.7;
        this.jaw.rotation.z = -Math.PI / 2 - mouthOpen * 0.5;
        
        // Uvula exposed when mouth open
        this.weakPointExposed = mouthOpen > 0.7;
        this.uvula.visible = this.weakPointExposed;
        
        // Spawn debris
        this.debrisTimer += delta;
        if (this.debrisTimer > 4) {
            this.debrisTimer = 0;
            this.spawnMouthDebris();
        }
        
        // Check phase transition
        if (this.health / this.maxHealth <= 0.7) {
            this.phase = 'phase2';
            this.time = 0;
            console.log('👹 Boss entering Phase 2 - ENRAGED!');
        }
        
        return this.pullStrength;
    }

    private updatePhase2(delta: number): number {
        // Phase 2: Stronger pull (12), faster debris (6s), mouth snaps
        
        this.pullStrength = 12;
        
        // Faster mouth movement
        const mouthOpen = Math.sin(this.time * 1.2) * 0.5 + 0.5;
        this.mouth.scale.y = 0.2 + mouthOpen * 0.8;
        this.jaw.rotation.z = -Math.PI / 2 - mouthOpen * 0.7;
        
        // Uvula exposed briefly
        this.weakPointExposed = mouthOpen > 0.8;
        this.uvula.visible = this.weakPointExposed;
        
        // Faster debris (3-shot burst)
        this.debrisTimer += delta;
        if (this.debrisTimer > 6) {
            this.debrisTimer = 0;
            // Burst of 3
            for (let i = 0; i < 3; i++) {
                setTimeout(() => this.spawnMouthDebris(), i * 300);
            }
        }
        
        // Check phase transition
        if (this.health / this.maxHealth <= 0.3) {
            this.phase = 'phase3';
            this.time = 0;
            console.log('👹 Boss entering Phase 3 - DESPERATION!');
        }
        
        return this.pullStrength;
    }

    private checkMouthSnap(): boolean {
        // Mouth snaps every 5s in phase 2
        const snapCycle = this.time % 5;
        return snapCycle < 0.5; // Snapping closed for 0.5s
    }

    private updatePhase3(delta: number): number {
        // Phase 3: Weaker pull (3) but adds tangential swirl, continuous debris
        
        const swirl = Math.sin(this.time * 2) * 5;
        this.pullStrength = 3;
        
        // Mouth stays mostly open, pulsing
        const pulse = Math.sin(this.time * 4) * 0.3 + 0.7;
        this.mouth.scale.y = 0.6 + pulse * 0.4;
        this.jaw.rotation.z = -Math.PI / 2 - pulse * 0.5;
        
        // Uvula always exposed but surrounded by rotating shield
        this.weakPointExposed = true;
        this.uvula.visible = true;
        
        // Rotate teeth to form shield gaps
        this.teeth.forEach((tooth, i) => {
            const angle = (this.time * 2 + i * Math.PI / 4) % (Math.PI * 2);
            tooth.position.x = 6 + Math.cos(angle) * 3;
            tooth.position.y = Math.sin(angle) * 3;
        });
        
        // Continuous debris stream
        this.debrisTimer += delta;
        if (this.debrisTimer > 2) {
            this.debrisTimer = 0;
            this.spawnMouthDebris();
            // + Homing plasma (simplified as fast debris)
            this.spawnMouthDebris(true);
        }
        
        return this.pullStrength + swirl * 0.5;
    }

    private updateDefeated(delta: number) {
        // Death animation
        this.group.scale.multiplyScalar(0.95);
        this.group.rotation.z += delta * 2;
        
        // Flash and fade
        const flash = Math.sin(this.time * 20) > 0;
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                const mat = child.material as THREE.MeshStandardMaterial;
                mat.emissiveIntensity = flash ? 5 : 0;
            }
        });
        
        if (this.group.scale.x < 0.01) {
            this.destroy();
        }
    }

    private spawnMouthDebris(homing: boolean = false) {
        const mouthPos = new THREE.Vector3(
            this.group.position.x + 8,
            this.group.position.y + (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4
        );
        this.spawnDebris(mouthPos);
    }

    takeDamage(amount: number): boolean {
        if (!this.isActive || this.phase === 'defeated') return false;
        if (!this.weakPointExposed) return false; // Invulnerable when mouth closed
        
        this.health -= amount;
        console.log(`👹 Boss health: ${this.health}/${this.maxHealth}`);
        
        // Flash white
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                const mat = child.material as THREE.MeshStandardMaterial;
                const originalEmissive = mat.emissive.clone();
                mat.emissive.setHex(0xffffff);
                mat.emissiveIntensity = 2;
                setTimeout(() => {
                    mat.emissive.copy(originalEmissive);
                    mat.emissiveIntensity = 0.3;
                }, 100);
            }
        });
        
        if (this.health <= 0) {
            this.health = 0;
            this.phase = 'defeated';
            this.time = 0;
            this.onDefeated();
        }
        
        return true;
    }

    getHitbox(): { center: THREE.Vector3; radius: number } {
        return {
            center: new THREE.Vector3(
                this.group.position.x + 8,
                this.group.position.y,
                this.group.position.z
            ),
            radius: this.weakPointExposed ? 2 : 6
        };
    }

    destroy() {
        this.isActive = false;
        this.scene.remove(this.group);
        
        // Cleanup geometries/materials
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
}

// Boss Manager to handle spawning and integration
export class BossManager {
    private scene: THREE.Scene;
    private currentBoss: StarEaterBoss | null = null;
    private bossSpawned: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    checkBossSpawn(
        playerX: number,
        level: number,
        callbacks: {
            onDefeated: () => void;
            onPlayerHit: () => void;
            getPlayerPosition: () => THREE.Vector3 | null;
            spawnDebris: (pos: THREE.Vector3) => void;
            onBossStart: () => void;
        }
    ): boolean {
        // Level 1 boss at x=3000
        if (level === 1 && !this.bossSpawned && playerX >= 3000) {
            this.bossSpawned = true;
            
            this.currentBoss = new StarEaterBoss(
                this.scene,
                {
                    spawnX: playerX,
                    arenaWidth: 60,
                    health: 100
                },
                callbacks
            );
            
            this.currentBoss.activate(playerX);
            callbacks.onBossStart();
            return true;
        }
        
        return false;
    }

    update(delta: number): { 
        bossActive: boolean; 
        pullForce: number; 
        isSnapping: boolean;
        boss?: StarEaterBoss;
    } {
        if (!this.currentBoss) {
            return { bossActive: false, pullForce: 0, isSnapping: false };
        }

        const result = this.currentBoss.update(delta);
        
        return {
            bossActive: this.currentBoss.isActive,
            pullForce: result.pullForce,
            isSnapping: result.isSnapping,
            boss: this.currentBoss
        };
    }

    reset() {
        if (this.currentBoss) {
            this.currentBoss.destroy();
            this.currentBoss = null;
        }
        this.bossSpawned = false;
    }

    getBoss(): StarEaterBoss | null {
        return this.currentBoss;
    }
}
