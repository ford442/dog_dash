import * as THREE from 'three';
import { MeshStandardNodeMaterial, MeshPhysicalNodeMaterial } from 'three/webgpu';
import { uniform, distance, positionWorld, smoothstep, time, mix, color, vec4 } from 'three/tsl';

import { CandyType, CandyFlavor, CANDY_COLORS } from './shared';

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
    private uPlayerPos: ReturnType<typeof uniform>;

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
        this.uPlayerPos = uniform(new THREE.Vector3(0, -999, 0));
        
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
        
        // Base distance calculation for player glow
        const distToPlayer = distance(positionWorld, this.uPlayerPos);
        const glowIntensity = smoothstep(15.0, 0.0, distToPlayer);
        const glowColor = color(0xffffff).mul(glowIntensity.mul(0.6));

        switch (type) {
            case 'gummy': {
                const mat = new MeshPhysicalNodeMaterial({
                    color: colors.primary,
                    transmission: 0.3,
                    thickness: 1.0,
                    roughness: 0.2,
                    clearcoat: 0.8,
                    transparent: true,
                    opacity: 0.85
                });
                mat.emissiveNode = glowColor;
                return mat;
            }
            case 'lollipop': {
                const mat = new MeshStandardNodeMaterial({
                    color: colors.primary,
                    roughness: 0.3,
                    metalness: 0.2
                });
                mat.emissiveNode = glowColor;
                return mat;
            }
            case 'jellybean': {
                const mat = new MeshPhysicalNodeMaterial({
                    color: colors.primary,
                    roughness: 0.15,
                    clearcoat: 0.8
                });
                mat.emissiveNode = glowColor;
                return mat;
            }
            case 'cotton_candy': {
                const mat = new MeshStandardNodeMaterial({
                    color: colors.primary,
                    roughness: 0.9,
                    transparent: true,
                    opacity: 0.6
                });
                mat.emissiveNode = glowColor;
                return mat;
            }
            default: {
                const mat = new MeshStandardNodeMaterial({
                    color: colors.primary,
                    roughness: 0.4
                });
                mat.emissiveNode = glowColor;
                return mat;
            }
        }
    }

    private getRandomType(configType: string): CandyType {
        if (configType !== 'mixed') {
            return configType as CandyType;
        }
        const types = Object.values(CandyType);
        return types[Math.floor(Math.random() * types.length)];
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        this.time += delta;
        if (playerPos) {
            (this.uPlayerPos.value as THREE.Vector3).copy(playerPos);
        }
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

