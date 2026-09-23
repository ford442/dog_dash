import * as THREE from 'three';
import { time, vec3, vec4, color, uniform, sin, cos, mix, positionLocal, float, smoothstep, fract, abs, uv, length, atan2 } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';
import { fbm } from './clouds/noise';

export interface StardustVortexConfig {
    enabled: boolean;
    density?: number;
    color1?: number;
    color2?: number;
    speed?: number;
}

const MAX_VORTEXES = 30; // Max buffer size
const DEFAULT_VORTEXES = 10;

function createVortexMaterial(color1: number, color2: number, uSpeed: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    // Convert UV to polar coordinates for spiral effect
    const centeredUv = uv().sub(0.5);
    const dist = length(centeredUv);
    const angle = atan2(centeredUv.y, centeredUv.x);

    // Spiraling noise lookup
    const spiralAngle = angle.add(dist.mul(10.0)).sub(time.mul(uSpeed));
    // Add noise to the spiral
    const noiseVal = fbm(vec3(dist.mul(10.0), spiralAngle, time.mul(0.1)));

    // Color mixing based on radius and noise
    const mixFactor = sin(dist.mul(15.0).sub(time.mul(uSpeed))).mul(0.5).add(0.5).add(noiseVal.mul(0.5));
    const baseColor = mix(c1, c2, mixFactor.clamp(0.0, 1.0));

    // Fade edges (smooth circle)
    const fade = smoothstep(0.5, 0.2, dist);
    // Darken center to look like a black hole/vortex eye
    const centerFade = smoothstep(0.02, 0.1, dist);

    mat.colorNode = vec4(baseColor, fade.mul(centerFade).mul(0.8));

    return mat;
}

export class StardustVortexSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh!: THREE.InstancedMesh;

    vortexCount: number = DEFAULT_VORTEXES;
    uSpeed = uniform(1.0);
    width: number = 3000;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Large planes for the vortexes
        const geo = new THREE.PlaneGeometry(800, 800, 1, 1);
        const mat = createVortexMaterial(0x6600ff, 0xff00aa, this.uSpeed);

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_VORTEXES);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -20; // Very far background, behind energy rifts

        const dummy = new THREE.Object3D();
        for (let i = 0; i < MAX_VORTEXES; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * 600;
            const z = -600 - Math.random() * 400; // Deep background
            dummy.position.set(x, y, z);

            // Random tilt to make them look 3D in the distance
            dummy.rotation.x = (Math.random() - 0.5) * 0.5;
            dummy.rotation.y = (Math.random() - 0.5) * 0.5;
            dummy.rotation.z = Math.random() * Math.PI * 2;

            const scale = 0.5 + Math.random() * 1.5;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);

        decorationBudget.register('stardust_vortex', {
            label: 'Stardust Vortex',
            category: 'background3d',
            maxActive: this.vortexCount
        });

        this.deactivate();
    }

    activate(config?: StardustVortexConfig) {
        if (this.active) return;
        this.active = true;
        this.vortexCount = Math.min(MAX_VORTEXES, Math.floor(DEFAULT_VORTEXES * (config?.density ?? 1.0)));
        this.mesh.count = this.vortexCount;
        this.mesh.visible = true;

        if (config?.color1 !== undefined || config?.color2 !== undefined) {
            const mat = createVortexMaterial(config.color1 ?? 0x6600ff, config.color2 ?? 0xff00aa, this.uSpeed);
            if (this.mesh.material) {
                (this.mesh.material as any).dispose?.();
            }
            this.mesh.material = mat;
        }

        if (config?.speed !== undefined) {
            this.uSpeed.value = config.speed;
        }

        decorationBudget.syncCount('stardust_vortex', this.vortexCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('stardust_vortex', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        const dummy = new THREE.Object3D();
        const mat4 = new THREE.Matrix4();
        const margin = 1000;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        for (let i = 0; i < this.vortexCount; i++) {
            this.mesh.getMatrixAt(i, mat4);
            mat4.decompose(dummy.position, dummy.quaternion, dummy.scale);

            // Very slow parallax based on distance
            const parallaxSpeed = 50.0 / Math.abs(dummy.position.z);
            dummy.position.x -= delta * playerSpeed * parallaxSpeed;

            // Slow spin
            dummy.rotation.z += delta * 0.05 * (i % 2 === 0 ? 1 : -1);

            if (dummy.position.x < limitBack) {
                dummy.position.x += this.width + margin * 2;
                dummy.position.y = (Math.random() - 0.5) * 600;
            } else if (dummy.position.x > limitFront) {
                dummy.position.x -= this.width + margin * 2;
                dummy.position.y = (Math.random() - 0.5) * 600;
            }

            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
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
        decorationBudget.syncCount('stardust_vortex', 0);
    }
}
