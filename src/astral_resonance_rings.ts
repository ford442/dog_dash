import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, mix, float, step, fract, uv, sin, length, atan2, smoothstep } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface AstralResonanceRingsConfig {
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_RINGS = 15;
const DEFAULT_RINGS = 5;

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createResonanceRingMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // The Torus geometry maps U along the tube and V around the tube.
    // For rings, x is around the ring, y is the cross-section

    // Animate energy pulse along the ring
    const scrollUv = vec2(baseUv.x.add(time.mul(0.2)), baseUv.y);

    // Noise to make it look like energy, not a solid band
    const noiseVal = fbm(vec3(scrollUv.x.mul(15.0), scrollUv.y.mul(2.0), time.mul(0.1)));

    // Edge fading around the torus cross section (y axis of UVs)
    // baseUv.y goes 0 to 1 around the minor radius
    const coreDist = float(0.5).sub(baseUv.y).abs();
    // Sharpen the core and fade the edges
    const coreGlow = smoothstep(0.5, 0.0, coreDist).pow(2.0);

    // Pulse effect over time
    const pulse = sin(baseUv.x.mul(20.0).add(time.mul(2.0))).mul(0.5).add(0.5);

    // Combine noise and pulse
    const intensity = coreGlow.mul(noiseVal.add(0.2)).mul(pulse.add(0.5));

    // Color shifting based on position and time
    const mixFactor = sin(baseUv.x.mul(5.0).add(time.mul(0.5))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    mat.colorNode = vec4(baseColor, intensity.mul(0.8));

    return mat;
}

export class AstralResonanceRingsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    ringCount: number = DEFAULT_RINGS;
    width: number = 8000;
    height: number = 4000;
    depth: number = 2000;
    speedMultiplier: number = 1.0;

    private ringData: { speedOffset: number, scaleOffset: number, rotSpeedX: number, rotSpeedY: number, rotSpeedZ: number }[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // TorusGeometry: radius, tube, radialSegments, tubularSegments
        const geo = new THREE.TorusGeometry(800, 20, 16, 128);

        // Default colors: deep cyan and vibrant purple
        const mat = createResonanceRingMaterial(0x00ffff, 0x8800ff);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_RINGS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -15; // Deep background

        for (let i = 0; i < MAX_RINGS; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                -1000 - Math.random() * this.depth
            );

            // Random initial rotation
            dummyObj.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            const scale = 0.5 + Math.random() * 2.5;
            dummyObj.scale.set(scale, scale, scale);
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);

            this.ringData.push({
                speedOffset: 0.5 + Math.random(),
                scaleOffset: scale,
                rotSpeedX: (Math.random() - 0.5) * 0.05,
                rotSpeedY: (Math.random() - 0.5) * 0.05,
                rotSpeedZ: (Math.random() - 0.5) * 0.1,
            });
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('astralResonanceRings', {
            label: 'Astral Resonance Rings',
            category: 'background3d',
            maxActive: this.ringCount
        });

        this.deactivate();
    }

    activate(config?: AstralResonanceRingsConfig) {
        if (this.active) return;
        this.active = true;
        this.ringCount = Math.min(MAX_RINGS, Math.floor(DEFAULT_RINGS * (config?.density ?? 1.0)));
        this.mesh.count = this.ringCount;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createResonanceRingMaterial(config.color1 ?? 0x00ffff, config.color2 ?? 0x8800ff);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('astralResonanceRings', this.ringCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('astralResonanceRings', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const margin = 2000;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        // Expansion effect variables
        const timeNow = performance.now() * 0.001;

        for (let i = 0; i < this.ringCount; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            const data = this.ringData[i];

            // Parallax factor based on depth
            const parallaxFactor = 100.0 / Math.abs(dummyObj.position.z);

            // Slow natural drift + player parallax
            const driftSpeed = 2.0 * this.speedMultiplier * data.speedOffset;
            const totalSpeed = driftSpeed + (playerSpeed * parallaxFactor);

            dummyObj.position.x -= delta * totalSpeed;

            // Slow continuous rotation
            dummyObj.rotation.x += data.rotSpeedX * delta * this.speedMultiplier;
            dummyObj.rotation.y += data.rotSpeedY * delta * this.speedMultiplier;
            dummyObj.rotation.z += data.rotSpeedZ * delta * this.speedMultiplier;

            // Slow expansion pulse (breathing)
            const pulseScale = 1.0 + Math.sin(timeNow * 0.5 + i) * 0.1;
            dummyObj.scale.set(data.scaleOffset * pulseScale, data.scaleOffset * pulseScale, data.scaleOffset * pulseScale);

            if (dummyObj.position.x < limitBack) {
                dummyObj.position.x += this.width + margin * 2;
                dummyObj.position.y = (Math.random() - 0.5) * this.height;
            } else if (dummyObj.position.x > limitFront) {
                dummyObj.position.x -= this.width + margin * 2;
                dummyObj.position.y = (Math.random() - 0.5) * this.height;
            }

            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if (Array.isArray(this.mesh.material)) {
            this.mesh.material.forEach(m => m.dispose());
        } else {
            this.mesh.material.dispose();
        }
        decorationBudget.syncCount('astralResonanceRings', 0);
    }
}