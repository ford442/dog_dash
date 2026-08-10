import * as THREE from 'three';
import { time, vec3, color, uniform, sin, cos, positionLocal, positionWorld, length, smoothstep, normalLocal } from 'three/tsl';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { ParticleSystem } from './particles';

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

        // Simplified pet body (a fluffy sphere) with a glass helmet
        const geo = new THREE.SphereGeometry(0.5, 12, 12);

        const mat = new MeshPhysicalNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.FrontSide,
            transmission: 0.2, // slight glass look for helmet
            roughness: 0.3,
            metalness: 0.1,
            ior: 1.2,
        });

        const baseColor = color(0xe6e6fa); // Lavender base (Space Bunny color)

        // Add a "helmet" glass look at the front
        const isHelmet = smoothstep(0.5, 0.7, normalLocal.z);
        const helmetColor = color(0xaaddff);
        const finalColor = baseColor.mix(helmetColor, isHelmet.mul(0.5));

        // Glow interaction based on player proximity
        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        const interactGlow = smoothstep(20.0, 0.0, distToPlayer);

        mat.colorNode = finalColor;
        mat.emissiveNode = color(0xffffff).mul(interactGlow.mul(0.8));

        // Gentle bobbing and wave
        const t = time.mul(1.5).add(positionWorld.x);
        mat.positionNode = positionLocal.add(vec3(0, sin(t).mul(0.15), cos(t.mul(0.7)).mul(0.1)));

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;

        // We render just behind midground stuff
        this.mesh.renderOrder = -2;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * 30,
                -20 - Math.random() * 40 // Parallax depth layers
            );

            dummy.rotation.set(
                (Math.random() - 0.5) * 0.4,
                Math.PI + (Math.random() - 0.5) * 0.4, // facing roughly towards camera
                (Math.random() - 0.5) * 0.2
            );

            const scale = 0.6 + Math.random() * 0.6;
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
                        this.burstCooldowns[i] = 2.0 + Math.random() * 2.0; // Cooldown
                    }
                }
            }

            if (pos.x < limitBack) {
                pos.x += this.width + margin * 2;
                pos.y = (Math.random() - 0.5) * 30;
            } else if (pos.x > limitFront) {
                pos.x -= this.width + margin * 2;
                pos.y = (Math.random() - 0.5) * 30;
            }

            matrix.setPosition(pos);
            this.mesh.setMatrixAt(i, matrix);
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
