import * as THREE from 'three';
import { ParticleSystem } from '../particles';
import type { AudioPort } from '../ports';
import { OrbType, ORB_CONFIG, PASTEL_COLORS, STAR_COLORS } from './types';

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
    glowBoostMultiplier: number = 1;
    glowBoostUntil: number = 0;
    private baseEmissiveIntensity: number = 2;
    private coreMesh: THREE.Mesh | null = null;
    private outerGlowMesh: THREE.Mesh | null = null;

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
        this.coreMesh = mesh;
        this.baseEmissiveIntensity = glowIntensity;

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
        this.outerGlowMesh = glowMesh;
        this.mesh.add(glowMesh);
    }

    /** Temporarily brighten this orb (e.g. Stellar Seal Pup clap cheer). */
    applyGlowBoost(multiplier: number, durationSeconds: number, time: number): void {
        this.glowBoostMultiplier = multiplier;
        this.glowBoostUntil = time + durationSeconds;
    }

    private refreshGlowVisuals(time: number): void {
        if (time > this.glowBoostUntil) {
            this.glowBoostMultiplier = 1;
        }
        const boost = this.glowBoostMultiplier;
        if (this.coreMesh?.material instanceof THREE.MeshStandardMaterial) {
            this.coreMesh.material.emissiveIntensity = this.baseEmissiveIntensity * boost;
        }
        if (this.outerGlowMesh?.material instanceof THREE.MeshBasicMaterial) {
            this.outerGlowMesh.material.opacity = 0.2 + (boost - 1) * 0.25;
        }
    }

    /** Bonus score when collected while seal-boosted. */
    getSealBoostBonus(): number {
        return this.glowBoostMultiplier > 1 ? Math.floor(8 * this.glowBoostMultiplier) : 0;
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

        this.refreshGlowVisuals(time);

        // Pulse glow
        if (this.glowLight) {
            const pulse = 1.0 + Math.sin(time * 3 + this.floatPhase) * 0.3;
            this.glowLight.intensity = 1.5 * pulse * this.glowBoostMultiplier;
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
    collect(particleSystem: ParticleSystem, audio: AudioPort): { points: number; type: OrbType; healthRestore?: number } {
        if (this.collected) return { points: 0, type: this.type };

        this.collected = true;

        // Play collection sound
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
            points: this.points + this.getSealBoostBonus(),
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
