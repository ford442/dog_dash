import * as THREE from 'three';
import type { InteractionResult } from './types';
import type { ParticleSystem } from '../particles';

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
        this.group.userData.speciesId = 'wishLantern';
        
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
