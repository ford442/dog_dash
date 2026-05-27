/**
 * Dog Cockpit Animation System 🐕🚀
 * Adorable dog astronaut animations for Dog Dash
 * A magical space game for a 7-year-old girl
 */

import * as THREE from 'three';

/** Animation states for the dog astronaut */
export enum DogAnimationState {
    IDLE = 'idle',
    THRUST = 'thrust',
    COLLECT = 'collect',
    POWER_UP = 'power_up',
    HIT = 'hit',
    VICTORY = 'victory',
    CURIOUS = 'curious',
    DELIGHTED = 'delighted'
}

/** Accessory types that can be unlocked and equipped */
export enum DogAccessory {
    TUTU = 'tutu',
    CAPE = 'cape',
    BOW = 'bow',
    GLASSES = 'glasses',
    CROWN = 'crown'
}

/** Configuration for accessory unlocks */
interface AccessoryUnlock {
    type: DogAccessory;
    name: string;
    description: string;
    cost: number;
    requirement?: () => boolean;
}

/** Interface for bone references */
interface DogBones {
    root?: THREE.Bone;
    body?: THREE.Bone;
    head?: THREE.Bone;
    neck?: THREE.Bone;
    tail?: THREE.Bone;
    tailTip?: THREE.Bone;
    leftEar?: THREE.Bone;
    rightEar?: THREE.Bone;
    leftFrontPaw?: THREE.Bone;
    rightFrontPaw?: THREE.Bone;
    leftBackPaw?: THREE.Bone;
    rightBackPaw?: THREE.Bone;
    nose?: THREE.Bone;
    // Alternative naming conventions
    earLeft?: THREE.Bone;
    earRight?: THREE.Bone;
    pilotHead?: THREE.Object3D;
    pilotGroup?: THREE.Object3D;
}

/** Animation data for each bone */
interface BoneAnimationData {
    basePosition: THREE.Vector3;
    baseRotation: THREE.Euler;
    baseScale: THREE.Vector3;
    animationOffset: number;
}

/** Particle for happy effects */
class HappyParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    
    constructor(scene: THREE.Scene, position: THREE.Vector3) {
        const geometry = new THREE.SphereGeometry(0.03, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(Math.random(), 1, 0.6),
            transparent: true,
            opacity: 0.8
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        
        // Random upward velocity
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            Math.random() * 0.15 + 0.05,
            (Math.random() - 0.5) * 0.1
        );
        
        this.life = 0;
        this.maxLife = 1 + Math.random() * 0.5;
        scene.add(this.mesh);
    }
    
    update(deltaTime: number): boolean {
        this.life += deltaTime;
        this.mesh.position.addScaledVector(this.velocity, deltaTime);
        this.velocity.y -= 0.1 * deltaTime; // Gravity
        
        // Fade out
        const t = this.life / this.maxLife;
        (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
        this.mesh.scale.setScalar(1 - t * 0.5);
        
        if (this.life >= this.maxLife) {
            this.mesh.parent?.remove(this.mesh);
            this.mesh.geometry.dispose();
            (this.mesh.material as THREE.Material).dispose();
            return false;
        }
        return true;
    }
}

/**
 * Main controller for dog astronaut animations
 * Manages all bone animations, states, and accessories
 */
export class DogCockpitController {
    private bones: DogBones = {};
    private boneData: Map<string, BoneAnimationData> = new Map();
    private currentState: DogAnimationState = DogAnimationState.IDLE;
    private stateTimer: number = 0;
    private stateDuration: number = 0;
    private initialized: boolean = false;
    
    // Look target for head tracking
    private lookTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 10);
    private lookTargetScreen: { x: number; y: number } = { x: 0.5, y: 0.5 };
    private lookIntensity: number = 0.5;
    
    // Animation parameters
    private time: number = 0;
    private blinkTimer: number = 0;
    private isBlinking: boolean = false;
    private tailWagSpeed: number = 3;
    private tailWagIntensity: number = 0.2;
    private earPerkAmount: number = 0;
    private bounceAmount: number = 0;
    private headTiltAngle: number = 0;
    
    // Emotion parameters
    private happiness: number = 0.5; // 0-1
    private excitement: number = 0; // 0-1
    private worry: number = 0; // 0-1
    
    // Accessories
    private accessories: Map<DogAccessory, THREE.Object3D> = new Map();
    private equippedAccessories: Set<DogAccessory> = new Set();
    private accessoryGroup?: THREE.Group;
    
    // Particles
    private happyParticles: HappyParticle[] = [];
    private scene?: THREE.Scene;
    
    // Physics-based animation
    private velocity: THREE.Vector3 = new THREE.Vector3();
    private targetRotation: THREE.Euler = new THREE.Euler();
    private currentRotation: THREE.Euler = new THREE.Euler();
    
    // Callbacks
    private onAnimationTrigger?: (state: DogAnimationState) => void;
    
    constructor() {
        // Set up mouse tracking
        this.setupMouseTracking();
    }
    
    /**
     * Initialize the controller with the rocket mesh
     * Finds and caches all bone references from the GLB model
     */
    initialize(rocketMesh: THREE.Group): void {
        console.log('🐕 Initializing Dog Cockpit Controller...');
        
        this.findBones(rocketMesh);
        this.storeBaseTransforms();
        this.createAccessoryGroup();
        this.setupEyes();
        
        this.scene = rocketMesh.parent?.parent?.parent as THREE.Scene;
        this.initialized = true;
        
        console.log('✅ Dog Cockpit Controller initialized!');
        this.logBoneStatus();
    }
    
    /** Find all dog bones in the rocket mesh */
    private findBones(rocketMesh: THREE.Group): void {
        // Common bone naming patterns
        const bonePatterns = {
            root: ['root', 'Root', 'dog_root', 'DogRoot', 'Armature'],
            body: ['body', 'Body', 'torso', 'Torso', 'spine', 'Spine', 'chest', 'Chest'],
            head: ['head', 'Head', 'pilotHead', 'PilotHead', 'dog_head', 'Head_Mesh'],
            neck: ['neck', 'Neck', 'head_neck', 'Neck_01'],
            tail: ['tail', 'Tail', 'tail_01', 'Tail_01', 'tail_base', 'TailBase'],
            tailTip: ['tail_tip', 'TailTip', 'tail_02', 'Tail_02', 'tail_end', 'TailEnd'],
            leftEar: ['leftEar', 'LeftEar', 'ear_L', 'Ear_L', 'ear_left', 'EarLeft', 'L_ear'],
            rightEar: ['rightEar', 'RightEar', 'ear_R', 'Ear_R', 'ear_right', 'EarRight', 'R_ear'],
            leftFrontPaw: ['leftFrontPaw', 'LeftFrontPaw', 'paw_L_F', 'Paw_L_F', 'hand_L'],
            rightFrontPaw: ['rightFrontPaw', 'RightFrontPaw', 'paw_R_F', 'Paw_R_F', 'hand_R'],
            leftBackPaw: ['leftBackPaw', 'LeftBackPaw', 'paw_L_B', 'Paw_L_B', 'foot_L'],
            rightBackPaw: ['rightBackPaw', 'RightBackPaw', 'paw_R_B', 'Paw_R_B', 'foot_R'],
            nose: ['nose', 'Nose', 'snout', 'Snout']
        };
        
        rocketMesh.traverse((child) => {
            const name = child.name;
            
            // Check each bone pattern
            for (const [boneName, patterns] of Object.entries(bonePatterns)) {
                if (patterns.some(pattern => name === pattern || name.includes(pattern))) {
                    if (child.type === 'Bone' || child instanceof THREE.Bone) {
                        (this.bones as any)[boneName] = child;
                    } else if (child instanceof THREE.Object3D) {
                        // Also accept Object3D for non-skinned meshes
                        (this.bones as any)[boneName] = child;
                    }
                }
            }
            
            // Special case for pilot group (from existing code)
            if (name === 'pilotGroup' || name === 'PilotGroup') {
                this.bones.pilotGroup = child;
            }
            if (name === 'pilotHead') {
                this.bones.pilotHead = child;
            }
        });
        
        // If we found pilotGroup, search within it for more bones
        if (this.bones.pilotGroup) {
            this.bones.pilotGroup.traverse((child) => {
                const name = child.name;
                if (name.toLowerCase().includes('ear') || name.toLowerCase().includes('head')) {
                    if (name.toLowerCase().includes('left')) {
                        this.bones.earLeft = child as THREE.Bone;
                    } else if (name.toLowerCase().includes('right')) {
                        this.bones.earRight = child as THREE.Bone;
                    }
                }
            });
        }
    }
    
    /** Store base transforms for animation reference */
    private storeBaseTransforms(): void {
        const storeBoneData = (name: string, obj?: THREE.Object3D) => {
            if (obj) {
                this.boneData.set(name, {
                    basePosition: obj.position.clone(),
                    baseRotation: obj.rotation.clone(),
                    baseScale: obj.scale.clone(),
                    animationOffset: Math.random() * Math.PI * 2
                });
            }
        };
        
        Object.entries(this.bones).forEach(([name, bone]) => {
            if (bone) storeBoneData(name, bone);
        });
    }
    
    /** Create a group for accessories */
    private createAccessoryGroup(): void {
        this.accessoryGroup = new THREE.Group();
        this.accessoryGroup.name = 'dogAccessories';
        
        // Attach to head if available, otherwise body, otherwise root
        const attachPoint = this.bones.head || this.bones.pilotHead || this.bones.body || this.bones.pilotGroup;
        if (attachPoint) {
            attachPoint.add(this.accessoryGroup);
        }
    }
    
    /** Setup animated eyes (if found) */
    private setupEyes(): void {
        // Eyes are often meshes named with eye/eyeball patterns
        // We'll track them for blinking animations
    }
    
    /** Setup mouse/touch tracking for head look */
    private setupMouseTracking(): void {
        if (typeof document !== 'undefined') {
            document.addEventListener('mousemove', (e) => {
                this.setLookTarget(e.clientX, e.clientY);
            });
            
            document.addEventListener('touchmove', (e) => {
                if (e.touches.length > 0) {
                    this.setLookTarget(e.touches[0].clientX, e.touches[0].clientY);
                }
            });
        }
    }
    
    /**
     * Update all animations
     * Should be called every frame from the game loop
     */
    update(deltaTime: number, gameState?: any): void {
        if (!this.initialized) return;
        
        this.time += deltaTime;
        
        // Update state timer
        if (this.stateDuration > 0) {
            this.stateTimer += deltaTime;
            if (this.stateTimer >= this.stateDuration) {
                this.returnToIdle();
            }
        }
        
        // Update emotions decay
        this.excitement = Math.max(0, this.excitement - deltaTime * 0.5);
        this.worry = Math.max(0, this.worry - deltaTime * 0.3);
        
        // Update animations based on current state
        this.updateStateAnimations(deltaTime, gameState);
        
        // Update blink
        this.updateBlink(deltaTime);
        
        // Update head look
        this.updateHeadLook(deltaTime);
        
        // Update particles
        this.updateParticles(deltaTime);
        
        // Update accessories
        this.updateAccessories(deltaTime);
        
        // Apply base animations (breathing, etc)
        this.updateBaseAnimations(deltaTime);
    }
    
    /** Update animations based on current state */
    private updateStateAnimations(deltaTime: number, gameState?: any): void {
        switch (this.currentState) {
            case DogAnimationState.IDLE:
                this.animateIdle(deltaTime);
                break;
            case DogAnimationState.THRUST:
                this.animateThrust(deltaTime, gameState);
                break;
            case DogAnimationState.COLLECT:
                this.animateCollect(deltaTime);
                break;
            case DogAnimationState.POWER_UP:
                this.animatePowerUp(deltaTime);
                break;
            case DogAnimationState.HIT:
                this.animateHit(deltaTime);
                break;
            case DogAnimationState.VICTORY:
                this.animateVictory(deltaTime);
                break;
            case DogAnimationState.CURIOUS:
                this.animateCurious(deltaTime);
                break;
            case DogAnimationState.DELIGHTED:
                this.animateDelighted(deltaTime);
                break;
        }
    }
    
    /** IDLE: Gentle breathing, occasional ear twitch */
    private animateIdle(deltaTime: number): void {
        const breathTime = this.time * 1.5;
        
        // Gentle body breathing
        if (this.bones.body || this.bones.pilotGroup) {
            const body = this.bones.body || this.bones.pilotGroup!;
            const data = this.boneData.get('body') || this.boneData.get('pilotGroup');
            if (data) {
                const breatheScale = 1 + Math.sin(breathTime) * 0.02;
                body.scale.set(
                    data.baseScale.x * breatheScale,
                    data.baseScale.y * (1 + Math.sin(breathTime) * 0.015),
                    data.baseScale.z * breatheScale
                );
            }
        }
        
        // Occasional ear twitch (every 3-5 seconds)
        const twitchCycle = (this.time % 4) / 4;
        if (twitchCycle > 0.9) {
            this.twitchEars(deltaTime);
        }
        
        // Slow gentle tail wag
        this.wagTail(2, 0.15);
        
        // Head tilt occasionally
        if (Math.random() < 0.001) {
            this.tiltHead((Math.random() - 0.5) * 0.3);
        }
    }
    
    /** THRUST: Tail wagging fast, body pushed back slightly */
    private animateThrust(deltaTime: number, gameState?: any): void {
        // Fast tail wag
        this.wagTail(12, 0.4);
        
        // Body pushed back (g-force effect)
        if (this.bones.body || this.bones.pilotGroup) {
            const body = this.bones.body || this.bones.pilotGroup!;
            const data = this.boneData.get('body') || this.boneData.get('pilotGroup');
            if (data) {
                // Lean back
                const leanAmount = -0.3 * (1 - this.excitement * 0.3);
                body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, data.baseRotation.x + leanAmount, 0.1);
            }
        }
        
        // Ears back (aerodynamic)
        this.perkEars(-0.2);
        
        // Excited expression
        this.happiness = Math.min(1, this.happiness + deltaTime * 0.5);
    }
    
    /** COLLECT: Happy ears perk, head bobs */
    private animateCollect(deltaTime: number): void {
        // Ears perk up
        this.perkEars(0.6);
        
        // Happy tail wag
        this.wagTail(8, 0.3);
        
        // Head bob
        const bobTime = this.time * 10;
        if (this.bones.head || this.bones.pilotHead) {
            const head = this.bones.head || this.bones.pilotHead!;
            const data = this.boneData.get('head') || this.boneData.get('pilotHead');
            if (data) {
                head.position.y = data.basePosition.y + Math.abs(Math.sin(bobTime)) * 0.05;
            }
        }
        
        // Spawn happy particles
        if (Math.random() < 0.3) {
            this.spawnHappyParticles();
        }
        
        this.happiness = Math.min(1, this.happiness + 0.2);
    }
    
    /** POWER_UP: Full happy dance, tail frenzy */
    private animatePowerUp(deltaTime: number): void {
        // Frenzied tail wag
        this.wagTail(20, 0.5);
        
        // Full body dance
        const danceTime = this.time * 8;
        if (this.bones.body || this.bones.pilotGroup) {
            const body = this.bones.body || this.bones.pilotGroup!;
            const data = this.boneData.get('body') || this.boneData.get('pilotGroup');
            if (data) {
                body.position.y = data.basePosition.y + Math.sin(danceTime * 2) * 0.08;
                body.rotation.z = Math.sin(danceTime) * 0.1;
            }
        }
        
        // Ears at maximum perk
        this.perkEars(0.8);
        
        // Paws up
        this.raisePaws(true);
        
        // Lots of particles
        if (Math.random() < 0.5) {
            this.spawnHappyParticles();
        }
        
        // Nose "boop" animation
        if (this.bones.nose && Math.random() < 0.1) {
            this.boopNose();
        }
        
        this.excitement = 1;
        this.happiness = 1;
    }
    
    /** HIT/DAMAGE: Sad ears droop, worried expression, whimper pose */
    private animateHit(deltaTime: number): void {
        // Ears droop down
        this.perkEars(-0.5);
        
        // Slow worried tail (or tucked)
        this.wagTail(1, 0.05);
        
        // Body cower slightly
        if (this.bones.body || this.bones.pilotGroup) {
            const body = this.bones.body || this.bones.pilotGroup!;
            const data = this.boneData.get('body') || this.boneData.get('pilotGroup');
            if (data) {
                body.position.y = THREE.MathUtils.lerp(body.position.y, data.basePosition.y - 0.1, 0.1);
                // Slight shake from fear
                body.position.x = data.basePosition.x + Math.sin(this.time * 20) * 0.01;
            }
        }
        
        // Head down
        if (this.bones.head || this.bones.pilotHead) {
            const head = this.bones.head || this.bones.pilotHead!;
            const data = this.boneData.get('head') || this.boneData.get('pilotHead');
            if (data) {
                head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, data.baseRotation.x + 0.3, 0.1);
            }
        }
        
        this.worry = Math.min(1, this.worry + deltaTime * 2);
        this.happiness = Math.max(0, this.happiness - deltaTime);
    }
    
    /** VICTORY: Paws up celebration, maximum wag */
    private animateVictory(deltaTime: number): void {
        // Maximum tail wag
        this.wagTail(25, 0.6);
        
        // Paws up in celebration
        this.raisePaws(true);
        
        // Jump/bounce
        const jumpTime = this.time * 6;
        if (this.bones.body || this.bones.pilotGroup) {
            const body = this.bones.body || this.bones.pilotGroup!;
            const data = this.boneData.get('body') || this.boneData.get('pilotGroup');
            if (data) {
                body.position.y = data.basePosition.y + Math.abs(Math.sin(jumpTime)) * 0.15;
            }
        }
        
        // Head looking up happily
        if (this.bones.head || this.bones.pilotHead) {
            const head = this.bones.head || this.bones.pilotHead!;
            const data = this.boneData.get('head') || this.boneData.get('pilotHead');
            if (data) {
                head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, data.baseRotation.x - 0.2, 0.1);
            }
        }
        
        // Confetti particles
        if (Math.random() < 0.4) {
            this.spawnHappyParticles();
        }
        
        this.excitement = 1;
        this.happiness = 1;
    }

    /** CURIOUS: Head tilts sideways, one ear perks, slow tail wag */
    private animateCurious(deltaTime: number): void {
        // One ear up, one relaxed — curious asymmetry
        if (this.bones.leftEar) {
            const data = this.boneData.get('leftEar');
            if (data) {
                this.bones.leftEar.rotation.x = THREE.MathUtils.lerp(
                    this.bones.leftEar.rotation.x,
                    data.baseRotation.x - 0.5,
                    0.08
                );
            }
        }
        if (this.bones.rightEar) {
            const data = this.boneData.get('rightEar');
            if (data) {
                this.bones.rightEar.rotation.x = THREE.MathUtils.lerp(
                    this.bones.rightEar.rotation.x,
                    data.baseRotation.x + 0.15,
                    0.08
                );
            }
        }

        // Head tilts to one side
        if (this.bones.head || this.bones.pilotHead) {
            const head = this.bones.head || this.bones.pilotHead!;
            const data = this.boneData.get('head') || this.boneData.get('pilotHead');
            if (data) {
                head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, data.baseRotation.z + 0.35, 0.08);
                head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, data.baseRotation.x - 0.1, 0.08);
            }
        }

        // Slow, thoughtful tail wag
        this.wagTail(2.5, 0.2);
        this.happiness = Math.min(1, this.happiness + deltaTime * 0.3);
    }

    /** DELIGHTED: Tail frenzy, head bobs forward, bright happy energy */
    private animateDelighted(deltaTime: number): void {
        // Fast joyful tail wag (faster than collect, softer than power_up)
        this.wagTail(14, 0.45);

        // Both ears perked forward
        this.perkEars(0.7);

        // Happy bouncy head
        const bobTime = this.time * 9;
        if (this.bones.head || this.bones.pilotHead) {
            const head = this.bones.head || this.bones.pilotHead!;
            const data = this.boneData.get('head') || this.boneData.get('pilotHead');
            if (data) {
                head.position.y = data.basePosition.y + Math.abs(Math.sin(bobTime)) * 0.06;
                head.rotation.z = Math.sin(bobTime * 0.5) * 0.08;
            }
        }

        // Gentle body wiggle
        if (this.bones.body || this.bones.pilotGroup) {
            const body = this.bones.body || this.bones.pilotGroup!;
            const data = this.boneData.get('body') || this.boneData.get('pilotGroup');
            if (data) {
                body.rotation.z = Math.sin(this.time * 7) * 0.05;
            }
        }

        // Occasional happy sparkle
        if (Math.random() < 0.2) {
            this.spawnHappyParticles();
        }

        this.excitement = Math.min(1, this.excitement + deltaTime * 1.5);
        this.happiness = 1;
    }
    
    /** Return to idle state */
    private returnToIdle(): void {
        this.currentState = DogAnimationState.IDLE;
        this.stateTimer = 0;
        this.stateDuration = 0;
        this.raisePaws(false);
    }
    
    /** Update blinking animation */
    private updateBlink(deltaTime: number): void {
        this.blinkTimer -= deltaTime;
        
        if (this.blinkTimer <= 0 && !this.isBlinking) {
            // Start blink
            this.isBlinking = true;
            this.blinkTimer = 0.15; // Blink duration
        } else if (this.blinkTimer <= 0 && this.isBlinking) {
            // End blink, schedule next
            this.isBlinking = false;
            this.blinkTimer = 2 + Math.random() * 4; // Next blink in 2-6 seconds
        }
        
        // Apply blink (scale eyes on Y)
        // This would require eye meshes to be found and animated
    }
    
    /** Update head looking at target */
    private updateHeadLook(deltaTime: number): void {
        if (!this.bones.head && !this.bones.pilotHead) return;
        
        const head = this.bones.head || this.bones.pilotHead!;
        const data = this.boneData.get('head') || this.boneData.get('pilotHead');
        if (!data) return;
        
        // Convert screen position to look angles
        const targetYaw = (this.lookTargetScreen.x - 0.5) * this.lookIntensity;
        const targetPitch = (this.lookTargetScreen.y - 0.5) * this.lookIntensity * 0.5;
        
        // Smoothly interpolate
        const lerpFactor = 3 * deltaTime;
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, data.baseRotation.y + targetYaw, lerpFactor);
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, data.baseRotation.x + targetPitch, lerpFactor);
    }
    
    /** Update particle effects */
    private updateParticles(deltaTime: number): void {
        this.happyParticles = this.happyParticles.filter(p => p.update(deltaTime));
    }
    
    /** Update accessory animations */
    private updateAccessories(deltaTime: number): void {
        this.accessories.forEach((mesh, type) => {
            // Animate based on accessory type
            switch (type) {
                case DogAccessory.CAPE:
                    // Cape flows behind
                    mesh.rotation.z = Math.sin(this.time * 3) * 0.1 - this.excitement * 0.3;
                    break;
                case DogAccessory.TUTU:
                    // Tutu bounces
                    mesh.position.y = Math.sin(this.time * 4) * 0.01;
                    break;
                case DogAccessory.BOW:
                    // Bow wiggles when happy
                    if (this.happiness > 0.7) {
                        mesh.rotation.z = Math.sin(this.time * 10) * 0.1;
                    }
                    break;
            }
        });
    }
    
    /** Update base animations (breathing, etc) */
    private updateBaseAnimations(deltaTime: number): void {
        // Reset bone rotations smoothly when not in special states
        if (this.currentState === DogAnimationState.IDLE) {
            // Smoothly return to base transforms
            this.boneData.forEach((data, name) => {
                const bone = (this.bones as any)[name];
                if (bone) {
                    bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, data.baseRotation.x, 2 * deltaTime);
                    bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, data.baseRotation.y, 2 * deltaTime);
                    bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, data.baseRotation.z, 2 * deltaTime);
                    bone.position.lerp(data.basePosition, 2 * deltaTime);
                }
            });
        }
    }
    
    /** Set the look target from screen coordinates */
    setLookTarget(screenX: number, screenY: number): void {
        if (typeof window !== 'undefined') {
            this.lookTargetScreen.x = screenX / window.innerWidth;
            this.lookTargetScreen.y = screenY / window.innerHeight;
        }
    }
    
    /**
     * Trigger an animation state
     * @param state The animation state to trigger
     * @param duration Duration in seconds (0 for indefinite)
     */
    triggerAnimation(state: DogAnimationState, duration: number = 0): void {
        this.currentState = state;
        this.stateTimer = 0;
        this.stateDuration = duration;
        
        // Call callback if set
        if (this.onAnimationTrigger) {
            this.onAnimationTrigger(state);
        }
        
        // Special effects for certain states
        switch (state) {
            case DogAnimationState.COLLECT:
                this.perkEars(0.7);
                break;
            case DogAnimationState.POWER_UP:
                this.spawnHappyParticles();
                break;
            case DogAnimationState.HIT:
                this.worry = 1;
                break;
            case DogAnimationState.VICTORY:
                // Spawn extra particles
                for (let i = 0; i < 5; i++) {
                    setTimeout(() => this.spawnHappyParticles(), i * 100);
                }
                break;
            case DogAnimationState.CURIOUS:
                // Tilt head immediately
                this.tiltHead(0.35);
                break;
            case DogAnimationState.DELIGHTED:
                // Perk ears and spawn initial burst of sparkles
                this.perkEars(0.8);
                this.spawnHappyParticles();
                break;
        }
    }
    
    /** Get current animation state */
    getCurrentState(): DogAnimationState {
        return this.currentState;
    }
    
    /** 
     * Procedural tail wag animation
     * @param speed Wag speed in wag cycles per second
     * @param intensity Wag amplitude in radians
     */
    wagTail(speed: number, intensity: number): void {
        this.tailWagSpeed = speed;
        this.tailWagIntensity = intensity;
        
        const wagTime = this.time * speed;
        
        if (this.bones.tail) {
            const data = this.boneData.get('tail');
            if (data) {
                this.bones.tail.rotation.y = data.baseRotation.y + Math.sin(wagTime) * intensity;
                this.bones.tail.rotation.z = data.baseRotation.z + Math.cos(wagTime * 0.7) * intensity * 0.3;
            }
        }
        
        // Tail tip wags faster for more natural look
        if (this.bones.tailTip) {
            const tipData = this.boneData.get('tailTip');
            if (tipData) {
                this.bones.tailTip.rotation.y = tipData.baseRotation.y + Math.sin(wagTime * 1.5) * intensity * 1.5;
            }
        }
    }
    
    /**
     * Perk or droop ears
     * @param amount -1 (fully drooped) to 1 (fully perked)
     */
    perkEars(amount: number): void {
        this.earPerkAmount = THREE.MathUtils.clamp(amount, -1, 1);
        
        const earRotation = this.earPerkAmount * 0.5;
        
        if (this.bones.leftEar || this.bones.earLeft) {
            const ear = this.bones.leftEar || this.bones.earLeft!;
            const data = this.boneData.get('leftEar') || this.boneData.get('earLeft');
            if (data) {
                ear.rotation.z = data.baseRotation.z + earRotation;
            }
        }
        
        if (this.bones.rightEar || this.bones.earRight) {
            const ear = this.bones.rightEar || this.bones.earRight!;
            const data = this.boneData.get('rightEar') || this.boneData.get('earRight');
            if (data) {
                ear.rotation.z = data.baseRotation.z - earRotation;
            }
        }
    }
    
    /**
     * Tilt head curiously
     * @param angle Tilt angle in radians (positive = right, negative = left)
     */
    tiltHead(angle: number): void {
        this.headTiltAngle = angle;
        
        if (this.bones.head || this.bones.pilotHead) {
            const head = this.bones.head || this.bones.pilotHead!;
            const data = this.boneData.get('head') || this.boneData.get('pilotHead');
            if (data) {
                head.rotation.z = data.baseRotation.z + angle;
            }
        }
    }
    
    /**
     * Bounce body in reaction to movement
     * @param amount Bounce amount (0-1)
     */
    bounceBody(amount: number): void {
        this.bounceAmount = amount;
        
        if (this.bones.body || this.bones.pilotGroup) {
            const body = this.bones.body || this.bones.pilotGroup!;
            const data = this.boneData.get('body') || this.boneData.get('pilotGroup');
            if (data) {
                const bounce = Math.sin(this.time * 10) * amount * 0.1;
                body.position.y = data.basePosition.y + bounce;
            }
        }
    }
    
    /** Twitch ears (random quick movement) */
    private twitchEars(deltaTime: number): void {
        const twitchSpeed = 30;
        const twitchAmount = Math.sin(this.time * twitchSpeed) * 0.1;
        
        if (this.bones.leftEar || this.bones.earLeft) {
            const ear = this.bones.leftEar || this.bones.earLeft!;
            ear.rotation.x += twitchAmount * deltaTime;
        }
    }
    
    /** Raise or lower paws */
    private raisePaws(raise: boolean): void {
        const targetRotation = raise ? -0.5 : 0;
        
        if (this.bones.leftFrontPaw) {
            const data = this.boneData.get('leftFrontPaw');
            if (data) {
                this.bones.leftFrontPaw.rotation.x = data.baseRotation.x + targetRotation;
            }
        }
        
        if (this.bones.rightFrontPaw) {
            const data = this.boneData.get('rightFrontPaw');
            if (data) {
                this.bones.rightFrontPaw.rotation.x = data.baseRotation.x + targetRotation;
            }
        }
    }
    
    /** Nose "boop" animation */
    private boopNose(): void {
        if (!this.bones.nose) return;
        
        // Quick scale pulse on nose
        const originalScale = this.bones.nose.scale.clone();
        this.bones.nose.scale.multiplyScalar(1.3);
        
        // Animate back
        const animate = () => {
            if (this.bones.nose) {
                this.bones.nose.scale.lerp(originalScale, 0.2);
                if (this.bones.nose.scale.distanceTo(originalScale) > 0.01) {
                    requestAnimationFrame(animate);
                }
            }
        };
        animate();
    }
    
    /** Spawn happy particles around the dog */
    private spawnHappyParticles(): void {
        if (!this.scene || !this.accessoryGroup) return;
        
        const position = new THREE.Vector3();
        this.accessoryGroup.getWorldPosition(position);
        position.y += 0.5;
        
        for (let i = 0; i < 3; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                0,
                (Math.random() - 0.5) * 0.5
            );
            this.happyParticles.push(new HappyParticle(this.scene, position.clone().add(offset)));
        }
    }
    
    // ============================================================================
    // ACCESSORY SYSTEM
    // ============================================================================
    
    /**
     * Create and equip an accessory
     * @param type The accessory type
     * @returns The created mesh
     */
    createAccessory(type: DogAccessory): THREE.Object3D | null {
        if (this.accessories.has(type)) {
            return this.accessories.get(type)!;
        }
        
        let mesh: THREE.Object3D | null = null;
        
        switch (type) {
            case DogAccessory.TUTU:
                mesh = this.createTutu();
                break;
            case DogAccessory.CAPE:
                mesh = this.createCape();
                break;
            case DogAccessory.BOW:
                mesh = this.createBow();
                break;
            case DogAccessory.GLASSES:
                mesh = this.createGlasses();
                break;
            case DogAccessory.CROWN:
                mesh = this.createCrown();
                break;
        }
        
        if (mesh && this.accessoryGroup) {
            this.accessoryGroup.add(mesh);
            this.accessories.set(type, mesh);
            mesh.visible = false; // Hidden by default
        }
        
        return mesh;
    }
    
    /** Create a tiny tutu */
    private createTutu(): THREE.Mesh {
        const geometry = new THREE.CylinderGeometry(0.35, 0.4, 0.15, 16, 1, true);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff69b4, // Hot pink
            emissive: 0xff1493,
            emissiveIntensity: 0.2,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        const tutu = new THREE.Mesh(geometry, material);
        tutu.name = 'tutu';
        tutu.position.set(0, -0.2, 0);
        
        // Add some sparkles (small spheres around the tutu)
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const sparkle = new THREE.Mesh(
                new THREE.SphereGeometry(0.03, 4, 4),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            sparkle.position.set(Math.cos(angle) * 0.38, 0, Math.sin(angle) * 0.38);
            tutu.add(sparkle);
        }
        
        return tutu;
    }
    
    /** Create a superhero cape */
    private createCape(): THREE.Mesh {
        // Create a curved cape using a plane with segments
        const geometry = new THREE.PlaneGeometry(0.6, 0.8, 4, 6);
        const material = new THREE.MeshStandardMaterial({
            color: 0x4444ff, // Blue
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
        });
        
        // Curve the cape
        const positions = geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            // Curve outward
            positions[i + 2] = Math.abs(x) * 0.3 - (y + 0.4) * 0.2;
        }
        geometry.computeVertexNormals();
        
        const cape = new THREE.Mesh(geometry, material);
        cape.name = 'cape';
        cape.position.set(0, 0, -0.25);
        cape.rotation.x = 0.2;
        
        // Add red interior
        const interior = cape.clone();
        interior.material = new THREE.MeshStandardMaterial({
            color: 0xff4444,
            side: THREE.DoubleSide
        });
        interior.scale.set(0.95, 0.95, 0.95);
        cape.add(interior);
        
        return cape;
    }
    
    /** Create a cute bow */
    private createBow(): THREE.Group {
        const group = new THREE.Group();
        group.name = 'bow';
        
        const material = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0x880000,
            emissiveIntensity: 0.3
        });
        
        // Left loop
        const leftLoop = new THREE.Mesh(
            new THREE.TorusGeometry(0.08, 0.03, 8, 16, Math.PI * 1.5),
            material
        );
        leftLoop.position.set(-0.08, 0, 0);
        leftLoop.rotation.z = Math.PI / 4;
        group.add(leftLoop);
        
        // Right loop
        const rightLoop = new THREE.Mesh(
            new THREE.TorusGeometry(0.08, 0.03, 8, 16, Math.PI * 1.5),
            material
        );
        rightLoop.position.set(0.08, 0, 0);
        rightLoop.rotation.z = -Math.PI / 4 - Math.PI / 2;
        group.add(rightLoop);
        
        // Center knot
        const knot = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 8, 8),
            material
        );
        group.add(knot);
        
        // Position on head
        group.position.set(0, 0.3, 0.15);
        
        return group;
    }
    
    /** Create cool glasses */
    private createGlasses(): THREE.Group {
        const group = new THREE.Group();
        group.name = 'glasses';
        
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const lensMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x00ffff,
            metalness: 0.9,
            roughness: 0.1,
            transmission: 0.3,
            transparent: true,
            opacity: 0.7
        });
        
        // Left frame
        const leftFrame = new THREE.Mesh(
            new THREE.TorusGeometry(0.06, 0.01, 8, 16),
            frameMaterial
        );
        leftFrame.position.set(-0.08, 0, 0);
        group.add(leftFrame);
        
        // Right frame
        const rightFrame = new THREE.Mesh(
            new THREE.TorusGeometry(0.06, 0.01, 8, 16),
            frameMaterial
        );
        rightFrame.position.set(0.08, 0, 0);
        group.add(rightFrame);
        
        // Bridge
        const bridge = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.01, 0.01),
            frameMaterial
        );
        group.add(bridge);
        
        // Lenses
        const leftLens = new THREE.Mesh(
            new THREE.CircleGeometry(0.055, 16),
            lensMaterial
        );
        leftLens.position.set(-0.08, 0, 0.005);
        group.add(leftLens);
        
        const rightLens = new THREE.Mesh(
            new THREE.CircleGeometry(0.055, 16),
            lensMaterial
        );
        rightLens.position.set(0.08, 0, 0.005);
        group.add(rightLens);
        
        // Position on face
        group.position.set(0, 0.05, 0.18);
        
        return group;
    }
    
    /** Create a sparkly crown */
    private createCrown(): THREE.Group {
        const group = new THREE.Group();
        group.name = 'crown';
        
        const goldMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 1,
            roughness: 0.2,
            emissive: 0xffaa00,
            emissiveIntensity: 0.2
        });
        
        // Base ring
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12),
            goldMaterial
        );
        group.add(base);
        
        // Points
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const pointHeight = i === 0 ? 0.12 : 0.08; // Middle point is tallest
            
            const point = new THREE.Mesh(
                new THREE.ConeGeometry(0.02, pointHeight, 6),
                goldMaterial
            );
            point.position.set(
                Math.cos(angle) * 0.1,
                pointHeight / 2,
                Math.sin(angle) * 0.1
            );
            group.add(point);
            
            // Gem on top
            const gem = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.025),
                new THREE.MeshStandardMaterial({
                    color: 0xff0066,
                    emissive: 0xff0066,
                    emissiveIntensity: 0.5,
                    metalness: 1,
                    roughness: 0.1
                })
            );
            gem.position.set(
                Math.cos(angle) * 0.1,
                pointHeight + 0.02,
                Math.sin(angle) * 0.1
            );
            group.add(gem);
        }
        
        // Position on head
        group.position.set(0, 0.35, 0);
        
        return group;
    }
    
    /** Equip an accessory (make it visible) */
    equipAccessory(type: DogAccessory): void {
        this.createAccessory(type);
        const mesh = this.accessories.get(type);
        if (mesh) {
            mesh.visible = true;
            this.equippedAccessories.add(type);
            
            // Entry animation
            mesh.scale.setScalar(0);
            const animate = () => {
                mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.15);
                if (mesh.scale.x < 0.99) {
                    requestAnimationFrame(animate);
                }
            };
            animate();
        }
    }
    
    /** Unequip an accessory */
    unequipAccessory(type: DogAccessory): void {
        const mesh = this.accessories.get(type);
        if (mesh) {
            mesh.visible = false;
            this.equippedAccessories.delete(type);
        }
    }
    
    /** Check if an accessory is equipped */
    isAccessoryEquipped(type: DogAccessory): boolean {
        return this.equippedAccessories.has(type);
    }
    
    /** Get all equipped accessories */
    getEquippedAccessories(): DogAccessory[] {
        return Array.from(this.equippedAccessories);
    }
    
    /** Toggle an accessory on/off */
    toggleAccessory(type: DogAccessory): boolean {
        if (this.isAccessoryEquipped(type)) {
            this.unequipAccessory(type);
            return false;
        } else {
            this.equipAccessory(type);
            return true;
        }
    }
    
    // ============================================================================
    // DEBUG / UTILITY
    // ============================================================================
    
    /** Log the status of all bones (for debugging) */
    private logBoneStatus(): void {
        const boneNames = Object.keys(this.bones);
        const found = boneNames.filter(name => (this.bones as any)[name]);
        const missing = boneNames.filter(name => !(this.bones as any)[name]);
        
        console.log('🦴 Bones found:', found.join(', ') || 'None');
        if (missing.length > 0) {
            console.log('🦴 Bones missing:', missing.join(', '));
        }
    }
    
    /** Set a callback for animation triggers */
    onAnimation(callback: (state: DogAnimationState) => void): void {
        this.onAnimationTrigger = callback;
    }
    
    /** Get happiness level (0-1) */
    getHappiness(): number {
        return this.happiness;
    }
    
    /** Get excitement level (0-1) */
    getExcitement(): number {
        return this.excitement;
    }
    
    /** Force reset all animations to base pose */
    resetPose(): void {
        this.boneData.forEach((data, name) => {
            const bone = (this.bones as any)[name];
            if (bone) {
                bone.position.copy(data.basePosition);
                bone.rotation.copy(data.baseRotation);
                bone.scale.copy(data.baseScale);
            }
        });
    }
    
    /** Clean up resources */
    dispose(): void {
        // Remove particles
        this.happyParticles.forEach(p => {
            p.mesh.parent?.remove(p.mesh);
            p.mesh.geometry.dispose();
            (p.mesh.material as THREE.Material).dispose();
        });
        this.happyParticles = [];
        
        // Dispose accessory meshes
        this.accessories.forEach(mesh => {
            mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
        this.accessories.clear();
    }
}

// ============================================================================
// ACCESSORY UNLOCK CONFIGURATION
// ============================================================================

/** Configuration for unlocking accessories via save manager progression */
export const ACCESSORY_UNLOCKS: { [key: string]: AccessoryUnlock } = {
    tutu: {
        type: DogAccessory.TUTU,
        name: 'Sparkle Tutu',
        description: 'A magical pink tutu for the brave space pup!',
        cost: 50
    },
    cape: {
        type: DogAccessory.CAPE,
        name: 'Hero Cape',
        description: 'A heroic cape for the galaxy protector!',
        cost: 100,
        requirement: () => {
            // Require defeating first boss
            const saveManager = (window as any).saveManager;
            return saveManager?.getStats().bossesDefeated >= 1;
        }
    },
    bow: {
        type: DogAccessory.BOW,
        name: 'Cute Bow',
        description: 'A cute red bow for your space adventurer!',
        cost: 25
    },
    glasses: {
        type: DogAccessory.GLASSES,
        name: 'Cool Shades',
        description: 'Stylish glasses for the coolest dog in space!',
        cost: 75,
        requirement: () => {
            // Require collecting 100 cores total
            const saveManager = (window as any).saveManager;
            return saveManager?.getStats().totalCoresCollected >= 100;
        }
    },
    crown: {
        type: DogAccessory.CROWN,
        name: 'Royal Crown',
        description: 'A golden crown fit for the queen of the galaxy!',
        cost: 200,
        requirement: () => {
            // Require completing all levels
            const saveManager = (window as any).saveManager;
            return saveManager?.getStats().runsCompleted >= 1;
        }
    }
};

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Helper to integrate with the game save manager
 * Unlocks accessories based on progression
 */
export function checkAccessoryUnlocks(saveManager: any): DogAccessory[] {
    const unlocked: DogAccessory[] = [];
    
    Object.values(ACCESSORY_UNLOCKS).forEach(unlock => {
        if (!unlock.requirement || unlock.requirement()) {
            unlocked.push(unlock.type);
        }
    });
    
    return unlocked;
}

/**
 * Create the integration with main.ts
 * Usage example showing how to hook into the game loop
 */
export function createDogCockpitIntegration(
    dogController: DogCockpitController,
    player: THREE.Group,
    playerState: any,
    keys: { jump: boolean; [key: string]: boolean }
) {
    return {
        /**
         * Call this after the rocket GLB is loaded
         */
        initialize: () => {
            const rocketRoot = player.children[0];
            if (rocketRoot) {
                dogController.initialize(rocketRoot as THREE.Group);
                
                // Equip any previously unlocked accessories
                const unlocked = checkAccessoryUnlocks((window as any).saveManager);
                unlocked.forEach(acc => dogController.createAccessory(acc));
            }
        },
        
        /**
         * Call this in the game loop update
         */
        update: (deltaTime: number) => {
            // Check for thrust state
            if (keys.jump) {
                dogController.triggerAnimation(DogAnimationState.THRUST);
            }
            
            // Update the controller
            dogController.update(deltaTime, playerState);
        },
        
        /**
         * Call this when collecting an item
         */
        onCollect: (itemType?: string) => {
            dogController.triggerAnimation(DogAnimationState.COLLECT, 0.5);
        },
        
        /**
         * Call this when activating a power-up
         */
        onPowerUp: (powerUpType?: string) => {
            dogController.triggerAnimation(DogAnimationState.POWER_UP, 2.0);
        },
        
        /**
         * Call this when taking damage
         */
        onHit: () => {
            dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
        },
        
        /**
         * Call this when winning the game
         */
        onVictory: () => {
            dogController.triggerAnimation(DogAnimationState.VICTORY, 5.0);
        },
        
        /**
         * Toggle an accessory on/off
         */
        toggleAccessory: (type: DogAccessory) => {
            return dogController.toggleAccessory(type);
        }
    };
}

export default DogCockpitController;
