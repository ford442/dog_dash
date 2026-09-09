import * as THREE from 'three';
import { disposeObject } from '../utils';
import { FlowerType, FLOWER_CONFIGS } from './types';
import { HeartPollenSystem } from './pollen';
import { createPetalForType, createFlowerCenter } from './constellation_geometry';

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
            const petal = createPetalForType(this.type, color, i);

            const radius = this.type === FlowerType.LOTUS ?
                (i < 8 ? 0.6 : 1.0) : 0.8;

            petal.position.x = Math.cos(angle) * radius * 0.3;
            petal.position.y = Math.sin(angle) * radius * 0.3;
            petal.position.z = this.type === FlowerType.TULIP ? 0.2 : 0;

            this.petalBaseRotations[i] = angle;
            petal.rotation.z = angle - Math.PI / 2;

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

    private createCenter() {
        this.center = createFlowerCenter(this.type, this.config);
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
        this.scene.remove(this.group);
        disposeObject(this.group);
        this.petals = [];
        this.sparkleOrbs = [];
    }
}

