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
function createLightningMaterial(uColor: any) {
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

    // The main trunk line is at x = 0.5, modified by the jagged offset
    const center = float(0.5).add(totalOffset);

    // Distance from the main trunk line
    const trunkDist = abs(x.sub(center));

    // Generate secondary branches using absolute sine waves to create V-shapes shooting outwards
    // We scale by y to make branches more prominent towards the bottom
    const branchWave1 = abs(sin(y.mul(30.0).add(uTime.mul(40.0)))).mul(0.15).mul(y);
    const branchWave2 = abs(sin(y.mul(55.0).sub(uTime.mul(60.0)))).mul(0.1).mul(y);
    const branchOffset = branchWave1.add(branchWave2);

    // Two side branches splitting from the trunk
    const branchLeftCenter = center.sub(branchOffset);
    const branchRightCenter = center.add(branchOffset);

    const distLeft = abs(x.sub(branchLeftCenter));
    const distRight = abs(x.sub(branchRightCenter));

    // Combine distances, favoring the closest part (trunk or branch)
    // We make branches thinner by dividing their distance by a smaller number
    const dist = trunkDist.min(distLeft.mul(1.5)).min(distRight.mul(1.5));

    // Core of the bolt is bright, edges fade out quickly
    const coreGlow = float(0.02).div(dist);
    const clampedGlow = coreGlow.clamp(0.0, 1.0);

    // Fade the bolt rapidly over time to simulate a flash
    const flashPulse = sin(uTime.mul(40.0)).mul(0.5).add(0.5);

    // Color
    const coreColor = color(0xffffff);
    const edgeColor = color(uColor);

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
    onBoltStrike?: (position: THREE.Vector3, color: THREE.Color) => void;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Use a wide plane to allow the jagged line to draw within it
        const geo = new THREE.PlaneGeometry(10, 40);
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

    activate(config?: { color?: number }) {
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
