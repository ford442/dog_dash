import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    time,
    positionWorld,
    color,
    uniform,
    mix,
    sin,
    cos,
    float,
    smoothstep,
    distance,
    loop,
    normalView,
    vec4
} from 'three/tsl';
import { WeaponLightManager } from './lighting';

/**
 * Creates a TSL material for asteroids with Rim Light and Weapon Light interaction.
 */
function createAsteroidMaterial(baseColorHex: number, opacity: number, weaponLights: any) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true,
        transparent: opacity < 1.0,
        opacity: opacity
    });

    const vNormalView = normalView; // View space normal

    // Rim Lighting
    // Intensity increases as normal faces away from camera (z approaches 0)
    // normalView.z is 1.0 when facing camera, 0.0 at edge.
    const rim = float(1.0).sub(vNormalView.z.abs());
    const rimGlow = rim.pow(3.0).mul(0.5); // Subtle rim

    // Weapon Light Interaction
    const weaponGlow = float(0.0).toVar();
    const uWeaponColor = uniform(new THREE.Color(0x00ffff)); // Cyan

    loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w; // 2.0 or 0.0

        // distance from world pos of fragment to light
        const distToLight = distance(positionWorld, lightPos);

        // Range 20.0 (slightly less than full projectile range to keep it tight)
        const lightRadius = float(20.0);

        const falloff = smoothstep(lightRadius, 0.0, distToLight);

        weaponGlow.addAssign(falloff.mul(lightIntensity));
    });

    // Emissive Output
    // Combine Rim Light (White/Base) + Weapon Glow (Cyan)
    const baseColor = color(new THREE.Color(baseColorHex));
    // Rim light is just boosted base color
    // Weapon light adds color
    const finalEmissive = baseColor.mul(rimGlow).add(uWeaponColor.mul(weaponGlow));

    mat.emissiveNode = finalEmissive;

    return mat;
}

/**
 * Manages a single layer of parallax asteroids using InstancedMesh.
 */
export class AsteroidLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    depth: number;
    baseZ: number;

    // Instance Data
    positions: Float32Array;
    rotations: Float32Array;
    rotationSpeeds: Float32Array;

    constructor(
        scene: THREE.Scene,
        config: {
            count: number,
            color: number,
            sizeMin: number,
            sizeMax: number,
            z: number,
            zRange: number,
            width: number,
            opacity?: number,
            weaponLights: any
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.z;
        this.depth = config.zRange;

        // Geometry: Icosahedron for jagged rock look
        const geometry = new THREE.IcosahedronGeometry(1, 0);

        // Material: TSL Node Material
        const material = createAsteroidMaterial(config.color, config.opacity ?? 1.0, config.weaponLights);

        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Don't frustrate player with background collisions (handled by main.ts logic anyway)
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.rotations = new Float32Array(this.count * 3); // Euler angles
        this.rotationSpeeds = new Float32Array(this.count * 3); // Speed per axis

        for (let i = 0; i < this.count; i++) {
            // Random Position
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 40; // Vertical spread
            const z = this.baseZ + (Math.random() - 0.5) * this.depth;

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;

            // Random Rotation
            const rx = Math.random() * Math.PI * 2;
            const ry = Math.random() * Math.PI * 2;
            const rz = Math.random() * Math.PI * 2;

            this.rotations[i * 3] = rx;
            this.rotations[i * 3 + 1] = ry;
            this.rotations[i * 3 + 2] = rz;

            // Random Rotation Speed
            this.rotationSpeeds[i * 3] = (Math.random() - 0.5) * 1.0;
            this.rotationSpeeds[i * 3 + 1] = (Math.random() - 0.5) * 1.0;
            this.rotationSpeeds[i * 3 + 2] = (Math.random() - 0.5) * 1.0;

            // Setup instance
            this.dummy.position.set(x, y, z);
            this.dummy.rotation.set(rx, ry, rz);

            const scale = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
            this.dummy.scale.setScalar(scale);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
    }

    update(delta: number, cameraX: number) {
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;

            // 1. Rotation Animation
            this.rotations[idx] += this.rotationSpeeds[idx] * delta;
            this.rotations[idx+1] += this.rotationSpeeds[idx+1] * delta;
            this.rotations[idx+2] += this.rotationSpeeds[idx+2] * delta;

            // 2. Parallax / Infinite Scroll Logic
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

            // Update Instance
            // Scale handling: Reconstruct transform
            this.mesh.getMatrixAt(i, this.dummy.matrix);
            const p = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            this.dummy.matrix.decompose(p, q, s); // Get current scale

            this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
            this.dummy.rotation.set(
                this.rotations[idx],
                this.rotations[idx+1],
                this.rotations[idx+2]
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

export class AsteroidFieldSystem {
    scene: THREE.Scene;
    layers: AsteroidLayer[] = [];
    active: boolean = false;
    weaponLightManager: WeaponLightManager;

    constructor(scene: THREE.Scene, weaponLightManager: WeaponLightManager) {
        this.scene = scene;
        this.weaponLightManager = weaponLightManager;
        this.initLayers();
    }

    initLayers() {
        const weaponLights = this.weaponLightManager.storageNode;

        // Layer 1: Foreground (Close, Large, Darker/Threatening)
        this.layers.push(new AsteroidLayer(this.scene, {
            count: 15,
            color: 0x333333, // Dark grey
            sizeMin: 1.5,
            sizeMax: 3.0,
            z: 12,
            zRange: 6,
            width: 150,
            weaponLights: weaponLights
        }));

        // Layer 2: Background Mid
        this.layers.push(new AsteroidLayer(this.scene, {
            count: 40,
            color: 0x555566,
            sizeMin: 1.0,
            sizeMax: 2.0,
            z: -15,
            zRange: 10,
            width: 200,
            weaponLights: weaponLights
        }));

        // Layer 3: Deep Background
        this.layers.push(new AsteroidLayer(this.scene, {
            count: 80,
            color: 0x222233,
            sizeMin: 0.5,
            sizeMax: 1.2,
            z: -40,
            zRange: 10,
            width: 300,
            opacity: 0.8,
            weaponLights: weaponLights
        }));

        // Start hidden
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
