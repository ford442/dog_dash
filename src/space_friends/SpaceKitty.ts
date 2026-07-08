import * as THREE from 'three';
import type { InteractionResult } from './types';

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
        this.group.userData.speciesId = 'spaceKitty';
        
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
