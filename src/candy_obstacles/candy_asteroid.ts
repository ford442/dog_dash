import * as THREE from 'three';
import { CandyType, CandyFlavor, CANDY_COLORS, LOLLIPOP_SWIRLS } from './shared';
import { disposeObject } from '../utils';

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
        disposeObject(this.mesh);
        this.active = false;
    }
}

