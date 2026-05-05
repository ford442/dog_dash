import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    time,
    positionLocal,
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
    normalView
} from 'three/tsl';

/**
 * Creates a TSL material for the waterfall.
 * Features:
 * - Vertical scrolling UVs (water flow)
 * - Horizontal UV offset based on camera position (parallax/infinite scrolling)
 * - Vertex displacement for curvature
 * - Foam/Color variation
 */
function createWaterMaterial(baseColorHex: number, opacity: number, speed: number) {
    const mat = new MeshStandardNodeMaterial({
        color: baseColorHex,
        transparent: true,
        opacity: opacity,
        roughness: 0.1,
        metalness: 0.8,
        side: THREE.DoubleSide
    });

    const uTime = time;
    const uSpeed = uniform(speed);
    const uCameraX = uniform(0.0); // Updated every frame
    const uParallaxFactor = uniform(0.1); // How fast texture scrolls horizontally

    // --- Vertex Shader: Curve & Wiggle ---
    const pos = positionLocal;

    // Wiggle (X axis)
    const wiggle = sin(pos.y.mul(0.5).add(uTime)).mul(0.5);

    // Curve (Z axis recedes at top) - Mode 7 Style
    // Assuming Y ranges from -Height/2 to +Height/2
    // curvature of 0.005 on height 100 (y=50) -> 2500 * 0.005 = 12.5
    // curvature of 0.02 on height 100 -> 50.0 (Deep curve)
    const uCurvature = uniform(0.02);
    const zOffset = pos.y.mul(pos.y).mul(uCurvature).negate(); // -y^2 * k

    mat.positionNode = vec3(pos.x.add(wiggle), pos.y, pos.z.add(zOffset));

    // --- Fragment Shader: Flowing Texture ---
    const vUv = uv();

    // Scroll UVs vertically (Flow)
    const scrollY = uTime.mul(uSpeed);

    // Scroll UVs horizontally (Parallax)
    const scrollX = uCameraX.mul(uParallaxFactor);

    const flowUv = vec2(vUv.x.add(scrollX), vUv.y.add(scrollY));

    // Sample simulated noise
    const noise1 = sin(flowUv.y.mul(20.0).add(flowUv.x.mul(10.0)));
    const noise2 = cos(flowUv.y.mul(15.0).sub(flowUv.x.mul(5.0))); 
    
    const combinedNoise = noise1.add(noise2).mul(0.5); // Range -1 to 1

    // Mix Base Color with lighter "Foam"
    const baseColor = color(new THREE.Color(baseColorHex));
    const foamColor = color(0xffffff);

    // Foam appears at peaks of noise
    const foamFactor = combinedNoise.add(1.0).mul(0.5); // 0 to 1

    // Basic color output
    mat.colorNode = vec4(mix(baseColor, foamColor, foamFactor.mul(0.3)), float(opacity));

    // Emission for glowing water
    mat.emissiveNode = baseColor.mul(0.5);

    // Store uniforms on userData so we can update them
    mat.userData.uCameraX = uCameraX;
    mat.userData.uParallaxFactor = uParallaxFactor;

    return mat;
}

/**
 * Creates a TSL material for rising bubbles.
 */
function createBubbleMaterial() {
    const mat = new MeshStandardNodeMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.6,
        roughness: 0.0,
        metalness: 0.1,
    });

    const uTime = time;

    // --- Vertex Shader: Wobble ---
    const pos = positionLocal;

    // Simple wobble based on position and time
    const wobbleX = sin(pos.y.mul(5.0).add(uTime.mul(3.0))).mul(0.1);
    const wobbleY = cos(pos.x.mul(5.0).add(uTime.mul(2.0))).mul(0.1);

    mat.positionNode = pos.add(vec3(wobbleX, wobbleY, 0.0));

    // --- Fragment Shader: Bubble Rim ---
    const nView = normalView;
    // Edge glow (Fresnel)
    const rim = float(1.0).sub(nView.z.abs());
    const glow = rim.pow(3.0);

    const bubbleColor = color(0x88ccff);
    const centerColor = color(0xffffff);

    // Mix based on rim
    const finalColor = mix(centerColor, bubbleColor, rim);

    // Output color with opacity based on rim (more opaque at edges)
    mat.colorNode = vec4(finalColor, glow.add(0.2)); // Minimum opacity 0.2
    mat.emissiveNode = bubbleColor.mul(glow);

    return mat;
}

/**
 * Creates a TSL material for the Submersion Overlay (Camera effect).
 * Visuals: Blue tint, screen distortion/wobble.
 */
function createSubmersionMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: 0.0,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const uTime = time;
    const uIntensity = uniform(0.0); // 0 to 1

    // Base Blue Tint
    const tintColor = color(0x004488);

    // Animated Wobble/Refraction logic could be added here if we had access to screen texture,
    // but for a simple overlay, we just modulate opacity and maybe add some "caustic" patterns.

    const vUv = uv();

    // Simple plasma/caustic pattern
    const pattern = sin(vUv.x.mul(10.0).add(uTime)).add(cos(vUv.y.mul(15.0).sub(uTime.mul(0.5))));
    const caustic = pattern.mul(0.1); // Subtle variation

    // Final Opacity depends on intensity
    const baseOpacity = float(0.3).mul(uIntensity);
    const finalOpacity = baseOpacity.add(caustic.mul(uIntensity)); // Add caustic flicker

    mat.colorNode = vec4(tintColor, finalOpacity);

    mat.userData.uIntensity = uIntensity;

    return mat;
}

export class WaterfallLayer {
    mesh: THREE.Mesh;
    speed: number;
    width: number;
    height: number;
    parallaxFactor: number;

    constructor(scene: THREE.Scene, config: {
        width: number,
        height: number,
        z: number,
        color: number,
        opacity: number,
        speed: number,
        parallaxFactor: number // How much texture slides vs camera move
    }) {
        this.width = config.width;
        this.height = config.height;
        this.speed = config.speed;
        this.parallaxFactor = config.parallaxFactor;

        // High segmentation for smooth curvature (Mode 7 effect)
        const geo = new THREE.PlaneGeometry(this.width, this.height, 64, 128);
        const mat = createWaterMaterial(config.color, config.opacity, config.speed);

        // Initialize parallax factor uniform
        if (mat.userData.uParallaxFactor) {
            mat.userData.uParallaxFactor.value = this.parallaxFactor;
        }

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.z = config.z;
        this.mesh.visible = false;

        scene.add(this.mesh);
    }

    update(cameraX: number) {
        // Keep the mesh centered on the camera so it never runs out
        this.mesh.position.x = cameraX;

        // Update the shader uniform to shift texture
        const mat = this.mesh.material as any;
        if (mat.userData && mat.userData.uCameraX) {
            mat.userData.uCameraX.value = cameraX;
        }
    }
}

export class BubbleLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    height: number;
    depth: number;
    baseZ: number;

    positions: Float32Array;
    speeds: Float32Array;
    scales: Float32Array;

    constructor(scene: THREE.Scene, config: {
        count: number,
        width: number,
        height: number,
        z: number,
        zRange: number
    }) {
        this.count = config.count;
        this.width = config.width;
        this.height = config.height;
        this.baseZ = config.z;
        this.depth = config.zRange;

        const geo = new THREE.SphereGeometry(0.3, 8, 8);
        const mat = createBubbleMaterial();

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.renderOrder = 1; // Render after water
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.speeds = new Float32Array(this.count);
        this.scales = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * this.height;
            const z = this.baseZ + (Math.random() - 0.5) * this.depth;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            // Random upward speed
            this.speeds[i] = 2.0 + Math.random() * 3.0;

            this.dummy.position.set(x, y, z);
            const s = 0.5 + Math.random() * 1.0;
            this.scales[i] = s;
            this.dummy.scale.setScalar(s);

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
        const topY = this.height / 2;
        const bottomY = -this.height / 2;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;

            // Rise
            this.positions[idx+1] += this.speeds[i] * delta;

            let x = this.positions[idx];
            let y = this.positions[idx+1];

            // Wrap Y
            if (y > topY) {
                y = bottomY;
                this.positions[idx+1] = y;
                // Randomize X slightly on respawn
                x = cameraX + (Math.random() - 0.5) * this.width;
                this.positions[idx] = x;
            }

            // Wrap X (Infinite Scroll)
            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
            }

            // Always update for smooth rising
            this.dummy.position.set(x, y, this.positions[idx+2]);
            this.dummy.scale.setScalar(this.scales[i]);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }
}

/**
 * Splash System - Fast moving water droplets influenced by gravity.
 */
export class SplashSystem {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;

    // Particle Data
    positions: Float32Array;
    velocities: Float32Array;
    ages: Float32Array; // 0 to 1
    activeParticles: boolean[];

    constructor(scene: THREE.Scene, count: number = 200) {
        this.count = count;

        const geo = new THREE.SphereGeometry(0.15, 4, 4); // Low poly droplet
        const mat = new THREE.MeshBasicMaterial({
            color: 0xccffff,
            transparent: true,
            opacity: 0.8
        });

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.velocities = new Float32Array(this.count * 3);
        this.ages = new Float32Array(this.count);
        this.activeParticles = new Array(this.count).fill(false);

        // Hide all initially
        for(let i=0; i<this.count; i++) {
            this.dummy.position.set(0, -1000, 0); // Far away
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
    }

    emit(position: THREE.Vector3, count: number) {
        let spawned = 0;
        for(let i=0; i<this.count && spawned < count; i++) {
            if (!this.activeParticles[i]) {
                this.activeParticles[i] = true;
                this.ages[i] = 1.0; // Life starts at 1.0

                // Position
                this.positions[i*3] = position.x + (Math.random() - 0.5) * 0.5;
                this.positions[i*3+1] = position.y + (Math.random() - 0.5) * 0.5;
                this.positions[i*3+2] = position.z + (Math.random() - 0.5) * 0.5;

                // Velocity (Explosive upward/outward)
                const angle = Math.random() * Math.PI * 2;
                const speed = 5.0 + Math.random() * 5.0;
                this.velocities[i*3] = Math.cos(angle) * speed;
                this.velocities[i*3+1] = (Math.random() * 5.0) + 5.0; // Upward bias
                this.velocities[i*3+2] = Math.sin(angle) * speed;

                spawned++;
            }
        }
    }

    update(delta: number) {
        let needsUpdate = false;
        const gravity = 20.0;

        for(let i=0; i<this.count; i++) {
            if (this.activeParticles[i]) {
                // Update Age
                this.ages[i] -= delta * 1.5; // Life duration approx 0.6s
                if (this.ages[i] <= 0) {
                    this.activeParticles[i] = false;
                    this.dummy.position.set(0, -1000, 0);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                    continue;
                }

                // Physics
                this.velocities[i*3+1] -= gravity * delta; // Gravity

                this.positions[i*3] += this.velocities[i*3] * delta;
                this.positions[i*3+1] += this.velocities[i*3+1] * delta;
                this.positions[i*3+2] += this.velocities[i*3+2] * delta;

                // Update Instance
                this.dummy.position.set(
                    this.positions[i*3],
                    this.positions[i*3+1],
                    this.positions[i*3+2]
                );

                // Scale shrinks with age
                const s = this.ages[i];
                this.dummy.scale.set(s, s, s);

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
 * Submersion Overlay - Camera effect for being "underwater"
 */
export class SubmersionOverlay {
    mesh: THREE.Mesh;
    camera: THREE.Camera;

    constructor(camera: THREE.Camera) {
        this.camera = camera;
        const geo = new THREE.PlaneGeometry(2, 2);
        const mat = createSubmersionMaterial();

        this.mesh = new THREE.Mesh(geo, mat);
        // Position in front of camera (similar to ReEntrySystem)
        this.mesh.position.set(0, 0, -1.05); // slightly closer than reentry?
        // this.mesh.visible = false; // Managed by opacity

        camera.add(this.mesh);
    }

    setIntensity(intensity: number) {
        const mat = this.mesh.material as any;
        if (mat.userData && mat.userData.uIntensity) {
            mat.userData.uIntensity.value = intensity;
        }
    }
}

export class WaterfallSystem {
    scene: THREE.Scene;
    camera: THREE.Camera;
    layers: WaterfallLayer[] = [];
    bubbles!: BubbleLayer;
    splash!: SplashSystem;
    submersion!: SubmersionOverlay;
    active: boolean = false;

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.camera = camera;
        this.initLayers();
    }

    initLayers() {
        // Layer 1: Background (Distant)
        // Moves slowly (low parallax factor)
        this.layers.push(new WaterfallLayer(this.scene, {
            width: 300,
            height: 100,
            z: -40,
            color: 0x002244,
            opacity: 0.9,
            speed: 0.2,
            parallaxFactor: 0.02 // Texture moves 2% of camera speed
        }));

        // Layer 2: Midground
        this.layers.push(new WaterfallLayer(this.scene, {
            width: 300,
            height: 80,
            z: -20,
            color: 0x0066aa,
            opacity: 0.6,
            speed: 0.5,
            parallaxFactor: 0.05
        }));

        // Layer 3: Foreground (Spray)
        // Moves fast (high parallax)
        this.layers.push(new WaterfallLayer(this.scene, {
            width: 300,
            height: 60,
            z: 10,
            color: 0x88ccff,
            opacity: 0.3,
            speed: 0.8,
            parallaxFactor: 0.1
        }));

        // Bubbles Layer
        this.bubbles = new BubbleLayer(this.scene, {
            count: 100,
            width: 150,
            height: 60,
            z: -10, // In midground
            zRange: 20
        });

        // Splash System
        this.splash = new SplashSystem(this.scene, 300);

        // Submersion Overlay
        this.submersion = new SubmersionOverlay(this.camera);
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.layers.forEach(l => l.mesh.visible = true);
        this.bubbles.mesh.visible = true;
        this.splash.mesh.visible = true;

        // Fade in submersion
        this.submersion.setIntensity(1.0);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.layers.forEach(l => l.mesh.visible = false);
        this.bubbles.mesh.visible = false;
        this.splash.mesh.visible = false;

        this.submersion.setIntensity(0.0);
    }

    update(cameraX: number, delta: number = 0.016) {
        // Always update splash particles (they might be finishing animation)
        this.splash.update(delta);

        if (!this.active) return;

        this.layers.forEach(l => l.update(cameraX));
        this.bubbles.update(delta, cameraX);
    }

    triggerSplash(position: THREE.Vector3, count: number = 10) {
        this.splash.emit(position, count);
    }
}
