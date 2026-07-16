import * as THREE from 'three';
import {
    MeshBasicNodeMaterial,
    MeshStandardNodeMaterial,
} from 'three/webgpu';
import { InstancedBufferAttribute as StorageBufferAttribute } from 'three';
import {
    time,
    positionLocal,
    positionWorld,
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
    fract,
    pow,
    length,
    smoothstep,
    distance,
    Loop,
    storage,
    cameraPosition,
    dot
} from 'three/tsl';
import { Projectile } from './weapons';
import { WeaponLightManager } from './lighting';
import { decorationBudget } from './decoration_budget';

/**
 * Creates a TSL material for a nebula cloud puff.
 */
function createNebulaMaterial(
    baseColorHex: number,
    secondaryColorHex: number,
    opacity: number,
    uGlobalPulse: any,
    weaponLights: any, // storage node
    uMagicIntensity: any
) {
    const mat = new MeshStandardNodeMaterial({
        transparent: true,
        opacity: opacity,
        side: THREE.FrontSide,
        depthWrite: false,
        blending: THREE.NormalBlending,
        roughness: 1.0,
        metalness: 0.0
    });

    const uTime = time;
    const uPulseSpeed = uniform(0.5);
    const uPlayerPos = uniform(new THREE.Vector3(0, 0, 0)); // Player position
    const uInteractionRadius = uniform(20.0); // Radius of glow effect
    const uGlowColor = uniform(new THREE.Color(0xffaa00)); // Engine/Exhaust glow color
    const uWeaponColor = uniform(new THREE.Color(0x00ffff)); // Cyan weapon color

    // --- Fragment Shader ---
    const pos = positionLocal.mul(0.5); // Scale noise

    // Simple 3D noise approximation
    const noise1 = sin(pos.x.add(uTime.mul(0.2))).mul(cos(pos.y.add(uTime.mul(0.3))));
    const noise2 = cos(pos.z.add(uTime.mul(0.1))).mul(sin(pos.x.mul(2.0)));
    const combinedNoise = noise1.add(noise2).mul(0.5).add(0.5); // 0..1

    // Radial gradient from center
    const dist = length(pos.mul(2.0));
    const core = float(1.0).sub(dist);
    const softCore = core.pow(2.0);

    // Combine noise and core
    const density = softCore.mul(combinedNoise.add(0.5));

    // 2. Color Shift
    const col1 = color(new THREE.Color(baseColorHex));
    const col2 = color(new THREE.Color(secondaryColorHex));

    // Whimsical Pastel variants
    const pastelColor1 = mix(col1, color(0xffffff), 0.4); // Lighten
    const pastelColor2 = mix(col2, color(0xe6e6fa), 0.5); // Lavender tint

    const pulseMix = mix(float(0.0), float(1.0), uGlobalPulse.add(uMagicIntensity).clamp(0.0, 1.0));

    // Interpolate with pastel variants based on global pulse and magic intensity
    const magicColor1 = mix(col1, pastelColor1, pulseMix);
    const magicColor2 = mix(col2, pastelColor2, pulseMix);

    // Pulse between colors
    const pulse = sin(uTime.mul(uPulseSpeed)).add(1.0).mul(0.5);
    let finalColor: any = mix(magicColor1, magicColor2, pulse.mul(combinedNoise));

    // 3. Dynamic Player Interaction
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const glowIntensity = smoothstep(uInteractionRadius, 0.0, distToPlayer);

    // Petal-like ripple effect
    const ripple = sin(distToPlayer.mul(2.0).sub(uTime.mul(5.0))).add(1.0).mul(0.5);
    const magicRipple = mix(float(1.0), ripple, uMagicIntensity);

    // Silver Lining Effect (Rim Lighting when player light is behind the nebula relative to camera)
    const viewDir = cameraPosition.sub(positionWorld).normalize();
    const lightDir = uPlayerPos.sub(positionWorld).normalize(); // from fragment to player
    const backlight = dot(viewDir, lightDir).negate().max(0.0);
    // Use softCore (0 to 1 based on density) for edge factor
    const edgeFactor = smoothstep(0.35, 0.85, float(1.0).sub(density));

    // Smooth threshold for backlight to avoid flickering
    const backlightSmooth = smoothstep(0.0, 0.6, backlight);
    const silverLining = backlightSmooth.mul(edgeFactor).mul(glowIntensity).mul(1.2); // Tuned for nebula

    const basePlayerGlow = uGlowColor.mul(glowIntensity.mul(0.8).mul(magicRipple));
    const silverLiningColor = color(new THREE.Color(0xffffff)).mul(silverLining);

    finalColor = finalColor.add(basePlayerGlow).add(silverLiningColor);

    // 4. Weapon Light Interaction
    const weaponGlow = float(0.0).toVar();

    Loop({ start: 0, end: 20 }, ({ i }) => {
        const lightData = weaponLights.element(i);
        const lightPos = lightData.xyz;
        const lightIntensity = lightData.w;

        const distToLight = distance(positionWorld, lightPos);
        const lightRadius = float(15.0);
        const falloff = smoothstep(lightRadius, 0.0, distToLight);

        weaponGlow.addAssign(falloff.mul(lightIntensity));
    });

    finalColor = finalColor.add(uWeaponColor.mul(weaponGlow.mul(0.5)));

    // 5. Global Harmonic Pulse
    const harmonicBoost = uGlobalPulse.mul(0.3).add(uMagicIntensity.mul(0.5)); // Boost with magic
    finalColor = finalColor.add(harmonicBoost.mul(col2));

    mat.colorNode = vec4(finalColor, density.mul(opacity));

    // Add rim lighting strongly into emissive only, to avoid washing out alpha
    mat.emissiveNode = finalColor.mul(0.2).add(silverLiningColor);

    // Expose uniform for updates
    mat.userData.uPlayerPos = uPlayerPos;

    return mat;
}

/**
 * Creates a TSL material for energy particles (sparkles).
 */
function createEnergyParticleMaterial(colorHex: number, uGlobalPulse: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const uTime = time;
    const pos = positionLocal;
    const phase = pos.x.mul(10.0).add(pos.y.mul(20.0)).add(pos.z.mul(30.0));
    const sparkle = sin(uTime.mul(5.0).add(phase)).add(1.0).mul(0.5);
    const sharpSparkle = pow(sparkle, 4.0);
    const globalSync = uGlobalPulse.mul(0.5).add(0.5);
    const baseColor = color(new THREE.Color(colorHex));

    mat.colorNode = vec4(baseColor, sharpSparkle.mul(globalSync));

    return mat;
}

/**
 * Creates a TSL material for the Pulse Overlay (Screen Breathing).
 */
function createPulseOverlayMaterial(uPulse: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: 1.0,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    const vUv = uv();
    const dist = length(vUv.sub(0.5)).mul(1.5);
    const vignette = smoothstep(0.4, 1.2, dist);
    const pulseColor = color(0x6600cc);
    const alpha = vignette.mul(uPulse).mul(0.2);

    mat.colorNode = vec4(pulseColor, alpha);

    return mat;
}

export class PulseOverlay {
    mesh: THREE.Mesh;
    camera: THREE.Camera | null = null;

    constructor() {
        const geo = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
        this.mesh.position.set(0, 0, -1.01);
    }

    init(uPulse: any, camera: THREE.Camera) {
        this.camera = camera;
        this.mesh.material = createPulseOverlayMaterial(uPulse);
        camera.add(this.mesh);
    }
}

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

// =============================================================================
// NEBULA RIBBON / VEIL LAYERS (background-only parallax sheets)
// =============================================================================
//
// Performance contract:
// - 3 InstancedMesh layers = 3 draw calls (≤4 total in densest views).
// - Quad / 2-segment plane geo only; MeshBasicNodeMaterial (no per-light calcs).
// - Background only — ignore for collision and interaction systems.

/**
 * Cheap ribbon/veil material: sky tint + one global time uniform (swirl + opacity pulse).
 */
function createRibbonVeilMaterial(
    topColorHex: number,
    bottomColorHex: number,
    opacity: number,
    uvPhase: number
) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending
    });

    const uTop = uniform(new THREE.Color(topColorHex));
    const uBottom = uniform(new THREE.Color(bottomColorHex));
    const uOpacity = uniform(opacity);
    const uPhase = uniform(uvPhase);
    const vUv = uv();

    const swirl = sin(vUv.x.mul(4.0).add(time.mul(0.1).add(uPhase)))
        .mul(cos(vUv.y.mul(3.0).sub(time.mul(0.07).add(uPhase.mul(0.5)))));
    const pulse = sin(time.mul(0.32).add(uPhase)).mul(0.5).add(0.5);

    const skyTint = mix(uBottom, uTop, vUv.y);
    const edgeFade = smoothstep(float(0.0), float(0.28), vUv.y)
        .mul(smoothstep(float(1.0), float(0.42), vUv.y));
    const alpha = edgeFade
        .mul(uOpacity)
        .mul(pulse.mul(0.12).add(0.88))
        .mul(swirl.mul(0.22).add(0.78));

    mat.colorNode = vec4(skyTint, alpha);
    mat.userData.uTop = uTop;
    mat.userData.uBottom = uBottom;

    return mat;
}

export interface NebulaRibbonLayerConfig {
    count: number;
    width: number;
    height: number;
    baseZ: number;
    zSpread: number;
    ribbonWidth: number;
    ribbonHeight: number;
    opacity: number;
    parallaxFactor: number;
    driftSpeed: number;
    topColor: number;
    bottomColor: number;
    uvPhase: number;
}

/**
 * One instanced ribbon layer — long semi-transparent sheets at a fixed depth band.
 * Background only — ignore for collision and interaction systems.
 */
export class NebulaRibbonLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    readonly count: number;
    readonly width: number;
    readonly baseZ: number;
    readonly parallaxFactor: number;
    readonly driftSpeed: number;
    private positions: Float32Array;
    private phases: Float32Array;
    private scales: Float32Array;

    constructor(scene: THREE.Scene, config: NebulaRibbonLayerConfig) {
        this.count = config.count;
        this.width = config.width;
        this.baseZ = config.baseZ;
        this.parallaxFactor = config.parallaxFactor;
        this.driftSpeed = config.driftSpeed;

        const geo = new THREE.PlaneGeometry(1, 1, 1, 2);
        const mat = createRibbonVeilMaterial(
            config.topColor,
            config.bottomColor,
            config.opacity,
            config.uvPhase
        );

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -6;
        this.mesh.userData.backgroundOnly = true;
        this.mesh.userData.skipCollision = true;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.phases = new Float32Array(this.count);
        this.scales = new Float32Array(this.count * 2);

        for (let i = 0; i < this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.height;
            const z = config.baseZ + (Math.random() - 0.5) * config.zSpread;
            const w = config.ribbonWidth * (0.75 + Math.random() * 0.5);
            const h = config.ribbonHeight * (0.7 + Math.random() * 0.6);

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;
            this.phases[i] = Math.random() * Math.PI * 2;
            this.scales[i * 2] = w;
            this.scales[i * 2 + 1] = h;

            this.dummy.position.set(x, y, z);
            this.dummy.scale.set(w, h, 1);
            this.dummy.rotation.set(
                (Math.random() - 0.5) * 0.35,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.25
            );
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        scene.add(this.mesh);
    }

    setSkyColors(topHex: number, bottomHex: number): void {
        const mat = this.mesh.material as MeshBasicNodeMaterial & { userData: Record<string, unknown> };
        (mat.userData.uTop as { value: THREE.Color }).value.setHex(topHex);
        (mat.userData.uBottom as { value: THREE.Color }).value.setHex(bottomHex);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8): void {
        const margin = 60;
        const limitBack = cameraX - this.width / 2 - margin;
        const limitFront = cameraX + this.width / 2 + margin;
        const scroll = delta * (this.driftSpeed + playerSpeed * this.parallaxFactor * 0.06);
        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            const idx = i * 3;
            let x = this.positions[idx] - scroll;
            const phase = this.phases[i];

            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx + 1] = (Math.random() - 0.5) * 50;
                needsUpdate = true;
            } else if (x > limitFront) {
                x -= this.width + margin * 2;
                this.positions[idx + 1] = (Math.random() - 0.5) * 50;
                needsUpdate = true;
            }

            this.positions[idx] = x;
            const y = this.positions[idx + 1] + Math.sin(phase + cameraX * 0.004) * 1.8;
            const z = this.positions[idx + 2];

            this.dummy.position.set(x, y, z);
            this.dummy.scale.set(this.scales[i * 2], this.scales[i * 2 + 1], 1);
            this.dummy.rotation.z = Math.sin(phase + cameraX * 0.002) * 0.08;
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            needsUpdate = true;
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

export class NebulaSystem {
    scene: THREE.Scene;
    active: boolean = false;
    ribbonsActive: boolean = false;
    layers: (NebulaCloudLayer | EnergyParticleLayer | ButterflyEnergyMoteLayer)[] = [];
    ribbonLayers: NebulaRibbonLayer[] = [];
    uGlobalPulse: any;
    uMagicIntensity: any;
    targetMagicIntensity: number = 0.0;
    pulseOverlay: PulseOverlay;
    elapsedTime: number = 0;
    weaponLightManager: WeaponLightManager;

    constructor(scene: THREE.Scene, weaponLightManager: WeaponLightManager) {
        this.scene = scene;
        this.uGlobalPulse = uniform(0.0);
        this.uMagicIntensity = uniform(0.0);
        this.pulseOverlay = new PulseOverlay();
        this.weaponLightManager = weaponLightManager;
        this.initRibbonLayers();
        this.initLayers();
    }

    setCamera(camera: THREE.Camera) {
        this.pulseOverlay.init(this.uGlobalPulse, camera);
    }

    /** Tint ribbons from LEVEL_CONFIG skyColors (call on level start / sky transition). */
    setSkyColors(topHex: number, bottomHex: number): void {
        this.ribbonLayers.forEach((layer) => layer.setSkyColors(topHex, bottomHex));
    }

    /**
     * Parallax ribbon/veil sheets only (3 draw calls).
     * Background only — ignore for collision and interaction systems.
     */
    initRibbonLayers(topColor: number = 0x0a001a, bottomColor: number = 0x1a0033): void {
        if (this.ribbonLayers.length > 0) return;

        const configs: NebulaRibbonLayerConfig[] = [
            {
                count: 8,
                width: 420,
                height: 55,
                baseZ: -145,
                zSpread: 18,
                ribbonWidth: 72,
                ribbonHeight: 28,
                opacity: 0.11,
                parallaxFactor: 0.07,
                driftSpeed: 0.35,
                topColor,
                bottomColor,
                uvPhase: 0.0
            },
            {
                count: 10,
                width: 380,
                height: 48,
                baseZ: -98,
                zSpread: 14,
                ribbonWidth: 52,
                ribbonHeight: 16,
                opacity: 0.16,
                parallaxFactor: 0.14,
                driftSpeed: 0.55,
                topColor,
                bottomColor,
                uvPhase: 1.7
            },
            {
                count: 6,
                width: 340,
                height: 42,
                baseZ: -72,
                zSpread: 10,
                ribbonWidth: 44,
                ribbonHeight: 20,
                opacity: 0.1,
                parallaxFactor: 0.22,
                driftSpeed: 0.75,
                topColor,
                bottomColor,
                uvPhase: 3.1
            }
        ];

        for (const cfg of configs) {
            this.ribbonLayers.push(new NebulaRibbonLayer(this.scene, cfg));
        }

        decorationBudget.syncCount('nebula_ribbons', 24);
        this.deactivateRibbons();
    }

    activateRibbons(): void {
        this.ribbonsActive = true;
        this.ribbonLayers.forEach((layer) => { layer.mesh.visible = true; });
    }

    deactivateRibbons(): void {
        this.ribbonsActive = false;
        this.ribbonLayers.forEach((layer) => { layer.mesh.visible = false; });
    }

    initLayers() {
        const weaponLights = this.weaponLightManager.storageNode;

        this.layers.push(new NebulaCloudLayer(this.scene, {
            count: 20,
            color1: 0x4b0082,
            color2: 0x8a2be2,
            opacity: 0.4,
            sizeMin: 20,
            sizeMax: 40,
            z: -60,
            zRange: 20,
            width: 300,
            height: 60,
            uGlobalPulse: this.uGlobalPulse,
            weaponLights: weaponLights,
            uMagicIntensity: this.uMagicIntensity
        }));

        this.layers.push(new NebulaCloudLayer(this.scene, {
            count: 15,
            color1: 0x00008b,
            color2: 0x00ced1,
            opacity: 0.3,
            sizeMin: 15,
            sizeMax: 25,
            z: -40,
            zRange: 15,
            width: 250,
            height: 50,
            uGlobalPulse: this.uGlobalPulse,
            weaponLights: weaponLights,
            uMagicIntensity: this.uMagicIntensity
        }));

        this.layers.push(new NebulaCloudLayer(this.scene, {
            count: 10,
            color1: 0xff1493,
            color2: 0xff69b4,
            opacity: 0.15,
            sizeMin: 10,
            sizeMax: 20,
            z: -20,
            zRange: 10,
            width: 200,
            height: 40,
            uGlobalPulse: this.uGlobalPulse,
            weaponLights: weaponLights,
            uMagicIntensity: this.uMagicIntensity
        }));

        this.layers.push(new EnergyParticleLayer(this.scene, 30, -30, 200, this.uGlobalPulse));
        this.layers.push(new ButterflyEnergyMoteLayer(this.scene, 20, -25, 200, this.uGlobalPulse, this.uMagicIntensity));

        decorationBudget.syncCount('nebula_cloud_puffs', 45);
        decorationBudget.syncCount('nebula_energy_motes', 50);
        decorationBudget.syncCount('nebula_ribbons', 24);

        this.deactivate();
    }


    setMagicActive(isActive: boolean) {
        this.targetMagicIntensity = isActive ? 1.0 : 0.0;
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.layers.forEach(l => l.mesh.visible = true);
        if (this.pulseOverlay.mesh) this.pulseOverlay.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.layers.forEach(l => l.mesh.visible = false);
        if (this.pulseOverlay.mesh) this.pulseOverlay.mesh.visible = false;
    }


    update(delta: number, cameraX: number, playerPos?: THREE.Vector3, playerSpeed: number = 8) {
        if (this.ribbonsActive) {
            this.ribbonLayers.forEach((layer) => layer.update(delta, cameraX, playerSpeed));
        }

        if (!this.active) return;

        // Lerp magic intensity
        const currentMagic = this.uMagicIntensity.value;
        this.uMagicIntensity.value = currentMagic + (this.targetMagicIntensity - currentMagic) * delta * 2.0;

        this.elapsedTime += delta;

        const pulse = Math.sin(this.elapsedTime * 1.0) * 0.5 + 0.5;
        this.uGlobalPulse.value = pulse;

        this.layers.forEach(l => {
            if (l instanceof NebulaCloudLayer) {
                l.update(delta, cameraX, playerPos);
            } else {
                l.update(delta, cameraX);
            }
        });
    }
}
