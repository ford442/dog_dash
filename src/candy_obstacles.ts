/**
 * Candy Obstacles System for Dog Dash
 * Transforms asteroids into delicious sweet treats for a magical space adventure
 * Perfect for a 7-year-old girl player! 🍭🍬✨
 */

import * as THREE from 'three';
import { AudioSystem } from './audio_system';
import { ParticleSystem, DebrisSystem } from './particles';

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export enum CandyType {
    GUMMY = 'gummy',
    LOLLIPOP = 'lollipop',
    JELLYBEAN = 'jellybean',
    COTTON_CANDY = 'cotton_candy'
}

export enum CandyFlavor {
    STRAWBERRY = 'strawberry',   // Pink/Red
    LIME = 'lime',               // Green
    ORANGE = 'orange',           // Orange
    GRAPE = 'grape',             // Purple
    BLUEBERRY = 'blueberry',     // Blue
    LEMON = 'lemon'              // Yellow
}

export interface CollisionResult {
    candy: CandyAsteroid;
    type: 'bouncy' | 'damage' | 'collectible';
    response?: {
        bounceForce?: THREE.Vector3;
        particles?: boolean;
        sound?: string;
    };
}

interface CandyShard {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotation: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    life: number;
    maxLife: number;
    size: number;
    color: THREE.Color;
}

interface SugarSparkle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    size: number;
    color: THREE.Color;
}

// ============================================================================
// COLOR PALETTES
// ============================================================================

const CANDY_COLORS: Record<CandyFlavor, { primary: number; secondary: number; highlight: number }> = {
    [CandyFlavor.STRAWBERRY]: { primary: 0xff6b9d, secondary: 0xff8fab, highlight: 0xffb3c6 },
    [CandyFlavor.LIME]: { primary: 0x90ee90, secondary: 0x7cfc00, highlight: 0x98fb98 },
    [CandyFlavor.ORANGE]: { primary: 0xffa07a, secondary: 0xffb347, highlight: 0xffcc99 },
    [CandyFlavor.GRAPE]: { primary: 0xdda0dd, secondary: 0xda70d6, highlight: 0xe6e6fa },
    [CandyFlavor.BLUEBERRY]: { primary: 0x87ceeb, secondary: 0xadd8e6, highlight: 0xb0e0e6 },
    [CandyFlavor.LEMON]: { primary: 0xfffacd, secondary: 0xffec8b, highlight: 0xffffe0 }
};

const LOLLIPOP_SWIRLS = [
    { primary: 0xff6b6b, secondary: 0xffffff }, // Red/White
    { primary: 0xff69b4, secondary: 0xffffff }, // Pink/White
    { primary: 0x9370db, secondary: 0xffff00 }, // Purple/Yellow (rainbow-ish)
    { primary: 0x00ced1, secondary: 0xff69b4 }, // Cyan/Pink
    { primary: 0xffa500, secondary: 0x90ee90 }  // Orange/Green
];

// ============================================================================
// CANDY ASTEROID CLASS
// ============================================================================

export class CandyAsteroid {
    mesh: THREE.Mesh;
    candyType: CandyType;
    flavor: CandyFlavor;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    rotation: THREE.Vector3;
    rotationSpeed: THREE.Vector3;
    scale: number;
    
    // Animation states
    wobblePhase: number = 0;
    wobbleIntensity: number = 0;
    isWobbling: boolean = false;
    spinSpeed: number = 0;
    
    // Properties
    isBouncy: boolean = false;
    health: number = 1;
    active: boolean = true;
    radius: number = 1;
    
    // Cotton candy specific
    dissolveProgress: number = 0;
    isDissolving: boolean = false;
    
    // Lollipop specific
    swirlRotation: number = 0;
    
    private originalScale: THREE.Vector3;
    private wobbleDirection: THREE.Vector3;
    private scene: THREE.Scene;

    constructor(
        type: CandyType,
        position: THREE.Vector3,
        flavor: CandyFlavor = CandyFlavor.STRAWBERRY,
        scene?: THREE.Scene
    ) {
        this.candyType = type;
        this.flavor = flavor;
        this.position = position.clone();
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Vector3(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        this.rotationSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5
        );
        this.scene = scene || null as any;
        this.wobbleDirection = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        ).normalize();
        
        this.createMesh();
        this.setupProperties();
    }

    private createMesh() {
        switch (this.candyType) {
            case CandyType.GUMMY:
                this.mesh = this.createGummyMesh();
                break;
            case CandyType.LOLLIPOP:
                this.mesh = this.createLollipopMesh();
                break;
            case CandyType.JELLYBEAN:
                this.mesh = this.createJellybeanMesh();
                break;
            case CandyType.COTTON_CANDY:
                this.mesh = this.createCottonCandyMesh();
                break;
        }
        
        this.mesh.position.copy(this.position);
        this.mesh.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
        this.originalScale = this.mesh.scale.clone();
    }

    private createGummyMesh(): THREE.Mesh {
        // Translucent icosahedron with jiggly appearance
        const geometry = new THREE.IcosahedronGeometry(1, 1);
        
        // Add some noise to vertices for organic gummy look
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const noise = (Math.random() - 0.5) * 0.2;
            positions.setXYZ(
                i,
                positions.getX(i) * (1 + noise),
                positions.getY(i) * (1 + noise),
                positions.getZ(i) * (1 + noise)
            );
        }
        geometry.computeVertexNormals();

        const colors = CANDY_COLORS[this.flavor];
        const material = new THREE.MeshPhysicalMaterial({
            color: colors.primary,
            emissive: colors.secondary,
            emissiveIntensity: 0.1,
            metalness: 0,
            roughness: 0.2,
            transmission: 0.4, // Translucent
            thickness: 1.5,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            transparent: true,
            opacity: 0.9,
            ior: 1.4 // Like jelly
        });

        const mesh = new THREE.Mesh(geometry, material);
        this.scale = 0.8 + Math.random() * 0.6;
        mesh.scale.setScalar(this.scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        return mesh;
    }

    private createLollipopMesh(): THREE.Mesh {
        const group = new THREE.Group();
        
        // Lollipop stick
        const stickGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 8);
        const stickMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.1
        });
        const stick = new THREE.Mesh(stickGeo, stickMat);
        stick.position.y = -1.5;
        group.add(stick);
        
        // Lollipop candy head with spiral texture
        const headGeo = new THREE.SphereGeometry(1, 32, 32);
        const swirlColors = LOLLIPOP_SWIRLS[Math.floor(Math.random() * LOLLIPOP_SWIRLS.length)];
        
        // Create spiral texture using canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        
        // Draw spiral
        const centerX = 128;
        const centerY = 128;
        const maxRadius = 180;
        const bands = 8;
        
        for (let r = maxRadius; r > 0; r -= maxRadius / bands / 2) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
            ctx.fillStyle = (Math.floor(r / (maxRadius / bands)) % 2 === 0) 
                ? '#' + swirlColors.primary.toString(16).padStart(6, '0')
                : '#' + swirlColors.secondary.toString(16).padStart(6, '0');
            ctx.fill();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        
        const headMat = new THREE.MeshStandardMaterial({
            map: texture,
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.2,
            emissive: swirlColors.primary,
            emissiveIntensity: 0.1
        });
        
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.5;
        group.add(head);
        
        // Create a wrapper mesh for the group
        const wrapperGeo = new THREE.BoxGeometry(2.2, 4, 2.2);
        const wrapperMat = new THREE.MeshBasicMaterial({ visible: false });
        const wrapper = new THREE.Mesh(wrapperGeo, wrapperMat);
        wrapper.add(group);
        
        // Store reference to visual group
        (wrapper as any).visualGroup = group;
        (wrapper as any).headMesh = head;
        
        this.scale = 0.6 + Math.random() * 0.4;
        wrapper.scale.setScalar(this.scale);
        wrapper.castShadow = true;
        wrapper.receiveShadow = true;
        
        return wrapper;
    }

    private createJellybeanMesh(): THREE.Mesh {
        // Distorted sphere for jellybean shape
        const geometry = new THREE.SphereGeometry(1, 16, 16);
        
        // Deform into bean shape
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            let x = positions.getX(i);
            let y = positions.getY(i);
            let z = positions.getZ(i);
            
            // Elongate on X axis
            x *= 1.4;
            
            // Curve the bean
            const bend = Math.sin(x * 0.5) * 0.3;
            z += bend;
            
            // Make ends narrower
            const taper = 1 - Math.abs(x) * 0.15;
            y *= Math.max(0.6, taper);
            z *= Math.max(0.6, taper);
            
            // Add bumpy surface
            const noise = (Math.random() - 0.5) * 0.1;
            x += noise;
            y += noise;
            z += noise;
            
            positions.setXYZ(i, x, y, z);
        }
        geometry.computeVertexNormals();

        const colors = CANDY_COLORS[this.flavor];
        const material = new THREE.MeshPhysicalMaterial({
            color: colors.primary,
            emissive: colors.highlight,
            emissiveIntensity: 0.05,
            metalness: 0.1,
            roughness: 0.15,
            clearcoat: 0.8,
            clearcoatRoughness: 0.1,
            ior: 1.5
        });

        const mesh = new THREE.Mesh(geometry, material);
        this.scale = 0.5 + Math.random() * 0.4;
        mesh.scale.setScalar(this.scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        return mesh;
    }

    private createCottonCandyMesh(): THREE.Mesh {
        // Create fluffy cloud using multiple spheres
        const group = new THREE.Group();
        
        const colors = CANDY_COLORS[this.flavor];
        const puffCount = 8 + Math.floor(Math.random() * 6);
        
        for (let i = 0; i < puffCount; i++) {
            const puffGeo = new THREE.SphereGeometry(
                0.3 + Math.random() * 0.4,
                8,
                8
            );
            
            // Add fluff noise
            const positions = puffGeo.attributes.position;
            for (let j = 0; j < positions.count; j++) {
                const noise = (Math.random() - 0.5) * 0.2;
                positions.setXYZ(
                    j,
                    positions.getX(j) + noise,
                    positions.getY(j) + noise,
                    positions.getZ(j) + noise
                );
            }
            puffGeo.computeVertexNormals();
            
            const puffMat = new THREE.MeshStandardMaterial({
                color: colors.primary,
                emissive: colors.secondary,
                emissiveIntensity: 0.2,
                roughness: 0.9,
                metalness: 0,
                transparent: true,
                opacity: 0.7 + Math.random() * 0.2
            });
            
            const puff = new THREE.Mesh(puffGeo, puffMat);
            
            // Random position within cloud
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 0.8;
            const height = (Math.random() - 0.5) * 0.6;
            
            puff.position.set(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
            
            group.add(puff);
        }
        
        // Wrapper mesh
        const wrapperGeo = new THREE.BoxGeometry(2.5, 2, 2.5);
        const wrapperMat = new THREE.MeshBasicMaterial({ visible: false });
        const wrapper = new THREE.Mesh(wrapperGeo, wrapperMat);
        wrapper.add(group);
        
        (wrapper as any).visualGroup = group;
        (wrapper as any).puffs = group.children;
        
        this.scale = 0.8 + Math.random() * 0.6;
        wrapper.scale.setScalar(this.scale);
        
        return wrapper;
    }

    private setupProperties() {
        switch (this.candyType) {
            case CandyType.GUMMY:
                this.isBouncy = true;
                this.health = 2;
                this.radius = 0.8 * this.scale;
                break;
            case CandyType.LOLLIPOP:
                this.isBouncy = false;
                this.health = 1;
                this.radius = 1.0 * this.scale;
                this.spinSpeed = 0.5 + Math.random() * 0.5;
                break;
            case CandyType.JELLYBEAN:
                this.isBouncy = true;
                this.health = 1;
                this.radius = 0.7 * this.scale;
                break;
            case CandyType.COTTON_CANDY:
                this.isBouncy = false;
                this.health = 1;
                this.radius = 1.2 * this.scale;
                break;
        }
    }

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================

    wobble(): void {
        if (this.candyType !== CandyType.GUMMY && this.candyType !== CandyType.JELLYBEAN) {
            return;
        }
        
        this.isWobbling = true;
        this.wobbleIntensity = 1.0;
        this.wobblePhase = 0;
        
        // Random wobble direction
        this.wobbleDirection.set(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        ).normalize();
    }

    shatter(): THREE.Vector3[] {
        const shardPositions: THREE.Vector3[] = [];
        const shardCount = this.getShardCount();
        
        for (let i = 0; i < shardCount; i++) {
            const angle = (Math.PI * 2 * i) / shardCount + Math.random() * 0.5;
            const speed = 2 + Math.random() * 4;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                (Math.random() - 0.5) * speed
            );
            shardPositions.push(velocity);
        }
        
        this.active = false;
        return shardPositions;
    }

    private getShardCount(): number {
        switch (this.candyType) {
            case CandyType.GUMMY: return 4 + Math.floor(Math.random() * 3);
            case CandyType.LOLLIPOP: return 6 + Math.floor(Math.random() * 4);
            case CandyType.JELLYBEAN: return 3 + Math.floor(Math.random() * 3);
            case CandyType.COTTON_CANDY: return 8 + Math.floor(Math.random() * 5);
            default: return 4;
        }
    }

    dissolve(): void {
        if (this.candyType !== CandyType.COTTON_CANDY) return;
        
        this.isDissolving = true;
        this.dissolveProgress = 0;
    }

    getIsBouncy(): boolean {
        return this.isBouncy;
    }

    getCandyColor(): number {
        return CANDY_COLORS[this.flavor].primary;
    }

    getSecondaryColor(): number {
        return CANDY_COLORS[this.flavor].secondary;
    }

    // ========================================================================
    // UPDATE
    // ========================================================================

    update(dt: number): void {
        if (!this.active) return;

        // Rotation animation
        this.rotation.x += this.rotationSpeed.x * dt;
        this.rotation.y += this.rotationSpeed.y * dt;
        this.rotation.z += this.rotationSpeed.z * dt;
        
        this.mesh.rotation.x = this.rotation.x;
        this.mesh.rotation.y = this.rotation.y;
        this.mesh.rotation.z = this.rotation.z;

        // Type-specific animations
        switch (this.candyType) {
            case CandyType.GUMMY:
            case CandyType.JELLYBEAN:
                this.updateWobble(dt);
                break;
            case CandyType.LOLLIPOP:
                this.updateLollipop(dt);
                break;
            case CandyType.COTTON_CANDY:
                this.updateCottonCandy(dt);
                break;
        }

        // Update mesh position
        this.mesh.position.copy(this.position);
    }

    private updateWobble(dt: number): void {
        if (!this.isWobbling) return;

        this.wobblePhase += dt * 10;
        this.wobbleIntensity *= 0.95; // Decay

        if (this.wobbleIntensity < 0.01) {
            this.isWobbling = false;
            this.wobbleIntensity = 0;
            this.mesh.scale.copy(this.originalScale);
            return;
        }

        // Jiggly scale effect
        const wobbleX = 1 + Math.sin(this.wobblePhase) * 0.15 * this.wobbleIntensity;
        const wobbleY = 1 + Math.cos(this.wobblePhase * 1.3) * 0.15 * this.wobbleIntensity;
        const wobbleZ = 1 + Math.sin(this.wobblePhase * 0.7) * 0.1 * this.wobbleIntensity;

        this.mesh.scale.set(
            this.originalScale.x * wobbleX,
            this.originalScale.y * wobbleY,
            this.originalScale.z * wobbleZ
        );
    }

    private updateLollipop(dt: number): void {
        // Slow spiral rotation
        this.swirlRotation += this.spinSpeed * dt;
        
        const visualGroup = (this.mesh as any).visualGroup;
        const headMesh = (this.mesh as any).headMesh;
        
        if (visualGroup && headMesh) {
            headMesh.rotation.y = this.swirlRotation;
        }
    }

    private updateCottonCandy(dt: number): void {
        if (!this.isDissolving) {
            // Gentle floating motion
            this.position.y += Math.sin(Date.now() * 0.001 + this.position.x) * 0.01;
            return;
        }

        this.dissolveProgress += dt * 0.5;
        
        const puffs = (this.mesh as any).puffs as THREE.Mesh[];
        if (puffs) {
            puffs.forEach((puff: THREE.Mesh, i: number) => {
                const staggeredProgress = Math.max(0, this.dissolveProgress - i * 0.05);
                const scale = Math.max(0.1, 1 - staggeredProgress);
                const opacity = Math.max(0, 0.8 - staggeredProgress);
                
                puff.scale.setScalar(scale);
                (puff.material as THREE.MeshStandardMaterial).opacity = opacity;
                
                // Drift apart
                puff.position.x += (Math.random() - 0.5) * dt;
                puff.position.y += dt * 0.5;
                puff.position.z += (Math.random() - 0.5) * dt;
            });
        }

        if (this.dissolveProgress > 1.5) {
            this.active = false;
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    destroy(): void {
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        this.mesh.traverse((child) => {
            if ((child as THREE.Mesh).geometry) {
                (child as THREE.Mesh).geometry.dispose();
            }
            if ((child as THREE.Mesh).material) {
                const mat = (child as THREE.Mesh).material;
                if (Array.isArray(mat)) {
                    mat.forEach(m => m.dispose());
                } else {
                    mat.dispose();
                }
            }
        });
        this.active = false;
    }
}

// ============================================================================
// CANDY BELT MANAGER
// ============================================================================

export class CandyBeltManager {
    private scene: THREE.Scene;
    private audio: AudioSystem;
    private particles: ParticleSystem;
    private debris: DebrisSystem;
    
    private candies: CandyAsteroid[] = [];
    private shards: CandyShard[] = [];
    private sparkles: SugarSparkle[] = [];
    
    // Instanced meshes for performance
    private shardMesh: THREE.InstancedMesh | null = null;
    private sparkleMesh: THREE.InstancedMesh | null = null;
    
    // Configuration
    private beltLength: number = 0;
    private beltStartX: number = 0;

    constructor(
        scene: THREE.Scene,
        audio: AudioSystem,
        particles: ParticleSystem,
        debris?: DebrisSystem
    ) {
        this.scene = scene;
        this.audio = audio;
        this.particles = particles;
        this.debris = debris || null as any;
        
        this.initShardMesh();
        this.initSparkleMesh();
    }

    private initShardMesh() {
        const geometry = new THREE.TetrahedronGeometry(0.15, 0);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.3,
            emissive: 0xffffff,
            emissiveIntensity: 0.5
        });
        
        this.shardMesh = new THREE.InstancedMesh(geometry, material, 200);
        this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.shardMesh.count = 0;
        this.scene.add(this.shardMesh);
    }

    private initSparkleMesh() {
        const geometry = new THREE.OctahedronGeometry(0.08, 0);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        });
        
        this.sparkleMesh = new THREE.InstancedMesh(geometry, material, 300);
        this.sparkleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.sparkleMesh.instanceColor = new THREE.InstancedBufferAttribute(
            new Float32Array(300 * 3), 3
        );
        this.sparkleMesh.count = 0;
        this.scene.add(this.sparkleMesh);
    }

    // ========================================================================
    // GENERATION
    // ========================================================================

    generateCandyBelt(length: number, density: number): void {
        this.beltLength = length;
        this.beltStartX = 0;
        
        const count = Math.floor(length * density);
        
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.3) * length;
            const y = (Math.random() - 0.5) * 30;
            const z = (Math.random() - 0.5) * 15;
            
            // Weighted random type
            const type = this.getRandomCandyType();
            const flavor = this.getRandomFlavor();
            
            this.spawnCandyAsteroid(x, y, z, type, flavor);
        }
        
        console.log(`🍭 Generated candy belt with ${count} sweet treats!`);
    }

    spawnCandyAsteroid(
        x: number,
        y: number,
        z: number = 0,
        type?: CandyType,
        flavor?: CandyFlavor
    ): CandyAsteroid {
        const candyType = type || this.getRandomCandyType();
        const candyFlavor = flavor || this.getRandomFlavor();
        
        const position = new THREE.Vector3(x, y, z);
        const candy = new CandyAsteroid(candyType, position, candyFlavor, this.scene);
        
        this.scene.add(candy.mesh);
        this.candies.push(candy);
        
        return candy;
    }

    private getRandomCandyType(): CandyType {
        const types = Object.values(CandyType);
        const weights = [0.3, 0.25, 0.3, 0.15]; // Gummy, Lollipop, Jellybean, CottonCandy
        
        const rand = Math.random();
        let cumulative = 0;
        
        for (let i = 0; i < types.length; i++) {
            cumulative += weights[i];
            if (rand < cumulative) {
                return types[i];
            }
        }
        
        return CandyType.GUMMY;
    }

    private getRandomFlavor(): CandyFlavor {
        const flavors = Object.values(CandyFlavor);
        return flavors[Math.floor(Math.random() * flavors.length)];
    }

    getCandyColorScheme(): Record<string, number> {
        return {
            pink: CANDY_COLORS[CandyFlavor.STRAWBERRY].primary,
            mint: CANDY_COLORS[CandyFlavor.LIME].primary,
            lavender: CANDY_COLORS[CandyFlavor.GRAPE].primary,
            peach: CANDY_COLORS[CandyFlavor.ORANGE].primary,
            lemon: CANDY_COLORS[CandyFlavor.LEMON].primary,
            sky: CANDY_COLORS[CandyFlavor.BLUEBERRY].primary
        };
    }

    // ========================================================================
    // COLLISIONS
    // ========================================================================

    checkCollisions(playerPos: THREE.Vector3, radius: number): CollisionResult[] {
        const results: CollisionResult[] = [];
        
        for (const candy of this.candies) {
            if (!candy.active) continue;
            
            const dist = candy.position.distanceTo(playerPos);
            const combinedRadius = candy.radius + radius;
            
            if (dist < combinedRadius) {
                const result = this.handleCollision(candy, playerPos, radius);
                if (result) {
                    results.push(result);
                }
            }
        }
        
        return results;
    }

    private handleCollision(
        candy: CandyAsteroid,
        playerPos: THREE.Vector3,
        playerRadius: number
    ): CollisionResult | null {
        
        switch (candy.candyType) {
            case CandyType.GUMMY:
            case CandyType.JELLYBEAN:
                // Bouncy collision - no damage, fun wobble!
                candy.wobble();
                
                // Calculate bounce direction
                const bounceDir = new THREE.Vector3()
                    .subVectors(playerPos, candy.position)
                    .normalize();
                bounceDir.y = Math.abs(bounceDir.y) + 0.3; // Always bounce up a bit
                
                // Play boing sound
                this.audio.play('boing', 0.7);
                
                // Emit giggle particles
                this.particles.emit(
                    candy.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
                    candy.getCandyColor(),
                    5,
                    2.0,
                    0.5,
                    0.8
                );
                
                return {
                    candy,
                    type: 'bouncy',
                    response: {
                        bounceForce: bounceDir.multiplyScalar(8),
                        particles: true,
                        sound: 'boing'
                    }
                };

            case CandyType.COTTON_CANDY:
                // Dissolve through - no damage, just delicious!
                if (!candy.isDissolving) {
                    candy.dissolve();
                    
                    // Play gentle dissolve sound
                    this.audio.playMagicSound('collect');
                    
                    // Create sugar sparkles
                    this.createSugarSparkles(candy.position, candy.getCandyColor());
                    
                    return {
                        candy,
                        type: 'collectible',
                        response: {
                            particles: true,
                            sound: 'sparkle'
                        }
                    };
                }
                return null;

            case CandyType.LOLLIPOP:
                // Hard candy - damage!
                this.shatterCandy(candy);
                
                // Play crunch sound
                this.audio.play('hit', 0.8);
                
                return {
                    candy,
                    type: 'damage',
                    response: {
                        particles: true,
                        sound: 'hit'
                    }
                };
        }
        
        return null;
    }

    private shatterCandy(candy: CandyAsteroid): void {
        const velocities = candy.shatter();
        const color = candy.getCandyColor();
        
        // Create candy shards
        velocities.forEach((vel) => {
            this.shards.push({
                position: candy.position.clone().add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * candy.radius,
                        (Math.random() - 0.5) * candy.radius,
                        (Math.random() - 0.5) * candy.radius
                    )
                ),
                velocity: vel,
                rotation: new THREE.Vector3(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                ),
                rotSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    0
                ),
                life: 1.5 + Math.random(),
                maxLife: 2.0,
                size: 0.1 + Math.random() * 0.15,
                color: new THREE.Color(color)
            });
        });
        
        // Emit candy particles
        this.particles.emit(
            candy.position,
            color,
            15,
            4.0,
            0.8,
            1.2
        );
        
        // Remove the candy
        candy.destroy();
        const idx = this.candies.indexOf(candy);
        if (idx > -1) {
            this.candies.splice(idx, 1);
        }
    }

    private createSugarSparkles(position: THREE.Vector3, colorHex: number): void {
        const color = new THREE.Color(colorHex);
        
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            
            this.sparkles.push({
                position: position.clone().add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2
                    )
                ),
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed,
                    Math.abs(Math.sin(angle)) * speed + 1,
                    (Math.random() - 0.5) * speed
                ),
                life: 1.0 + Math.random() * 0.5,
                maxLife: 1.5,
                size: 0.05 + Math.random() * 0.1,
                color: color.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.2)
            });
        }
    }

    // ========================================================================
    // UPDATE
    // ========================================================================

    update(dt: number): void {
        // Update candies
        for (const candy of this.candies) {
            candy.update(dt);
        }
        
        // Cleanup inactive candies
        for (let i = this.candies.length - 1; i >= 0; i--) {
            if (!this.candies[i].active) {
                this.candies[i].destroy();
                this.candies.splice(i, 1);
            }
        }
        
        // Update shards
        this.updateShards(dt);
        
        // Update sparkles
        this.updateSparkles(dt);
    }

    private updateShards(dt: number): void {
        if (!this.shardMesh) return;
        
        const dummy = new THREE.Object3D();
        const _color = new THREE.Color();
        
        for (let i = this.shards.length - 1; i >= 0; i--) {
            const shard = this.shards[i];
            shard.life -= dt;
            
            if (shard.life <= 0) {
                this.shards.splice(i, 1);
                continue;
            }
            
            // Physics
            shard.position.addScaledVector(shard.velocity, dt);
            shard.velocity.y -= 5.0 * dt; // Gravity
            
            // Rotation
            shard.rotation.x += shard.rotSpeed.x * dt;
            shard.rotation.y += shard.rotSpeed.y * dt;
            
            // Scale based on life
            const lifeRatio = shard.life / shard.maxLife;
            const scale = shard.size * Math.max(0.3, lifeRatio);
            
            dummy.position.copy(shard.position);
            dummy.rotation.set(shard.rotation.x, shard.rotation.y, 0);
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            
            if (i < this.shardMesh.count) {
                this.shardMesh.setMatrixAt(i, dummy.matrix);
                this.shardMesh.setColorAt(i, shard.color);
            }
        }
        
        this.shardMesh.count = this.shards.length;
        this.shardMesh.instanceMatrix.needsUpdate = true;
        if (this.shardMesh.instanceColor) {
            this.shardMesh.instanceColor.needsUpdate = true;
        }
    }

    private updateSparkles(dt: number): void {
        if (!this.sparkleMesh) return;
        
        const dummy = new THREE.Object3D();
        
        for (let i = this.sparkles.length - 1; i >= 0; i--) {
            const sparkle = this.sparkles[i];
            sparkle.life -= dt;
            
            if (sparkle.life <= 0) {
                this.sparkles.splice(i, 1);
                continue;
            }
            
            // Float upward with slight drift
            sparkle.position.addScaledVector(sparkle.velocity, dt);
            sparkle.velocity.x += (Math.random() - 0.5) * dt;
            sparkle.velocity.z += (Math.random() - 0.5) * dt;
            sparkle.velocity.y *= 0.98; // Slow down upward motion
            
            // Twinkle
            const lifeRatio = sparkle.life / sparkle.maxLife;
            const scale = sparkle.size * lifeRatio;
            const twinkle = 0.5 + Math.sin(Date.now() * 0.01 + i) * 0.5;
            
            dummy.position.copy(sparkle.position);
            dummy.rotation.x += dt * 2;
            dummy.rotation.y += dt * 3;
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            
            if (i < this.sparkleMesh.count) {
                this.shardMesh!.setMatrixAt(i, dummy.matrix);
                const brightColor = sparkle.color.clone().multiplyScalar(0.5 + twinkle * 0.5);
                this.sparkleMesh.setColorAt(i, brightColor);
            }
        }
        
        this.sparkleMesh.count = this.sparkles.length;
        this.sparkleMesh.instanceMatrix.needsUpdate = true;
        if (this.sparkleMesh.instanceColor) {
            this.sparkleMesh.instanceColor.needsUpdate = true;
        }
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    getCandyCount(): number {
        return this.candies.length;
    }

    clear(): void {
        // Destroy all candies
        for (const candy of this.candies) {
            candy.destroy();
        }
        this.candies = [];
        this.shards = [];
        this.sparkles = [];
        
        // Reset instanced meshes
        if (this.shardMesh) {
            this.shardMesh.count = 0;
        }
        if (this.sparkleMesh) {
            this.sparkleMesh.count = 0;
        }
    }

    destroy(): void {
        this.clear();
        
        if (this.shardMesh) {
            this.scene.remove(this.shardMesh);
            this.shardMesh.geometry.dispose();
            (this.shardMesh.material as THREE.Material).dispose();
        }
        
        if (this.sparkleMesh) {
            this.scene.remove(this.sparkleMesh);
            this.sparkleMesh.geometry.dispose();
            (this.sparkleMesh.material as THREE.Material).dispose();
        }
    }
}

// ============================================================================
// CANDY BACKGROUND LAYER (Parallax candy belt like AsteroidFieldSystem)
// ============================================================================

export class CandyParallaxLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    depth: number;
    baseZ: number;
    
    positions: Float32Array;
    rotations: Float32Array;
    rotationSpeeds: Float32Array;
    candyTypes: CandyType[];
    flavors: CandyFlavor[];
    
    private time: number = 0;

    constructor(
        scene: THREE.Scene,
        config: {
            count: number;
            z: number;
            zRange: number;
            width: number;
            type: 'gummy' | 'lollipop' | 'jellybean' | 'cotton_candy' | 'mixed';
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.z;
        this.depth = config.zRange;
        
        this.candyTypes = [];
        this.flavors = [];
        
        // Create geometry based on type
        const geometry = this.createCandyGeometry(config.type);
        const material = this.createCandyMaterial(config.type);
        
        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.frustumCulled = false;
        
        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.rotations = new Float32Array(this.count * 3);
        this.rotationSpeeds = new Float32Array(this.count * 3);
        
        // Initialize instances
        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 40;
            const z = this.baseZ + (Math.random() - 0.5) * this.depth;
            
            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;
            
            const rx = Math.random() * Math.PI * 2;
            const ry = Math.random() * Math.PI * 2;
            const rz = Math.random() * Math.PI * 2;
            
            this.rotations[i * 3] = rx;
            this.rotations[i * 3 + 1] = ry;
            this.rotations[i * 3 + 2] = rz;
            
            this.rotationSpeeds[i * 3] = (Math.random() - 0.5) * 0.5;
            this.rotationSpeeds[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
            this.rotationSpeeds[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
            
            // Store type and flavor
            this.candyTypes.push(this.getRandomType(config.type));
            this.flavors.push(Object.values(CandyFlavor)[Math.floor(Math.random() * 6)]);
            
            this.dummy.position.set(x, y, z);
            this.dummy.rotation.set(rx, ry, rz);
            
            const scale = 0.5 + Math.random() * 0.8;
            this.dummy.scale.setScalar(scale);
            
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        
        scene.add(this.mesh);
    }

    private createCandyGeometry(type: string): THREE.BufferGeometry {
        switch (type) {
            case 'gummy':
                return new THREE.IcosahedronGeometry(1, 1);
            case 'lollipop':
                return new THREE.SphereGeometry(1, 16, 16);
            case 'jellybean':
                return new THREE.SphereGeometry(1, 12, 12);
            case 'cotton_candy':
                return new THREE.DodecahedronGeometry(1, 0);
            default:
                return new THREE.IcosahedronGeometry(1, 0);
        }
    }

    private createCandyMaterial(type: string): THREE.Material {
        const colors = CANDY_COLORS[CandyFlavor.STRAWBERRY];
        
        switch (type) {
            case 'gummy':
                return new THREE.MeshPhysicalMaterial({
                    color: colors.primary,
                    transmission: 0.3,
                    thickness: 1.0,
                    roughness: 0.2,
                    clearcoat: 0.8,
                    transparent: true,
                    opacity: 0.85
                });
            case 'lollipop':
                return new THREE.MeshStandardMaterial({
                    color: colors.primary,
                    roughness: 0.3,
                    metalness: 0.2
                });
            case 'jellybean':
                return new THREE.MeshPhysicalMaterial({
                    color: colors.primary,
                    roughness: 0.15,
                    clearcoat: 0.8
                });
            case 'cotton_candy':
                return new THREE.MeshStandardMaterial({
                    color: colors.primary,
                    roughness: 0.9,
                    transparent: true,
                    opacity: 0.6
                });
            default:
                return new THREE.MeshStandardMaterial({
                    color: colors.primary,
                    roughness: 0.4
                });
        }
    }

    private getRandomType(configType: string): CandyType {
        if (configType !== 'mixed') {
            return configType as CandyType;
        }
        const types = Object.values(CandyType);
        return types[Math.floor(Math.random() * types.length)];
    }

    update(delta: number, cameraX: number) {
        this.time += delta;
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;
        
        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;
            
            // Rotation
            this.rotations[idx] += this.rotationSpeeds[idx] * delta;
            this.rotations[idx + 1] += this.rotationSpeeds[idx + 1] * delta;
            this.rotations[idx + 2] += this.rotationSpeeds[idx + 2] * delta;
            
            // Parallax scroll
            let x = this.positions[idx];
            
            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }
            
            // Get current scale
            this.mesh.getMatrixAt(i, this.dummy.matrix);
            const p = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            this.dummy.matrix.decompose(p, q, s);
            
            // Add gentle float for cotton candy types
            let y = this.positions[idx + 1];
            if (this.candyTypes[i] === CandyType.COTTON_CANDY) {
                y += Math.sin(this.time + i) * 0.01;
            }
            
            this.dummy.position.set(x, y, this.positions[idx + 2]);
            this.dummy.rotation.set(
                this.rotations[idx],
                this.rotations[idx + 1],
                this.rotations[idx + 2]
            );
            this.dummy.scale.copy(s);
            this.dummy.updateMatrix();
            
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

// ============================================================================
// CANDY FIELD SYSTEM (Main controller like AsteroidFieldSystem)
// ============================================================================

export class CandyFieldSystem {
    scene: THREE.Scene;
    layers: CandyParallaxLayer[] = [];
    active: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initLayers();
    }

    private initLayers() {
        // Foreground layer - Gummy asteroids
        this.layers.push(new CandyParallaxLayer(this.scene, {
            count: 12,
            z: 10,
            zRange: 5,
            width: 120,
            type: 'gummy'
        }));

        // Mid layer - Lollipops and jellybeans
        this.layers.push(new CandyParallaxLayer(this.scene, {
            count: 25,
            z: -10,
            zRange: 8,
            width: 180,
            type: 'mixed'
        }));

        // Background layer - Cotton candy clouds
        this.layers.push(new CandyParallaxLayer(this.scene, {
            count: 40,
            z: -35,
            zRange: 10,
            width: 250,
            type: 'cotton_candy'
        }));

        this.setVisible(false);
    }

    setVisible(visible: boolean) {
        this.layers.forEach(l => {
            l.mesh.visible = visible;
        });
        this.active = visible;
    }

    activate() {
        if (this.active) return;
        this.setVisible(true);
    }

    deactivate() {
        if (!this.active) return;
        this.setVisible(false);
    }

    update(delta: number, cameraX: number) {
        if (!this.active) return;
        this.layers.forEach(l => l.update(delta, cameraX));
    }
}
