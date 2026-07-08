import * as THREE from 'three';
import { WeaponLightManager } from './lighting';
import { createAsteroidFieldMaterial } from './candy_materials';

/**
 * Manages a single layer of parallax asteroids using InstancedMesh.
 *
 * Candy/gummy variants replace a fraction of instances (same total count).
 */
export class AsteroidLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    maxCount: number;
    width: number;
    depth: number;
    baseZ: number;
    sizeMin: number;
    sizeMax: number;

    // Instance Data
    positions: Float32Array;
    rotations: Float32Array;
    rotationSpeeds: Float32Array;
    scales: Float32Array;
    velocities: Float32Array;
    candyMix: Float32Array;
    candyHue: Float32Array;
    candyChance: number;

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
            weaponLights: any,
            candyChance?: number
        }
    ) {
        this.maxCount = config.count;
        this.width = config.width;
        this.baseZ = config.z;
        this.depth = config.zRange;
        this.sizeMin = config.sizeMin;
        this.sizeMax = config.sizeMax;
        this.candyChance = config.candyChance ?? 0;

        // Geometry: Icosahedron for jagged rock look
        const geometry = new THREE.IcosahedronGeometry(1, 0);

        // Material: TSL Node Material (rock + optional candy mix per instance)
        const material = createAsteroidFieldMaterial(
            config.color,
            config.opacity ?? 1.0,
            config.weaponLights,
            this.candyChance
        );

        this.mesh = new THREE.InstancedMesh(geometry, material, this.maxCount);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Don't frustrate player with background collisions (handled by main.ts logic anyway)
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.maxCount * 3);
        this.rotations = new Float32Array(this.maxCount * 3); // Euler angles
        this.rotationSpeeds = new Float32Array(this.maxCount * 3); // Speed per axis
        this.scales = new Float32Array(this.maxCount * 3);
        this.velocities = new Float32Array(this.maxCount * 3);
        this.candyMix = new Float32Array(this.maxCount);
        this.candyHue = new Float32Array(this.maxCount);

        for (let i = 0; i < this.maxCount; i++) {
            this._rollCandyVariant(i);
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

            const scale = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
            this.scales[i * 3] = scale;
            this.scales[i * 3 + 1] = scale;
            this.scales[i * 3 + 2] = scale;

            this.velocities[i * 3] = 0;
            this.velocities[i * 3 + 1] = 0;
            this.velocities[i * 3 + 2] = 0;

            // Setup instance
            this.dummy.position.set(x, y, z);
            this.dummy.rotation.set(rx, ry, rz);
            this.dummy.scale.setScalar(scale);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        geometry.setAttribute('aCandyMix', new THREE.InstancedBufferAttribute(this.candyMix, 1));
        geometry.setAttribute('aCandyHue', new THREE.InstancedBufferAttribute(this.candyHue, 1));

        scene.add(this.mesh);
    }

    private _rollCandyVariant(index: number) {
        const isCandy = this.candyChance > 0 && Math.random() < this.candyChance;
        this.candyMix[index] = isCandy ? 1 : 0;
        this.candyHue[index] = Math.random();
    }

    setCandyChance(chance: number) {
        this.candyChance = Math.max(0, Math.min(1, chance));
        for (let i = 0; i < this.maxCount; i++) {
            this._rollCandyVariant(i);
        }
        const geo = this.mesh.geometry;
        const mixAttr = geo.getAttribute('aCandyMix') as THREE.InstancedBufferAttribute;
        const hueAttr = geo.getAttribute('aCandyHue') as THREE.InstancedBufferAttribute;
        if (mixAttr) mixAttr.needsUpdate = true;
        if (hueAttr) hueAttr.needsUpdate = true;
    }

    setDensity(multiplier: number) {
        const newCount = Math.floor(this.maxCount * multiplier);
        this.mesh.count = Math.min(Math.max(newCount, 0), this.maxCount);
    }

    resetPositions(cameraX: number) {
        for (let i = 0; i < this.maxCount; i++) {
            const idx = i * 3;

            const x = cameraX + (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 40;
            const z = this.baseZ + (Math.random() - 0.5) * this.depth;

            this.positions[idx] = x;
            this.positions[idx + 1] = y;
            this.positions[idx + 2] = z;

            this.mesh.getMatrixAt(i, this.dummy.matrix);
            const p = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            this.dummy.matrix.decompose(p, q, s);

            this.velocities[idx] = 0;
            this.velocities[idx + 1] = 0;
            this.velocities[idx + 2] = 0;

            this.dummy.position.set(x, y, z);
            this.dummy.rotation.set(
                this.rotations[idx],
                this.rotations[idx+1],
                this.rotations[idx+2]
            );
            this.dummy.scale.set(this.scales[idx], this.scales[idx+1], this.scales[idx+2]);
            this.dummy.updateMatrix();

            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }


    breakAsteroid(hitIdx: number, hitPos: THREE.Vector3, cameraPos: THREE.Vector3, shotDirection: THREE.Vector3 = new THREE.Vector3(1, 0, 0)) {
        // Hide original asteroid by making scale 0
        const idx = hitIdx * 3;
        const originalScale = this.scales[idx];
        this.scales[idx] = 0;
        this.scales[idx+1] = 0;
        this.scales[idx+2] = 0;

        // Find 2-4 asteroids off-screen to use as fragments
        const margin = 20;
        const limitBack = cameraPos.x - (this.width / 2) - margin;
        const limitFront = cameraPos.x + (this.width / 2) + margin;

        const numFragments = Math.floor(Math.random() * 3) + 2; // 2 to 4
        let fragmentsFound = 0;

        for (let i = 0; i < this.mesh.count; i++) {
            if (fragmentsFound >= numFragments) break;
            if (i === hitIdx) continue;

            const i3 = i * 3;
            const x = this.positions[i3];

            // If it's off-screen or invisible (scale 0)
            if (x < limitBack || x > limitFront || this.scales[i3] === 0) {
                fragmentsFound++;

                // Repurpose as fragment
                this.positions[i3] = hitPos.x + (Math.random() - 0.5) * originalScale;
                this.positions[i3+1] = hitPos.y + (Math.random() - 0.5) * originalScale;
                this.positions[i3+2] = hitPos.z + (Math.random() - 0.5) * originalScale;

                const fragmentScale = originalScale * (0.3 + Math.random() * 0.3);
                this.scales[i3] = fragmentScale;
                this.scales[i3+1] = fragmentScale;
                this.scales[i3+2] = fragmentScale;

                // Set burst velocity outward
                const outVel = new THREE.Vector3(
                    (Math.random() - 0.5) * 2.0,
                    (Math.random() - 0.5) * 2.0,
                    (Math.random() - 0.5) * 2.0
                ).normalize().multiplyScalar(5.0 + Math.random() * 10.0);

                // Add some inherited shot velocity
                outVel.add(shotDirection.clone().multiplyScalar(3.0));

                this.velocities[i3] = outVel.x;
                this.velocities[i3+1] = outVel.y;
                this.velocities[i3+2] = outVel.z;

                // Set random rotation speeds for fragments
                this.rotationSpeeds[i3] = (Math.random() - 0.5) * 5.0;
                this.rotationSpeeds[i3+1] = (Math.random() - 0.5) * 5.0;
                this.rotationSpeeds[i3+2] = (Math.random() - 0.5) * 5.0;

                // Update matrix immediately
                this.dummy.position.set(this.positions[i3], this.positions[i3+1], this.positions[i3+2]);
                this.dummy.rotation.set(this.rotations[i3], this.rotations[i3+1], this.rotations[i3+2]);
                this.dummy.scale.setScalar(fragmentScale);
                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
            }
        }

        // Update the original asteroid matrix
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(hitIdx, this.dummy.matrix);
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    hitAsteroid(worldPosition: THREE.Vector3, particleSystem: any, cameraPos: THREE.Vector3, shotDirection: THREE.Vector3 = new THREE.Vector3(1, 0, 0)): boolean {
        let hitFound = false;

        // Ray from camera to projectile
        const rayDir = new THREE.Vector3().subVectors(worldPosition, cameraPos).normalize();

        for (let i = 0; i < this.mesh.count; i++) {
            const idx = i * 3;
            const ax = this.positions[idx];
            const ay = this.positions[idx+1];
            const az = this.positions[idx+2];

            const scale = this.scales[idx];
            if (scale === 0) continue; // Skip already destroyed/invisible

            // 1. Find where the ray intersects the Z-plane of the asteroid
            // ray: P = cameraPos + t * rayDir
            // We want P.z = az
            // cameraPos.z + t * rayDir.z = az
            // t = (az - cameraPos.z) / rayDir.z

            if (Math.abs(rayDir.z) < 0.001) continue; // Prevent division by zero
            const t = (az - cameraPos.z) / rayDir.z;

            if (t < 0) continue; // Behind camera

            // Point of intersection on the asteroid's Z-plane
            const projectedX = cameraPos.x + t * rayDir.x;
            const projectedY = cameraPos.y + t * rayDir.y;

            // 2. Check 2D distance on that plane
            const distSq = (projectedX - ax) * (projectedX - ax) + (projectedY - ay) * (projectedY - ay);

            const hitRadius = scale * 1.5; // Approximate radius of Icosahedron * scale
            if (distSq < hitRadius * hitRadius) {
                // Hit!
                const hitPos = new THREE.Vector3(ax, ay, az);
                this.breakAsteroid(i, hitPos, cameraPos, shotDirection);

                // Emit particles
                if (particleSystem) {
                    particleSystem.emit(hitPos, 0x888888, 5, 2.0, scale);
                }

                hitFound = true;
                // Usually just hit one per check
                return true;
            }
        }

        return hitFound;
    }

    update(delta: number, cameraX: number) {
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        for (let i = 0; i < this.mesh.count; i++) {
            const idx = i * 3;

            // 1. Rotation Animation
            if (this.rotationSpeeds[idx] !== 0 || this.rotationSpeeds[idx+1] !== 0 || this.rotationSpeeds[idx+2] !== 0) {
                this.rotations[idx] += this.rotationSpeeds[idx] * delta;
                this.rotations[idx+1] += this.rotationSpeeds[idx+1] * delta;
                this.rotations[idx+2] += this.rotationSpeeds[idx+2] * delta;
                needsUpdate = true;
            }

            // 2. Parallax / Infinite Scroll Logic
            let x = this.positions[idx];
            let y = this.positions[idx+1];
            let z = this.positions[idx+2];

            if (this.velocities[idx] !== 0 || this.velocities[idx+1] !== 0 || this.velocities[idx+2] !== 0) {
                x += this.velocities[idx] * delta;
                y += this.velocities[idx+1] * delta;
                z += this.velocities[idx+2] * delta;
                needsUpdate = true;
            }

            if (x < limitBack || x > limitFront) {
                if (x < limitBack) {
                    x += this.width + margin * 2;
                } else {
                    x -= (this.width + margin * 2);
                }

                this.positions[idx] = x;

                // Reset Y and Z to original random distribution
                y = (Math.random() - 0.5) * 40; // Vertical spread
                z = this.baseZ + (Math.random() - 0.5) * this.depth;
                this.positions[idx+1] = y;
                this.positions[idx+2] = z;

                // Reset scale to original
                const scale = this.sizeMin + Math.random() * (this.sizeMax - this.sizeMin);
                this.scales[idx] = scale;
                this.scales[idx+1] = scale;
                this.scales[idx+2] = scale;

                // Reset velocities
                this.velocities[idx] = 0;
                this.velocities[idx+1] = 0;
                this.velocities[idx+2] = 0;

                // Reset rotation speeds
                this.rotationSpeeds[idx] = (Math.random() - 0.5) * 1.0;
                this.rotationSpeeds[idx+1] = (Math.random() - 0.5) * 1.0;
                this.rotationSpeeds[idx+2] = (Math.random() - 0.5) * 1.0;

                this._rollCandyVariant(i);

                needsUpdate = true;
            }

            this.positions[idx] = x;
            this.positions[idx+1] = y;
            this.positions[idx+2] = z;

            // Update Instance
            this.dummy.position.set(x, y, z);
            this.dummy.rotation.set(
                this.rotations[idx],
                this.rotations[idx+1],
                this.rotations[idx+2]
            );
            this.dummy.scale.set(this.scales[idx], this.scales[idx+1], this.scales[idx+2]);
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
    private candyChance = 0;

    constructor(scene: THREE.Scene, weaponLightManager: WeaponLightManager) {
        this.scene = scene;
        this.weaponLightManager = weaponLightManager;
        this.initLayers();
    }

    initLayers() {
        const weaponLights = this.weaponLightManager.storageNode;
        const layerConfigs = [
            { count: 15, color: 0x333333, sizeMin: 1.5, sizeMax: 3.0, z: 12, zRange: 6, width: 150 },
            { count: 40, color: 0x555566, sizeMin: 1.0, sizeMax: 2.0, z: -15, zRange: 10, width: 200 },
            { count: 80, color: 0x222233, sizeMin: 0.5, sizeMax: 1.2, z: -40, zRange: 10, width: 300, opacity: 0.8 }
        ] as const;

        for (const cfg of layerConfigs) {
            this.layers.push(new AsteroidLayer(this.scene, {
                ...cfg,
                weaponLights,
                candyChance: this.candyChance
            }));
        }

        // Start hidden
        this.setVisible(false);
    }

    /** Fraction of parallax instances that render as candy (replaces rock, same count). */
    setCandyChance(chance: number) {
        this.candyChance = Math.max(0, Math.min(1, chance));
        this.layers.forEach(l => l.setCandyChance(this.candyChance));
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

    setDensity(multiplier: number) {
        this.layers.forEach(l => l.setDensity(multiplier));
    }

    resetPositions(cameraX: number) {
        this.layers.forEach(l => l.resetPositions(cameraX));
    }

    hitAsteroid(worldPosition: THREE.Vector3, particleSystem: any, cameraPos: THREE.Vector3, shotDirection: THREE.Vector3 = new THREE.Vector3(1, 0, 0)): boolean {
        if (!this.active) return false;

        let hitFound = false;

        for (const layer of this.layers) {
            if (layer.hitAsteroid(worldPosition, particleSystem, cameraPos, shotDirection)) {
                hitFound = true;
            }
        }

        return hitFound;
    }

    update(delta: number, cameraX: number) {
        if (!this.active) return;
        this.layers.forEach(l => l.update(delta, cameraX));
    }
}
