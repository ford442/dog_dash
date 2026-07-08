import * as THREE from 'three';
import type { InteractionResult } from './types';

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
        this.group.userData.speciesId = 'moonBunny';
        
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
