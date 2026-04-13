import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    color,
    time,
    positionLocal,
    normalLocal,
    vec3,
    vec4,
    float,
    uniform,
    mix,
    sin,
    cos,
    abs,
    smoothstep
} from 'three/tsl';

// ============================================================================
// NEBULA KRAKEN — Giant Biomechanical Space Robot Squid
// ============================================================================
// A rare boss-level obstacle featuring a massive, biomechanical space squid
// with deep glossy black metallic surfaces offset by intense pulsing purple
// bioluminescence. Three health phases with distinct behavior patterns and
// a strange, mysterious AI personality.
// ============================================================================

/** Personality state for the squid's mysterious AI behavior */
type PersonalityState =
    | 'observing'     // Quietly watching the player
    | 'curious'       // Moving closer, tilting head
    | 'aggressive'    // Direct attack pattern
    | 'retreating'    // Pulling back after taking damage
    | 'contemplating' // Pausing mid-combat, as if reconsidering
    | 'enraged';      // Final phase fury

/** Options to create the NebulaKraken */
export interface NebulaKrakenOptions {
    scene: THREE.Scene;
    particleSystem: {
        emit: (position: THREE.Vector3, color: number, count: number, speed: number, lifetime: number, size?: number) => void;
    };
    debrisSystem: {
        emit: (position: THREE.Vector3, count: number, speed: number, radius: number) => void;
    };
}

// Boss health phases
const PHASE_1_THRESHOLD = 0.6; // 100% – 60% HP: Void Sweep
const PHASE_2_THRESHOLD = 0.2; // 60% – 20% HP: Ink Protocol
const PHASE_3_THRESHOLD = 0.0; // 20% – 0% HP: Frenzy

const MAX_HEALTH = 300;
const BODY_RADIUS = 4;
const HITBOX_RADIUS = 6;
const TENTACLE_COUNT = 10;
const TENTACLE_SEGMENTS = 12;

// Purple color palette
const COLOR_DEEP_PURPLE = 0x1a0033;
const COLOR_NEON_PURPLE = 0x9900ff;
const COLOR_BRIGHT_PURPLE = 0x8A2BE2;
const COLOR_HOT_PURPLE = 0x9400D3;
const COLOR_BLACK_HULL = 0x110022;
const COLOR_INK_CLOUD = 0x440088;
const COLOR_EYE_GLOW = 0xff00ff;

/**
 * NebulaKraken: A giant biomechanical space robot squid boss entity.
 *
 * Features:
 * - Multi-segment body with metallic black hull and purple bioluminescent accents
 * - 10 mechanical tentacles with procedural damped-sine-wave animation
 * - TSL (WebGPU) shaders for circuit glow and pulsing energy pathways
 * - 3-phase boss fight (Void Sweep → Ink Protocol → Frenzy)
 * - Mysterious AI personality with emergent behavior
 * - Dynamic purple point light for atmospheric shadows
 */
export class NebulaKraken {
    public group: THREE.Group;
    public isDestroyed = false;
    public health = MAX_HEALTH;
    public readonly maxHealth = MAX_HEALTH;

    private body!: THREE.Mesh;
    private tentacles: THREE.Mesh[] = [];
    private tentacleCurves: THREE.CatmullRomCurve3[] = [];
    private armorPlates: THREE.Mesh[] = [];
    private eyeNodes: THREE.Mesh[] = [];
    private coreLight: THREE.PointLight;
    private options: NebulaKrakenOptions;
    private time = 0;
    private velocity = new THREE.Vector3(-8, 0, 0);

    // AI personality
    private personality: PersonalityState = 'observing';
    private personalityTimer = 0;
    private personalityDuration = 3.0; // seconds before reconsidering mood
    private lastDamageTime = 0;
    private damageFlashTimer = 0;

    // Phase tracking
    private currentPhase = 1;
    private inkCooldown = 0;
    private sweepAngle = 0;

    // Shader uniforms
    private uPulseIntensity = uniform(0.0);

    constructor(options: NebulaKrakenOptions, spawnX: number, spawnY: number) {
        this.options = options;
        this.group = new THREE.Group();
        this.group.position.set(spawnX, spawnY, 0);

        // Build the squid
        this.createBody();
        this.createTentacles(TENTACLE_COUNT);
        this.createArmorPlates();
        this.createEyes();

        // Dynamic purple point light emanating from core
        this.coreLight = new THREE.PointLight(COLOR_NEON_PURPLE, 3.0, 40);
        this.coreLight.position.set(0, 0, 2);
        this.group.add(this.coreLight);

        this.options.scene.add(this.group);
    }

    // =========================================================================
    // GEOMETRY CONSTRUCTION
    // =========================================================================

    /** Main squid mantle – elongated ellipsoid with custom TSL shader */
    private createBody(): void {
        const bodyGeo = new THREE.SphereGeometry(BODY_RADIUS, 64, 32);
        const bodyMat = this.createHullMaterial(COLOR_DEEP_PURPLE);

        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.scale.set(1.8, 1.2, 1.4);
        this.body.castShadow = true;
        this.group.add(this.body);
    }

    /** 10 mechanical tentacles using CatmullRomCurve3 + TubeGeometry */
    private createTentacles(count: number): void {
        for (let i = 0; i < count; i++) {
            const points: THREE.Vector3[] = [];
            const angle = (i / count) * Math.PI * 1.8 - Math.PI * 0.9;

            for (let t = 0; t < TENTACLE_SEGMENTS; t++) {
                points.push(new THREE.Vector3(
                    Math.sin(angle) * (t * 0.8),
                    Math.cos(angle + t * 0.3) * 2 - t * 1.2,
                    0
                ));
            }

            const curve = new THREE.CatmullRomCurve3(points);
            this.tentacleCurves.push(curve);

            const tentacleGeo = new THREE.TubeGeometry(curve, 48, 0.35, 12, false);
            const tentacleMat = this.createTentacleMaterial(i);

            const tentacle = new THREE.Mesh(tentacleGeo, tentacleMat);
            tentacle.castShadow = true;
            tentacle.userData = {
                baseAngle: angle,
                waveOffset: i * 0.5,
                segmentCount: TENTACLE_SEGMENTS,
                index: i
            };
            this.tentacles.push(tentacle);
            this.group.add(tentacle);
        }
    }

    /** Armor plates – angular black metal plates on the mantle */
    private createArmorPlates(): void {
        for (let i = 0; i < 6; i++) {
            const plate = new THREE.Mesh(
                new THREE.BoxGeometry(2.5, 0.4, 3),
                new THREE.MeshStandardMaterial({
                    color: 0x050505,
                    metalness: 1.0,
                    roughness: 0.05
                })
            );
            plate.position.set(0, 1 - i * 0.6, 0);
            plate.rotation.z = (i % 2 ? 0.3 : -0.3);
            plate.castShadow = true;
            this.armorPlates.push(plate);
            this.group.add(plate);
        }
    }

    /** Glowing purple eye nodes – the weak points */
    private createEyes(): void {
        const eyePositions = [
            new THREE.Vector3(0, 1.8, 3.5),
            new THREE.Vector3(-1.5, 1.0, 3.0),
            new THREE.Vector3(1.5, 1.0, 3.0),
            new THREE.Vector3(-0.8, 2.2, 2.8),
            new THREE.Vector3(0.8, 2.2, 2.8),
        ];

        for (const pos of eyePositions) {
            const eyeMat = new THREE.MeshStandardMaterial({
                color: COLOR_NEON_PURPLE,
                emissive: COLOR_EYE_GLOW,
                emissiveIntensity: 4.0
            });

            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 32, 32),
                eyeMat
            );
            eye.position.copy(pos);
            this.eyeNodes.push(eye);
            this.group.add(eye);
        }
    }

    // =========================================================================
    // SHADER / MATERIAL CREATION (TSL for WebGPU)
    // =========================================================================

    /** Custom TSL material for the black metallic hull with purple circuit glow */
    private createHullMaterial(baseHex: number): MeshStandardNodeMaterial {
        const mat = new MeshStandardNodeMaterial({
            color: baseHex,
            metalness: 0.95,
            roughness: 0.2,
        });

        const uTime = time;

        // Pulsing circuit energy along the hull
        const pulse = sin(uTime.mul(3.0)).mul(0.3).add(0.7); // 0.4..1.0
        const circuitGlow = color(COLOR_NEON_PURPLE).mul(pulse);

        // Fresnel-like rim glow (edges glow brighter)
        const fresnel = float(1.0).sub(abs(normalLocal.z)).pow(3);
        mat.emissiveNode = circuitGlow.mul(fresnel).mul(this.uPulseIntensity.add(1.0));

        return mat;
    }

    /** Custom TSL material for tentacles with sequential purple pulse */
    private createTentacleMaterial(index: number): MeshStandardNodeMaterial {
        const mat = new MeshStandardNodeMaterial({
            color: COLOR_BLACK_HULL,
            metalness: 1.0,
            roughness: 0.1,
        });

        const uTime = time;
        const offset = float(index * 0.618); // Golden ratio offset for staggered glow

        // Damped traveling wave glow along tentacle
        // y(x,t) = A * sin(k*x - w*t) * e^(-lambda*x)
        const wavePhase = sin(uTime.mul(8.0).add(offset));
        const glowIntensity = wavePhase.mul(0.5).add(0.5); // 0..1

        mat.emissiveNode = color(COLOR_BRIGHT_PURPLE).mul(glowIntensity);

        return mat;
    }

    // =========================================================================
    // UPDATE LOOP
    // =========================================================================

    update(delta: number, playerX: number, playerY: number): void {
        if (this.isDestroyed) return;

        this.time += delta;
        this.personalityTimer += delta;
        this.damageFlashTimer = Math.max(0, this.damageFlashTimer - delta);

        // Update phase
        const hpRatio = this.health / this.maxHealth;
        if (hpRatio <= PHASE_3_THRESHOLD + 0.001) {
            // Dead
        } else if (hpRatio <= PHASE_2_THRESHOLD) {
            this.currentPhase = 3;
        } else if (hpRatio <= PHASE_1_THRESHOLD) {
            this.currentPhase = 2;
        } else {
            this.currentPhase = 1;
        }

        // AI personality decisions
        this.updatePersonality(playerX, playerY);

        // Movement based on personality & phase
        this.updateMovement(delta, playerX, playerY);

        // Animate tentacles with damped sine wave
        this.animateTentacles(delta, playerX, playerY);

        // Animate eyes
        this.animateEyes();

        // Phase-specific attacks
        this.updatePhaseAttacks(delta, playerX, playerY);

        // Update core light
        this.updateCoreLighting();

        // Update shader pulse uniform
        this.uPulseIntensity.value = this.currentPhase === 3 ? 2.0 : (this.currentPhase === 2 ? 1.0 : 0.5);
    }

    // =========================================================================
    // AI PERSONALITY SYSTEM
    // =========================================================================

    /** The squid has a strange, mysterious personality that shifts over time */
    private updatePersonality(playerX: number, playerY: number): void {
        if (this.personalityTimer < this.personalityDuration) return;
        this.personalityTimer = 0;

        const dx = playerX - this.group.position.x;
        const dist = Math.abs(dx);
        const hpRatio = this.health / this.maxHealth;
        const recentlyHurt = (this.time - this.lastDamageTime) < 3.0;

        // Phase 3: Frenzy overrides personality
        if (this.currentPhase === 3) {
            this.personality = 'enraged';
            this.personalityDuration = 1.0;
            return;
        }

        // Mysterious AI decision-making
        const roll = Math.random();

        if (recentlyHurt && roll < 0.4) {
            // Sometimes retreats after damage, sometimes gets angry
            this.personality = roll < 0.2 ? 'retreating' : 'aggressive';
            this.personalityDuration = 2.0 + Math.random() * 2.0;
        } else if (dist > 25 && roll < 0.6) {
            // Far from player: curious approach or quiet observation
            this.personality = roll < 0.3 ? 'curious' : 'observing';
            this.personalityDuration = 3.0 + Math.random() * 3.0;
        } else if (dist < 15 && hpRatio < 0.5) {
            // Close and hurt: unpredictable
            const moods: PersonalityState[] = ['aggressive', 'contemplating', 'retreating', 'curious'];
            this.personality = moods[Math.floor(Math.random() * moods.length)];
            this.personalityDuration = 1.5 + Math.random() * 2.0;
        } else if (roll < 0.15) {
            // Rare contemplation pause – the squid seems to think
            this.personality = 'contemplating';
            this.personalityDuration = 2.0 + Math.random() * 4.0;
        } else {
            // Default aggressive/curious cycle
            this.personality = roll < 0.5 ? 'aggressive' : 'curious';
            this.personalityDuration = 2.0 + Math.random() * 3.0;
        }
    }

    // =========================================================================
    // MOVEMENT
    // =========================================================================

    private updateMovement(delta: number, playerX: number, playerY: number): void {
        const dx = playerX - this.group.position.x;
        const dy = playerY - this.group.position.y;

        switch (this.personality) {
            case 'observing':
                // Slow drift, gentle bob – watching from a distance
                this.group.position.x += this.velocity.x * 0.3 * delta;
                this.group.position.y += Math.sin(this.time * 1.5) * 0.4 * delta;
                break;

            case 'curious':
                // Approaches player slowly, weaving side to side
                this.group.position.x += Math.sign(dx) * 4 * delta;
                this.group.position.y += Math.sin(this.time * 3) * 1.2 * delta;
                // Slight tilt toward player (curiosity head-tilt)
                this.group.rotation.z = Math.sin(this.time * 2) * 0.15;
                break;

            case 'aggressive':
                // Rushes toward player
                this.group.position.x += Math.sign(dx) * 10 * delta;
                this.group.position.y += Math.sign(dy) * 5 * delta;
                this.group.rotation.z = 0;
                break;

            case 'retreating':
                // Pulls away from player
                this.group.position.x -= Math.sign(dx) * 6 * delta;
                this.group.position.y += Math.sin(this.time * 4) * 2 * delta;
                break;

            case 'contemplating':
                // Stops almost entirely, very slow bob, eerily still
                this.group.position.y += Math.sin(this.time * 0.8) * 0.2 * delta;
                // Slowly rotates, as if examining something
                this.group.rotation.z = Math.sin(this.time * 0.5) * 0.08;
                break;

            case 'enraged':
                // Phase 3: Rapid, erratic pursuit
                this.group.position.x += Math.sign(dx) * 14 * delta;
                this.group.position.y += Math.sign(dy) * 8 * delta;
                // Jittering from damage / rage
                this.group.position.x += (Math.random() - 0.5) * 0.5;
                this.group.position.y += (Math.random() - 0.5) * 0.5;
                break;
        }
    }

    // =========================================================================
    // TENTACLE ANIMATION (Damped Sine Wave)
    // =========================================================================

    /**
     * Animate tentacles using the damped sine wave formula:
     * y(x,t) = A * sin(k*x - ω*t) * e^(-λ*x)
     *
     * Where:
     * - A = amplitude (increases with phase)
     * - k = wave number
     * - ω = angular frequency
     * - λ = damping coefficient (base moves less than tip)
     */
    private animateTentacles(delta: number, playerX: number, playerY: number): void {
        const A = this.currentPhase === 3 ? 1.2 : (this.currentPhase === 2 ? 0.8 : 0.6);
        const k = 1.2;    // wave number
        const omega = 4.0; // angular frequency
        const lambda = 0.08; // damping coefficient

        this.tentacles.forEach((tent, i) => {
            const waveOffset = tent.userData.waveOffset;
            const baseAngle = tent.userData.baseAngle;

            // Base oscillation using damped sine wave
            const waveDisplacement = A * Math.sin(k * i - omega * this.time + waveOffset) * Math.exp(-lambda * i);
            tent.rotation.z = baseAngle + waveDisplacement;

            // In phase 3 (Frenzy), tentacles track player directly
            if (this.currentPhase === 3 || this.personality === 'aggressive') {
                const dx = playerX - this.group.position.x;
                const dy = playerY - this.group.position.y;
                const targetAngle = Math.atan2(dy, dx);
                // Blend toward player (IK-like targeting)
                const trackStr = this.currentPhase === 3 ? 0.3 : 0.1;
                tent.rotation.z += (targetAngle - tent.rotation.z) * trackStr;
            }

            // Sweep animation for phase 1
            if (this.currentPhase === 1 && (i === 0 || i === 1)) {
                this.sweepAngle += delta * 2;
                tent.rotation.z += Math.sin(this.sweepAngle) * 0.8;
            }
        });
    }

    // =========================================================================
    // EYE ANIMATION
    // =========================================================================

    private animateEyes(): void {
        this.eyeNodes.forEach((eye, i) => {
            const mat = eye.material as THREE.MeshStandardMaterial;
            const basePulse = Math.sin(this.time * 12 + i * 1.5) * 2;

            // Different glow per personality state
            switch (this.personality) {
                case 'contemplating':
                    mat.emissiveIntensity = 1.0 + Math.sin(this.time * 2 + i) * 0.5;
                    break;
                case 'enraged':
                    mat.emissiveIntensity = 5.0 + basePulse;
                    break;
                case 'curious':
                    mat.emissiveIntensity = 3.0 + Math.sin(this.time * 6 + i * 0.8) * 1.5;
                    break;
                default:
                    mat.emissiveIntensity = 3.0 + basePulse;
            }
        });
    }

    // =========================================================================
    // PHASE-SPECIFIC ATTACKS
    // =========================================================================

    private updatePhaseAttacks(delta: number, playerX: number, playerY: number): void {
        this.inkCooldown = Math.max(0, this.inkCooldown - delta);

        switch (this.currentPhase) {
            case 1:
                // Phase 1: Void Sweep – menacing drift, occasional particles
                if (Math.random() < 0.005) {
                    this.emitPurpleParticles(6, 3.0);
                }
                break;

            case 2:
                // Phase 2: Ink Protocol – release ink clouds that obscure vision
                if (this.inkCooldown <= 0 && Math.random() < 0.015) {
                    this.releaseInkCloud();
                    this.inkCooldown = 4.0; // 4-second cooldown between ink bursts
                }
                // Constant dripping particles
                if (Math.random() < 0.02) {
                    this.emitPurpleParticles(3, 2.0);
                }
                break;

            case 3:
                // Phase 3: Frenzy – hull fractures, intense energy release
                if (Math.random() < 0.04) {
                    this.emitPurpleParticles(12, 6.0);
                }
                // EMP-like energy bursts
                if (this.inkCooldown <= 0 && Math.random() < 0.02) {
                    this.releaseEnergyBurst(playerX, playerY);
                    this.inkCooldown = 2.0;
                }
                break;
        }
    }

    /** Emit purple particles from the body */
    private emitPurpleParticles(count: number, speed: number): void {
        const pos = this.group.position.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 3,
            0
        ));
        this.options.particleSystem.emit(pos, COLOR_NEON_PURPLE, count, speed, 1.5, 1.2);
    }

    /** Phase 2 attack: Release a dark ink cloud */
    private releaseInkCloud(): void {
        const inkPos = this.group.position.clone().add(new THREE.Vector3(-6, 0, 0));
        // Large cloud of dark purple particles
        this.options.particleSystem.emit(inkPos, COLOR_INK_CLOUD, 60, 4.0, 3.0, 2.5);
        // Secondary brighter burst
        this.options.particleSystem.emit(inkPos, COLOR_HOT_PURPLE, 20, 6.0, 2.0, 1.0);
    }

    /** Phase 3 attack: Directed energy burst toward player */
    private releaseEnergyBurst(playerX: number, playerY: number): void {
        const burstPos = this.group.position.clone();
        // Bright purple energy burst
        this.options.particleSystem.emit(burstPos, COLOR_EYE_GLOW, 30, 8.0, 1.0, 1.5);
        // Trail particles between squid and player direction
        const dx = playerX - this.group.position.x;
        const dy = playerY - this.group.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const midPoint = burstPos.add(new THREE.Vector3(dx / dist * 5, dy / dist * 5, 0));
        this.options.particleSystem.emit(midPoint, COLOR_BRIGHT_PURPLE, 15, 10.0, 0.8, 0.8);
    }

    // =========================================================================
    // CORE LIGHTING
    // =========================================================================

    private updateCoreLighting(): void {
        // Pulse the core light based on phase
        const baseIntensity = this.currentPhase === 3 ? 6.0 : (this.currentPhase === 2 ? 4.0 : 3.0);
        const pulse = Math.sin(this.time * (this.currentPhase === 3 ? 15 : 6)) * 1.5;
        this.coreLight.intensity = baseIntensity + pulse;

        // Flash white briefly when recently damaged
        if (this.damageFlashTimer > 0) {
            this.coreLight.color.setHex(0xffffff);
            this.coreLight.intensity = 10.0;
        } else {
            this.coreLight.color.setHex(COLOR_NEON_PURPLE);
        }

        // In phase 3, the light range increases dramatically
        this.coreLight.distance = this.currentPhase === 3 ? 60 : 40;
    }

    // =========================================================================
    // DAMAGE & DESTRUCTION
    // =========================================================================

    takeDamage(dmg: number): void {
        if (this.isDestroyed) return;

        this.health -= dmg;
        this.lastDamageTime = this.time;
        this.damageFlashTimer = 0.15; // Brief white flash

        // Visual feedback: emit sparks at impact
        this.emitPurpleParticles(8, 5.0);

        // Phase transition effects
        const hpRatio = this.health / this.maxHealth;
        if (hpRatio <= PHASE_2_THRESHOLD && this.currentPhase < 2) {
            this.currentPhase = 2;
            // Dramatic ink burst on phase transition
            this.releaseInkCloud();
            this.releaseInkCloud();
        }
        if (hpRatio <= PHASE_3_THRESHOLD + 0.20 && this.currentPhase < 3) {
            this.currentPhase = 3;
            // Armor plates start to fracture
            this.armorPlates.forEach(plate => {
                plate.rotation.x += (Math.random() - 0.5) * 0.5;
                plate.position.y += (Math.random() - 0.5) * 0.3;
            });
        }

        if (this.health <= 0) {
            this.destroy();
        }
    }

    /** Epic destruction sequence */
    private destroy(): void {
        this.isDestroyed = true;

        // Massive debris explosion
        this.options.debrisSystem.emit(this.group.position, 40, 12, 8);

        // Multiple particle bursts in purple
        for (let i = 0; i < 5; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 2
            );
            const burstPos = this.group.position.clone().add(offset);
            this.options.particleSystem.emit(burstPos, COLOR_NEON_PURPLE, 30, 8.0, 2.0, 2.0);
            this.options.particleSystem.emit(burstPos, COLOR_EYE_GLOW, 15, 12.0, 1.5, 1.0);
        }

        // Final white flash burst
        this.options.particleSystem.emit(this.group.position.clone(), 0xffffff, 50, 15.0, 1.0, 3.0);

        this.options.scene.remove(this.group);
    }

    // =========================================================================
    // PUBLIC ACCESSORS
    // =========================================================================

    getPosition(): THREE.Vector3 {
        return this.group.position;
    }

    getRadius(): number {
        return HITBOX_RADIUS;
    }

    getPhase(): number {
        return this.currentPhase;
    }

    getPersonality(): PersonalityState {
        return this.personality;
    }

    getHealthRatio(): number {
        return this.health / this.maxHealth;
    }
}
