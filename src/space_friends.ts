/**
 * Space Friends - Adorable friendly entities for Dog Dash
 * Magical space companions for a 7-year-old girl
 * 🐱 Space Kitty - Astronaut kitten in bubble helmet
 * 🐰 Space Bunny - Fluffy bunny in rocket pack
 * 🏮 Wish Lantern - Floating pink paper lantern
 */

import * as THREE from 'three';
import { AudioSystem } from './audio_system';
import { ParticleSystem } from './particles';

// =============================================================================
// INTERACTION RESULT TYPE
// =============================================================================

export interface InteractionResult {
    type: 'kitty_wave' | 'bunny_heal' | 'lantern_pop' | 'tarsier_cheer' | 'tarsier_panic';
    position: THREE.Vector3;
    bonus?: number;
    healthRestore?: number;
}

// =============================================================================
// SPACE KITTY - Tiny astronaut kitten in bubble helmet
// =============================================================================

export class SpaceKitty {
    group: THREE.Group;
    position: THREE.Vector3;
    baseY: number;
    
    // Animation state
    time: number = 0;
    waveTimer: number = 0;
    isWaving: boolean = false;
    hasWavedAtPlayer: boolean = false;
    collected: boolean = false;
    
    // Parts for animation
    private paw: THREE.Mesh | null = null;
    private head: THREE.Group | null = null;
    private tail: THREE.Mesh | null = null;
    private sparkles: THREE.Points | null = null;
    
    // Constants
    readonly INTERACTION_DISTANCE = 8;
    readonly WAVE_DURATION = 1.5;
    readonly FLOAT_AMPLITUDE = 0.5;
    readonly FLOAT_SPEED = 1.5;
    
    constructor(scene: THREE.Scene, x: number, y: number) {
        this.position = new THREE.Vector3(x, y, 0);
        this.baseY = y;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        this.createMesh();
        scene.add(this.group);
    }
    
    private createMesh() {
        const kittyGroup = new THREE.Group();
        
        // --- Body (Soft white sphere) ---
        const bodyGeo = new THREE.SphereGeometry(0.4, 16, 16);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xfff0f5, // Lavender blush white
            roughness: 0.8,
            metalness: 0.1
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.scale.set(1, 0.9, 0.8);
        kittyGroup.add(body);
        
        // --- Bubble Helmet ---
        const helmetGeo = new THREE.SphereGeometry(0.7, 24, 24);
        const helmetMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25,
            roughness: 0.05,
            metalness: 0.1,
            transmission: 0.9,
            thickness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });
        const helmet = new THREE.Mesh(helmetGeo, helmetMat);
        helmet.position.y = 0.3;
        kittyGroup.add(helmet);
        
        // Helmet rim
        const rimGeo = new THREE.TorusGeometry(0.7, 0.05, 8, 24);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0xffc0cb, // Pink
            roughness: 0.3,
            metalness: 0.6
        });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.position.y = 0.3;
        rim.rotation.x = Math.PI / 2;
        kittyGroup.add(rim);
        
        // --- Head (inside helmet) ---
        const headGroup = new THREE.Group();
        headGroup.position.y = 0.35;
        
        const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xfff0f5,
            roughness: 0.8
        });
        const head = new THREE.Mesh(headGeo, headMat);
        headGroup.add(head);
        
        // Ears (tiny triangles)
        const earGeo = new THREE.ConeGeometry(0.12, 0.25, 8);
        const earMat = new THREE.MeshStandardMaterial({
            color: 0xffb6c1, // Light pink
            roughness: 0.8
        });
        
        const leftEar = new THREE.Mesh(earGeo, earMat);
        leftEar.position.set(-0.18, 0.35, 0);
        leftEar.rotation.z = 0.3;
        headGroup.add(leftEar);
        
        const rightEar = new THREE.Mesh(earGeo, earMat);
        rightEar.position.set(0.18, 0.35, 0);
        rightEar.rotation.z = -0.3;
        headGroup.add(rightEar);
        
        // Inner ears (darker pink)
        const innerEarGeo = new THREE.ConeGeometry(0.06, 0.15, 8);
        const innerEarMat = new THREE.MeshStandardMaterial({
            color: 0xff69b4, // Hot pink
            roughness: 0.9
        });
        
        const leftInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
        leftInnerEar.position.set(-0.18, 0.35, 0.05);
        leftInnerEar.rotation.z = 0.3;
        headGroup.add(leftInnerEar);
        
        const rightInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
        rightInnerEar.position.set(0.18, 0.35, 0.05);
        rightInnerEar.rotation.z = -0.3;
        headGroup.add(rightInnerEar);
        
        // Eyes (big and sparkly)
        const eyeGeo = new THREE.SphereGeometry(0.08, 12, 12);
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0x3366ff, // Bright blue
            roughness: 0.2,
            metalness: 0.3
        });
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.12, 0.05, 0.28);
        headGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.12, 0.05, 0.28);
        headGroup.add(rightEye);
        
        // Eye shine (tiny white dots)
        const shineGeo = new THREE.SphereGeometry(0.03, 8, 8);
        const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const leftShine = new THREE.Mesh(shineGeo, shineMat);
        leftShine.position.set(-0.1, 0.08, 0.34);
        headGroup.add(leftShine);
        
        const rightShine = new THREE.Mesh(shineGeo, shineMat);
        rightShine.position.set(0.14, 0.08, 0.34);
        headGroup.add(rightShine);
        
        // Nose (tiny pink triangle)
        const noseGeo = new THREE.ConeGeometry(0.04, 0.05, 6);
        const noseMat = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, -0.05, 0.32);
        nose.rotation.x = Math.PI / 2;
        headGroup.add(nose);
        
        kittyGroup.add(headGroup);
        this.head = headGroup;
        
        // --- Paws (for waving) ---
        const pawGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const pawMat = new THREE.MeshStandardMaterial({
            color: 0xfff0f5,
            roughness: 0.8
        });
        
        // Left paw (waving paw)
        const leftPaw = new THREE.Mesh(pawGeo, pawMat);
        leftPaw.position.set(-0.35, -0.1, 0.2);
        leftPaw.scale.set(1, 1.2, 0.8);
        kittyGroup.add(leftPaw);
        this.paw = leftPaw;
        
        // Right paw
        const rightPaw = new THREE.Mesh(pawGeo, pawMat);
        rightPaw.position.set(0.35, -0.2, 0.15);
        rightPaw.scale.set(1, 1.2, 0.8);
        kittyGroup.add(rightPaw);
        
        // --- Tail (curled) ---
        const tailGeo = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(0, -0.2, -0.3),
                new THREE.Vector3(0, 0.1, -0.5),
                new THREE.Vector3(0, 0.3, -0.4),
                new THREE.Vector3(0, 0.25, -0.2)
            ]),
            8, 0.08, 8, false
        );
        const tailMat = new THREE.MeshStandardMaterial({
            color: 0xfff0f5,
            roughness: 0.8
        });
        const tail = new THREE.Mesh(tailGeo, tailMat);
        kittyGroup.add(tail);
        this.tail = tail;
        
        // --- Sparkle Particles (around helmet) ---
        const sparkleCount = 12;
        const sparkleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(sparkleCount * 3);
        
        for (let i = 0; i < sparkleCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const r = 0.8 + Math.random() * 0.3;
            
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + 0.3;
            positions[i * 3 + 2] = r * Math.cos(phi);
        }
        
        sparkleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const sparkleMat = new THREE.PointsMaterial({
            color: 0xffd700, // Gold sparkles
            size: 0.08,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.sparkles = new THREE.Points(sparkleGeo, sparkleMat);
        kittyGroup.add(this.sparkles);
        
        // --- Soft Point Light ---
        const light = new THREE.PointLight(0xffc0cb, 0.5, 5);
        light.position.set(0, 0.5, 0.5);
        kittyGroup.add(light);
        
        this.group.add(kittyGroup);
        this.group.userData.kitty = this;
    }
    
    update(dt: number, playerPos: THREE.Vector3): InteractionResult | null {
        if (this.collected) return null;
        
        this.time += dt;
        
        // Gentle sine wave floating
        const floatY = Math.sin(this.time * this.FLOAT_SPEED) * this.FLOAT_AMPLITUDE;
        this.group.position.y = this.baseY + floatY;
        
        // Subtle rotation
        this.group.rotation.y = Math.sin(this.time * 0.5) * 0.2;
        
        // Animate sparkles
        if (this.sparkles) {
            this.sparkles.rotation.y += dt * 0.5;
            const positions = this.sparkles.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 1] += Math.sin(this.time * 2 + i) * 0.002;
            }
            this.sparkles.geometry.attributes.position.needsUpdate = true;
        }
        
        // Tail wag
        if (this.tail) {
            this.tail.rotation.z = Math.sin(this.time * 3) * 0.1;
        }
        
        // Check if player is close
        const dist = this.position.distanceTo(playerPos);
        
        // Wave animation when player is close
        if (dist < this.INTERACTION_DISTANCE && !this.isWaving) {
            this.isWaving = true;
            this.hasWavedAtPlayer = true;
            return { type: 'kitty_wave', position: this.position.clone(), bonus: 10 };
        }
        
        // Update waving animation
        if (this.isWaving) {
            this.waveTimer += dt;
            
            // Paw waving motion
            if (this.paw) {
                const waveAngle = Math.sin(this.waveTimer * 8) * 0.5 - 0.5;
                this.paw.rotation.z = waveAngle;
                this.paw.position.y = -0.1 + Math.sin(this.waveTimer * 8) * 0.1;
            }
            
            // Head tilt
            if (this.head) {
                this.head.rotation.z = Math.sin(this.waveTimer * 4) * 0.1;
            }
            
            if (this.waveTimer >= this.WAVE_DURATION) {
                this.isWaving = false;
                this.waveTimer = 0;
                // Reset paw
                if (this.paw) {
                    this.paw.rotation.z = 0;
                    this.paw.position.y = -0.1;
                }
                if (this.head) {
                    this.head.rotation.z = 0;
                }
            }
        }
        
        return null;
    }
    
    collect(): number {
        if (this.collected) return 0;
        this.collected = true;
        
        // Scale down animation
        const startScale = this.group.scale.x;
        const duration = 0.3;
        let elapsed = 0;
        
        const animate = () => {
            elapsed += 0.016;
            const t = Math.min(elapsed / duration, 1);
            const scale = startScale * (1 - t);
            this.group.scale.setScalar(scale);
            
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                this.group.visible = false;
            }
        };
        animate();
        
        return 50; // Bonus points
    }
    
    destroy(scene: THREE.Scene) {
        scene.remove(this.group);
        // Cleanup geometries and materials
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
    }
    
    getDistanceToPlayer(playerPos: THREE.Vector3): number {
        return this.position.distanceTo(playerPos);
    }
}

// =============================================================================
// SPACE BUNNY - Fluffy bunny in mini rocket pack
// =============================================================================

export class SpaceBunny {
    group: THREE.Group;
    position: THREE.Vector3;
    baseY: number;
    
    // Animation state
    time: number = 0;
    hopTimer: number = 0;
    isHopping: boolean = false;
    boopTimer: number = 0;
    isBooping: boolean = false;
    hasHealed: boolean = false;
    
    // Parts for animation
    private head: THREE.Group | null = null;
    private nose: THREE.Mesh | null = null;
    private ears: THREE.Group | null = null;
    private rocketPack: THREE.Group | null = null;
    private heartParticles: THREE.Points | null = null;
    
    // Constants
    readonly INTERACTION_DISTANCE = 10;
    readonly HEAL_DISTANCE = 6;
    readonly HEAL_AMOUNT = 1;
    readonly HOP_INTERVAL = 2;
    readonly BOOP_DURATION = 0.6;
    
    constructor(scene: THREE.Scene, x: number, y: number) {
        this.position = new THREE.Vector3(x, y, 0);
        this.baseY = y;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        this.createMesh();
        scene.add(this.group);
    }
    
    private createMesh() {
        const bunnyGroup = new THREE.Group();
        
        // --- Body (fluffy lavender sphere) ---
        const bodyGeo = new THREE.SphereGeometry(0.5, 20, 20);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xe6e6fa, // Lavender
            roughness: 0.9,
            metalness: 0.0
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.scale.set(1, 0.85, 0.9);
        bunnyGroup.add(body);
        
        // Fluff effect (smaller spheres around body)
        for (let i = 0; i < 8; i++) {
            const fluffGeo = new THREE.SphereGeometry(0.2, 8, 8);
            const fluff = new THREE.Mesh(fluffGeo, bodyMat);
            const theta = (i / 8) * Math.PI * 2;
            fluff.position.set(
                Math.cos(theta) * 0.45,
                -0.1 + Math.sin(i * 0.5) * 0.1,
                Math.sin(theta) * 0.4
            );
            bunnyGroup.add(fluff);
        }
        
        // --- Head Group ---
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.5, 0.2);
        
        const headGeo = new THREE.SphereGeometry(0.4, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xe6e6fa,
            roughness: 0.9
        });
        const head = new THREE.Mesh(headGeo, headMat);
        headGroup.add(head);
        
        // --- Ears (long and floppy) ---
        const earsGroup = new THREE.Group();
        
        // Left ear
        const earGeo = new THREE.CapsuleGeometry(0.12, 0.6, 4, 8);
        const earMat = new THREE.MeshStandardMaterial({
            color: 0xe6e6fa,
            roughness: 0.9
        });
        const leftEar = new THREE.Mesh(earGeo, earMat);
        leftEar.position.set(-0.2, 0.5, 0);
        leftEar.rotation.z = 0.3;
        earsGroup.add(leftEar);
        
        // Right ear
        const rightEar = new THREE.Mesh(earGeo, earMat);
        rightEar.position.set(0.2, 0.5, 0);
        rightEar.rotation.z = -0.3;
        earsGroup.add(rightEar);
        
        // Inner ears (pink)
        const innerEarGeo = new THREE.CapsuleGeometry(0.06, 0.4, 4, 8);
        const innerEarMat = new THREE.MeshStandardMaterial({
            color: 0xffb6c1,
            roughness: 0.9
        });
        
        const leftInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
        leftInnerEar.position.set(-0.2, 0.5, 0.06);
        leftInnerEar.rotation.z = 0.3;
        earsGroup.add(leftInnerEar);
        
        const rightInnerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
        rightInnerEar.position.set(0.2, 0.5, 0.06);
        rightInnerEar.rotation.z = -0.3;
        earsGroup.add(rightInnerEar);
        
        headGroup.add(earsGroup);
        this.ears = earsGroup;
        
        // --- Face ---
        // Eyes (dark purple)
        const eyeGeo = new THREE.SphereGeometry(0.08, 12, 12);
        const eyeMat = new THREE.MeshStandardMaterial({
            color: 0x663399, // Rebecca purple
            roughness: 0.3
        });
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.15, 0.05, 0.32);
        headGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.15, 0.05, 0.32);
        headGroup.add(rightEye);
        
        // Nose (pink sphere for booping)
        const noseGeo = new THREE.SphereGeometry(0.06, 12, 12);
        const noseMat = new THREE.MeshStandardMaterial({
            color: 0xff69b4,
            roughness: 0.4,
            metalness: 0.2
        });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, -0.05, 0.38);
        headGroup.add(nose);
        this.nose = nose;
        
        // Mouth (tiny curve)
        const mouthGeo = new THREE.TorusGeometry(0.08, 0.02, 4, 8, Math.PI);
        const mouthMat = new THREE.MeshStandardMaterial({ color: 0x663399 });
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0, -0.1, 0.35);
        mouth.rotation.x = Math.PI;
        headGroup.add(mouth);
        
        // Cheeks (pink blush)
        const cheekGeo = new THREE.CircleGeometry(0.08, 12);
        const cheekMat = new THREE.MeshBasicMaterial({
            color: 0xffb6c1,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        
        const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
        leftCheek.position.set(-0.25, -0.05, 0.3);
        leftCheek.lookAt(0, -0.05, 1);
        headGroup.add(leftCheek);
        
        const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
        rightCheek.position.set(0.25, -0.05, 0.3);
        rightCheek.lookAt(0, -0.05, 1);
        headGroup.add(rightCheek);
        
        bunnyGroup.add(headGroup);
        this.head = headGroup;
        
        // --- Rocket Pack ---
        const rocketGroup = new THREE.Group();
        rocketGroup.position.set(0, 0.1, -0.5);
        
        // Main pack
        const packGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.6, 12);
        const packMat = new THREE.MeshStandardMaterial({
            color: 0xffa500, // Orange
            roughness: 0.4,
            metalness: 0.5
        });
        const pack = new THREE.Mesh(packGeo, packMat);
        pack.rotation.x = Math.PI / 2;
        rocketGroup.add(pack);
        
        // Left thruster
        const thrusterGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.3, 10);
        const thrusterMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.3,
            metalness: 0.7
        });
        
        const leftThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
        leftThruster.position.set(-0.2, 0, -0.3);
        leftThruster.rotation.x = Math.PI / 2;
        rocketGroup.add(leftThruster);
        
        const rightThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
        rightThruster.position.set(0.2, 0, -0.3);
        rightThruster.rotation.x = Math.PI / 2;
        rocketGroup.add(rightThruster);
        
        // Flames (glowing cones)
        const flameGeo = new THREE.ConeGeometry(0.1, 0.3, 8);
        const flameMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff, // Cyan flame
            transparent: true,
            opacity: 0.8
        });
        
        const leftFlame = new THREE.Mesh(flameGeo, flameMat);
        leftFlame.position.set(-0.2, 0, -0.6);
        leftFlame.rotation.x = -Math.PI / 2;
        rocketGroup.add(leftFlame);
        
        const rightFlame = new THREE.Mesh(flameGeo, flameMat);
        rightFlame.position.set(0.2, 0, -0.6);
        rightFlame.rotation.x = -Math.PI / 2;
        rocketGroup.add(rightFlame);
        
        bunnyGroup.add(rocketGroup);
        this.rocketPack = rocketGroup;
        
        // --- Heart Particle Trail ---
        const heartCount = 15;
        const heartGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(heartCount * 3);
        const sizes = new Float32Array(heartCount);
        
        for (let i = 0; i < heartCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = -0.5 - i * 0.3;
            sizes[i] = 0.1 - i * 0.005;
        }
        
        heartGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        heartGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const heartMat = new THREE.PointsMaterial({
            color: 0xff69b4,
            size: 0.15,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
        });
        
        this.heartParticles = new THREE.Points(heartGeo, heartMat);
        bunnyGroup.add(this.heartParticles);
        
        // --- Carrot Accessory ---
        const carrotGroup = new THREE.Group();
        carrotGroup.position.set(0.4, 0.3, 0);
        carrotGroup.rotation.z = -0.5;
        
        // Carrot body
        const carrotGeo = new THREE.ConeGeometry(0.08, 0.4, 8);
        const carrotMat = new THREE.MeshStandardMaterial({
            color: 0xff8c00, // Dark orange
            roughness: 0.6
        });
        const carrot = new THREE.Mesh(carrotGeo, carrotMat);
        carrot.rotation.x = Math.PI;
        carrotGroup.add(carrot);
        
        // Carrot greens
        const greenGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 4);
        const greenMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
        
        for (let i = 0; i < 3; i++) {
            const green = new THREE.Mesh(greenGeo, greenMat);
            green.position.set((i - 1) * 0.03, 0.25, 0);
            green.rotation.z = (i - 1) * 0.3;
            carrotGroup.add(green);
        }
        
        bunnyGroup.add(carrotGroup);
        
        // --- Soft Point Light ---
        const light = new THREE.PointLight(0xffb6c1, 0.4, 4);
        light.position.set(0, 0.3, 0.5);
        bunnyGroup.add(light);
        
        this.group.add(bunnyGroup);
        this.group.userData.bunny = this;
    }
    
    update(dt: number, playerPos: THREE.Vector3): InteractionResult | null {
        this.time += dt;
        
        // Hopping animation
        this.hopTimer += dt;
        if (this.hopTimer >= this.HOP_INTERVAL) {
            this.hopTimer = 0;
            this.isHopping = true;
        }
        
        if (this.isHopping) {
            const hopProgress = this.hopTimer / (this.HOP_INTERVAL * 0.5);
            if (hopProgress <= 1) {
                // Parabolic hop
                const hopHeight = Math.sin(hopProgress * Math.PI) * 1.5;
                this.group.position.y = this.baseY + hopHeight;
                
                // Rotate ears back during hop
                if (this.ears) {
                    this.ears.rotation.x = -hopHeight * 0.3;
                }
            } else {
                this.isHopping = false;
                if (this.ears) {
                    this.ears.rotation.x = 0;
                }
            }
        } else {
            // Gentle bobbing when not hopping
            this.group.position.y = this.baseY + Math.sin(this.time * 2) * 0.1;
        }
        
        // Animate heart trail
        if (this.heartParticles) {
            const positions = this.heartParticles.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < positions.length / 3; i++) {
                // Float hearts upward and fade
                positions[i * 3 + 1] += dt * 0.5;
                positions[i * 3] += Math.sin(this.time * 3 + i) * dt * 0.1;
                
                // Reset if too high
                if (positions[i * 3 + 1] > 2) {
                    positions[i * 3 + 1] = 0;
                    positions[i * 3] = (Math.random() - 0.5) * 0.3;
                }
            }
            this.heartParticles.geometry.attributes.position.needsUpdate = true;
        }
        
        // Boop animation
        if (this.isBooping) {
            this.boopTimer += dt;
            
            if (this.nose) {
                // Nose wiggle
                const wiggle = Math.sin(this.boopTimer * 20) * 0.02;
                this.nose.position.x = wiggle;
                // Scale nose up slightly
                const scale = 1 + Math.sin(this.boopTimer * 10) * 0.3;
                this.nose.scale.setScalar(scale);
            }
            
            if (this.boopTimer >= this.BOOP_DURATION) {
                this.isBooping = false;
                this.boopTimer = 0;
                if (this.nose) {
                    this.nose.position.x = 0;
                    this.nose.scale.setScalar(1);
                }
            }
        }
        
        // Check for interaction
        const dist = this.position.distanceTo(playerPos);
        
        // Trigger boop when player gets close
        if (dist < this.INTERACTION_DISTANCE && !this.isBooping && Math.random() < 0.02) {
            this.isBooping = true;
        }
        
        // Heal when very close
        if (dist < this.HEAL_DISTANCE && !this.hasHealed) {
            this.hasHealed = true;
            return {
                type: 'bunny_heal',
                position: this.position.clone(),
                healthRestore: this.HEAL_AMOUNT
            };
        }
        
        // Reset heal when player moves away
        if (dist > this.INTERACTION_DISTANCE + 2) {
            this.hasHealed = false;
        }
        
        return null;
    }
    
    triggerBoop(): boolean {
        if (!this.isBooping) {
            this.isBooping = true;
            this.boopTimer = 0;
            return true;
        }
        return false;
    }
    
    destroy(scene: THREE.Scene) {
        scene.remove(this.group);
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
    }
    
    getDistanceToPlayer(playerPos: THREE.Vector3): number {
        return this.position.distanceTo(playerPos);
    }
}

// =============================================================================
// WISH LANTERN - Floating pink paper lantern with heart cutouts
// =============================================================================

export class WishLantern {
    group: THREE.Group;
    position: THREE.Vector3;
    baseY: number;
    
    // Animation state
    time: number = 0;
    isPopped: boolean = false;
    popTimer: number = 0;
    floatOffset: number = Math.random() * 100;
    
    // Parts
    private lanternMesh: THREE.Mesh | null = null;
    private glowLight: THREE.PointLight | null = null;
    private internalGlow: THREE.Mesh | null = null;
    
    // Constants
    readonly INTERACTION_DISTANCE = 6;
    readonly FLOAT_SPEED = 0.8;
    readonly FLOAT_AMPLITUDE = 0.8;
    
    constructor(scene: THREE.Scene, x: number, y: number) {
        this.position = new THREE.Vector3(x, y, 0);
        this.baseY = y;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        this.createMesh();
        scene.add(this.group);
    }
    
    private createMesh() {
        const lanternGroup = new THREE.Group();
        
        // --- Paper Lantern Body ---
        // Main spherical paper body
        const lanternGeo = new THREE.SphereGeometry(1.2, 32, 24);
        
        // Create heart cutout texture pattern
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d')!;
        
        // Fill with pink
        ctx.fillStyle = '#ffb6c1';
        ctx.fillRect(0, 0, 512, 512);
        
        // Draw hearts (cutouts will be transparent)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000000';
        
        function drawHeart(cx: number, cy: number, size: number) {
            ctx.beginPath();
            ctx.moveTo(cx, cy + size * 0.3);
            ctx.bezierCurveTo(cx, cy, cx - size * 0.5, cy, cx - size * 0.5, cy + size * 0.3);
            ctx.bezierCurveTo(cx - size * 0.5, cy + size * 0.7, cx, cy + size, cx, cy + size);
            ctx.bezierCurveTo(cx, cy + size, cx + size * 0.5, cy + size * 0.7, cx + size * 0.5, cy + size * 0.3);
            ctx.bezierCurveTo(cx + size * 0.5, cy, cx, cy, cx, cy + size * 0.3);
            ctx.fill();
        }
        
        // Draw multiple hearts
        drawHeart(256, 150, 80);
        drawHeart(100, 256, 60);
        drawHeart(412, 256, 60);
        drawHeart(180, 380, 50);
        drawHeart(332, 380, 50);
        drawHeart(256, 280, 40);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        const lanternMat = new THREE.MeshStandardMaterial({
            color: 0xffb6c1, // Light pink
            map: texture,
            transparent: true,
            opacity: 0.9,
            roughness: 0.8,
            side: THREE.DoubleSide,
            alphaTest: 0.1
        });
        
        this.lanternMesh = new THREE.Mesh(lanternGeo, lanternMat);
        this.lanternMesh.scale.set(1, 0.9, 1); // Slightly squashed
        lanternGroup.add(this.lanternMesh);
        
        // --- Internal Glow ---
        const glowGeo = new THREE.SphereGeometry(0.8, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffaa44, // Warm orange glow
            transparent: true,
            opacity: 0.3
        });
        this.internalGlow = new THREE.Mesh(glowGeo, glowMat);
        lanternGroup.add(this.internalGlow);
        
        // --- Ribbons hanging down ---
        const ribbonGeo = new THREE.PlaneGeometry(0.15, 1.5, 1, 4);
        const ribbonMat = new THREE.MeshStandardMaterial({
            color: 0xff69b4, // Hot pink
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        
        for (let i = 0; i < 4; i++) {
            const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
            const angle = (i / 4) * Math.PI * 2;
            ribbon.position.set(
                Math.cos(angle) * 0.5,
                -1.2,
                Math.sin(angle) * 0.5
            );
            ribbon.userData.baseRotation = angle;
            ribbon.userData.ribbonIndex = i;
            lanternGroup.add(ribbon);
        }
        
        // --- Top cap ---
        const capGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.2, 16);
        const capMat = new THREE.MeshStandardMaterial({
            color: 0xff1493, // Deep pink
            roughness: 0.5
        });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = 1.1;
        lanternGroup.add(cap);
        
        // --- String for hanging ---
        const stringGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 8);
        const stringMat = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        const string = new THREE.Mesh(stringGeo, stringMat);
        string.position.y = 1.7;
        lanternGroup.add(string);
        
        // --- Warm Point Light ---
        this.glowLight = new THREE.PointLight(0xffaa44, 1, 8);
        this.glowLight.position.set(0, 0, 0);
        lanternGroup.add(this.glowLight);
        
        this.group.add(lanternGroup);
        this.group.userData.lantern = this;
    }
    
    update(dt: number, playerPos: THREE.Vector3): InteractionResult | null {
        if (this.isPopped) return null;
        
        this.time += dt;
        
        // Gentle up-draft floating (slower sine wave)
        const floatY = Math.sin((this.time + this.floatOffset) * this.FLOAT_SPEED) * this.FLOAT_AMPLITUDE;
        this.group.position.y = this.baseY + floatY;
        
        // Gentle swaying
        this.group.rotation.z = Math.sin(this.time * 0.5) * 0.05;
        this.group.rotation.x = Math.cos(this.time * 0.4) * 0.03;
        
        // Pulsing glow
        if (this.glowLight && this.internalGlow) {
            const pulse = 0.8 + Math.sin(this.time * 2) * 0.2;
            this.glowLight.intensity = pulse;
            (this.internalGlow.material as THREE.MeshBasicMaterial).opacity = 0.3 * pulse;
        }
        
        // Animate ribbons
        this.group.children[0].children.forEach((child) => {
            if (child.userData.ribbonIndex !== undefined) {
                const ribbon = child as THREE.Mesh;
                const baseRot = ribbon.userData.baseRotation;
                ribbon.rotation.z = Math.sin(this.time * 2 + baseRot) * 0.2;
                ribbon.rotation.x = Math.cos(this.time * 1.5 + baseRot) * 0.1;
            }
        });
        
        // Check if player is close enough to pop
        const dist = this.position.distanceTo(playerPos);
        if (dist < this.INTERACTION_DISTANCE) {
            return { type: 'lantern_pop', position: this.position.clone(), bonus: 25 };
        }
        
        return null;
    }
    
    pop(scene: THREE.Scene, particleSystem: ParticleSystem): boolean {
        if (this.isPopped) return false;
        this.isPopped = true;
        
        // Create firework burst effect
        const colors = [0xff69b4, 0xffd700, 0xffa500, 0xff1493, 0x00ffff];
        
        // Multiple bursts
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 1
                );
                const burstPos = this.position.clone().add(offset);
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                particleSystem.emit(burstPos, color, 15, 6.0, 0.8, 2.0);
            }, i * 100);
        }
        
        // Scale up and fade out animation
        const startScale = this.group.scale.x;
        const duration = 0.5;
        let elapsed = 0;
        
        const animate = () => {
            elapsed += 0.016;
            const t = Math.min(elapsed / duration, 1);
            
            // Expand then fade
            if (t < 0.5) {
                const expandT = t * 2;
                this.group.scale.setScalar(startScale * (1 + expandT * 0.5));
            } else {
                const fadeT = (t - 0.5) * 2;
                this.group.scale.setScalar(startScale * 1.5 * (1 - fadeT));
                this.group.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach((mat: THREE.Material) => {
                            if (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.MeshStandardMaterial) {
                                mat.opacity = 0.9 * (1 - fadeT);
                                mat.transparent = true;
                            }
                        });
                    }
                });
            }
            
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                this.group.visible = false;
            }
        };
        animate();
        
        return true;
    }
    
    destroy(scene: THREE.Scene) {
        scene.remove(this.group);
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
    }
    
    getDistanceToPlayer(playerPos: THREE.Vector3): number {
        return this.position.distanceTo(playerPos);
    }
}

// =============================================================================
// ASTRO TARSIER - Tiny big-eyed creature clinging to Gravity Anchors
// =============================================================================

type TarsierState = 'idle' | 'alarmed' | 'panicking' | 'cheering';

export class AstroTarsier {
    group: THREE.Group;
    position: THREE.Vector3;   // world position (updated each frame)
    anchorPos: THREE.Vector3;  // gravity anchor this tarsier orbits

    // Animation state
    time: number = 0;
    state: TarsierState = 'idle';
    private stateTimer: number = 0;

    // Orbital parameters (tarsier clings near its anchor)
    private orbitAngle: number;
    private orbitRadius: number;
    private orbitZ: number;

    // Per-tarsier idle variation
    private phaseOffset: number;

    // Parts for animation
    private headGroup: THREE.Group | null = null;
    private leftEye: THREE.Mesh | null = null;
    private rightEye: THREE.Mesh | null = null;
    private leftEar: THREE.Mesh | null = null;
    private rightEar: THREE.Mesh | null = null;
    private body: THREE.Mesh | null = null;

    // Constants
    readonly ALARM_DISTANCE = 14;
    readonly PANIC_DISTANCE = 8;
    readonly CHEER_DURATION = 1.8;
    readonly PANIC_DURATION = 2.0;
    readonly ALARMED_DURATION = 1.2;

    constructor(scene: THREE.Scene, anchorPos: THREE.Vector3, index: number) {
        this.anchorPos = anchorPos.clone();

        // Spread tarsiers around the anchor at varying angles/radii
        this.orbitAngle = (index / 5) * Math.PI * 2 + Math.random() * 0.4;
        this.orbitRadius = 6 + Math.random() * 4;
        this.orbitZ = (Math.random() - 0.5) * 8 - 10; // behind the anchor in Z
        this.phaseOffset = Math.random() * Math.PI * 2;

        this.position = new THREE.Vector3(
            anchorPos.x + Math.cos(this.orbitAngle) * this.orbitRadius,
            anchorPos.y + Math.sin(this.orbitAngle) * this.orbitRadius * 0.6,
            this.orbitZ
        );

        this.group = new THREE.Group();
        this.group.position.copy(this.position);

        this.createMesh();
        scene.add(this.group);
    }

    private createMesh(): void {
        const tarsierGroup = new THREE.Group();

        // --- Body ---
        const bodyGeo = new THREE.SphereGeometry(0.38, 12, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xc8a87a,   // warm sandy-tan
            roughness: 0.85,
            metalness: 0.0
        });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.scale.set(1, 1.1, 0.9);
        tarsierGroup.add(this.body);

        // --- Head group (allows independent head rotation) ---
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 0.45, 0.1);
        tarsierGroup.add(this.headGroup);

        // Head sphere
        const headGeo = new THREE.SphereGeometry(0.32, 12, 12);
        const headMesh = new THREE.Mesh(headGeo, bodyMat.clone());
        this.headGroup.add(headMesh);

        // --- Big eyes (tarsier trademark) ---
        const eyeGeo = new THREE.SphereGeometry(0.13, 10, 10);
        const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const pupilGeo = new THREE.SphereGeometry(0.07, 8, 8);
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });

        // Left eye
        const leftEyeGroup = new THREE.Group();
        leftEyeGroup.position.set(-0.14, 0.05, 0.26);
        const leftWhite = new THREE.Mesh(eyeGeo, eyeWhiteMat);
        this.leftEye = leftWhite;
        leftEyeGroup.add(leftWhite);
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(0, 0, 0.07);
        leftEyeGroup.add(leftPupil);
        this.headGroup.add(leftEyeGroup);

        // Right eye
        const rightEyeGroup = new THREE.Group();
        rightEyeGroup.position.set(0.14, 0.05, 0.26);
        const rightWhite = new THREE.Mesh(eyeGeo, eyeWhiteMat);
        this.rightEye = rightWhite;
        rightEyeGroup.add(rightWhite);
        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0, 0, 0.07);
        rightEyeGroup.add(rightPupil);
        this.headGroup.add(rightEyeGroup);

        // --- Large rounded ears ---
        const earGeo = new THREE.SphereGeometry(0.18, 8, 8);
        const earMat = new THREE.MeshStandardMaterial({ color: 0xb8916a, roughness: 0.9 });

        this.leftEar = new THREE.Mesh(earGeo, earMat);
        this.leftEar.scale.set(0.7, 1.2, 0.4);
        this.leftEar.position.set(-0.28, 0.28, 0);
        this.headGroup.add(this.leftEar);

        this.rightEar = new THREE.Mesh(earGeo, earMat);
        this.rightEar.scale.set(0.7, 1.2, 0.4);
        this.rightEar.position.set(0.28, 0.28, 0);
        this.headGroup.add(this.rightEar);

        // --- Tiny tail ---
        const tailGeo = new THREE.CylinderGeometry(0.04, 0.02, 0.55, 6);
        const tailMat = new THREE.MeshStandardMaterial({ color: 0xb8916a, roughness: 0.9 });
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.set(0, -0.45, -0.2);
        tail.rotation.x = 0.7;
        tarsierGroup.add(tail);

        // Scale down overall — they are tiny
        tarsierGroup.scale.setScalar(0.55);
        this.group.add(tarsierGroup);
        this.group.userData.tarsier = this;
    }

    /**
     * Notify this tarsier of a nearby sling-arc cheer event.
     * Called externally when the player performs a clean sling exit near the anchor.
     */
    triggerCheer(): void {
        this.state = 'cheering';
        this.stateTimer = 0;
    }

    /**
     * Notify this tarsier of a nearby projectile/disturbance.
     * Called externally when a shot passes close to the anchor.
     */
    triggerPanic(): void {
        if (this.state !== 'panicking') {
            this.state = 'panicking';
            this.stateTimer = 0;
        }
    }

    update(dt: number, playerPos: THREE.Vector3): InteractionResult | null {
        this.time += dt;
        this.stateTimer += dt;

        // --- Determine next state from environment ---
        const distToPlayer = playerPos.distanceTo(this.position);

        if (this.state === 'idle' || this.state === 'alarmed') {
            if (distToPlayer < this.PANIC_DISTANCE) {
                this.state = 'panicking';
                this.stateTimer = 0;
            } else if (distToPlayer < this.ALARM_DISTANCE) {
                if (this.state === 'idle') {
                    this.state = 'alarmed';
                    this.stateTimer = 0;
                }
            } else if (this.state === 'alarmed' && this.stateTimer > this.ALARMED_DURATION) {
                this.state = 'idle';
                this.stateTimer = 0;
            }
        }

        // --- State duration resets ---
        if (this.state === 'panicking' && this.stateTimer > this.PANIC_DURATION) {
            this.state = 'idle';
            this.stateTimer = 0;
        }
        if (this.state === 'cheering' && this.stateTimer > this.CHEER_DURATION) {
            this.state = 'idle';
            this.stateTimer = 0;
        }

        // --- Position: orbit / flee ---
        let targetX: number;
        let targetY: number;

        if (this.state === 'panicking') {
            // Flee slightly away from player along the orbital arc
            const fleeAngle = this.orbitAngle + this.stateTimer * 2.5;
            const fleeRadius = this.orbitRadius + this.stateTimer * 1.5;
            targetX = this.anchorPos.x + Math.cos(fleeAngle) * Math.min(fleeRadius, this.orbitRadius + 5);
            targetY = this.anchorPos.y + Math.sin(fleeAngle) * Math.min(fleeRadius, this.orbitRadius + 5) * 0.6;
        } else {
            // Gentle orbital drift
            const drift = Math.sin(this.time * 0.4 + this.phaseOffset) * 0.15;
            targetX = this.anchorPos.x + Math.cos(this.orbitAngle + drift) * this.orbitRadius;
            targetY = this.anchorPos.y + Math.sin(this.orbitAngle + drift) * this.orbitRadius * 0.6;
        }

        // Smooth movement toward target position
        this.position.x = THREE.MathUtils.lerp(this.position.x, targetX, dt * 3);
        this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, dt * 3);
        this.position.z = this.orbitZ;
        this.group.position.copy(this.position);

        // --- Animations by state ---
        this._animateByState(dt, playerPos);

        // --- Emit interaction events ---
        if (this.state === 'cheering' && this.stateTimer < dt * 2) {
            // Just entered cheering state — emit cheer event once
            return { type: 'tarsier_cheer', position: this.position.clone() };
        }
        if (this.state === 'panicking' && this.stateTimer < dt * 2) {
            // Just entered panicking state — emit panic event once
            return { type: 'tarsier_panic', position: this.position.clone() };
        }

        return null;
    }

    private _animateByState(dt: number, playerPos: THREE.Vector3): void {
        if (!this.headGroup || !this.leftEar || !this.rightEar) return;

        switch (this.state) {
            case 'idle': {
                // Gentle bob
                this.group.position.y = this.position.y + Math.sin(this.time * 1.8 + this.phaseOffset) * 0.1;
                // Slow head tilt
                this.headGroup.rotation.z = Math.sin(this.time * 0.7 + this.phaseOffset) * 0.12;
                this.headGroup.rotation.y = Math.sin(this.time * 0.5 + this.phaseOffset) * 0.15;
                // Ears relax
                this.leftEar.rotation.z = 0.1;
                this.rightEar.rotation.z = -0.1;
                // Occasional look toward anchor core
                this.headGroup.lookAt(
                    this.anchorPos.x,
                    this.anchorPos.y,
                    this.headGroup.getWorldPosition(new THREE.Vector3()).z
                );
                break;
            }
            case 'alarmed': {
                // Freeze + wide eyes + look at player
                const toPlayer = new THREE.Vector3(playerPos.x, playerPos.y, this.position.z);
                this.headGroup.lookAt(toPlayer);
                // Ear alert
                this.leftEar.rotation.z = 0.3;
                this.rightEar.rotation.z = -0.3;
                // Small tremble
                this.group.position.x = this.position.x + Math.sin(this.time * 25) * 0.03;
                // Eyes slightly enlarged
                if (this.leftEye) this.leftEye.scale.setScalar(1.15);
                if (this.rightEye) this.rightEye.scale.setScalar(1.15);
                break;
            }
            case 'panicking': {
                // Rapid bounce
                const bounceY = Math.abs(Math.sin(this.time * 14)) * 0.25;
                this.group.position.y = this.position.y + bounceY;
                this.group.rotation.z = Math.sin(this.time * 20) * 0.18;
                // Ears flap back
                this.leftEar.rotation.z = Math.sin(this.time * 12) * 0.4 - 0.3;
                this.rightEar.rotation.z = Math.sin(this.time * 12 + 0.5) * 0.4 + 0.3;
                // Eyes reset
                if (this.leftEye) this.leftEye.scale.setScalar(1.0);
                if (this.rightEye) this.rightEye.scale.setScalar(1.0);
                break;
            }
            case 'cheering': {
                // Synchronized cheer jump
                const cheerT = this.stateTimer / this.CHEER_DURATION;
                const jumpArc = Math.sin(cheerT * Math.PI) * 0.6;
                this.group.position.y = this.position.y + jumpArc;
                // Happy ears flapping up
                this.leftEar.rotation.z = 0.5 + Math.sin(this.time * 15) * 0.2;
                this.rightEar.rotation.z = -0.5 + Math.sin(this.time * 15 + 0.3) * 0.2;
                // Head tilts up joyfully
                this.headGroup.rotation.x = -0.35;
                this.headGroup.rotation.z = Math.sin(this.time * 8) * 0.15;
                // Eyes reset
                if (this.leftEye) this.leftEye.scale.setScalar(1.0);
                if (this.rightEye) this.rightEye.scale.setScalar(1.0);
                break;
            }
        }
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.group);
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
    }
}

// =============================================================================
// FRIENDS MANAGER - Manages all space friends
// =============================================================================

export class FriendsManager {
    private scene: THREE.Scene;
    private audio: AudioSystem;
    private particles: ParticleSystem;
    
    kitties: SpaceKitty[] = [];
    bunnies: SpaceBunny[] = [];
    lanterns: WishLantern[] = [];
    tarsiers: AstroTarsier[] = [];
    
    // Cooldowns for audio (prevent spam)
    private lastKittySound: number = 0;
    private lastBunnySound: number = 0;
    private lastLanternSound: number = 0;
    private lastTarsierSound: number = 0;
    
    // Spawn tracking
    private lastSpawnX: number = 0;
    private spawnInterval: number = 100; // Spawn friends every ~100 units
    
    constructor(scene: THREE.Scene, audio: AudioSystem, particles: ParticleSystem) {
        this.scene = scene;
        this.audio = audio;
        this.particles = particles;
    }
    
    spawnKitty(x: number, y: number): SpaceKitty {
        const kitty = new SpaceKitty(this.scene, x, y);
        this.kitties.push(kitty);
        return kitty;
    }
    
    spawnBunny(x: number, y: number): SpaceBunny {
        const bunny = new SpaceBunny(this.scene, x, y);
        this.bunnies.push(bunny);
        return bunny;
    }
    
    spawnLantern(x: number, y: number): WishLantern {
        const lantern = new WishLantern(this.scene, x, y);
        this.lanterns.push(lantern);
        return lantern;
    }

    /**
     * Spawn 2–5 Astro Tarsiers orbiting a Gravity Anchor.
     * @param anchorPos  World-space centre of the anchor.
     * @param count      How many tarsiers (default 3).
     */
    spawnTarsiersNearAnchor(anchorPos: THREE.Vector3, count: number = 3): AstroTarsier[] {
        const spawned: AstroTarsier[] = [];
        const cap = Math.min(count, 5);
        for (let i = 0; i < cap; i++) {
            const t = new AstroTarsier(this.scene, anchorPos, i);
            this.tarsiers.push(t);
            spawned.push(t);
        }
        return spawned;
    }

    /**
     * Trigger a panic reaction on all tarsiers near a world position
     * (e.g. a projectile passed close to an anchor).
     */
    panicTarsiersNear(worldPos: THREE.Vector3, radius: number = 18): void {
        for (const t of this.tarsiers) {
            if (t.position.distanceTo(worldPos) < radius) {
                t.triggerPanic();
            }
        }
    }

    /**
     * Trigger a cheer reaction on all tarsiers orbiting a specific anchor
     * (e.g. the player completed a clean sling-arc nearby).
     */
    cheerTarsiersNearAnchor(anchorPos: THREE.Vector3, radius: number = 20): void {
        for (const t of this.tarsiers) {
            if (t.anchorPos.distanceTo(anchorPos) < radius) {
                t.triggerCheer();
            }
        }
    }
    
    /**
     * Spawn friends randomly as player progresses
     */
    maybeSpawnFriends(playerX: number, levelConfig?: any): void {
        if (playerX - this.lastSpawnX > this.spawnInterval) {
            this.lastSpawnX = playerX;
            
            // Spawn 1-3 friends near this area
            const count = 1 + Math.floor(Math.random() * 3);
            
            for (let i = 0; i < count; i++) {
                const spawnX = playerX + 30 + Math.random() * 40;
                const spawnY = (Math.random() - 0.5) * 15;
                
                const type = Math.random();
                if (type < 0.4) {
                    this.spawnKitty(spawnX, spawnY);
                } else if (type < 0.7) {
                    this.spawnBunny(spawnX, spawnY);
                } else {
                    this.spawnLantern(spawnX, spawnY + 2); // Lanterns float higher
                }
            }
        }
    }
    
    /**
     * Spawn friends near interesting areas (like asteroid clusters)
     */
    spawnNearInterestArea(x: number, y: number, type: 'cluster' | 'gap' | 'tunnel'): void {
        switch (type) {
            case 'cluster':
                // Spawn a bunny near asteroid clusters (comfort in danger)
                this.spawnBunny(x, y + 3);
                break;
            case 'gap':
                // Spawn a lantern in gaps (guiding light)
                this.spawnLantern(x, y);
                break;
            case 'tunnel':
                // Spawn a kitty in tunnels (cute companion)
                this.spawnKitty(x, y);
                break;
        }
    }
    
    update(dt: number, playerPos: THREE.Vector3): void {
        const now = Date.now();
        
        // Update all kitties
        for (const kitty of this.kitties) {
            const result = kitty.update(dt, playerPos);
            if (result) {
                this.handleInteraction(result, now);
            }
        }
        
        // Update all bunnies
        for (const bunny of this.bunnies) {
            const result = bunny.update(dt, playerPos);
            if (result) {
                this.handleInteraction(result, now);
            }
        }
        
        // Update all lanterns
        for (const lantern of this.lanterns) {
            const result = lantern.update(dt, playerPos);
            if (result) {
                this.handleInteraction(result, now);
                // Auto-pop lanterns when player is close
                if (result.type === 'lantern_pop') {
                    this.popLantern(lantern);
                }
            }
        }

        // Update all tarsiers
        for (const tarsier of this.tarsiers) {
            const result = tarsier.update(dt, playerPos);
            if (result) {
                this.handleInteraction(result, now);
            }
        }
    }
    
    private handleInteraction(result: InteractionResult, now: number): void {
        switch (result.type) {
            case 'kitty_wave':
                // Play soft meow on wave (with cooldown)
                if (now - this.lastKittySound > 2000) {
                    this.audio.play('twinkle', 0.6);
                    this.lastKittySound = now;
                }
                // Emit sparkle particles
                this.particles.emit(result.position, 0xffd700, 8, 3.0, 0.5, 1.0);
                break;
                
            case 'bunny_heal':
                // Play happy boop sound (with cooldown)
                if (now - this.lastBunnySound > 3000) {
                    this.audio.play('heart_pop', 0.7);
                    this.lastBunnySound = now;
                }
                // Emit heart particles
                this.particles.emit(result.position, 0xff69b4, 12, 4.0, 0.6, 1.5);
                break;
                
            case 'lantern_pop':
                // Sounds handled in popLantern
                break;

            case 'tarsier_cheer':
                // Happy twinkle cheer (with cooldown)
                if (now - this.lastTarsierSound > 1500) {
                    this.audio.play('twinkle', 0.5);
                    this.lastTarsierSound = now;
                }
                // Warm golden burst of sparkles
                this.particles.emit(result.position, 0xffd966, 10, 3.5, 0.5, 1.2);
                break;

            case 'tarsier_panic':
                // Quick scatter sound (with cooldown)
                if (now - this.lastTarsierSound > 1000) {
                    this.audio.play('sparkle', 0.35);
                    this.lastTarsierSound = now;
                }
                // Small puff of dust/spores
                this.particles.emit(result.position, 0xaaddcc, 6, 2.0, 0.3, 0.8);
                break;
        }
    }
    
    checkInteractions(playerPos: THREE.Vector3): InteractionResult[] {
        const results: InteractionResult[] = [];
        
        for (const kitty of this.kitties) {
            const result = kitty.update(0, playerPos);
            if (result) results.push(result);
        }
        
        for (const bunny of this.bunnies) {
            const result = bunny.update(0, playerPos);
            if (result) results.push(result);
        }
        
        for (const lantern of this.lanterns) {
            const result = lantern.update(0, playerPos);
            if (result) results.push(result);
        }
        
        return results;
    }
    
    popLantern(lantern: WishLantern): boolean {
        const now = Date.now();
        
        // Play twinkle chime + firework pop (with cooldown)
        if (now - this.lastLanternSound > 1000) {
            this.audio.playSequence([
                { sound: 'twinkle', delay: 0, volume: 0.8 },
                { sound: 'sparkle', delay: 0.1, volume: 0.6 },
                { sound: 'giggle', delay: 0.2, volume: 0.5 }
            ]);
            this.lastLanternSound = now;
        }
        
        return lantern.pop(this.scene, this.particles);
    }
    
    /**
     * Cleanup friends that are far behind the player
     */
    cleanupFarFriends(playerX: number, buffer: number = 50): void {
        // Remove kitties that are far behind
        for (let i = this.kitties.length - 1; i >= 0; i--) {
            const kitty = this.kitties[i];
            if (kitty.position.x < playerX - buffer) {
                kitty.destroy(this.scene);
                this.kitties.splice(i, 1);
            }
        }
        
        // Remove bunnies that are far behind
        for (let i = this.bunnies.length - 1; i >= 0; i--) {
            const bunny = this.bunnies[i];
            if (bunny.position.x < playerX - buffer) {
                bunny.destroy(this.scene);
                this.bunnies.splice(i, 1);
            }
        }
        
        // Remove lanterns that are far behind
        for (let i = this.lanterns.length - 1; i >= 0; i--) {
            const lantern = this.lanterns[i];
            if (lantern.position.x < playerX - buffer) {
                lantern.destroy(this.scene);
                this.lanterns.splice(i, 1);
            }
        }

        // Remove tarsiers whose anchor has fallen behind
        for (let i = this.tarsiers.length - 1; i >= 0; i--) {
            const tarsier = this.tarsiers[i];
            if (tarsier.anchorPos.x < playerX - buffer) {
                tarsier.destroy(this.scene);
                this.tarsiers.splice(i, 1);
            }
        }
    }
    
    /**
     * Get total friend count
     */
    getFriendCount(): { kitties: number; bunnies: number; lanterns: number; tarsiers: number; total: number } {
        return {
            kitties: this.kitties.length,
            bunnies: this.bunnies.length,
            lanterns: this.lanterns.length,
            tarsiers: this.tarsiers.length,
            total: this.kitties.length + this.bunnies.length + this.lanterns.length + this.tarsiers.length
        };
    }
    
    /**
     * Clear all friends
     */
    clear(): void {
        for (const kitty of this.kitties) {
            kitty.destroy(this.scene);
        }
        this.kitties = [];
        
        for (const bunny of this.bunnies) {
            bunny.destroy(this.scene);
        }
        this.bunnies = [];
        
        for (const lantern of this.lanterns) {
            lantern.destroy(this.scene);
        }
        this.lanterns = [];

        for (const tarsier of this.tarsiers) {
            tarsier.destroy(this.scene);
        }
        this.tarsiers = [];
    }
}

export default FriendsManager;
