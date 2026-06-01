import * as THREE from 'three';
// @ts-ignore
import { MeshStandardNodeMaterial } from 'three/webgpu';
// @ts-ignore
import {
    time,
    positionWorld,
    positionLocal,
    color,
    uniform,
    mix,
    sin,
    cos,
    float,
    smoothstep,
    distance,
    normalLocal,
    vec3,
    vec4,
    instanceIndex,
    fract,
    dot,
    step,
    pow,
    clamp,
    mat4
// @ts-ignore
} from 'three/tsl';

// --- TSL Noise Functions (3D) ---
const random3D = (v: any) => {
    return sin(dot(v, vec3(12.9898, 78.233, 37.719))).mul(43758.5453).fract();
};

const valueNoise3D = (v: any) => {
    const i = v.floor();
    const f = v.fract();

    // 8 corners
    const a = random3D(i);
    const b = random3D(i.add(vec3(1.0, 0.0, 0.0)));
    const c = random3D(i.add(vec3(0.0, 1.0, 0.0)));
    const d = random3D(i.add(vec3(1.0, 1.0, 0.0)));
    const e = random3D(i.add(vec3(0.0, 0.0, 1.0)));
    const f_ = random3D(i.add(vec3(1.0, 0.0, 1.0)));
    const g = random3D(i.add(vec3(0.0, 1.0, 1.0)));
    const h = random3D(i.add(vec3(1.0, 1.0, 1.0)));

    // Smooth interpolation curve
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

    // Mix X
    const mixX1 = mix(a, b, u.x);
    const mixX2 = mix(c, d, u.x);
    const mixX3 = mix(e, f_, u.x);
    const mixX4 = mix(g, h, u.x);

    // Mix Y
    const mixY1 = mix(mixX1, mixX2, u.y);
    const mixY2 = mix(mixX3, mixX4, u.y);

    // Mix Z
    return mix(mixY1, mixY2, u.z);
};

const fbm = (v: any) => {
    let total = float(0.0);
    let amplitude = float(0.5);
    let frequency = float(1.0);

    // 3 Octaves
    total = total.add(valueNoise3D(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);

    total = total.add(valueNoise3D(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);

    total = total.add(valueNoise3D(v.mul(frequency)).mul(amplitude));

    return total;
};

/**
 * Creates a TSL material for Chroma-Shift Rocks.
 */
function createChromaShiftMaterial(uPlayerPos: any) {
    const mat = new MeshStandardNodeMaterial({
        roughness: 0.2,
        metalness: 0.8,
        flatShading: true
    });

    const uTime = time;
    const pos = positionLocal;
    const worldPos = positionWorld;

    // --- Distance-Driven Proximity ---
    const distToPlayer = distance(worldPos, uPlayerPos);
    // When distance < 20m, the rock becomes highly stressed
    const stressFactor = smoothstep(20.0, 5.0, distToPlayer); // 0 at 20m, 1 at 5m

// --- GPU Rotation ---
    // Instead of CPU tumbling, we do a cheap rotation based on time and instanceIndex
    const t = uTime.mul(float(0.5).add(float(instanceIndex).mul(0.1))); // varying speed
    const cX = cos(t);
    const sX = sin(t);
    const cY = cos(t.mul(1.3));
    const sY = sin(t.mul(1.3));

    // Rotate around X
    const pX = vec3(pos.x, pos.y.mul(cX).sub(pos.z.mul(sX)), pos.y.mul(sX).add(pos.z.mul(cX)));
    // Rotate around Y
    const rotatedPos = vec3(pX.x.mul(cY).add(pX.z.mul(sY)), pX.y, pX.z.mul(cY).sub(pX.x.mul(sY)));

    // --- Vertex Displacement (Breathing/Rumbling) ---
    // Only rumble when stressed
    const rumbleSpeed = uTime.mul(10.0);
    const rumbleNoise = valueNoise3D(rotatedPos.mul(5.0).add(rumbleSpeed)).sub(0.5);
    const displacement = normalLocal.mul(rumbleNoise).mul(stressFactor).mul(0.2);
    mat.positionNode = rotatedPos.add(displacement);

    // --- Color / Hue Shift ---
    // Base color is a cool deep crystalline color
    const baseCol1 = color(0x224488);
    const baseCol2 = color(0x112244);
    const baseIridescence = sin(uTime.mul(0.5).add(worldPos.x).add(worldPos.y)).add(1.0).mul(0.5);
    const baseColor = mix(baseCol1, baseCol2, baseIridescence);

    // Stressed color (Vivid Magenta/Cyan)
    const stressCol1 = color(0xff00ff); // Magenta
    const stressCol2 = color(0x00ffff); // Cyan
    const stressIridescence = sin(uTime.mul(2.0).add(worldPos.x).add(worldPos.y)).add(1.0).mul(0.5);
    const stressColor = mix(stressCol1, stressCol2, stressIridescence);

    // Blend based on distance
    const finalColor = mix(baseColor, stressColor, stressFactor);
    mat.colorNode = finalColor;

    // --- Procedural Cracks (Shatter Mask) ---
    // Create a voronoi/vein-like structure using FBM noise
    const noiseVal = fbm(pos.mul(3.0).add(uTime.mul(0.2)));
    // Sharp ridge-like cracks
    const cracks = smoothstep(0.48, 0.5, noiseVal).sub(smoothstep(0.5, 0.52, noiseVal));

    // Cracks glow with intense cyan/magenta when stressed
    const crackGlowColor = color(0xffffff);
    // The cracks only appear/glow when stressed
    const crackIntensity = cracks.mul(stressFactor).mul(2.0); // Boost glow

    mat.emissiveNode = crackGlowColor.mul(crackIntensity);

    // Pass the player position uniform so we can update it
    mat.userData.uPlayerPos = uPlayerPos;

    return mat;
}

export class ChromaShiftSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh!: THREE.InstancedMesh;
    count: number = 0;
    maxCount: number = 2000;

    private dummy: THREE.Object3D;
    private positions: Float32Array;
    private scales: Float32Array;
    private rotations: Float32Array;

    private uPlayerPos: any;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.dummy = new THREE.Object3D();

        // Arrays for instance properties
        this.positions = new Float32Array(this.maxCount * 3);
        this.scales = new Float32Array(this.maxCount);
        this.rotations = new Float32Array(this.maxCount * 3);

        this._initMesh();
        this.deactivate();
    }

    private _initMesh() {
        // High detail Icosahedron for the crystalline look
        const geometry = new THREE.IcosahedronGeometry(1, 1);

        // Add random displacement to base geometry to make each rock unique
        const posAttr = geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);

            const scaleX = 1 + (Math.random() - 0.5) * 0.4;
            const scaleY = 1 + (Math.random() - 0.5) * 0.4;
            const scaleZ = 1 + (Math.random() - 0.5) * 0.4;

            posAttr.setXYZ(i, vx * scaleX, vy * scaleY, vz * scaleZ);
        }
        geometry.computeVertexNormals();

        this.uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
        const material = createChromaShiftMaterial(this.uPlayerPos);

        this.mesh = new THREE.InstancedMesh(geometry, material, this.maxCount);
        this.mesh.count = 0; // Start with 0 visible
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = true;

        this.scene.add(this.mesh);
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    /**
     * Add a rock at the given position with the given size.
     */
    addRock(position: THREE.Vector3, size: number) {
        if (this.count >= this.maxCount) return; // Full

        const idx = this.count;

        this.positions[idx * 3] = position.x;
        this.positions[idx * 3 + 1] = position.y;
        this.positions[idx * 3 + 2] = position.z;

        this.scales[idx] = size;

        this.rotations[idx * 3] = Math.random() * Math.PI * 2;
        this.rotations[idx * 3 + 1] = Math.random() * Math.PI * 2;
        this.rotations[idx * 3 + 2] = Math.random() * Math.PI * 2;

        this._updateInstance(idx);
        this.count++;
        this.mesh.count = this.count;
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    /**
     * Clear all rocks (e.g., between levels).
     */
    clearRocks() {
        this.count = 0;
        this.mesh.count = 0;
    }

    private _updateInstance(idx: number) {
        this.dummy.position.set(
            this.positions[idx * 3],
            this.positions[idx * 3 + 1],
            this.positions[idx * 3 + 2]
        );
        this.dummy.rotation.set(
            this.rotations[idx * 3],
            this.rotations[idx * 3 + 1],
            this.rotations[idx * 3 + 2]
        );
        const s = this.scales[idx];
        this.dummy.scale.set(s, s, s);

        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(idx, this.dummy.matrix);
    }

    update(delta: number, playerPos?: THREE.Vector3) {
        if (!this.active || this.count === 0) return;

        // Update player position uniform for the shader
        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }





    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as any).dispose?.();
    }
}
