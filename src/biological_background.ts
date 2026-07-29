import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    time,
    uv,
    vec2,
    vec3,
    vec4,
    color,
    uniform,
    mix,
    sin,
    cos,
    float,
    smoothstep,
    dot,
    fract,
    length,
    pow,
    normalView,
    positionLocal
} from 'three/tsl';
import type { TSLNode } from './tsl_types';

// --- TSL Noise Helpers (Shared Logic) ---

const random2D = (v: any) => {
    return sin(dot(v, vec2(12.9898, 78.233))).mul(43758.5453).fract();
};

const valueNoise = (v: any) => {
    const i = v.floor();
    const f = v.fract();

    // Four corners
    const a = random2D(i);
    const b = random2D(i.add(vec2(1.0, 0.0)));
    const c = random2D(i.add(vec2(0.0, 1.0)));
    const d = random2D(i.add(vec2(1.0, 1.0)));

    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

    return mix(a, b, u.x).add(
        (c.sub(a).mul(u.y).mul(float(1.0).sub(u.x))).add(
        (d.sub(b).mul(u.x).mul(u.y)))
    );
};

const fbm = (v: any) => {
    let total: TSLNode = float(0.0);
    let amplitude: TSLNode = float(0.5);
    let frequency: TSLNode = float(1.0);

    // 3 Octaves
    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);

    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);

    total = total.add(valueNoise(v.mul(frequency)).mul(amplitude));

    return total;
};

/**
 * Creates a TSL material for organic tissue walls.
 * Visuals: Red/Pink, fleshy noise, pulsing.
 */
function createTissueMaterial(color1Hex: number, color2Hex: number) {
    const mat = new MeshStandardNodeMaterial({
        roughness: 0.6,
        metalness: 0.1,
        side: THREE.FrontSide
    });

    const uTime = time;
    const vUv = uv();

    // Organic movement: slowly morphing noise
    // Scale UVs
    const p = vUv.mul(4.0);

    // Add time offset to noise for "breathing" texture
    const t = uTime.mul(0.2);
    const noiseVal = fbm(p.add(vec2(t, t.mul(0.5))));

    // Colors
    const c1 = color(new THREE.Color(color1Hex)); // Dark Red
    const c2 = color(new THREE.Color(color2Hex)); // Pinkish

    // Mix based on noise
    const tissueColor = mix(c1, c2, noiseVal);

    // Add a heartbeat pulse to emission
    const pulse = sin(uTime.mul(2.0)).add(1.0).mul(0.5); // 0..1
    const glow = c2.mul(pulse).mul(0.2); // Subtle glow

    mat.colorNode = vec4(tissueColor, 1.0);
    mat.emissiveNode = glow;

    return mat;
}

/**
 * Creates a TSL material for Veins.
 * Visuals: Web-like branching, flowing.
 */
function createVeinMaterial(colorHex: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false, // Additive-ish feel
        blending: THREE.NormalBlending
    });

    const uTime = time;
    const vUv = uv();

    // Branching pattern simulation using high-freq FBM and thresholding
    const p = vUv.mul(10.0);
    const flow = uTime.mul(0.5);

    // Flow along Y (or X depending on orientation)
    // We distort the domain to look like flow
    const distortedP = p.add(vec2(0.0, flow));

    const n = fbm(distortedP);

    // Veins are the "ridges" of the noise (where value is high)
    // Use smoothstep to isolate thin lines
    const veinMask = smoothstep(0.6, 0.7, n);

    const baseColor = color(new THREE.Color(colorHex));

    // Pulsing intensity
    const pulse = sin(uTime.mul(3.0)).add(1.0).mul(0.5);
    const finalColor = baseColor.mul(pulse.add(0.5));

    mat.colorNode = vec4(finalColor, veinMask); // Use mask as alpha

    return mat;
}

/**
 * Creates a TSL material for Corpuscles (Blood Cells).
 * Visuals: Disc/Sphere, Rim lighting, translucent center.
 */
function createCorpuscleMaterial(colorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness: 0.4,
        metalness: 0.0,
        transparent: true,
        opacity: 0.9
    });

    // Fresnel / Rim Lighting (classic cell look)
    const nView = normalView;
    const rim = float(1.0).sub(nView.z.abs());
    const glow = rim.pow(3.0);

    const baseColor = color(new THREE.Color(colorHex));
    const centerColor = color(new THREE.Color(colorHex).multiplyScalar(0.5)); // Darker center

    // Mix based on rim
    const finalColor = mix(centerColor, baseColor, rim);

    mat.colorNode = vec4(finalColor, float(0.8).add(glow.mul(0.2)));
    mat.emissiveNode = baseColor.mul(glow).mul(0.5);

    return mat;
}

// --- Layers ---

export class BiologicalLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    baseZ: number;
    positions: Float32Array;

    constructor(
        scene: THREE.Scene,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        config: {
            count: number,
            z: number,
            zRange: number,
            width: number,
            height: number,
            scaleMin: number,
            scaleMax: number
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.z;

        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);

        for(let i=0; i<this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.height;
            const z = this.baseZ + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            this.dummy.position.set(x, y, z);

            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.dummy.scale.set(s, s, s);

            this.dummy.rotation.z = Math.random() * Math.PI * 2;

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
        this.mesh.visible = false;
    }

    update(cameraX: number) {
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        for(let i=0; i<this.count; i++) {
            const idx = i*3;
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

            if (needsUpdate) {
                this.mesh.getMatrixAt(i, this.dummy.matrix);
                const p = new THREE.Vector3();
                const q = new THREE.Quaternion();
                const s = new THREE.Vector3();
                this.dummy.matrix.decompose(p, q, s);

                this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
                this.dummy.scale.copy(s);
                this.dummy.quaternion.copy(q);

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

export class CorpuscleSystem {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    positions: Float32Array;
    velocities: Float32Array; // Flow velocity
    rotations: Float32Array; // Current rotation
    width: number;

    constructor(scene: THREE.Scene, count: number, z: number, width: number) {
        this.count = count;
        this.width = width;

        // Sphere geometry for cells
        const geo = new THREE.SphereGeometry(0.3, 8, 8);
        const mat = createCorpuscleMaterial(0xff3333); // Red blood cells

        this.mesh = new THREE.InstancedMesh(geo, mat, count);
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count); // X speed
        this.rotations = new Float32Array(count * 3);

        for(let i=0; i<count; i++) {
            const x = (Math.random() - 0.5) * width;
            const y = (Math.random() - 0.5) * 30;
            const cellZ = z + (Math.random() - 0.5) * 20;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = cellZ;

            this.velocities[i] = 2.0 + Math.random() * 4.0; // Flow speed

            // Initial Rotation
            const rx = Math.random()*Math.PI;
            const ry = Math.random()*Math.PI;
            const rz = Math.random()*Math.PI;

            this.rotations[i*3] = rx;
            this.rotations[i*3+1] = ry;
            this.rotations[i*3+2] = rz;

            this.dummy.position.set(x, y, cellZ);

            // Flatten slightly to look like disc?
            this.dummy.scale.set(1.0, 1.0, 0.4);
            this.dummy.rotation.set(rx, ry, rz);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number) {
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        for(let i=0; i<this.count; i++) {
            const idx = i*3;
            let x = this.positions[idx];

            // Move with flow
            x += this.velocities[i] * delta;

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

            // Tumble rotation (Individual)
            this.rotations[idx] += delta * 0.5;
            this.rotations[idx+1] += delta * 0.3;

            this.dummy.rotation.set(
                this.rotations[idx],
                this.rotations[idx+1],
                this.rotations[idx+2]
            );

            // Re-apply scale since we are reusing dummy
            this.dummy.scale.set(1.0, 1.0, 0.4);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true;
        }

        if (needsUpdate) this.mesh.instanceMatrix.needsUpdate = true;
    }
}

export class BiologicalBackgroundSystem {
    scene: THREE.Scene;
    active: boolean = false;
    layers: BiologicalLayer[] = [];
    corpuscles: CorpuscleSystem;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // 1. Deep Background Tissue (Muscle Wall)
        // Huge, far back, dark red
        const tissueGeo = new THREE.PlaneGeometry(20, 20); // Large planes
        const tissueMat = createTissueMaterial(0x440000, 0x661111);

        this.layers.push(new BiologicalLayer(this.scene, tissueGeo, tissueMat, {
            count: 40,
            z: -40,
            zRange: 10,
            width: 300,
            height: 60,
            scaleMin: 2.0,
            scaleMax: 3.0
        }));

        // 2. Midground Vein Network
        // Transparent webs
        const veinGeo = new THREE.PlaneGeometry(15, 15);
        const veinMat = createVeinMaterial(0xff0055);

        this.layers.push(new BiologicalLayer(this.scene, veinGeo, veinMat, {
            count: 30,
            z: -20,
            zRange: 5,
            width: 250,
            height: 50,
            scaleMin: 1.5,
            scaleMax: 2.5
        }));

        // 3. Corpuscles (Blood Cells)
        this.corpuscles = new CorpuscleSystem(this.scene, 100, -10, 200);
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.layers.forEach(l => l.mesh.visible = true);
        this.corpuscles.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.layers.forEach(l => l.mesh.visible = false);
        this.corpuscles.mesh.visible = false;
    }

    update(delta: number, cameraX: number) {
        if (!this.active) return;
        this.layers.forEach(l => l.update(cameraX));
        this.corpuscles.update(delta, cameraX);
    }
}
