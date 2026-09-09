import * as THREE from 'three';
import { time, vec2, vec3, color, uniform, mix, float, sin, cos, max, smoothstep, length, positionWorld } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';

export class GrappleIslesSystem {
    scene: THREE.Scene;
    active: boolean = false;

    private layerMeshes: THREE.InstancedMesh[] = [];
    private layerParams: { speed: number; z: number; width: number; count: number }[] = [];
    private uPlayerPos = uniform(vec3(0, 0, 0));
    private timeUniform = uniform(0.0);

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Base geometry: rough icosphere for floating rocks
        const geo = new THREE.IcosahedronGeometry(1, 1);

        // Setup multiple parallax layers
        this.layerParams = [
            { speed: 0.1, z: -80, width: 400, count: 20 },  // Deep background
            { speed: 0.25, z: -40, width: 300, count: 15 }, // Midground
            { speed: 0.5, z: -15, width: 250, count: 10 },  // Near midground
            { speed: 0.8, z: 5, width: 200, count: 5 }      // Foreground (passes in front)
        ];

        for (let i = 0; i < this.layerParams.length; i++) {
            const params = this.layerParams[i];

            // Unique material per layer to scale opacity or tint if needed
            const mat = this.createIsleMaterial(i);
            const mesh = new THREE.InstancedMesh(geo, mat, params.count);
            mesh.frustumCulled = false;

            const dummy = new THREE.Object3D();
            for (let j = 0; j < params.count; j++) {
                const x = (Math.random() - 0.5) * params.width;
                const y = (Math.random() - 0.5) * 40;

                // Random scale
                const s = 4 + Math.random() * 8 + (i * 2); // Foreground islands are larger
                dummy.position.set(x, y, params.z);

                // Random rotation
                dummy.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );

                dummy.scale.set(s, s * (0.6 + Math.random() * 0.4), s);
                dummy.updateMatrix();
                mesh.setMatrixAt(j, dummy.matrix);
            }

            mesh.instanceMatrix.needsUpdate = true;
            this.layerMeshes.push(mesh);
            this.scene.add(mesh);
        }

        this.deactivate();
    }

    private createIsleMaterial(layerIndex: number): MeshStandardNodeMaterial {
        const mat = new MeshStandardNodeMaterial({
            roughness: 0.9,
            metalness: 0.1,
            transparent: layerIndex === 3, // Only foreground might obscure player
            depthWrite: layerIndex !== 3,
            side: layerIndex === 3 ? THREE.DoubleSide : THREE.FrontSide
        });

        const baseColor = color(0x3d4a3e); // Mossy green-brown
        const highlightColor = color(0x769b74);

        // Procedural time-based float bobbing applied to vertices
        const uTime = this.timeUniform;
        const bob = sin(uTime.add(positionWorld.x.mul(0.1))).mul(0.5);
        mat.positionNode = positionWorld.add(vec3(0, bob, 0));

        // Player glow interaction
        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        const glowIntensity = smoothstep(40.0, 10.0, distToPlayer);
        const playerGlowColor = color(0x00ffcc).mul(glowIntensity.mul(0.5));

        mat.colorNode = baseColor.add(playerGlowColor);

        return mat;
    }

    activate(config?: { density?: number }) {
        if (this.active) return;
        this.active = true;
        this.layerMeshes.forEach(m => m.visible = true);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.layerMeshes.forEach(m => m.visible = false);
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        this.timeUniform.value += delta;
        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        // Parallax scroll logic
        const margin = 50;
        for (let i = 0; i < this.layerParams.length; i++) {
            const params = this.layerParams[i];
            const mesh = this.layerMeshes[i];

            // Base offset driven by cameraX to create parallax
            // We want slower layers to move LESS with the camera
            const scrollX = cameraX * params.speed;

            // Actually move the mesh wrapper so instances wrap around it
            mesh.position.x = scrollX;

            const limitBack = cameraX - (params.width / 2) - margin - scrollX;
            const limitFront = cameraX + (params.width / 2) + margin - scrollX;

            let needsUpdate = false;
            const dummy = new THREE.Object3D();
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            const scale = new THREE.Vector3();

            for (let j = 0; j < params.count; j++) {
                mesh.getMatrixAt(j, dummy.matrix);
                dummy.matrix.decompose(pos, quat, scale);

                let wrapped = false;
                if (pos.x < limitBack) {
                    pos.x += params.width + margin * 2;
                    wrapped = true;
                } else if (pos.x > limitFront) {
                    pos.x -= params.width + margin * 2;
                    wrapped = true;
                }

                if (wrapped) {
                    dummy.position.copy(pos);
                    dummy.quaternion.copy(quat);
                    dummy.scale.copy(scale);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(j, dummy.matrix);
                    needsUpdate = true;
                }
            }
            if (needsUpdate) {
                mesh.instanceMatrix.needsUpdate = true;
            }
        }
    }

    cleanup() {
        this.layerMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as any).dispose?.();
        });
        this.layerMeshes = [];
    }
}
