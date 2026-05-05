/**
 * Magical Flower Constellations for Dog Dash
 * Giant glowing space flowers that create a dreamy garden in space
 * Perfect for a 7-year-old girl's space adventure! 🌸✨🌺
 */

import * as THREE from 'three';
import { AudioSystem } from './audio_system';
import { ParticleSystem } from './particles';

// Reuse dummy object for matrix calculations
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/** Flower type enum */
export enum FlowerType {
    DAISY = 0,      // Space Daisy - rotating pastel petals with heart pollen
    TULIP = 1,      // Nebula Tulip - breathing gradient petals
    LOTUS = 2,      // Lotus Constellation - multi-layered with sparkle orbs
    SUNFLOWER = 3   // Crystal Sunflower - follows player, drops golden sparkles
}

/** Configuration for each flower type */
const FLOWER_CONFIGS = {
    [FlowerType.DAISY]: {
        petalCount: 10,
        petalColors: [0xffb6c1, 0xffffff, 0xe6e6fa], // Pink, white, lavender
        centerColor: 0xffd700, // Gold
        glowColor: 0xffeb3b,
        scaleRange: [8, 12],
        rotationSpeed: 0.3,
        bloomScale: 1.4
    },
    [FlowerType.TULIP]: {
        petalCount: 6,
        petalColors: [0x9b59b6, 0xe74c3c, 0x1abc9c], // Purple, pink, teal gradient
        centerColor: 0xf39c12,
        glowColor: 0x9b59b6,
        scaleRange: [10, 14],
        rotationSpeed: 0.15,
        bloomScale: 1.3
    },
    [FlowerType.LOTUS]: {
        petalCount: 16,
        petalColors: [0xffc0cb, 0xffb6c1, 0xff69b4], // Various pinks
        centerColor: 0xffd700,
        glowColor: 0xff69b4,
        scaleRange: [12, 16],
        rotationSpeed: 0.2,
        bloomScale: 1.5
    },
    [FlowerType.SUNFLOWER]: {
        petalCount: 20,
        petalColors: [0xffd700, 0xffa500, 0xff8c00], // Golden shades
        centerColor: 0x8b4513, // Brown
        glowColor: 0xffd700,
        scaleRange: [10, 15],
        rotationSpeed: 0.1,
        bloomScale: 1.2
    }
};

/** Heart-shaped pollen particle system */
class HeartPollenSystem {
    private scene: THREE.Scene;
    private maxHearts: number;
    private hearts: THREE.Mesh[] = [];
    private heartData: Array<{
        velocity: THREE.Vector3;
        life: number;
        maxLife: number;
        scale: number;
        wobble: number;
    }> = [];
    private heartGeometry: THREE.ShapeGeometry;
    private heartMaterial: THREE.MeshBasicMaterial;
    private poolIndex: number = 0;

    constructor(scene: THREE.Scene, maxHearts: number = 100) {
        this.scene = scene;
        this.maxHearts = maxHearts;

        // Create heart shape
        const heartShape = new THREE.Shape();
        const x = 0, y = 0;
        heartShape.moveTo(x + 0.25, y + 0.25);
        heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
        heartShape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
        heartShape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
        heartShape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
        heartShape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
        heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

        this.heartGeometry = new THREE.ShapeGeometry(heartShape);
        this.heartMaterial = new THREE.MeshBasicMaterial({
            color: 0xff69b4,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });

        // Pre-create heart pool
        for (let i = 0; i < maxHearts; i++) {
            const heart = new THREE.Mesh(this.heartGeometry, this.heartMaterial.clone());
            heart.visible = false;
            heart.scale.setScalar(0.3);
            this.scene.add(heart);
            this.hearts.push(heart);
            this.heartData.push({
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 0,
                scale: 0.3,
                wobble: Math.random() * Math.PI * 2
            });
        }
    }

    emit(position: THREE.Vector3, count: number = 5, color: number = 0xff69b4) {
        for (let i = 0; i < count; i++) {
            const idx = this.poolIndex;
            const heart = this.hearts[idx];
            const data = this.heartData[idx];

            heart.position.copy(position);
            heart.position.x += (Math.random() - 0.5) * 3;
            heart.position.y += (Math.random() - 0.5) * 3;
            heart.position.z += (Math.random() - 0.5) * 2;

            heart.visible = true;
            (heart.material as THREE.MeshBasicMaterial).color.setHex(color);
            (heart.material as THREE.MeshBasicMaterial).opacity = 1;

            // Gentle floating velocity
            data.velocity.set(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.5 + 0.5,
                (Math.random() - 0.5) * 1
            );
            data.life = 2 + Math.random() * 2;
            data.maxLife = data.life;
            data.scale = 0.2 + Math.random() * 0.3;
            data.wobble = Math.random() * Math.PI * 2;

            this.poolIndex = (this.poolIndex + 1) % this.maxHearts;
        }
    }

    update(dt: number) {
        for (let i = 0; i < this.maxHearts; i++) {
            const heart = this.hearts[i];
            const data = this.heartData[i];

            if (!heart.visible || data.life <= 0) continue;

            data.life -= dt;

            if (data.life <= 0) {
                heart.visible = false;
                continue;
            }

            // Update position with gentle floating
            data.wobble += dt * 2;
            heart.position.x += data.velocity.x * dt + Math.sin(data.wobble) * 0.5 * dt;
            heart.position.y += data.velocity.y * dt;
            heart.position.z += data.velocity.z * dt;

            // Gentle rotation
            heart.rotation.y += dt * 0.5;
            heart.rotation.z = Math.sin(data.wobble) * 0.2;

            // Fade and scale
            const lifeRatio = data.life / data.maxLife;
            const scale = data.scale * lifeRatio;
            heart.scale.setScalar(scale);
            (heart.material as THREE.MeshBasicMaterial).opacity = lifeRatio * 0.9;
        }
    }

    cleanup() {
        this.hearts.forEach(heart => {
            heart.geometry.dispose();
            (heart.material as THREE.Material).dispose();
            this.scene.remove(heart);
        });
        this.hearts = [];
        this.heartData = [];
    }
}

/** Individual magical flower constellation */
export class FlowerConstellation {
    type: FlowerType;
    position: THREE.Vector3;
    scale: number;
    petals: THREE.Mesh[] = [];
    center!: THREE.Mesh;
    glowLight!: THREE.PointLight;
    private scene: THREE.Scene;
    private group: THREE.Group;
    
    // Animation state
    private time: number = 0;
    private bloomState: number = 0; // 0 = normal, 1 = fully bloomed
    private targetBloom: number = 0;
    private isBlooming: boolean = false;
    private petalBaseRotations: number[] = [];
    private sparkleOrbs: THREE.Mesh[] = []; // For lotus type
    private trackingPlayer: boolean = false;
    private playerPosition: THREE.Vector3 = new THREE.Vector3();
    
    // Config
    private config: typeof FLOWER_CONFIGS[FlowerType.DAISY];

    constructor(type: FlowerType, position: THREE.Vector3, scene: THREE.Scene) {
        this.type = type;
        this.position = position.clone();
        this.scene = scene;
        this.config = FLOWER_CONFIGS[type];
        
        // Random scale within range
        const [minScale, maxScale] = this.config.scaleRange;
        this.scale = minScale + Math.random() * (maxScale - minScale);

        // Create group
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.scale.setScalar(this.scale);
        scene.add(this.group);

        // Create flower components
        this.createPetals();
        this.createCenter();
        this.createGlowLight();
        
        // Create sparkle orbs for lotus
        if (type === FlowerType.LOTUS) {
            this.createSparkleOrbs();
        }
    }

    private createPetals() {
        const config = this.config;
        const petalCount = config.petalCount;

        for (let i = 0; i < petalCount; i++) {
            const angle = (i / petalCount) * Math.PI * 2;
            const color = config.petalColors[i % config.petalColors.length];

            let petal: THREE.Mesh;

            switch (this.type) {
                case FlowerType.DAISY:
                    petal = this.createDaisyPetal(color);
                    break;
                case FlowerType.TULIP:
                    petal = this.createTulipPetal(color, i);
                    break;
                case FlowerType.LOTUS:
                    petal = this.createLotusPetal(color, i);
                    break;
                case FlowerType.SUNFLOWER:
                    petal = this.createSunflowerPetal(color);
                    break;
                default:
                    petal = this.createDaisyPetal(color);
            }

            // Position and rotate petal
            const radius = this.type === FlowerType.LOTUS ? 
                (i < 8 ? 0.6 : 1.0) : 0.8;
            
            petal.position.x = Math.cos(angle) * radius * 0.3;
            petal.position.y = Math.sin(angle) * radius * 0.3;
            petal.position.z = this.type === FlowerType.TULIP ? 0.2 : 0;

            // Store base rotation for animation
            this.petalBaseRotations[i] = angle;

            // Rotate to face outward
            petal.rotation.z = angle - Math.PI / 2;
            
            // Initial tilt
            if (this.type === FlowerType.DAISY || this.type === FlowerType.SUNFLOWER) {
                petal.rotation.x = 0.3;
            } else if (this.type === FlowerType.TULIP) {
                petal.rotation.x = -0.4;
            } else if (this.type === FlowerType.LOTUS) {
                petal.rotation.x = i < 8 ? -0.6 : -0.3;
            }

            this.group.add(petal);
            this.petals.push(petal);
        }
    }

    private createDaisyPetal(color: number): THREE.Mesh {
        // Long oval petal shape
        const geometry = new THREE.SphereGeometry(0.25, 16, 16);
        geometry.scale(1, 2.5, 0.3);

        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.9,
            roughness: 0.4,
            metalness: 0.1
        });

        return new THREE.Mesh(geometry, material);
    }

    private createTulipPetal(color: number, index: number): THREE.Mesh {
        // Cup/tulip shape using scaled sphere
        const geometry = new THREE.SphereGeometry(0.4, 16, 16);
        geometry.scale(0.8, 1.5, 0.6);

        // Gradient-like colors based on position
        const colorVariation = new THREE.Color(color);
        colorVariation.offsetHSL(0, 0, (index % 3 - 1) * 0.1);

        const material = new THREE.MeshStandardMaterial({
            color: colorVariation,
            emissive: color,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.85,
            roughness: 0.5,
            metalness: 0.2,
            side: THREE.DoubleSide
        });

        return new THREE.Mesh(geometry, material);
    }

    private createLotusPetal(color: number, index: number): THREE.Mesh {
        // Elegant pointed petal
        const geometry = new THREE.ConeGeometry(0.25, 1.8, 16);
        geometry.scale(1, 1, 0.2);

        // Inner petals are lighter
        const colorVariation = new THREE.Color(color);
        if (index < 8) {
            colorVariation.offsetHSL(0, -0.2, 0.2);
        }

        const material = new THREE.MeshStandardMaterial({
            color: colorVariation,
            emissive: color,
            emissiveIntensity: 0.35,
            transparent: true,
            opacity: 0.9,
            roughness: 0.3,
            metalness: 0.15,
            side: THREE.DoubleSide
        });

        return new THREE.Mesh(geometry, material);
    }

    private createSunflowerPetal(color: number): THREE.Mesh {
        // Golden crystalline petal
        const geometry = new THREE.BoxGeometry(0.3, 2.0, 0.1);
        
        // Taper the geometry
        const positions = geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
            const y = positions[i + 1];
            if (y > 0) {
                positions[i] *= 0.5; // Taper top
            }
        }
        geometry.attributes.position.needsUpdate = true;

        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.95,
            roughness: 0.2,
            metalness: 0.6 // Crystal-like
        });

        return new THREE.Mesh(geometry, material);
    }

    private createCenter() {
        const config = this.config;
        
        let geometry: THREE.BufferGeometry;
        
        if (this.type === FlowerType.SUNFLOWER) {
            // Detailed center for sunflower
            geometry = new THREE.SphereGeometry(0.5, 24, 24);
        } else if (this.type === FlowerType.DAISY) {
            // Smooth dome for daisy
            geometry = new THREE.SphereGeometry(0.4, 20, 20);
        } else {
            geometry = new THREE.SphereGeometry(0.35, 16, 16);
        }

        const material = new THREE.MeshStandardMaterial({
            color: config.centerColor,
            emissive: config.centerColor,
            emissiveIntensity: 0.8,
            roughness: 0.6,
            metalness: 0.3
        });

        this.center = new THREE.Mesh(geometry, material);
        this.group.add(this.center);
    }

    private createGlowLight() {
        const config = this.config;
        this.glowLight = new THREE.PointLight(
            config.glowColor,
            2.0,
            30 * this.scale,
            1.5
        );
        this.group.add(this.glowLight);
    }

    private createSparkleOrbs() {
        // Floating sparkle orbs around lotus
        for (let i = 0; i < 5; i++) {
            const geometry = new THREE.SphereGeometry(0.08, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffd700,
                transparent: true,
                opacity: 0.8
            });
            const orb = new THREE.Mesh(geometry, material);
            
            orb.position.set(
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 0.5,
                0.5 + Math.random() * 0.5
            );
            
            this.group.add(orb);
            this.sparkleOrbs.push(orb);
        }
    }

    /** Bloom animation - petals open wider */
    bloom(): void {
        if (!this.isBlooming) {
            this.isBlooming = true;
            this.targetBloom = 1;
        }
    }

    /** Release heart-shaped pollen particles */
    releasePollen(heartSystem: HeartPollenSystem): void {
        const colors = [0xff69b4, 0xff1493, 0xffa0c9, 0xffd700];
        const color = colors[Math.floor(Math.random() * colors.length)];
        heartSystem.emit(
            this.position.clone().add(new THREE.Vector3(0, 0, 2)),
            8,
            color
        );
    }

    /** Called when player is near */
    onPlayerNear(distance: number, heartSystem: HeartPollenSystem): void {
        // Auto-bloom when player is close
        if (distance < 25 && !this.isBlooming) {
            this.bloom();
            this.releasePollen(heartSystem);
        }

        // Sunflower tracks player
        if (this.type === FlowerType.SUNFLOWER) {
            this.trackingPlayer = distance < 40;
        }
    }

    /** Update animation */
    update(dt: number): void {
        this.time += dt;

        // Gentle swaying
        const swayX = Math.sin(this.time * 0.5) * 0.05;
        const swayY = Math.cos(this.time * 0.3) * 0.03;
        this.group.rotation.x = swayX;
        this.group.rotation.y += this.config.rotationSpeed * dt;

        // Bloom animation
        if (this.isBlooming) {
            const bloomSpeed = 2 * dt;
            if (this.bloomState < this.targetBloom) {
                this.bloomState = Math.min(1, this.bloomState + bloomSpeed);
            } else if (this.bloomState > this.targetBloom) {
                this.bloomState = Math.max(0, this.bloomState - bloomSpeed);
            }

            // Apply bloom to petals
            this.petals.forEach((petal, i) => {
                const baseAngle = this.petalBaseRotations[i];
                const bloomFactor = this.bloomState * 0.5;
                
                if (this.type === FlowerType.TULIP) {
                    // Tulips open outward
                    petal.rotation.x = -0.4 + bloomFactor;
                } else if (this.type === FlowerType.LOTUS) {
                    // Lotus petals flatten
                    petal.rotation.x = (i < 8 ? -0.6 : -0.3) + bloomFactor * 0.5;
                } else {
                    // Others tilt outward
                    petal.rotation.x = 0.3 - bloomFactor * 0.5;
                }

                // Scale up slightly during bloom
                const scaleMult = 1 + this.bloomState * 0.2;
                petal.scale.setScalar(scaleMult);
            });

            // Center pulses during bloom
            const pulseScale = 1 + Math.sin(this.time * 8) * 0.1 * this.bloomState;
            this.center.scale.setScalar(pulseScale);

            // Light intensity increases
            this.glowLight.intensity = 2.0 + this.bloomState * 2;

            // End bloom state after animation
            if (this.targetBloom === 1 && this.bloomState >= 1) {
                setTimeout(() => {
                    this.targetBloom = 0;
                }, 2000);
            } else if (this.targetBloom === 0 && this.bloomState <= 0) {
                this.isBlooming = false;
            }
        } else {
            // Gentle center pulse when not blooming
            const pulseScale = 1 + Math.sin(this.time * 2) * 0.05;
            this.center.scale.setScalar(pulseScale);
            
            // Light gently pulses
            this.glowLight.intensity = 2.0 + Math.sin(this.time * 1.5) * 0.3;
        }

        // Animate sparkle orbs for lotus
        if (this.type === FlowerType.LOTUS && this.sparkleOrbs.length > 0) {
            this.sparkleOrbs.forEach((orb, i) => {
                const angle = this.time * 0.5 + (i / this.sparkleOrbs.length) * Math.PI * 2;
                const radius = 0.8 + Math.sin(this.time + i) * 0.2;
                orb.position.x = Math.cos(angle) * radius;
                orb.position.y = Math.sin(angle * 0.5) * 0.3;
                orb.position.z = 0.5 + Math.sin(this.time * 2 + i) * 0.2;
                
                // Pulse opacity
                (orb.material as THREE.MeshBasicMaterial).opacity = 
                    0.5 + Math.sin(this.time * 3 + i) * 0.3;
            });
        }

        // Sunflower tracking
        if (this.type === FlowerType.SUNFLOWER && this.trackingPlayer) {
            // Gently rotate to face player
            const targetRotation = Math.atan2(
                this.playerPosition.y - this.position.y,
                this.playerPosition.x - this.position.x
            );
            
            // Smoothly interpolate rotation
            const currentRot = this.group.rotation.z;
            const diff = targetRotation - currentRot;
            this.group.rotation.z += diff * dt * 2;
        }
    }

    /** Update player position for tracking */
    setPlayerPosition(pos: THREE.Vector3): void {
        this.playerPosition.copy(pos);
    }

    /** Get current position */
    getPosition(): THREE.Vector3 {
        return this.position;
    }

    /** Cleanup resources */
    destroy(): void {
        this.petals.forEach(petal => {
            petal.geometry.dispose();
            (petal.material as THREE.Material).dispose();
        });
        this.petals = [];

        if (this.center) {
            this.center.geometry.dispose();
            (this.center.material as THREE.Material).dispose();
        }

        this.sparkleOrbs.forEach(orb => {
            orb.geometry.dispose();
            (orb.material as THREE.Material).dispose();
        });
        this.sparkleOrbs = [];

        this.scene.remove(this.group);
    }
}

/** Golden sparkle particle system for sunflower */
class GoldenSparkleSystem {
    private scene: THREE.Scene;
    private maxSparkles: number;
    private sparkles: THREE.Mesh[] = [];
    private sparkleData: Array<{
        velocity: THREE.Vector3;
        life: number;
        maxLife: number;
        baseScale: number;
    }> = [];
    private poolIndex: number = 0;

    constructor(scene: THREE.Scene, maxSparkles: number = 50) {
        this.scene = scene;
        this.maxSparkles = maxSparkles;

        // Star shape geometry
        const geometry = new THREE.OctahedronGeometry(0.1, 0);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 1
        });

        for (let i = 0; i < maxSparkles; i++) {
            const sparkle = new THREE.Mesh(geometry, material.clone());
            sparkle.visible = false;
            this.scene.add(sparkle);
            this.sparkles.push(sparkle);
            this.sparkleData.push({
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 0,
                baseScale: 0.1
            });
        }
    }

    emit(position: THREE.Vector3, count: number = 3) {
        for (let i = 0; i < count; i++) {
            const idx = this.poolIndex;
            const sparkle = this.sparkles[idx];
            const data = this.sparkleData[idx];

            sparkle.position.copy(position);
            sparkle.position.x += (Math.random() - 0.5) * 2;
            sparkle.position.y += (Math.random() - 0.5) * 2;
            sparkle.position.z += Math.random() * 1;

            sparkle.visible = true;
            sparkle.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            // Drift downward slowly
            data.velocity.set(
                (Math.random() - 0.5) * 1,
                -Math.random() * 1 - 0.5,
                (Math.random() - 0.5) * 0.5
            );
            data.life = 1.5 + Math.random();
            data.maxLife = data.life;
            data.baseScale = 0.05 + Math.random() * 0.1;

            this.poolIndex = (this.poolIndex + 1) % this.maxSparkles;
        }
    }

    update(dt: number) {
        for (let i = 0; i < this.maxSparkles; i++) {
            const sparkle = this.sparkles[i];
            const data = this.sparkleData[i];

            if (!sparkle.visible || data.life <= 0) continue;

            data.life -= dt;

            if (data.life <= 0) {
                sparkle.visible = false;
                continue;
            }

            sparkle.position.addScaledVector(data.velocity, dt);
            sparkle.rotation.x += dt * 2;
            sparkle.rotation.y += dt * 3;

            // Twinkle effect
            const lifeRatio = data.life / data.maxLife;
            const twinkle = 0.5 + Math.sin(data.life * 10) * 0.5;
            const scale = data.baseScale * lifeRatio * (0.5 + twinkle * 0.5);
            sparkle.scale.setScalar(scale);
            (sparkle.material as THREE.MeshBasicMaterial).opacity = lifeRatio * twinkle;
        }
    }

    cleanup() {
        this.sparkles.forEach(sparkle => {
            sparkle.geometry.dispose();
            (sparkle.material as THREE.Material).dispose();
            this.scene.remove(sparkle);
        });
        this.sparkles = [];
        this.sparkleData = [];
    }
}

/** Manages a field of magical flower constellations */
export class ConstellationManager {
    private scene: THREE.Scene;
    private audio: AudioSystem | null;
    private particles: ParticleSystem | null;
    private flowers: FlowerConstellation[] = [];
    private heartPollen: HeartPollenSystem;
    private goldenSparkles: GoldenSparkleSystem;
    private playerPosition: THREE.Vector3 = new THREE.Vector3();
    
    // Audio cooldown to prevent spam
    private lastBloomSound: number = 0;
    private bloomSoundCooldown: number = 0.5;

    constructor(
        scene: THREE.Scene,
        audio: AudioSystem | null = null,
        particles: ParticleSystem | null = null
    ) {
        this.scene = scene;
        this.audio = audio;
        this.particles = particles;
        this.heartPollen = new HeartPollenSystem(scene);
        this.goldenSparkles = new GoldenSparkleSystem(scene);
    }

    /** Generate a constellation of flowers in the given area */
    generateConstellation(
        count: number,
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number
    ): void {
        for (let i = 0; i < count; i++) {
            // Random position
            const x = xMin + Math.random() * (xMax - xMin);
            const y = yMin + Math.random() * (yMax - yMin);
            const z = -5 - Math.random() * 15; // Background depth

            // Random flower type
            const type = Math.floor(Math.random() * 4) as FlowerType;

            const position = new THREE.Vector3(x, y, z);
            const flower = new FlowerConstellation(type, position, this.scene);
            this.flowers.push(flower);
        }

        console.log(`🌸 Generated ${count} magical flower constellations!`);
    }

    /** Add a single flower at specific position */
    addFlower(type: FlowerType, position: THREE.Vector3): FlowerConstellation {
        const flower = new FlowerConstellation(type, position, this.scene);
        this.flowers.push(flower);
        return flower;
    }

    /** Update all flowers and particle systems */
    update(dt: number, playerPos: THREE.Vector3): void {
        this.playerPosition.copy(playerPos);

        // Update flowers
        for (const flower of this.flowers) {
            flower.setPlayerPosition(playerPos);
            flower.update(dt);

            // Sunflowers emit golden sparkles occasionally
            if (flower.type === FlowerType.SUNFLOWER && Math.random() < 0.02) {
                this.goldenSparkles.emit(flower.getPosition(), 2);
            }
        }

        // Update particle systems
        this.heartPollen.update(dt);
        this.goldenSparkles.update(dt);

        // Check proximity
        this.checkPlayerProximity(playerPos);
    }

    /** Check if player is near any flowers and trigger effects */
    checkPlayerProximity(playerPos: THREE.Vector3): void {
        const now = performance.now() / 1000;

        for (const flower of this.flowers) {
            const distance = flower.getPosition().distanceTo(playerPos);

            if (distance < 30) {
                flower.onPlayerNear(distance, this.heartPollen);

                // Play sound on bloom (with cooldown)
                if (distance < 25 && now - this.lastBloomSound > this.bloomSoundCooldown) {
                    if (this.audio) {
                        // Different sounds for different flower types
                        switch (flower.type) {
                            case FlowerType.DAISY:
                                this.audio.play('twinkle', 0.6);
                                break;
                            case FlowerType.TULIP:
                                this.audio.play('magic_cast', 0.5);
                                break;
                            case FlowerType.LOTUS:
                                this.audio.play('sparkle', 0.7);
                                break;
                            case FlowerType.SUNFLOWER:
                                this.audio.play('heart_pop', 0.5);
                                break;
                        }
                    }
                    this.lastBloomSound = now;
                }
            }
        }
    }

    /** Remove flowers that are far behind the player */
    cleanupFarFlowers(playerX: number): void {
        const cleanupDistance = 100;
        
        for (let i = this.flowers.length - 1; i >= 0; i--) {
            const flower = this.flowers[i];
            if (flower.getPosition().x < playerX - cleanupDistance) {
                flower.destroy();
                this.flowers.splice(i, 1);
            }
        }
    }

    /** Get flower count */
    getFlowerCount(): number {
        return this.flowers.length;
    }

    /** Cleanup all resources */
    cleanup(): void {
        this.flowers.forEach(flower => flower.destroy());
        this.flowers = [];
        this.heartPollen.cleanup();
        this.goldenSparkles.cleanup();
    }
}
