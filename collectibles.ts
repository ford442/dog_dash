/**
 * Collectible Orbs System for Dog Dash
 * Magical floating orbs for a 7-year-old girl's space adventure
 * - StarOrbs: Pastel colored stars (pink, lavender, mint, sky blue)
 * - MagicBones: Rare bone-shaped bonus items
 * - HeartOrbs: Health restoring hearts
 */

import * as THREE from 'three';
import { ParticleSystem } from './particles';
import { getAudioSystem } from './audio_system';

/** Types of collectible orbs */
export enum OrbType {
    STAR = 'star',
    MAGIC_BONE = 'magic_bone',
    HEART = 'heart'
}

/** Pastel color palette for magical girl aesthetic */
const PASTEL_COLORS = {
    pink: 0xFFB6C1,      // Light pink
    lavender: 0xE6E6FA,  // Lavender
    mint: 0x98FF98,      // Mint green
    skyBlue: 0x87CEEB,   // Sky blue
    peach: 0xFFDAB9,     // Peach
    cream: 0xFFF8DC      // Cream
};

/** Star orb color variations */
const STAR_COLORS = [
    PASTEL_COLORS.pink,
    PASTEL_COLORS.lavender,
    PASTEL_COLORS.mint,
    PASTEL_COLORS.skyBlue
];

/** Configuration for each orb type */
const ORB_CONFIG = {
    [OrbType.STAR]: {
        scale: 0.8,
        rotationSpeed: 1.5,
        floatSpeed: 2.0,
        floatAmplitude: 0.3,
        points: 10,
        glowIntensity: 2.0,
        particleColor: 0xFFD700  // Gold sparkles
    },
    [OrbType.MAGIC_BONE]: {
        scale: 1.0,
        rotationSpeed: 2.0,
        floatSpeed: 2.5,
        floatAmplitude: 0.4,
        points: 50,
        glowIntensity: 3.0,
        particleColor: 0xFF69B4  // Hot pink sparkles
    },
    [OrbType.HEART]: {
        scale: 0.9,
        rotationSpeed: 1.0,
        floatSpeed: 1.8,
        floatAmplitude: 0.25,
        points: 25,
        glowIntensity: 2.5,
        particleColor: 0xFF1493  // Deep pink sparkles
    }
};

/** Collectible orb with magical floating animation */
export class CollectibleOrb {
    mesh: THREE.Group;
    type: OrbType;
    position: THREE.Vector3;
    baseY: number;
    rotationSpeed: number;
    floatSpeed: number;
    floatAmplitude: number;
    floatPhase: number;
    points: number;
    collected: boolean = false;
    particleTimer: number = 0;
    glowLight?: THREE.PointLight;
    
    // Sparkle particles
    private sparkleCount: number = 3;
    private sparkles: THREE.Mesh[] = [];
    
    constructor(scene: THREE.Scene, x: number, y: number, z: number, type: OrbType) {
        this.type = type;
        this.position = new THREE.Vector3(x, y, z);
        this.baseY = y;
        
        const config = ORB_CONFIG[type];
        this.rotationSpeed = config.rotationSpeed;
        this.floatSpeed = config.floatSpeed;
        this.floatAmplitude = config.floatAmplitude;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.points = config.points;
        
        // Create the mesh group
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        
        // Create geometry based on type
        this.createGeometry(config.scale, config.glowIntensity);
        
        // Add glow light
        this.glowLight = new THREE.PointLight(
            this.getGlowColor(),
            1.5,
            8
        );
        this.glowLight.position.set(0, 0, 0);
        this.mesh.add(this.glowLight);
        
        // Create sparkle particles
        this.createSparkles();
        
        scene.add(this.mesh);
    }
    
    /** Get the glow color based on orb type */
    private getGlowColor(): number {
        switch (this.type) {
            case OrbType.STAR:
                return STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
            case OrbType.MAGIC_BONE:
                return PASTEL_COLORS.peach;
            case OrbType.HEART:
                return 0xFF69B4; // Hot pink
            default:
                return 0xFFFFFF;
        }
    }
    
    /** Create the orb geometry based on type */
    private createGeometry(scale: number, glowIntensity: number): void {
        let geometry: THREE.BufferGeometry;
        let color: number;
        
        switch (this.type) {
            case OrbType.STAR:
                // Star shape using cone geometry
                geometry = this.createStarGeometry();
                color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
                break;
                
            case OrbType.MAGIC_BONE:
                // Bone shape using combined geometries
                geometry = this.createBoneGeometry();
                color = PASTEL_COLORS.cream;
                break;
                
            case OrbType.HEART:
                // Heart shape
                geometry = this.createHeartGeometry();
                color = 0xFF69B4; // Hot pink
                break;
                
            default:
                geometry = new THREE.SphereGeometry(0.5, 16, 16);
                color = 0xFFFFFF;
        }
        
        // Create material with emissive glow
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: glowIntensity,
            roughness: 0.2,
            metalness: 0.3,
            transparent: true,
            opacity: 0.95
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.setScalar(scale);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        
        this.mesh.add(mesh);
        
        // Add an outer glow sphere
        const glowGeometry = new THREE.SphereGeometry(0.7 * scale, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.mesh.add(glowMesh);
    }
    
    /** Create star-shaped geometry */
    private createStarGeometry(): THREE.BufferGeometry {
        // Create a star using a cone with 5 sides
        const geometry = new THREE.ConeGeometry(0.5, 1, 5);
        
        // Create a group-like geometry by merging with an inverted cone
        const topCone = geometry.clone();
        topCone.rotateX(Math.PI); // Flip upside down
        
        // Use a dodecahedron for a nice faceted star look
        return new THREE.DodecahedronGeometry(0.5, 0);
    }
    
    /** Create bone-shaped geometry */
    private createBoneGeometry(): THREE.BufferGeometry {
        // Create a bone shape using a cylinder with spheres at ends
        const boneGroup = new THREE.Group();
        
        // Center cylinder
        const cylinderGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 8);
        cylinderGeo.rotateZ(Math.PI / 2);
        
        // End caps (knobs)
        const knobGeo = new THREE.SphereGeometry(0.35, 12, 12);
        
        // Merge geometries manually
        const cylinder = new THREE.Mesh(cylinderGeo);
        const knob1 = new THREE.Mesh(knobGeo);
        knob1.position.set(-0.6, 0, 0);
        const knob2 = new THREE.Mesh(knobGeo);
        knob2.position.set(0.6, 0, 0);
        
        boneGroup.add(cylinder, knob1, knob2);
        
        // Return a simple capsule-like shape as fallback
        return new THREE.CapsuleGeometry(0.25, 0.8, 4, 8);
    }
    
    /** Create heart-shaped geometry */
    private createHeartGeometry(): THREE.BufferGeometry {
        // Create heart shape using a sphere with scaling
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        
        // Scale to make it heart-like
        geometry.scale(1, 0.9, 0.5);
        
        return geometry;
    }
    
    /** Create floating sparkle particles around the orb */
    private createSparkles(): void {
        const sparkleGeo = new THREE.OctahedronGeometry(0.08, 0);
        const sparkleMat = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8
        });
        
        for (let i = 0; i < this.sparkleCount; i++) {
            const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat.clone());
            
            // Position around the orb
            const angle = (i / this.sparkleCount) * Math.PI * 2;
            const radius = 0.6 + Math.random() * 0.3;
            sparkle.position.set(
                Math.cos(angle) * radius,
                (Math.random() - 0.5) * 0.5,
                Math.sin(angle) * radius
            );
            
            // Store random phase for twinkling
            (sparkle as any).twinklePhase = Math.random() * Math.PI * 2;
            (sparkle as any).orbitSpeed = 0.5 + Math.random() * 0.5;
            (sparkle as any).orbitAngle = angle;
            
            this.mesh.add(sparkle);
            this.sparkles.push(sparkle);
        }
    }
    
    /** Update animation - call every frame */
    update(dt: number, time: number): void {
        if (this.collected) return;
        
        // Gentle floating motion (sine wave)
        const floatOffset = Math.sin(time * this.floatSpeed + this.floatPhase) * this.floatAmplitude;
        this.mesh.position.y = this.baseY + floatOffset;
        
        // Slow rotation
        this.mesh.rotation.y += this.rotationSpeed * dt;
        this.mesh.rotation.z = Math.sin(time * 0.5 + this.floatPhase) * 0.1;
        
        // Update sparkles
        this.updateSparkles(dt, time);
        
        // Pulse glow
        if (this.glowLight) {
            const pulse = 1.0 + Math.sin(time * 3 + this.floatPhase) * 0.3;
            this.glowLight.intensity = 1.5 * pulse;
        }
    }
    
    /** Update sparkle animations */
    private updateSparkles(dt: number, time: number): void {
        for (const sparkle of this.sparkles) {
            const data = sparkle as any;
            
            // Orbit around the orb
            data.orbitAngle += data.orbitSpeed * dt;
            const radius = 0.6;
            sparkle.position.x = Math.cos(data.orbitAngle) * radius;
            sparkle.position.z = Math.sin(data.orbitAngle) * radius;
            sparkle.position.y = Math.sin(time * 2 + data.twinklePhase) * 0.3;
            
            // Twinkle effect
            const twinkle = 0.3 + Math.abs(Math.sin(time * 4 + data.twinklePhase)) * 0.7;
            (sparkle.material as THREE.MeshBasicMaterial).opacity = twinkle;
            
            // Rotate sparkle
            sparkle.rotation.x += dt * 2;
            sparkle.rotation.y += dt * 1.5;
        }
    }
    
    /** Check if player is close enough to collect */
    checkCollision(playerPosition: THREE.Vector3, collectionRadius: number = 2.0): boolean {
        if (this.collected) return false;
        
        const distance = this.mesh.position.distanceTo(playerPosition);
        return distance < collectionRadius;
    }
    
    /** Collect the orb - play effects and return points */
    collect(particleSystem: ParticleSystem): { points: number; type: OrbType; healthRestore?: number } {
        if (this.collected) return { points: 0, type: this.type };
        
        this.collected = true;
        
        // Play collection sound
        const audio = getAudioSystem();
        if (this.type === OrbType.MAGIC_BONE) {
            audio.play('powerup', 1.2);
        } else if (this.type === OrbType.HEART) {
            audio.play('powerup', 0.8);
        } else {
            audio.play('ui_click', 0.6);
        }
        
        // Create particle burst
        const config = ORB_CONFIG[this.type];
        particleSystem.emit(
            this.mesh.position,
            config.particleColor,
            15,     // count
            3.0,    // speed
            0.8,    // size
            1.0     // spread
        );
        
        // Hide mesh (will be cleaned up later)
        this.mesh.visible = false;
        
        return {
            points: this.points,
            type: this.type,
            healthRestore: this.type === OrbType.HEART ? 1 : undefined
        };
    }
    
    /** Clean up resources */
    destroy(scene: THREE.Scene): void {
        scene.remove(this.mesh);
        
        // Dispose geometries and materials
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }
    
    /** Get current position for external systems */
    getPosition(): THREE.Vector3 {
        return this.mesh.position.clone();
    }
}

/** Manages all collectible orbs in the game */
export class OrbManager {
    private scene: THREE.Scene;
    private particleSystem: ParticleSystem;
    private orbs: CollectibleOrb[] = [];
    private orbCount: number = 0;
    private powerUpThreshold: number = 5;
    
    // Score callback
    onScore?: (points: number) => void;
    onHealthRestore?: (amount: number) => void;
    onPowerUpReady?: () => void;
    
    constructor(scene: THREE.Scene, particleSystem: ParticleSystem, powerUpThreshold: number = 5) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.powerUpThreshold = powerUpThreshold;
    }
    
    /** Spawn a new orb at the given position */
    spawnOrb(x: number, y: number, type: OrbType, z: number = 0): CollectibleOrb {
        const orb = new CollectibleOrb(this.scene, x, y, z, type);
        this.orbs.push(orb);
        return orb;
    }
    
    /** Spawn a StarOrb with random pastel color */
    spawnStarOrb(x: number, y: number, z: number = 0): CollectibleOrb {
        return this.spawnOrb(x, y, OrbType.STAR, z);
    }
    
    /** Spawn a MagicBone (rare) */
    spawnMagicBone(x: number, y: number, z: number = 0): CollectibleOrb {
        return this.spawnOrb(x, y, OrbType.MAGIC_BONE, z);
    }
    
    /** Spawn a HeartOrb */
    spawnHeartOrb(x: number, y: number, z: number = 0): CollectibleOrb {
        return this.spawnOrb(x, y, OrbType.HEART, z);
    }
    
    /** Spawn a random orb type */
    spawnRandomOrb(x: number, y: number, z: number = 0): CollectibleOrb {
        const rand = Math.random();
        let type: OrbType;
        
        if (rand < 0.05) {
            // 5% chance for Magic Bone
            type = OrbType.MAGIC_BONE;
        } else if (rand < 0.15) {
            // 10% chance for Heart
            type = OrbType.HEART;
        } else {
            // 85% chance for Star
            type = OrbType.STAR;
        }
        
        return this.spawnOrb(x, y, type, z);
    }
    
    /** Update all orbs - call every frame */
    update(dt: number, time: number): void {
        for (const orb of this.orbs) {
            if (!orb.collected) {
                orb.update(dt, time);
            }
        }
    }
    
    /** Check for collection by player */
    checkCollection(playerPosition: THREE.Vector3, collectionRadius: number = 2.0): {
        collected: boolean;
        points: number;
        type?: OrbType;
        healthRestore?: number;
        powerUpReady?: boolean;
    } {
        let totalPoints = 0;
        let collectedType: OrbType | undefined;
        let healthRestored = 0;
        let anyCollected = false;
        
        for (const orb of this.orbs) {
            if (!orb.collected && orb.checkCollision(playerPosition, collectionRadius)) {
                const result = orb.collect(this.particleSystem);
                
                totalPoints += result.points;
                collectedType = result.type;
                anyCollected = true;
                
                if (result.healthRestore) {
                    healthRestored += result.healthRestore;
                }
                
                // Increment orb count for power-up tracking
                this.orbCount++;
                
                // Notify score callback
                if (this.onScore) {
                    this.onScore(result.points);
                }
                
                // Notify health callback
                if (result.healthRestore && this.onHealthRestore) {
                    this.onHealthRestore(result.healthRestore);
                }
                
                // Only collect one per frame to avoid issues
                break;
            }
        }
        
        // Check if power-up is ready
        const powerUpReady = this.orbCount >= this.powerUpThreshold;
        if (powerUpReady && this.onPowerUpReady) {
            this.onPowerUpReady();
            // Reset count after triggering
            this.orbCount = 0;
        }
        
        return {
            collected: anyCollected,
            points: totalPoints,
            type: collectedType,
            healthRestore: healthRestored > 0 ? healthRestored : undefined,
            powerUpReady
        };
    }
    
    /** Get current orb count toward power-up */
    getOrbCount(): number {
        return this.orbCount;
    }
    
    /** Get progress toward next power-up (0-1) */
    getPowerUpProgress(): number {
        return this.orbCount / this.powerUpThreshold;
    }
    
    /** Set the power-up threshold */
    setPowerUpThreshold(threshold: number): void {
        this.powerUpThreshold = threshold;
    }
    
    /** Reset orb count (e.g., after power-up activation) */
    resetOrbCount(): void {
        this.orbCount = 0;
    }
    
    /** Remove all orbs and clean up */
    reset(): void {
        for (const orb of this.orbs) {
            orb.destroy(this.scene);
        }
        this.orbs = [];
        this.orbCount = 0;
    }
    
    /** Clean up collected orbs that are far behind player */
    cleanupOrbsBehind(playerX: number, buffer: number = 20): void {
        for (let i = this.orbs.length - 1; i >= 0; i--) {
            const orb = this.orbs[i];
            if (orb.mesh.position.x < playerX - buffer) {
                orb.destroy(this.scene);
                this.orbs.splice(i, 1);
            }
        }
    }
    
    /** Get all active orb positions (for debugging or AI) */
    getOrbPositions(): { position: THREE.Vector3; type: OrbType }[] {
        return this.orbs
            .filter(orb => !orb.collected)
            .map(orb => ({
                position: orb.getPosition(),
                type: orb.type
            }));
    }
    
    /** Get count of active orbs */
    getActiveOrbCount(): number {
        return this.orbs.filter(orb => !orb.collected).length;
    }

    /** Get all active (uncollected) orbs */
    getActiveOrbs(): CollectibleOrb[] {
        return this.orbs.filter(orb => !orb.collected);
    }
}

/** 
 * USAGE EXAMPLE - Integration with main.ts:
 * 
 * ```typescript
 * import { OrbManager, OrbType } from './collectibles';
 * 
 * // In your game initialization:
 * const orbManager = new OrbManager(scene, particleSystem, 5); // 5 orbs for power-up
 * 
 * // Set up callbacks
 * orbManager.onScore = (points) => {
 *     gameScore += points;
 *     updateScoreDisplay(gameScore);
 * };
 * 
 * orbManager.onHealthRestore = (amount) => {
 *     playerState.health = Math.min(playerState.health + amount, playerState.maxHealth);
 *     updateHealthDisplay(playerState.health);
 * };
 * 
 * orbManager.onPowerUpReady = () => {
 *     activatePowerUp();
 *     showPowerUpMessage();
 * };
 * 
 * // Spawn orbs in your level generation:
 * function spawnLevelOrbs() {
 *     // Spawn star orbs along the path
 *     for (let i = 0; i < 10; i++) {
 *         const x = player.position.x + 20 + i * 15;
 *         const y = 2 + Math.random() * 6;
 *         orbManager.spawnStarOrb(x, y);
 *     }
 *     
 *     // Spawn a rare magic bone
 *     orbManager.spawnMagicBone(player.position.x + 100, 5);
 *     
 *     // Spawn a heart for health
 *     orbManager.spawnHeartOrb(player.position.x + 50, 3);
 * }
 * 
 * // In your game loop:
 * function gameLoop(dt: number, time: number) {
 *     // Update orbs (floating animation)
 *     orbManager.update(dt, time);
 *     
 *     // Check for collection
 *     if (player) {
 *         const result = orbManager.checkCollection(player.position, 2.5);
 *         if (result.collected) {
 *             console.log(`Collected ${result.type} for ${result.points} points!`);
 *             if (result.healthRestore) {
 *                 console.log(`Restored ${result.healthRestore} health!`);
 *             }
 *             if (result.powerUpReady) {
 *                 console.log('Power-up ready!');
 *             }
 *         }
 *     }
 *     
 *     // Cleanup orbs behind player
 *     if (player) {
 *         orbManager.cleanupOrbsBehind(player.position.x);
 *     }
 * }
 * 
 * // On game over / level complete:
 * orbManager.reset();
 * ```
 */
