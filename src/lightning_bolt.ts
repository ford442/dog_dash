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
    float,
    step,
    abs
} from 'three/tsl';

/**
 * Creates a TSL material for jagged lightning bolts.
 */
function createLightningMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const vUv = uv();

    // Core UV coordinates
    const y = vUv.y;
    const x = vUv.x;

    // Time-based animation
    const uTime = time;

    // Procedural jagged offset based on y (length of the bolt) and time
    const wave1 = sin(y.mul(20.0).add(uTime.mul(50.0))).mul(0.1);
    const wave2 = sin(y.mul(40.0).sub(uTime.mul(30.0))).mul(0.05);
    const wave3 = sin(y.mul(100.0).add(uTime.mul(80.0))).mul(0.02);

    const totalOffset = wave1.add(wave2).add(wave3);

    // The center line is at x = 0.5, modified by the jagged offset
    const center = float(0.5).add(totalOffset);

    // Distance from the jagged center line
    const dist = abs(x.sub(center));

    // Core of the bolt is bright, edges fade out quickly
    const coreGlow = float(0.02).div(dist);
    const clampedGlow = coreGlow.clamp(0.0, 1.0);

    // Fade the bolt rapidly over time to simulate a flash
    const flashPulse = sin(uTime.mul(40.0)).mul(0.5).add(0.5);

    // Color
    const coreColor = color(0xffffff);
    const edgeColor = color(0x88bbff);

    // Mix core and edge based on distance
    const boltColor = mix(edgeColor, coreColor, step(dist, 0.05));

    // Final alpha combines glow and flash pulse
    const alpha = clampedGlow.mul(flashPulse);

    mat.colorNode = vec4(boltColor, alpha);

    return mat;
}

export class LightningBoltSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number = 10;

    positions: Float32Array;
    timers: Float32Array; // Timers to control individual bolt visibility

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Use a wide plane to allow the jagged line to draw within it
        const geo = new THREE.PlaneGeometry(10, 40);
        const mat = createLightningMaterial();

        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;
        // Background order but above deep clouds
        this.mesh.renderOrder = -1;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);
        this.timers = new Float32Array(this.count);

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

    update(delta: number, cameraX: number) {
        if (!this.active) return;

        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            if (this.timers[i] > 0) {
                this.timers[i] -= delta;

                // If timer expires, hide the bolt
                if (this.timers[i] <= 0) {
                    this.timers[i] = 0;
                    this.dummy.scale.set(0, 0, 0);
                    this.dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    needsUpdate = true;
                }
            } else {
                // Random chance to spawn a bolt
                // Very rare per frame to keep it sparse, e.g. one bolt every few seconds
                if (Math.random() < 0.005) {
                    this.timers[i] = 0.2 + Math.random() * 0.3; // Visible for 0.2-0.5s

                    const x = cameraX + (Math.random() - 0.5) * 200;
                    const y = (Math.random() - 0.5) * 20 + 10; // High up
                    const z = -30 + (Math.random() - 0.5) * 20; // Background

                    this.positions[i * 3] = x;
                    this.positions[i * 3 + 1] = y;
                    this.positions[i * 3 + 2] = z;

                    this.dummy.position.set(x, y, z);

                    // Random scale and rotation for variety
                    const scaleX = 1.0 + Math.random() * 2.0;
                    const scaleY = 1.0 + Math.random() * 1.5;
                    this.dummy.scale.set(scaleX, scaleY, 1.0);

                    this.dummy.rotation.set(0, 0, (Math.random() - 0.5) * 0.5);

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
