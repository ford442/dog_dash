import * as THREE from 'three';
import { time, vec3, vec4, color, uniform, sin, cos, mix, positionLocal, float, smoothstep, fract, abs } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';


export interface HyperspaceTunnelConfig {
    density?: number;
    speed?: number;
    color1?: number;
    color2?: number;
}

const RING_COUNT = 80;
const TUNNEL_LENGTH = 3000;
const TUNNEL_RADIUS = 150;

function createWarpRingMaterial(color1: number, color2: number, uSpeed: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    // Subtle pulsation and chromatic shift
    const t = time.mul(uSpeed).add(positionLocal.z.mul(0.01));
    const mixFactor = sin(t).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    // Fade out at extreme distance (edges of the individual ring)
    const fade = smoothstep(1.0, 0.8, abs(positionLocal.z).div(10.0));

    // Shimmer effect
    const shimmer = fract(time.mul(2.0).add(positionLocal.x.mul(0.1))).step(0.8).oneMinus().mul(0.5).add(0.5);

    mat.colorNode = vec4(baseColor, fade.mul(shimmer).mul(0.8));

    return mat;
}

export class HyperspaceTunnelSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh!: THREE.InstancedMesh;

    // Config
    ringCount: number = RING_COUNT;
    speedMultiplier: number = 1.0;

    // TSL Uniforms
    uSpeed: ReturnType<typeof uniform>;

    constructor(scene: THREE.Scene, config?: HyperspaceTunnelConfig) {
        this.scene = scene;
        this.uSpeed = uniform(1.0);

        const color1 = config?.color1 ?? 0x00ffff;
        const color2 = config?.color2 ?? 0xff00ff;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.ringCount = Math.floor(RING_COUNT * (config?.density ?? 1.0));

        const geo = new THREE.TorusGeometry(TUNNEL_RADIUS, 2.0, 4, 32);
        const mat = createWarpRingMaterial(color1, color2, this.uSpeed);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.ringCount);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -15; // Behind most things, but in front of deep background

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.ringCount; i++) {
            const z = (i / this.ringCount) * TUNNEL_LENGTH;
            // Add some jitter to x and y
            const x = (Math.random() - 0.5) * 40;
            const y = (Math.random() - 0.5) * 40;
            dummy.position.set(x, y, -z);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;

        this.scene.add(this.mesh);

        decorationBudget.register('hyperspace_tunnel', {
            label: 'Hyperspace Tunnel',
            category: 'background3d',
            maxActive: this.ringCount
        });

        this.deactivate();
    }

    activate(config?: HyperspaceTunnelConfig) {
        if (config?.speed !== undefined) this.speedMultiplier = config.speed;
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
        decorationBudget.syncCount('hyperspace_tunnel', this.ringCount);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        decorationBudget.syncCount('hyperspace_tunnel', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        // Rush effect: rings move towards camera based on speed
        const rushSpeed = 400 * playerSpeed * this.speedMultiplier * delta;
        this.uSpeed.value = playerSpeed * this.speedMultiplier;

        const dummy = new THREE.Object3D();
        const mat4 = new THREE.Matrix4();

        for (let i = 0; i < this.ringCount; i++) {
            this.mesh.getMatrixAt(i, mat4);
            mat4.decompose(dummy.position, dummy.quaternion, dummy.scale);

            dummy.position.z += rushSpeed;

            // Wrap around
            if (dummy.position.z > 200) {
                dummy.position.z -= TUNNEL_LENGTH;
                // Re-randomize x and y slightly when wrapping
                dummy.position.x = cameraX + (Math.random() - 0.5) * 40;
                dummy.position.y = (Math.random() - 0.5) * 40;
            } else {
                // Keep tracking camera X
                dummy.position.x = cameraX + (dummy.position.x - cameraX) * 0.99;
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
        decorationBudget.syncCount('hyperspace_tunnel', 0);
    }
}
