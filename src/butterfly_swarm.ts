import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    time,
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
    smoothstep,
    dot,
    fract,
    length,
    pow,
    positionLocal,
    positionWorld,
    instanceMatrix,
    attribute
} from 'three/tsl';

/**
 * Butterfly Swarm System for Dog Dash
 * Creates a magical swarm of glowing, flapping butterflies
 * Perfect for a dreamy 7-year-old girl aesthetic! 🦋✨🌈
 */

export class ButterflySwarmSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 100;

    // Config
    baseColor1: number = 0xFFB6C1; // Light pink
    baseColor2: number = 0xB6FFE6; // Mint green
    baseColor3: number = 0xE6B6FF; // Lavender

    // Arrays for instance properties
    private dummy = new THREE.Object3D();
    private instanceData: Float32Array; // x, y, z, phase

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Butterfly Geometry (simple plane that we will bend/flap in shader)
        const geometry = new THREE.PlaneGeometry(1.5, 1.5, 4, 1);

        // TSL Material
        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        // TSL Shader Logic
        const uTime = time;
        const vUv = uv();

        // Instance attributes
        const aPhase = attribute('aPhase', 'float');
        const aColor = attribute('aColor', 'vec3');

        // 1. Procedural Shape (Wing Alpha Mask)
        // Simple shape: taper at edges, split in middle
        const xDist = vUv.x.sub(0.5).abs().mul(2.0); // 0 at center, 1 at edges
        const yDist = vUv.y.sub(0.5).abs().mul(2.0); // 0 at center, 1 at edges

        // Wing shape equation (heart/butterfly-ish)
        const wingShape = float(1.0).sub(pow(xDist, 2.0).add(pow(yDist, 2.0)));
        const isCenter = smoothstep(0.0, 0.1, vUv.x.sub(0.5).abs());
        const alpha = smoothstep(0.0, 0.3, wingShape).mul(isCenter);

        // 2. Vertex Animation (Flapping)
        // Bend vertices based on distance from center (vUv.x = 0.5)
        const flapSpeed = float(15.0);
        const flapAmount = float(0.8);
        const flapAngle = sin(uTime.mul(flapSpeed).add(aPhase)).mul(flapAmount);

        // Apply flap only to X-edges (vUv.x != 0.5)
        const bendFactor = vUv.x.sub(0.5).abs().mul(2.0);
        // We move the Z position to fold the wings up/down
        const zOffset = bendFactor.mul(flapAngle);

        // Modify the local position
        const modifiedPos = positionLocal.add(vec3(0.0, 0.0, zOffset));
        mat.positionNode = modifiedPos;

        // 3. Coloring & Glow
        // Subtle shimmer moving across the wings
        const shimmer = sin(uTime.mul(5.0).add(vUv.y.mul(10.0)).add(aPhase))
            .add(1.0).mul(0.5).mul(0.3);

        const finalColor = aColor.add(vec3(shimmer));
        const glowAlpha = alpha.mul(0.8).add(shimmer);

        mat.colorNode = vec4(finalColor, glowAlpha);

        // Instanced Mesh
        this.mesh = new THREE.InstancedMesh(geometry, mat, this.count);
        this.mesh.frustumCulled = false;

        // Initialize instance data
        this.instanceData = new Float32Array(this.count * 4); // x, y, z, phase
        const colors = new Float32Array(this.count * 3);
        const phases = new Float32Array(this.count);

        const palette = [this.baseColor1, this.baseColor2, this.baseColor3];

        for (let i = 0; i < this.count; i++) {
            // Position
            const x = (Math.random() - 0.5) * 60;
            const y = (Math.random() - 0.5) * 40;
            const z = (Math.random() - 0.5) * 40 - 20; // Mostly behind player

            this.instanceData[i * 4] = x;
            this.instanceData[i * 4 + 1] = y;
            this.instanceData[i * 4 + 2] = z;
            this.instanceData[i * 4 + 3] = Math.random() * Math.PI * 2; // phase

            this.dummy.position.set(x, y, z);

            // Random orientation
            this.dummy.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            // Random size variation
            const scale = 0.5 + Math.random() * 0.8;
            this.dummy.scale.set(scale, scale, scale);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);

            // Phase for animation
            phases[i] = this.instanceData[i * 4 + 3];

            // Color
            const colorHex = palette[Math.floor(Math.random() * palette.length)];
            const colorObj = new THREE.Color(colorHex);
            colors[i * 3] = colorObj.r;
            colors[i * 3 + 1] = colorObj.g;
            colors[i * 3 + 2] = colorObj.b;
        }

        this.mesh.instanceMatrix.needsUpdate = true;

        geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
        geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));

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

        const targetPos = playerPos || new THREE.Vector3(cameraX, 0, 0);

        for (let i = 0; i < this.count; i++) {
            let x = this.instanceData[i * 4];
            let y = this.instanceData[i * 4 + 1];
            let z = this.instanceData[i * 4 + 2];
            const phase = this.instanceData[i * 4 + 3];

            // Swarm movement logic (boids-lite)
            // They want to generally move forward with the camera, but swirl around

            // 1. Move forward
            x += delta * 5.0; // Base speed

            // 2. Swirl motion
            const swirlRadius = 15;
            const timeVal = Date.now() * 0.001;

            // Target point swirls around the player
            const targetX = targetPos.x + Math.sin(timeVal * 0.5 + phase) * swirlRadius;
            const targetY = targetPos.y + Math.cos(timeVal * 0.7 + phase) * swirlRadius;
            const targetZ = targetPos.z - 10 + Math.sin(timeVal * 0.3 + phase) * swirlRadius;

            // Interpolate toward target
            x += (targetX - x) * delta * 0.5;
            y += (targetY - y) * delta * 0.5;
            z += (targetZ - z) * delta * 0.5;

            // Wrap if falling too far behind
            if (x < cameraX - 40) {
                x = cameraX + 60 + Math.random() * 20;
                y = targetPos.y + (Math.random() - 0.5) * 40;
                z = targetPos.z + (Math.random() - 0.5) * 40;
            }
            // Or getting too far ahead
            if (x > cameraX + 80) {
                x = cameraX - 20;
            }

            this.instanceData[i * 4] = x;
            this.instanceData[i * 4 + 1] = y;
            this.instanceData[i * 4 + 2] = z;

            // Update matrix
            this.mesh.getMatrixAt(i, this.dummy.matrix);
            this.dummy.position.set(x, y, z);

            // Face direction of movement (roughly)
            const dirX = targetX - x;
            const dirY = targetY - y;
            const dirZ = targetZ - z;

            // Gentle banking rotation based on movement
            this.dummy.rotation.x = dirY * 0.1;
            this.dummy.rotation.y = Math.atan2(dirX, dirZ) + Math.PI / 2;
            this.dummy.rotation.z = dirX * 0.05 + Math.sin(timeVal * 2 + phase) * 0.2;

            // Preserve scale
            const scale = 0.5 + (phase % 1.0) * 0.8;
            this.dummy.scale.setScalar(scale);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        // Material is a NodeMaterial, may need special disposal in future three/webgpu versions
        if ((this.mesh.material as any).dispose) {
            (this.mesh.material as any).dispose();
        }
    }
}
