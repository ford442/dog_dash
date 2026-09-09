import * as THREE from 'three';
import { decorationBudget } from '../decoration_budget';
import { DogAnimationState, DogAccessory, DogBones, BoneAnimationData, DogAnimationHost } from './types';
import { HappyParticle } from './happy_particle';
import { createTutu, createCape, createBow, createGlasses, createCrown } from './accessory_meshes';
import * as animationStates from './animation_states';
import { wagTail as applyWagTail, perkEars as applyPerkEars, tiltHead as applyTiltHead, bounceBody as applyBounceBody } from './dog_motion';
import { twitchEars as applyTwitchEars, raisePaws as applyRaisePaws, boopNose as applyBoopNose, spawnHappyParticles as applySpawnHappyParticles } from './animation_helpers';
import { createProceduralDog, placeProceduralDogOnRocket, EXPECTED_DOG_BONE_SLOTS } from './procedural_dog';

const BONE_PATTERNS: Record<string, string[]> = {
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
    private proceduralGroup?: THREE.Group;
    private usedProceduralFallback = false;
    
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
        if (!this.hasUsableRig()) {
            this.attachProceduralDog(rocketMesh);
        }
        this.storeBaseTransforms();
        this.createAccessoryGroup();
        this.setupEyes();
        
        this.scene = rocketMesh.parent?.parent?.parent as THREE.Scene;
        this.initialized = true;
        
        console.log('✅ Dog Cockpit Controller initialized!');
        this.logBoneStatus();
    }

    private hasUsableRig(): boolean {
        return !!(this.bones.body || this.bones.head || this.bones.pilotGroup);
    }

    private attachProceduralDog(rocketMesh: THREE.Group): void {
        const { group, bones } = createProceduralDog();
        placeProceduralDogOnRocket(group, rocketMesh);
        rocketMesh.add(group);
        this.proceduralGroup = group;
        this.usedProceduralFallback = true;
        this.bones = { ...this.bones, ...bones };
        decorationBudget.reportSpawn('dog_cockpit');
        console.log('🐕 No GLB armature — using procedural cockpit dog');
    }
    
    /** Find all dog bones in the rocket mesh */
    private findBones(rocketMesh: THREE.Group): void {
        rocketMesh.traverse((child) => {
            this.bindNamedNode(child);
            if (child instanceof THREE.SkinnedMesh && child.skeleton) {
                for (const bone of child.skeleton.bones) {
                    this.bindNamedNode(bone);
                }
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

    private bindNamedNode(child: THREE.Object3D): void {
        const name = child.name;
        if (!name) return;

        for (const [boneName, patterns] of Object.entries(BONE_PATTERNS)) {
            if (patterns.some(pattern => name === pattern || name.includes(pattern))) {
                (this.bones as Record<string, THREE.Object3D>)[boneName] = child;
            }
        }

        if (name === 'pilotGroup' || name === 'PilotGroup') {
            this.bones.pilotGroup = child;
        }
        if (name === 'pilotHead') {
            this.bones.pilotHead = child;
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
    
    private get animHost(): DogAnimationHost {
        return this as unknown as DogAnimationHost;
    }

    /** Update animations based on current state */
    private updateStateAnimations(deltaTime: number, gameState?: any): void {
        switch (this.currentState) {
            case DogAnimationState.IDLE:
                animationStates.animateIdle(this.animHost, deltaTime);
                break;
            case DogAnimationState.THRUST:
                animationStates.animateThrust(this.animHost, deltaTime, gameState);
                break;
            case DogAnimationState.COLLECT:
                animationStates.animateCollect(this.animHost, deltaTime);
                break;
            case DogAnimationState.POWER_UP:
                animationStates.animatePowerUp(this.animHost, deltaTime);
                break;
            case DogAnimationState.HIT:
                animationStates.animateHit(this.animHost, deltaTime);
                break;
            case DogAnimationState.VICTORY:
                animationStates.animateVictory(this.animHost, deltaTime);
                break;
            case DogAnimationState.CURIOUS:
                animationStates.animateCurious(this.animHost, deltaTime);
                break;
            case DogAnimationState.DELIGHTED:
                animationStates.animateDelighted(this.animHost, deltaTime);
                break;
            case DogAnimationState.BARK:
                animationStates.animateBark(this.animHost, deltaTime);
                break;
        }
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
            case DogAnimationState.BARK:
                this.perkEars(1.0);
                this.raisePaws(true);
                break;
        }
    }
    
    /** Get current animation state */
    getCurrentState(): DogAnimationState {
        return this.currentState;
    }

    /** Procedural tail wag animation */
    wagTail(speed: number, intensity: number): void {
        applyWagTail(this.animHost, speed, intensity);
    }

    /** Perk or droop ears */
    perkEars(amount: number): void {
        applyPerkEars(this.animHost, amount);
    }

    /** Tilt head curiously */
    tiltHead(angle: number): void {
        applyTiltHead(this.animHost, angle);
    }

    /** Bounce body in reaction to movement */
    bounceBody(amount: number): void {
        applyBounceBody(this.animHost, amount);
    }

    private twitchEars(deltaTime: number): void {
        applyTwitchEars(this.animHost, deltaTime);
    }

    private raisePaws(raise: boolean): void {
        applyRaisePaws(this.animHost, raise);
    }

    private boopNose(): void {
        applyBoopNose(this.animHost);
    }

    private spawnHappyParticles(): void {
        applySpawnHappyParticles(this.animHost);
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
                mesh = createTutu();
                break;
            case DogAccessory.CAPE:
                mesh = createCape();
                break;
            case DogAccessory.BOW:
                mesh = createBow();
                break;
            case DogAccessory.GLASSES:
                mesh = createGlasses();
                break;
            case DogAccessory.CROWN:
                mesh = createCrown();
                break;
        }

        if (mesh && this.accessoryGroup) {
            this.accessoryGroup.add(mesh);
            this.accessories.set(type, mesh);
            mesh.visible = false; // Hidden by default
        }

        return mesh;
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
        const found = EXPECTED_DOG_BONE_SLOTS.filter(name => this.bones[name]);
        const missing = EXPECTED_DOG_BONE_SLOTS.filter(name => !this.bones[name]);
        const suffix = this.usedProceduralFallback ? ' (procedural fallback)' : '';
        
        console.log('🦴 Bones found:', (found.join(', ') || 'None') + suffix);
        if (this.usedProceduralFallback && found.length > 0) {
            console.log('🦴 Source: procedural fallback (GLB had no armature)');
        }
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

        if (this.proceduralGroup) {
            const materials = new Set<THREE.Material>();
            this.proceduralGroup.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => materials.add(m));
                    } else {
                        materials.add(child.material);
                    }
                }
            });
            materials.forEach(m => m.dispose());
            this.proceduralGroup.parent?.remove(this.proceduralGroup);
            this.proceduralGroup = undefined;
            decorationBudget.reportDestroy('dog_cockpit');
        }
    }
}
