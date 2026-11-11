import * as THREE from 'three';
import { time, vec2, vec3, vec4, color, mix, float, step, fract, uv, sin, abs } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface EtherealPrismaticRibbonsConfig {
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_RIBBONS = 12;
const DEFAULT_RIBBONS = 6;

const dummyObj = new THREE.Object3D();
const mat4Obj = new THREE.Matrix4();

function createRibbonMaterial(color1: number, color2: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    const baseUv = uv();

    // Scroll along the ribbon length
    const scrollUv = vec2(baseUv.x, baseUv.y.add(time.mul(0.15)));

    // Create a twisted, folding noise effect
    const twistFactor = sin(baseUv.y.mul(10.0).add(time.mul(0.5)));
    const warpedUv = vec2(scrollUv.x.add(twistFactor.mul(0.2)), scrollUv.y);

    const noiseVal = fbm(vec3(warpedUv.x.mul(8.0), warpedUv.y.mul(3.0), time.mul(0.2)));

    // Glowing core, fading towards the edges (X axis)
    const coreDist = float(0.5).sub(baseUv.x).abs();
    const coreGlow = float(1.0).sub(coreDist.mul(2.0)).max(0.0).pow(1.5);

    // Fade ends of the ribbon (Y axis)
    const fadeEnd = baseUv.y.mul(float(1.0).sub(baseUv.y)).mul(4.0);

    const intensity = coreGlow.mul(noiseVal.add(0.5)).mul(fadeEnd).mul(0.8);

    // Prismatic color shift along length and time
    const shift = sin(baseUv.y.mul(5.0).add(time.mul(0.4))).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, shift);

    mat.colorNode = vec4(baseColor, intensity);

    return mat;
}

export class EtherealPrismaticRibbonsSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;

    ribbonCount: number = DEFAULT_RIBBONS;
    width: number = 4000;
    height: number = 2500;
    depth: number = 1500;
    speedMultiplier: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Long, flowing ribbon geometry
        const geo = new THREE.PlaneGeometry(150, 3000, 16, 128);

        // Default colors: Prismatic purple and cyan
        const mat = createRibbonMaterial(0xff00ff, 0x00ffff);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_RIBBONS);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -18; // Deep background

        for (let i = 0; i < MAX_RIBBONS; i++) {
            dummyObj.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                -500 - Math.random() * this.depth
            );

            // Flowing across the background with slightly varied angles
            dummyObj.rotation.set(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * Math.PI
            );

            const scaleX = 0.5 + Math.random() * 2.0;
            const scaleY = 0.8 + Math.random() * 1.5;
            dummyObj.scale.set(scaleX, scaleY, 1.0);
            dummyObj.updateMatrix();
            this.mesh.setMatrixAt(i, dummyObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('etherealPrismaticRibbons', {
            label: 'Ethereal Prismatic Ribbons',
            category: 'background3d',
            maxActive: this.ribbonCount
        });

        this.deactivate();
    }

    activate(config?: EtherealPrismaticRibbonsConfig) {
        if (this.active) return;
        this.active = true;
        this.ribbonCount = Math.min(MAX_RIBBONS, Math.floor(DEFAULT_RIBBONS * (config?.density ?? 1.0)));
        this.mesh.count = this.ribbonCount;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createRibbonMaterial(config.color1 ?? 0xff00ff, config.color2 ?? 0x00ffff);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        decorationBudget.syncCount('etherealPrismaticRibbons', this.ribbonCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('etherealPrismaticRibbons', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const margin = 1500;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        const timeNow = performance.now() * 0.001;

        for (let i = 0; i < this.ribbonCount; i++) {
            this.mesh.getMatrixAt(i, mat4Obj);
            mat4Obj.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);

            // Parallax factor based on depth
            const parallaxFactor = 100.0 / Math.abs(dummyObj.position.z);

            // Natural drift + player parallax
            const driftSpeed = 3.0 * this.speedMultiplier;
            const totalSpeed = driftSpeed + (playerSpeed * parallaxFactor);

            dummyObj.position.x -= delta * totalSpeed;

            // Slow, majestic twisting
            dummyObj.rotation.z += delta * 0.05 * Math.sin(timeNow * 0.5 + i);
            dummyObj.rotation.x = Math.sin(timeNow * 0.2 + i) * 0.1;
            dummyObj.rotation.y = Math.cos(timeNow * 0.2 + i) * 0.1;

            if (dummyObj.position.x < limitBack) {
                dummyObj.position.x += this.width + margin * 2;
                dummyObj.position.y = (Math.random() - 0.5) * this.height;
                dummyObj.rotation.z = (Math.random() - 0.5) * Math.PI;
            } else if (dummyObj.position.x > limitFront) {
                dummyObj.position.x -= this.width + margin * 2;
                dummyObj.position.y = (Math.random() - 0.5) * this.height;
                dummyObj.rotation.z = (Math.random() - 0.5) * Math.PI;
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
        decorationBudget.syncCount('etherealPrismaticRibbons', 0);
    }
}
