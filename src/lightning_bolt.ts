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
    abs,
    normalView
} from 'three/tsl';

/**
 * Creates a TSL material for jagged lightning bolts.
 */
function createLightningMaterial(uColor: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const vUv = uv();

    // Core UV coordinates for a Cylinder
    // vUv.y maps to height (0 to 1)
    // vUv.x maps to circumference (0 to 1)
    const y = vUv.y;
    const x = vUv.x;

    // Time-based animation
    const uTime = time;

    // Procedural jagged offset based on y (length of the bolt) and time
    // We warp the cylinder's actual vertex position to make it jagged and 3D
    const wave1 = sin(y.mul(20.0).add(uTime.mul(50.0))).mul(2.0);
    const wave2 = sin(y.mul(40.0).sub(uTime.mul(30.0))).mul(1.0);
    const wave3 = sin(y.mul(100.0).add(uTime.mul(80.0))).mul(0.5);
    const totalOffsetX = wave1.add(wave2).add(wave3);

    // Add Z offset for true 3D
    const waveZ1 = sin(y.mul(25.0).add(uTime.mul(45.0))).mul(2.0);
    const waveZ2 = sin(y.mul(35.0).sub(uTime.mul(25.0))).mul(1.0);
    const totalOffsetZ = waveZ1.add(waveZ2);


    // Procedural secondary branching via sine waves
    // We only want the branches to stick out on the sides, fading near the ends
    const branchWave1 = abs(sin(y.mul(30.0).add(uTime.mul(40.0)))).mul(2.5).mul(y);
    const branchWave2 = abs(sin(y.mul(55.0).sub(uTime.mul(60.0)))).mul(1.5).mul(y);

    // We add branching offsets depending on which side of the cylinder we are (vUv.x around the circle)
    const sideFactorX = sin(x.mul(Math.PI * 2.0));
    const sideFactorZ = sin(x.mul(Math.PI * 2.0).add(Math.PI * 0.5));

    const branchX = branchWave1.mul(sideFactorX);
    const branchZ = branchWave2.mul(sideFactorZ);

    mat.positionNode = vec3(
        positionLocal.x.add(totalOffsetX).add(branchX),
        positionLocal.y,
        positionLocal.z.add(totalOffsetZ).add(branchZ)
    );

    // The glowing surface based on view normal (soft edges)
    const viewDot = normalView.z.abs();
    const coreGlow = float(0.5).add(viewDot.mul(0.5)); // Brighter in the center facing camera

    // Procedural intensity (pulse)
    const flashPulse = sin(uTime.mul(40.0)).mul(0.5).add(0.5);
    // Afterglow baseline
    const glowIntensity = flashPulse.mul(0.8).add(0.2);

    // Thin inner core vs thick outer glow
    const coreColor = color(0xffffff);
    const edgeColor = color(uColor);

    // Smooth step based on the view normal to create a soft tube look
    const colorMix = mix(edgeColor, coreColor, viewDot.pow(4.0));
    const alpha = viewDot.pow(2.0).mul(glowIntensity);

    mat.colorNode = vec4(colorMix, alpha);

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
    onBoltStrike?: (position: THREE.Vector3, color: THREE.Color) => void;
    currentDensity: number = 1.0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Use a wide plane to allow the jagged line to draw within it
        const geo = new THREE.CylinderGeometry(0.5, 0.5, 40, 8, 32);
        const uColor = uniform(new THREE.Color(0x88bbff));
        const mat = createLightningMaterial(uColor) as any;
        mat.userData = mat.userData || {};
        mat.userData.uColor = uColor;

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

    activate(config?: { color?: number, density?: number }) {
        if (config && config.color !== undefined) {
            const mat = this.mesh.material as any;
            if (mat.userData && mat.userData.uColor) {
                mat.userData.uColor.value.setHex(config.color);
            }
        } else {
            const mat = this.mesh.material as any;
            if (mat.userData && mat.userData.uColor) {
                mat.userData.uColor.value.setHex(0x88bbff); // Default blue
            }
        }
        this.currentDensity = config?.density ?? 1.0;
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8.0) {
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
                const speedBoost = Math.max(0, (playerSpeed - 10) * 0.1); // Increase density when dashing
                if (Math.random() < 0.005 * this.currentDensity * (1.0 + speedBoost)) {
                    this.timers[i] = 0.2 + Math.random() * 0.3; // Visible for 0.2-0.5s


                    const x = cameraX + (Math.random() - 0.5) * 200;
                    const y = (Math.random() - 0.5) * 20 + 10; // High up
                    const z = -30 + (Math.random() - 0.5) * 20; // Background

                    if (this.onBoltStrike) {
                        const mat = this.mesh.material as any;
                        const strikeColor = mat.userData && mat.userData.uColor ? mat.userData.uColor.value : new THREE.Color(0x88bbff);
                        this.onBoltStrike(new THREE.Vector3(x, y, z), strikeColor);
                    }


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
