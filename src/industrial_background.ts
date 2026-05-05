import * as THREE from 'three';
import {
    MeshStandardNodeMaterial
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
    step,
    fract
} from 'three/tsl';

/**
 * Creates a TSL material for a conveyor belt with animated warning stripes.
 * Visuals:
 * - Scrolling diagonal stripes (black and yellow)
 * - Metallic roughness
 */
function createConveyorMaterial(speed: number) {
    const mat = new MeshStandardNodeMaterial({
        color: 0x888888,
        roughness: 0.7,
        metalness: 0.6,
        side: THREE.FrontSide
    });

    const uTime = time;
    const uSpeed = uniform(speed);

    // UVs for texture generation
    const vUv = uv();

    // animate UVs: x + time * speed
    // We want diagonal stripes.
    // stripe pattern = fract((u + v) * density - time * speed) -> Inverted direction
    const density = float(10.0);
    // Invert speed direction for "opposite momentum"
    const patternInput = vUv.x.add(vUv.y).mul(density).sub(uTime.mul(uSpeed));
    const stripe = step(0.5, fract(patternInput)); // 0 or 1

    // Colors
    const colorBase = color(0x222222); // Dark rubber/metal
    const colorStripe = color(0xffcc00); // Warning yellow

    // Emission (faint glow on yellow stripes)
    const emissiveBase = color(0x000000);
    const emissiveStripe = color(0x332200);

    mat.colorNode = vec4(mix(colorBase, colorStripe, stripe), 1.0);
    mat.emissiveNode = mix(emissiveBase, emissiveStripe, stripe);

    return mat;
}

/**
 * Creates a TSL material for energy conduits (pulsing pipes).
 * Visuals:
 * - Base dark metal pipe
 * - Glowing core that pulses with sine wave
 */
function createPulsingConduitMaterial(baseColorHex: number, glowColorHex: number, pulseSpeed: number) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        roughness: 0.4,
        metalness: 0.9,
    });

    const uTime = time;
    const vUv = uv();

    // Simulate a glowing liquid/energy flowing through the pipe
    // We assume the pipe is a cylinder mapped such that V is along length or U is along length.
    // Usually cylinder U wraps around, V is height.
    // Let's assume V is along the length (vertical cylinder) or X axis if rotated.

    // Energy flow calculation
    const flow = sin(vUv.y.mul(20.0).sub(uTime.mul(pulseSpeed))).add(1.0).mul(0.5); // 0..1

    // Add some noise/variation?
    const pulse = sin(uTime.mul(2.0)).add(1.0).mul(0.5); // Global pulse

    const glowColor = color(glowColorHex);
    // const baseColor = color(baseColorHex);

    // Center glow (simulating core) -> assume uv.x 0..1 wraps around.
    // If we want the pipe to look like it has a glowing core visible through slots,
    // we can use a stripe pattern on UV.x
    // stripe = step(0.8, fract(vUv.x * 4.0)) ...

    // Let's just make the whole pipe pulse for now as "energy conduit"
    mat.emissiveNode = glowColor.mul(flow).mul(pulse).mul(2.0); // Intense glow

    return mat;
}

/**
 * Creates a procedural 3D gear geometry.
 */
function createGearGeometry(radius: number, teeth: number, thickness: number) {
    const shape = new THREE.Shape();
    const toothDepth = radius * 0.2;
    const holeRadius = radius * 0.3;

    // Generate gear profile
    const steps = teeth * 2;
    const angleStep = (Math.PI * 2) / steps;

    for (let i = 0; i < steps; i++) {
        const angle = i * angleStep;
        // Use simpler logic: Outer point, then inner point
        const r = (i % 2 === 0) ? radius : radius - toothDepth;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();

    // Central hole
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, holeRadius, 0, Math.PI * 2, false);
    shape.holes.push(holePath);

    const extrudeSettings = {
        depth: thickness,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/**
 * Creates a piston head geometry (Cylinder with a plate).
 */
function createPistonGeometry(radius: number, height: number) {
    return new THREE.CylinderGeometry(radius, radius, height, 16);
}

/**
 * Creates a rusty mechanical material using TSL.
 */
function createMechanismMaterial(colorHex: number) {
    const mat = new MeshStandardNodeMaterial({
        color: colorHex,
        roughness: 0.8,
        metalness: 0.6
    });

    // Add rust/noise pattern using TSL
    const uTime = time;
    const pos = uv().mul(10.0);
    // Simple noise for rust
    const noise = sin(pos.x.mul(10.0)).mul(cos(pos.y.mul(10.0))).add(1.0).mul(0.5);

    // Mix rust color
    const baseColor = color(new THREE.Color(colorHex));
    const rustColor = color(0x8b4513); // SaddleBrown

    mat.colorNode = vec4(mix(baseColor, rustColor, noise.mul(0.3)), 1.0);

    return mat;
}

/**
 * Creates a material for foreground silhouette structures.
 * Visuals:
 * - Dark, almost black metal
 * - High roughness (rusty/dusty)
 * - Slight rim light via metalness? Or just dark.
 */
function createForegroundMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.2,
    });
}

/**
 * Manages a layer of industrial background elements using InstancedMesh.
 */
export class IndustrialLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    baseZ: number;

    // Instance data
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
            yRange: number,
            scaleMin: number,
            scaleMax: number,
            rotationMode: 'random' | 'horizontal' | 'vertical'
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.z;

        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false; // Infinite scrolling logic handles visibility

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);

        for(let i=0; i<this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.yRange;
            const z = this.baseZ + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            this.dummy.position.set(x, y, z);

            // Random Scale
            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.dummy.scale.setScalar(s);

            // Orientation
            if (config.rotationMode === 'random') {
                this.dummy.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
            } else if (config.rotationMode === 'vertical') {
                this.dummy.rotation.set(0, 0, 0);
            } else {
                // Default 'horizontal'
                this.dummy.rotation.z = Math.PI / 2;
            }

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
                // No rotation update needed here as we want them static in orientation
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

/**
 * Manages a layer of animated mechanical elements (Gears, Pistons).
 */
export class AnimatedMechanismLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    baseZ: number;
    animationType: 'rotate' | 'piston';

    // Instance data
    positions: Float32Array;
    animationSpeeds: Float32Array;
    phases: Float32Array;

    constructor(
        scene: THREE.Scene,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        config: {
            count: number,
            z: number,
            zRange: number,
            width: number,
            yRange: number,
            scaleMin: number,
            scaleMax: number,
            animationType: 'rotate' | 'piston'
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.z;
        this.animationType = config.animationType;

        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.animationSpeeds = new Float32Array(this.count);
        this.phases = new Float32Array(this.count);

        for(let i=0; i<this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.yRange;
            const z = this.baseZ + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            // Random Scale
            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.dummy.scale.setScalar(s);

            // Initial Rotation (Random)
            this.dummy.rotation.z = Math.random() * Math.PI * 2;

            // Animation Data
            this.animationSpeeds[i] = (0.5 + Math.random() * 1.5) * (Math.random() > 0.5 ? 1 : -1);
            this.phases[i] = Math.random() * Math.PI * 2;

            this.dummy.position.set(x, y, z);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, time: number) {
        const margin = 20;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let needsUpdate = false;

        for(let i=0; i<this.count; i++) {
            const idx = i*3;
            let x = this.positions[idx];
            let y = this.positions[idx+1];
            let z = this.positions[idx+2];

            // 1. Parallax / Scrolling
            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
            }

            // 2. Animation
            this.mesh.getMatrixAt(i, this.dummy.matrix);
            const p = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            this.dummy.matrix.decompose(p, q, s);

            if (this.animationType === 'rotate') {
                // Spin
                const rotSpeed = this.animationSpeeds[i];
                // We construct rotation from scratch to avoid accumulation error or quaternion drift
                // Z-axis rotation
                const currentRot = (time * rotSpeed) + this.phases[i];
                this.dummy.rotation.set(0, 0, currentRot);

                // Position update
                this.dummy.position.set(x, y, z);

                needsUpdate = true;
            } else if (this.animationType === 'piston') {
                // Move Up/Down
                const speed = this.animationSpeeds[i];
                const offset = Math.sin(time * speed + this.phases[i]) * 2.0; // 2.0 amplitude

                this.dummy.position.set(x, y + offset, z);
                // Keep original rotation (e.g. vertical)?
                // For piston, we might want fixed rotation.
                // Constructor didn't set specific orientation other than random Z.
                // Let's assume vertical pistons.
                this.dummy.rotation.set(0, 0, 0);

                needsUpdate = true;
            }

            this.dummy.scale.copy(s); // Preserve scale
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

function createTunnelMaterial(speed: number) {
    const mat = new MeshStandardNodeMaterial({
        color: 0x332211,
        roughness: 0.8,
        metalness: 0.5,
        side: THREE.BackSide // Render inside of cylinder
    });

    const uTime = time;
    const uCameraX = uniform(0.0);

    // UVs are wrapped around cylinder. U is around, V is length?
    // CylinderGeometry: "radial segments" (U), "height segments" (V).
    // Standard UV: U goes 0-1 around, V goes 0-1 along height (X axis in our rotation).
    const vUv = uv();

    // Scroll V based on camera X to simulate infinite tunnel
    // Factor 0.01 implies texture repeats every 100 units?
    const scrollV = vUv.y.add(uCameraX.mul(0.02));

    // Grid/Panel Pattern
    // U is 0-1 (circumference ~ 2*PI*60 ~ 376). V is length (300).
    // We want square panels.
    const panelU = vUv.x.mul(12.0); // 12 panels around
    const panelV = scrollV.mul(10.0); // 10 panels along length

    const grid = step(0.95, fract(panelU)).add(step(0.95, fract(panelV))).clamp(0.0, 1.0);

    // Tech Details (Noise inside panels)
    const detailNoise = sin(panelU.mul(5.0)).mul(cos(panelV.mul(5.0))).add(1.0).mul(0.5);

    // Color Mix
    const wallColor = color(0x221105); // Dark Rusty
    const gridColor = color(0x110800); // Darker Seams
    const lightColor = color(0xff6600); // Orange accents

    // Random lights based on panel index
    const panelId = panelU.floor().add(panelV.floor().mul(10.0));
    const lightProb = sin(panelId).add(1.0).mul(0.5); // 0..1 random-ish
    const isLight = step(0.9, lightProb); // 10% chance of light

    // Pulse lights
    const pulse = sin(uTime.mul(2.0).add(panelId)).add(1.0).mul(0.5);

    mat.colorNode = vec4(mix(wallColor, gridColor, grid), 1.0);

    // Emissive lights
    mat.emissiveNode = mix(color(0x000000), lightColor.mul(pulse), isLight.mul(float(1.0).sub(grid)));

    mat.userData.uCameraX = uCameraX;

    return mat;
}

export class TunnelLayer {
    mesh: THREE.Mesh;

    constructor(scene: THREE.Scene) {
        // Radius 60, Length 300, Open-ended
        const geo = new THREE.CylinderGeometry(60, 60, 300, 32, 1, true);
        // Rotate so length is along X axis
        geo.rotateZ(Math.PI / 2);

        const mat = createTunnelMaterial(0);
        this.mesh = new THREE.Mesh(geo, mat);
        // Put it far behind
        this.mesh.renderOrder = -10;
        this.mesh.visible = false;

        scene.add(this.mesh);
    }

    update(cameraX: number) {
        // Follow camera
        this.mesh.position.x = cameraX;

        // Update shader for infinite scroll texture
        const mat = this.mesh.material as any;
        if (mat.userData && mat.userData.uCameraX) {
            mat.userData.uCameraX.value = cameraX;
        }
    }
}

export class IndustrialBackgroundSystem {
    scene: THREE.Scene;
    layers: (IndustrialLayer | AnimatedMechanismLayer)[] = [];
    tunnel!: TunnelLayer;
    active: boolean = false;
    elapsedTime: number = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initLayers();
    }

    initLayers() {
        // Tunnel Wall (Vast Background)
        this.tunnel = new TunnelLayer(this.scene);

        // Layer 1: Deep Background Pipes (Dark, massive)
        // Position: Z = -40, moving parallax
        const pipeGeo = new THREE.CylinderGeometry(2, 2, 40, 16); // Long pipes
        const pipeMat = createPulsingConduitMaterial(0x111122, 0x0044ff, 2.0); // Blue pulse

        this.layers.push(new IndustrialLayer(this.scene, pipeGeo, pipeMat, {
            count: 20,
            z: -40,
            zRange: 10,
            width: 300,
            yRange: 40,
            scaleMin: 1.0,
            scaleMax: 2.0,
            rotationMode: 'horizontal'
        }));

        // Layer 2: Mid-ground Conveyor Belts / Structs
        // Position: Z = -20
        const beltGeo = new THREE.BoxGeometry(10, 1, 2); // Flat belt segments
        const beltMat = createConveyorMaterial(5.0); // Fast moving stripes

        this.layers.push(new IndustrialLayer(this.scene, beltGeo, beltMat, {
            count: 30,
            z: -20,
            zRange: 5,
            width: 200,
            yRange: 30,
            scaleMin: 1.0,
            scaleMax: 1.5,
            rotationMode: 'horizontal'
        }));

        // New Layer: Background Pistons (Animated)
        // Position: Z = -15
        const pistonGeo = createPistonGeometry(1.5, 8);
        const pistonMat = createMechanismMaterial(0x555555);

        this.layers.push(new AnimatedMechanismLayer(this.scene, pistonGeo, pistonMat, {
            count: 12,
            z: -15,
            zRange: 5,
            width: 200,
            yRange: 20,
            scaleMin: 0.8,
            scaleMax: 1.2,
            animationType: 'piston'
        }));

        // Layer 3: Vertical Support Ribs (Background wall details)
        // Position: Z = -12
        const ribGeo = new THREE.BoxGeometry(2, 40, 2);
        const ribMat = new THREE.MeshStandardMaterial({
            color: 0x443322,
            roughness: 0.9,
            metalness: 0.5
        });

        this.layers.push(new IndustrialLayer(this.scene, ribGeo, ribMat, {
            count: 15,
            z: -12,
            zRange: 2,
            width: 150,
            yRange: 10,
            scaleMin: 1.0,
            scaleMax: 1.0,
            rotationMode: 'vertical'
        }));

        // New Layer: Foreground Gears (Animated, Occlusion)
        // Position: Z = 10 (Passes in front of player)
        const gearGeo = createGearGeometry(3, 12, 0.5);
        const gearMat = createMechanismMaterial(0x885533); // Rusty copper/bronze

        this.layers.push(new AnimatedMechanismLayer(this.scene, gearGeo, gearMat, {
            count: 6,
            z: 10,
            zRange: 4,
            width: 150,
            yRange: 15,
            scaleMin: 1.0,
            scaleMax: 2.0,
            animationType: 'rotate'
        }));

        // Layer 4: Foreground Pillars (Occlusion)
        // Position: Z = 8 (In front of player at Z=0)
        // Large, dark, imposing vertical structures
        const fgPillarGeo = new THREE.BoxGeometry(3, 50, 3);
        const fgMat = createForegroundMaterial();

        this.layers.push(new IndustrialLayer(this.scene, fgPillarGeo, fgMat, {
            count: 5, // Sparse
            z: 8,
            zRange: 2,
            width: 150,
            yRange: 10, // Centered roughly
            scaleMin: 1.0,
            scaleMax: 1.2,
            rotationMode: 'vertical'
        }));

        // Layer 5: Foreground Cables (Hanging)
        // Position: Z = 6
        const cableGeo = new THREE.CylinderGeometry(0.2, 0.2, 30, 8);
        const cableMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.8
        });

        this.layers.push(new IndustrialLayer(this.scene, cableGeo, cableMat, {
            count: 8,
            z: 6,
            zRange: 1,
            width: 120,
            yRange: 5,
            scaleMin: 0.8,
            scaleMax: 1.2,
            rotationMode: 'vertical'
        }));
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.tunnel.mesh.visible = true;
        this.layers.forEach(l => l.mesh.visible = true);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.tunnel.mesh.visible = false;
        this.layers.forEach(l => l.mesh.visible = false);
    }

    update(cameraX: number, delta: number = 0.016) {
        if (!this.active) return;
        this.elapsedTime += delta;

        this.tunnel.update(cameraX);

        this.layers.forEach(l => {
            if (l instanceof AnimatedMechanismLayer) {
                l.update(delta, cameraX, this.elapsedTime);
            } else {
                l.update(cameraX);
            }
        });
    }
}
