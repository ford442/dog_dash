import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time,
    vec3,
    vec4,
    float,
    sin,
    cos,
    mix,
    smoothstep,
    length,
    positionLocal,
    attribute
} from 'three/tsl';
import { DEPTH_LAYERS, randomZInRange } from './depth_layers';
import type { VoidJellyfishEnvironmentConfig } from './level_config';

export type { VoidJellyfishEnvironmentConfig };

const MAX_INSTANCES = 60;
const DEFAULT_DENSITY = 30;
const MIN_DENSITY = 20;

const PASTEL_PALETTE = [0xffb6d9, 0xb6ffe6, 0xd4b6ff, 0xb6d4ff, 0xffd4b6];

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const positions: number[] = [];
    const normals: number[] = [];

    for (const geo of geometries) {
        geo.computeVertexNormals();
        const pos = geo.attributes.position;
        const norm = geo.attributes.normal;
        for (let i = 0; i < pos.count; i++) {
            positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
            normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        }
        geo.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return merged;
}

/** Low-poly bell + tentacles (~50 tris). */
function createJellyfishGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];

    const bell = new THREE.SphereGeometry(0.55, 5, 3, 0, Math.PI * 2, 0, Math.PI * 0.55);
    bell.translate(0, 0.08, 0);
    parts.push(bell);

    const tentacleCount = 3;
    for (let i = 0; i < tentacleCount; i++) {
        const angle = (i / tentacleCount) * Math.PI * 2;
        const tentacle = new THREE.ConeGeometry(0.05, 0.45, 3);
        tentacle.translate(
            Math.cos(angle) * 0.22,
            -0.28,
            Math.sin(angle) * 0.22
        );
        parts.push(tentacle);
    }

    return mergeGeometries(parts);
}

/**
 * Instanced void jellyfish — pastel drifting background life.
 * Single draw call, sinusoidal drift + gentle player avoidance.
 */
export class VoidJellyfishSystem {
    scene: THREE.Scene;
    active = false;
    mesh: THREE.InstancedMesh;
    activeCount = DEFAULT_DENSITY;

    private readonly dummy = new THREE.Object3D();
    private readonly positions: Float32Array;
    private readonly velocities: Float32Array;
    private readonly phases: Float32Array;
    private readonly baseScales: Float32Array;
    private elapsed = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.positions = new Float32Array(MAX_INSTANCES * 3);
        this.velocities = new Float32Array(MAX_INSTANCES * 3);
        this.phases = new Float32Array(MAX_INSTANCES);
        this.baseScales = new Float32Array(MAX_INSTANCES);

        const geometry = createJellyfishGeometry();

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.NormalBlending
        });

        const aPhase = attribute('aPhase', 'float');
        const aColor = attribute('aColor', 'vec3');
        const uTime = time;

        const tentacleMask = smoothstep(float(-0.05), float(-0.45), positionLocal.y);
        const swayX = sin(uTime.mul(1.4).add(aPhase)).mul(0.07);
        const swayZ = cos(uTime.mul(1.1).add(aPhase.mul(1.25))).mul(0.05);
        mat.positionNode = positionLocal.add(vec3(swayX, float(0), swayZ).mul(tentacleMask));

        const rimDist = length(vec3(positionLocal.x, float(0), positionLocal.z));
        const rimGlow = smoothstep(float(0.3), float(0.52), rimDist)
            .mul(sin(uTime.mul(2.2).add(aPhase)).mul(0.5).add(0.5));
        const glowTint = aColor.mul(vec3(1.25, 1.2, 1.35));
        const bodyColor = mix(aColor, glowTint, rimGlow.mul(0.65));

        mat.colorNode = vec4(bodyColor, float(0.3).add(rimGlow.mul(0.18)));
        mat.opacityNode = float(0.26).add(rimGlow.mul(0.14));

        this.mesh = new THREE.InstancedMesh(geometry, mat, MAX_INSTANCES);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 2;
        this.mesh.count = 0;

        const colors = new Float32Array(MAX_INSTANCES * 3);
        const zRange: [number, number] = [DEPTH_LAYERS.BACKGROUND.min, DEPTH_LAYERS.MIDGROUND.max];

        for (let i = 0; i < MAX_INSTANCES; i++) {
            const x = (Math.random() - 0.5) * 120;
            const y = (Math.random() - 0.5) * 28;
            const z = randomZInRange(zRange);

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;

            this.velocities[i * 3] = 1.2 + Math.random() * 1.8;
            this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
            this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.35;

            this.phases[i] = Math.random() * Math.PI * 2;
            this.baseScales[i] = 0.35 + Math.random() * 0.45;

            const colorHex = PASTEL_PALETTE[Math.floor(Math.random() * PASTEL_PALETTE.length)];
            const c = new THREE.Color(colorHex);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            this._writeInstanceMatrix(i, 0);
        }

        geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(this.phases, 1));
        geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));

        this.scene.add(this.mesh);
        this.deactivate();
    }

    private _writeInstanceMatrix(index: number, pulseTime: number) {
        const x = this.positions[index * 3];
        const y = this.positions[index * 3 + 1];
        const z = this.positions[index * 3 + 2];
        const phase = this.phases[index];
        const base = this.baseScales[index];

        const pulse = 1 + Math.sin(pulseTime * 1.8 + phase) * 0.12;
        const squash = 1 - Math.sin(pulseTime * 1.8 + phase) * 0.06;

        this.dummy.position.set(x, y, z);
        this.dummy.rotation.set(
            Math.sin(pulseTime * 0.4 + phase) * 0.15,
            Math.sin(pulseTime * 0.25 + phase * 1.7) * 0.3,
            Math.cos(pulseTime * 0.35 + phase) * 0.1
        );
        this.dummy.scale.set(base * squash, base * pulse, base * squash);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(index, this.dummy.matrix);
    }

    activate(config?: VoidJellyfishEnvironmentConfig) {
        const requested = config?.density ?? DEFAULT_DENSITY;
        this.activeCount = Math.min(MAX_INSTANCES, Math.max(MIN_DENSITY, Math.floor(requested)));
        this.mesh.count = this.activeCount;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.active = true;
        this.mesh.visible = true;
    }

    deactivate() {
        this.active = false;
        this.mesh.visible = false;
        this.mesh.count = 0;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active || this.activeCount === 0) return;

        this.elapsed += delta;
        const margin = 90;
        const limitBack = cameraX - margin;
        const limitFront = cameraX + margin;
        const zRange: [number, number] = [DEPTH_LAYERS.BACKGROUND.min, DEPTH_LAYERS.MIDGROUND.max];

        for (let i = 0; i < this.activeCount; i++) {
            let x = this.positions[i * 3];
            let y = this.positions[i * 3 + 1];
            let z = this.positions[i * 3 + 2];

            x += this.velocities[i * 3] * delta;
            y += this.velocities[i * 3 + 1] * delta;
            z += this.velocities[i * 3 + 2] * delta;

            y += Math.sin(this.elapsed * 0.7 + this.phases[i]) * delta * 0.35;
            z += Math.cos(this.elapsed * 0.55 + this.phases[i] * 1.3) * delta * 0.25;

            if (playerPos) {
                const dx = x - playerPos.x;
                const dy = y - playerPos.y;
                const dz = z - playerPos.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                const avoidRadius = 9;
                const avoidSq = avoidRadius * avoidRadius;
                if (distSq < avoidSq && distSq > 0.01) {
                    const dist = Math.sqrt(distSq);
                    const push = (1 - dist / avoidRadius) * 1.8 * delta;
                    x += (dx / dist) * push;
                    y += (dy / dist) * push;
                    z += (dz / dist) * push;
                }
            }

            if (x < limitBack) {
                x = cameraX + margin * 0.6 + Math.random() * 40;
                y = (Math.random() - 0.5) * 28;
                z = randomZInRange(zRange);
            } else if (x > limitFront) {
                x = cameraX - margin * 0.4;
            }

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;

            this._writeInstanceMatrix(i, this.elapsed);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if ((this.mesh.material as THREE.Material).dispose) {
            (this.mesh.material as THREE.Material).dispose();
        }
    }
}
