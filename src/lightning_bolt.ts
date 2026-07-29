import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time,
    positionLocal,
    uv,
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
    abs,
    normalView,
    dot,
    vec2,
    floor,
    positionWorld,
    length,
    distance,
    Loop,
    smoothstep
} from 'three/tsl';
import { WeaponLightManager } from './lighting';

/**
 * Creates a TSL material for jagged lightning bolts.
 */


const random2D = (v: any) => {
    return sin(dot(v, vec2(12.9898, 78.233))).mul(43758.5453).fract();
};

const valueNoise = (v: any) => {
    const i = floor(v);
    const f = fract(v);

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
    let total = float(0.0).toVar();
    let amplitude = float(0.5).toVar();
    let frequency = float(1.0).toVar();

    // 4 Octaves for detailed lightning
    Loop({ start: 0, end: 4 }, () => {
        total.addAssign(valueNoise(v.mul(frequency)).mul(amplitude));
        frequency.mulAssign(2.0);
        amplitude.mulAssign(0.5);
    });

    return total;
};

function createLightningMaterial(uColor: any, weaponLights?: any, uPlayerPos?: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const vUv = uv();

    const y = vUv.y;
    const x = vUv.x;

    const uTime = time;

    // Advanced procedural jagged offset for volumetric core using fract
    // We use a pseudo-random stepped approach to create sharp turns
    const timeSpeed = uTime.mul(30.0);
    // FBM based procedural displacement for jagged lightning
    const noiseOffsetX = fbm(vec2(y.mul(4.0), timeSpeed.mul(0.5))).sub(0.5).mul(8.0);
    const noiseOffsetZ = fbm(vec2(y.mul(4.5).add(10.0), timeSpeed.mul(0.5))).sub(0.5).mul(8.0);

    const highFreqX = fbm(vec2(y.mul(15.0), timeSpeed.mul(1.5))).sub(0.5).mul(2.0);
    const highFreqZ = fbm(vec2(y.mul(15.0).add(20.0), timeSpeed.mul(1.5))).sub(0.5).mul(2.0);

    const totalOffsetX = noiseOffsetX.add(highFreqX);
    const totalOffsetZ = noiseOffsetZ.add(highFreqZ);

    // Chaotic secondary forks branching out
    const forkTrigger = fbm(vec2(y.mul(8.0), timeSpeed.mul(0.8)));
    const isFork = smoothstep(0.6, 0.8, forkTrigger);

    const forkOffsetX = fbm(vec2(y.mul(20.0), timeSpeed)).sub(0.5).mul(12.0).mul(y).mul(isFork);
    const forkOffsetZ = fbm(vec2(y.mul(20.0).add(30.0), timeSpeed)).sub(0.5).mul(12.0).mul(y).mul(isFork);

    const sideFactorX = sin(x.mul(Math.PI * 2.0));
    const sideFactorZ = cos(x.mul(Math.PI * 2.0));

    const branchX = forkOffsetX.mul(sideFactorX);
    const branchZ = forkOffsetZ.mul(sideFactorZ);

    mat.positionNode = vec3(
        positionLocal.x.add(totalOffsetX).add(branchX),
        positionLocal.y,
        positionLocal.z.add(totalOffsetZ).add(branchZ)
    );

    // Volumetric ray-marched approximation based on distance from core
    const distFromCenter = abs(x.sub(0.5)).mul(2.0); // 0 at center, 1 at edges
    const coreDensity = float(1.0).sub(distFromCenter); // 1 at center, 0 at edges
    const viewDot = normalView.z.abs();

    // Combine view normal and center distance for volumetric falloff
    const volumetricFalloff = coreDensity.mul(viewDot);

    // High-frequency energy crackle with sharp flickers
    // A rapid flicker that occasionally spikes to 1.5, creating a violent flash
    const flickerPulse = fract(uTime.mul(45.0)).mul(sin(uTime.mul(120.0))).clamp(0.0, 1.0);
    const sharpFlash = smoothstep(0.7, 1.0, flickerPulse).mul(1.5);
    const basePulse = sin(uTime.mul(50.0)).mul(0.3).add(0.7);

    const crackleNoise = sin(y.mul(200.0).add(uTime.mul(150.0))).mul(0.2).add(0.8);
    const glowIntensity = basePulse.add(sharpFlash).mul(crackleNoise);

    const coreColor = color(0xffffff);
    // Increase edge color saturation
    const edgeColor = color(uColor).mul(1.5);

    // Color gradient based on volumetric density
    // A tighter core to make the lightning look thinner and hotter inside
    let colorMix: any = mix(edgeColor, coreColor, volumetricFalloff.pow(4.0));

    // Dynamic Lighting Interaction
    if (uPlayerPos) {
        const distToPlayer = length(positionWorld.sub(uPlayerPos));
        const playerGlow = smoothstep(0.0, 120.0, distToPlayer).oneMinus().mul(0.6);
        colorMix = colorMix.add(vec3(0.5, 0.8, 1.0).mul(playerGlow));
    }

    if (weaponLights) {
        const weaponGlow = float(0.0).toVar();
        Loop({ start: 0, end: 20 }, ({ i }) => {
            const lightData = weaponLights.element(i);
            const lightPos = lightData.xyz;
            const lightIntensity = lightData.w;
            const distToLight = distance(positionWorld, lightPos);
            const lightFactor = smoothstep(0.0, 100.0, distToLight).oneMinus().mul(lightIntensity).mul(1.8);
            weaponGlow.addAssign(lightFactor);
        });
        colorMix = colorMix.add(vec3(0.0, 1.0, 1.0).mul(weaponGlow));
    }

    // Advanced alpha blending for volumetric scattering
    // Use a sharp falloff for the glowing core and softer for the edges
    const coreAlpha = volumetricFalloff.pow(1.5);
    const edgeAlpha = volumetricFalloff.pow(0.5).mul(0.5);

    // Combine core and edge with the intense flickering glow
    const alpha = coreAlpha.add(edgeAlpha).mul(glowIntensity).clamp(0.0, 1.0);

    mat.colorNode = vec4(colorMix, alpha);

    return mat;
}



function createShockwaveMaterial(uColor: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const dist = length(uv().sub(0.5));
    const ringInner = smoothstep(0.3, 0.45, dist);
    const ringOuter = smoothstep(0.45, 0.5, dist).oneMinus();

    const ringAlpha = ringInner.mul(ringOuter);

    mat.colorNode = vec4(uColor, ringAlpha);
    mat.userData.uColor = uColor;

    return mat;
}

export class LightningShockwaveLayer {
    scene: THREE.Scene;
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;

    positions: Float32Array;
    timers: Float32Array;
    baseScales: Float32Array;

    constructor(scene: THREE.Scene, count: number = 10) {
        this.scene = scene;
        this.count = count;

        const geo = new THREE.PlaneGeometry(10, 10);
        const uColor = uniform(new THREE.Color(0x88bbff));
        const mat = createShockwaveMaterial(uColor);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -1;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.timers = new Float32Array(this.count);
        this.baseScales = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            this.timers[i] = 0;
            this.dummy.scale.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
    }

    trigger(pos: THREE.Vector3, colorHex: number, scale: number = 1.0) {
        for (let i = 0; i < this.count; i++) {
            if (this.timers[i] <= 0) {
                this.timers[i] = 0.5; // 0.5 seconds life
                this.positions[i * 3] = pos.x;
                this.positions[i * 3 + 1] = pos.y;
                this.positions[i * 3 + 2] = pos.z;
                this.baseScales[i] = scale;

                const mat = this.mesh.material as any;
                if (mat.userData && mat.userData.uColor) {
                    mat.userData.uColor.value.setHex(colorHex);
                }
                break;
            }
        }
    }

    update(delta: number) {
        let needsUpdate = false;
        for (let i = 0; i < this.count; i++) {
            if (this.timers[i] > 0) {
                this.timers[i] -= delta;
                if (this.timers[i] <= 0) {
                    this.timers[i] = 0;
                    this.dummy.scale.set(0, 0, 0);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                } else {
                    const life = this.timers[i] / 0.5; // 1.0 down to 0.0
                    // Expanding shockwave ring
                    const currentScale = this.baseScales[i] * (1.0 + (1.0 - life) * 4.0);

                    this.dummy.position.set(this.positions[i*3], this.positions[i*3+1], this.positions[i*3+2]);
                    this.dummy.rotation.x = -Math.PI / 2; // Flat on the ground plane

                    // Emulate fading via scaling Z which we don't use, wait no, let's just scale it.
                    // As it expands, the thickness visually decreases.
                    this.dummy.scale.set(currentScale, currentScale, 1.0);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                }
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as any).dispose?.();

    }
}

export class LightningBoltSystem {
    weaponLightManager?: WeaponLightManager;
    uPlayerPos: any = uniform(new THREE.Vector3(0,0,0));
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number = 10;
    shockwaveLayer!: LightningShockwaveLayer;

    positions: Float32Array;
    timers: Float32Array;
    baseScaleX: Float32Array;
    baseScaleY: Float32Array;
    onBoltStrike?: (position: THREE.Vector3, color: THREE.Color) => void;
    currentDensity: number = 1.0;

    constructor(scene: THREE.Scene, weaponLightManager?: WeaponLightManager) {
        this.scene = scene;
        this.weaponLightManager = weaponLightManager;

        // Use a wide plane to allow the jagged line to draw within it
        const geo = new THREE.CylinderGeometry(0.5, 0.5, 40, 8, 32);
        const uColor = uniform(new THREE.Color(0x88bbff));
        const weaponLights = this.weaponLightManager ? this.weaponLightManager.storageNode : undefined;
        const mat = createLightningMaterial(uColor, weaponLights, this.uPlayerPos) as any;
        mat.userData = mat.userData || {};
        mat.userData.uColor = uColor;

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;
        // Background order but above deep clouds
        this.mesh.renderOrder = -1;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.timers = new Float32Array(this.count);
        this.baseScaleX = new Float32Array(this.count);
        this.baseScaleY = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            this.positions[i * 3] = 0;
            this.positions[i * 3 + 1] = 0;
            this.positions[i * 3 + 2] = 0;
            this.timers[i] = 0; // 0 means inactive

            // Hide initially by scaling to 0
            this.dummy.scale.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.scene.add(this.mesh);
        this.shockwaveLayer = new LightningShockwaveLayer(scene, this.count);
        this.deactivate();
    }

    activate(config?: { color?: number, density?: number }) {
        if (config && config.color !== undefined) {
            const mat = this.mesh.material as any;
            if (mat.userData && mat.userData.uColor) {
                mat.userData.uColor.value.setHex(config.color);
            }
        } else {
            const mat = this.mesh.material as any;
            if (mat.userData && mat.userData.uColor) {
                mat.userData.uColor.value.setHex(0x88bbff); // Default blue
            }
        }
        this.currentDensity = config?.density ?? 1.0;
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
        if (this.shockwaveLayer) this.shockwaveLayer.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        if (this.shockwaveLayer) this.shockwaveLayer.mesh.visible = false;
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8.0, playerPos?: THREE.Vector3) {
        if (playerPos) this.uPlayerPos.value.copy(playerPos);
        if (!this.active) return;

        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            if (this.timers[i] > 0) {
                this.timers[i] -= delta;

                if (this.timers[i] <= 0) {
                    this.timers[i] = 0;
                    this.dummy.scale.set(0, 0, 0);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                } else {
                    // Volumetric fade out
                    const fade = Math.min(1.0, this.timers[i] * 3.0);
                    this.mesh.getMatrixAt(i, this.dummy.matrix);
                    this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);
                    this.dummy.scale.set(this.baseScaleX[i] * fade, this.baseScaleY[i], 1.0);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                }
            } else {
                const speedBoost = Math.max(0, (playerSpeed - 10) * 0.1);
                if (Math.random() < 0.005 * this.currentDensity * (1.0 + speedBoost)) {
                    this.timers[i] = 0.2 + Math.random() * 0.3; // Visible for 0.2-0.5s

                    const x = cameraX + (Math.random() - 0.5) * 200;
                    const y = (Math.random() - 0.5) * 20 + 10; // High up
                    const z = -30 + (Math.random() - 0.5) * 20; // Background

                    if (this.onBoltStrike) {
                        const mat = this.mesh.material as any;
                        const strikeColor = mat.userData && mat.userData.uColor ? mat.userData.uColor.value : new THREE.Color(0x88bbff);
                        this.onBoltStrike(new THREE.Vector3(x, y, z), strikeColor);

                        // Trigger expanding shockwave at base level
                        if (this.shockwaveLayer) {
                            this.shockwaveLayer.trigger(new THREE.Vector3(x, y - 20, z), strikeColor.getHex(), 1.0 + Math.random() * 1.5);
                        }
                    }

                    this.positions[i * 3] = x;
                    this.positions[i * 3 + 1] = y;
                    this.positions[i * 3 + 2] = z;

                    this.dummy.position.set(x, y, z);

                    const scaleX = 1.0 + Math.random() * 2.5;
                    const scaleY = 1.0 + Math.random() * 2.0;
                    this.baseScaleX[i] = scaleX;
                    this.baseScaleY[i] = scaleY;
                    this.dummy.scale.set(scaleX, scaleY, 1.0);

                    this.dummy.rotation.set(0, 0, (Math.random() - 0.5) * 0.5);

                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                }
            }
        }

        if (this.shockwaveLayer) this.shockwaveLayer.update(delta);

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as any).dispose?.();

    }
}
