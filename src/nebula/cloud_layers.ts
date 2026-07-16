import * as THREE from 'three';
import { createNebulaMaterial, createEnergyParticleMaterial } from './materials';
import { createButterflyMaterial } from './materials_butterfly_ribbon';

export class NebulaCloudLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    depth: number;
    baseZ: number;
    positions: Float32Array;
    velocities: Float32Array;

    constructor(
        scene: THREE.Scene,
        config: {
            count: number,
            color1: number,
            color2: number,
            opacity: number,
            sizeMin: number,
            sizeMax: number,
            z: number,
            zRange: number,
            width: number,
            height: number,
            uGlobalPulse: any,
            weaponLights: any,
            uMagicIntensity: any
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.depth = config.zRange;
        this.baseZ = config.z;

        const geo = new THREE.SphereGeometry(1, 8, 8);
        const mat = createNebulaMaterial(config.color1, config.color2, config.opacity, config.uGlobalPulse, config.weaponLights, config.uMagicIntensity);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -1;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.velocities = new Float32Array(this.count * 3);

        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.height;
            const z = this.baseZ + (Math.random() - 0.5) * this.depth;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            this.velocities[i*3] = (Math.random() - 0.5) * 2.0;
            this.velocities[i*3+1] = (Math.random() - 0.5) * 0.5;
            this.velocities[i*3+2] = 0;

            this.dummy.position.set(x, y, z);
            const s = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
            this.dummy.scale.set(s * 1.5, s, s);
            this.dummy.rotation.z = Math.random() * Math.PI;

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        const margin = 50;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        // Update Player Pos Uniform
        if (playerPos) {
            const mat = this.mesh.material as any;
            if (mat.userData && mat.userData.uPlayerPos) {
                mat.userData.uPlayerPos.value.copy(playerPos);
            }
        }

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;
            this.positions[idx] += this.velocities[idx] * delta;
            this.positions[idx+1] += this.velocities[idx+1] * delta;

            let x = this.positions[idx];
            let y = this.positions[idx+1];
            let z = this.positions[idx+2];

            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            if (y > 40) { y = -40; this.positions[idx+1] = y; needsUpdate = true; }
            if (y < -40) { y = 40; this.positions[idx+1] = y; needsUpdate = true; }

            if (needsUpdate || true) {
                this.mesh.getMatrixAt(i, this.dummy.matrix);
                const p = new THREE.Vector3();
                const q = new THREE.Quaternion();
                const s = new THREE.Vector3();
                this.dummy.matrix.decompose(p, q, s);

                this.dummy.position.set(x, y, z);
                this.dummy.rotation.z += delta * 0.05;
                this.dummy.scale.copy(s);
                // Do not copy quaternion back, as it overwrites rotation.z update
                // this.dummy.quaternion.copy(q);

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}


/**
 * Creates a TSL material for a whimsical butterfly mote.
 */
function createButterflyMaterial(colorHex: number, uGlobalPulse: any, uMagicIntensity: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const uTime = time;
    const pos = positionLocal;

    // Wing flap animation
    const flapSpeed = float(15.0).add(uMagicIntensity.mul(15.0)); // flap faster with magic
    const flap = sin(uTime.mul(flapSpeed));
    // Fold plane on X axis
    const zOffset = pos.x.abs().mul(flap);

    mat.positionNode = vec3(pos.x, pos.y, pos.z.add(zOffset));

    const phase = pos.x.mul(10.0).add(pos.y.mul(20.0)).add(pos.z.mul(30.0));
    const sparkle = sin(uTime.mul(5.0).add(phase)).add(1.0).mul(0.5);
    const sharpSparkle = pow(sparkle, 2.0);

    // Base colors
    const baseColor = color(new THREE.Color(colorHex));
    const pastelColor = mix(baseColor, color(0xffffff), 0.5);

    // Glow intensifies with magic
    const magicGlow = mix(float(0.5), float(1.0), uMagicIntensity);
    const globalSync = uGlobalPulse.mul(0.5).add(0.5);

    mat.colorNode = vec4(pastelColor, sharpSparkle.mul(globalSync).mul(magicGlow));

    return mat;
}

export class EnergyParticleLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    baseZ: number;
    positions: Float32Array;

    constructor(scene: THREE.Scene, count: number, z: number, width: number, uGlobalPulse: any) {
        this.count = count;
        this.width = width;
        this.baseZ = z;

        const geo = new THREE.OctahedronGeometry(0.2, 0);
        const mat = createEnergyParticleMaterial(0x88ffff, uGlobalPulse);

        this.mesh = new THREE.InstancedMesh(geo, mat, count);
        this.mesh.renderOrder = -1;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(count * 3);

        for(let i=0; i<count; i++) {
            const x = (Math.random() - 0.5) * width;
            const y = (Math.random() - 0.5) * 30;
            const z = this.baseZ + (Math.random() - 0.5) * 10;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            this.dummy.position.set(x, y, z);
            this.dummy.scale.setScalar(0.5 + Math.random());
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

        for(let i=0; i<this.count; i++) {
            const idx = i*3;
            let x = this.positions[idx];
            x += delta * 0.5;

            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            this.positions[idx] = x;
            this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
            this.dummy.rotation.y += delta;
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true;
        }

        if (needsUpdate) this.mesh.instanceMatrix.needsUpdate = true;
    }
}


export class ButterflyEnergyMoteLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    baseZ: number;
    positions: Float32Array;

    constructor(scene: THREE.Scene, count: number, z: number, width: number, uGlobalPulse: any, uMagicIntensity: any) {
        this.count = count;
        this.width = width;
        this.baseZ = z;

        const geo = new THREE.PlaneGeometry(0.4, 0.4);
        const mat = createButterflyMaterial(0xffaaff, uGlobalPulse, uMagicIntensity);

        this.mesh = new THREE.InstancedMesh(geo, mat, count);
        this.mesh.renderOrder = -1;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(count * 3);

        for(let i=0; i<count; i++) {
            const x = (Math.random() - 0.5) * width;
            const y = (Math.random() - 0.5) * 30;
            const z = this.baseZ + (Math.random() - 0.5) * 10;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            this.dummy.position.set(x, y, z);
            this.dummy.scale.setScalar(0.5 + Math.random());
            // Random orientation
            this.dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
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

        for(let i=0; i<this.count; i++) {
            const idx = i*3;
            let x = this.positions[idx];
            x += delta * 0.2; // Move slightly slower than simple motes

            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            this.positions[idx] = x;
            this.positions[idx+1] += Math.sin(x * 0.5) * delta * 0.5; // Slight vertical bobbing
            this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);

            // Slow rotation to simulate drifting butterfly
            this.mesh.getMatrixAt(i, this.dummy.matrix);
            const p = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            this.dummy.matrix.decompose(p, q, s);

            this.dummy.rotation.setFromQuaternion(q);
            this.dummy.rotation.y += delta * 0.5;
            this.dummy.scale.copy(s);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true;
        }

        if (needsUpdate) this.mesh.instanceMatrix.needsUpdate = true;
    }
}
