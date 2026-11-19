import * as THREE from 'three';
import { disposeObject } from './utils';
import { time, vec3, color, uniform, sin, cos, positionLocal, positionWorld, length, smoothstep, vertexColor, instanceIndex, float, clamp } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { ParticleSystem } from './particles';
import { getSpacePetGeometry, PET_EAR_BASE_Y } from './scenery_art/space_pet';

/**
 * Space-bunny material: vertex colours, a hop-and-sway, ears that flop, and a
 * white glow when the player is close (shared with the gallery).
 */
export function createSpacePetMaterial(uPlayerPos: ReturnType<typeof uniform>): MeshStandardNodeMaterial {
    const mat = new MeshStandardNodeMaterial({ roughness: 0.45, metalness: 0.05 });
    mat.colorNode = vertexColor();

    // Glow interaction based on player proximity
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const interactGlow = smoothstep(20.0, 0.0, distToPlayer);
    mat.emissiveNode = color(0xffffff).mul(interactGlow.mul(0.6));

    // Gentle bob, plus the ears flopping side to side (phase per instance)
    const t = time.mul(1.5).add(float(instanceIndex).mul(0.73));
    const ear = clamp(positionLocal.y.sub(PET_EAR_BASE_Y).mul(3.0), 0, 1);
    mat.positionNode = positionLocal.add(vec3(
        sin(t.mul(2.0)).mul(0.08).mul(ear),
        sin(t).mul(0.15),
        cos(t.mul(0.7)).mul(0.1)
    ));
    return mat;
}

export class SpacePetsSwarmSystem {
    private particles: ParticleSystem | null = null;
    private burstCooldowns: Float32Array;
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 60;
    width: number = 300;
    uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));

    constructor(scene: THREE.Scene, particles?: ParticleSystem) {
        if (particles) this.particles = particles;
        this.burstCooldowns = new Float32Array(this.count);
        this.scene = scene;

        // Merged low-poly space bunny (ears, helmet, tail), one draw call for the swarm.
        const geo = getSpacePetGeometry();
        const mat = createSpacePetMaterial(this.uPlayerPos);

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;

        // We render just behind midground stuff
        this.mesh.renderOrder = -2;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * this.width, // visual-only
                (Math.random() - 0.5) * 30, // visual-only
                -20 - Math.random() * 40 // visual-only; Parallax depth layers
            );

            dummy.rotation.set(
                (Math.random() - 0.5) * 0.2, // visual-only
                0.9 + (Math.random() - 0.5) * 0.4, // visual-only; three-quarter view: drifting +X, visor toward the camera
                (Math.random() - 0.5) * 0.2 // visual-only
            );

            const scale = 0.6 + Math.random() * 0.6; // visual-only
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        const margin = 50;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;

        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();

        for (let i = 0; i < this.count; i++) {
            this.mesh.getMatrixAt(i, matrix);
            pos.setFromMatrixPosition(matrix);

            // Very slow drift
            pos.x += delta * (0.8 + (i % 3) * 0.4);

            // Intensified waving animation based on player proximity
            let bobAmplitude = 0.15;
            let bobFrequency = 1.5;

            this.burstCooldowns[i] = Math.max(0, this.burstCooldowns[i] - delta);

            if (playerPos) {
                const distToPlayer = pos.distanceTo(playerPos);
                if (distToPlayer < 20.0) {
                    // Intensify bobbing when near
                    const intensity = 1.0 - (distToPlayer / 20.0);
                    // In a future pass, these could be passed via an instance buffer attribute to drive shader animation.
                    // bobAmplitude += intensity * 0.2;
                    // bobFrequency += intensity * 2.0;

                    // Sparkle burst when very close
                    if (distToPlayer < 8.0 && this.burstCooldowns[i] === 0 && this.particles) {
                        this.particles.emit(pos.clone(), 0xffd700, 5, 2.0, 0.4, 0.8);
                        this.burstCooldowns[i] = 2.0 + Math.random() * 2.0; // visual-only; Cooldown
                    }
                }
            }

            if (pos.x < limitBack) {
                pos.x += this.width + margin * 2;
                pos.y = (Math.random() - 0.5) * 30; // visual-only
            } else if (pos.x > limitFront) {
                pos.x -= this.width + margin * 2;
                pos.y = (Math.random() - 0.5) * 30; // visual-only
            }

            matrix.setPosition(pos);
            this.mesh.setMatrixAt(i, matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        disposeObject(this.mesh);
    }
}
