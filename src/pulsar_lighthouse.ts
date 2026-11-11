import * as THREE from 'three';
import { time, vec3, vec4, color, uniform, sin, mix, positionLocal, smoothstep, abs, length, dot, normalize, cross } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';

export interface PulsarLighthouseConfig {
    density?: number;
    speed?: number;
    color1?: number;
    color2?: number;
}

const PULSAR_COUNT = 6;
const BEAM_LENGTH = 1000;
const BEAM_WIDTH = 200;

function createPulsarBeamMaterial(color1: number, color2: number, uSpeed: any) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const c1 = color(color1);
    const c2 = color(color2);

    // Color gradient based on time
    const t = time.mul(uSpeed).add(positionLocal.z.mul(0.005));
    const mixFactor = sin(t).mul(0.5).add(0.5);
    const baseColor = mix(c1, c2, mixFactor);

    // Fade out towards the edges (X-axis) of the beam
    const edgeFade = smoothstep(BEAM_WIDTH * 0.5, 0.0, abs(positionLocal.x));

    // Fade out towards the far end (Y-axis) of the beam
    const distanceFade = smoothstep(BEAM_LENGTH * 0.9, 0.0, positionLocal.y);

    // Fade out very close to the pulsar core to avoid blowing out exposure
    const coreFade = smoothstep(0.0, 50.0, positionLocal.y);

    const alpha = edgeFade.mul(distanceFade).mul(coreFade).mul(0.6);

    mat.colorNode = vec4(baseColor, alpha);

    return mat;
}

function createPulsarCoreMaterial(color1: number) {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const baseColor = color(color1);
    // Core has a bright center falling off rapidly
    const dist = length(positionLocal.xy);
    const coreGlow = smoothstep(50.0, 0.0, dist);

    mat.colorNode = vec4(baseColor, coreGlow);
    return mat;
}

export class PulsarLighthouseSystem {
    scene: THREE.Scene;
    active: boolean = false;
    beamMesh!: THREE.InstancedMesh;
    coreMesh!: THREE.InstancedMesh;

    // Config
    pulsarCount: number = PULSAR_COUNT;
    speedMultiplier: number = 1.0;

    // TSL Uniforms
    uSpeed: ReturnType<typeof uniform>;

    // Internal state
    private timeOffset: number = 0;
    private pulsars: Array<{
        position: THREE.Vector3;
        axis: THREE.Vector3;
        phase: number;
        spinSpeed: number;
    }> = [];

    constructor(scene: THREE.Scene, config?: PulsarLighthouseConfig) {
        this.scene = scene;
        this.uSpeed = uniform(1.0);

        const color1 = config?.color1 ?? 0x00ffff;
        const color2 = config?.color2 ?? 0xff00ff;
        this.speedMultiplier = config?.speed ?? 1.0;
        this.pulsarCount = Math.floor(PULSAR_COUNT * (config?.density ?? 1.0));

        // Create beam mesh
        // Using a plane where origin is at bottom center (0, 0, 0) and grows upwards along +Y
        const beamGeo = new THREE.PlaneGeometry(BEAM_WIDTH, BEAM_LENGTH, 4, 8);
        beamGeo.translate(0, BEAM_LENGTH / 2, 0); // Move origin to bottom edge
        const beamMat = createPulsarBeamMaterial(color1, color2, this.uSpeed);

        // We need 2 beams per pulsar (opposite directions)
        this.beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, this.pulsarCount * 2);
        this.beamMesh.frustumCulled = false;
        this.beamMesh.renderOrder = -20; // Deep background

        // Create core mesh
        const coreGeo = new THREE.PlaneGeometry(100, 100);
        const coreMat = createPulsarCoreMaterial(color1);
        this.coreMesh = new THREE.InstancedMesh(coreGeo, coreMat, this.pulsarCount);
        this.coreMesh.frustumCulled = false;
        this.coreMesh.renderOrder = -19; // Just in front of beams

        // Initialize pulsars
        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.pulsarCount; i++) {
            // Position them deep in the background, spread out
            const z = -600 - Math.random() * 800;
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 800;
            const position = new THREE.Vector3(x, y, z);

            // Random spin axis, mostly vertical but tilted
            const axis = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                1.0,
                (Math.random() - 0.5) * 0.5
            ).normalize();

            this.pulsars.push({
                position,
                axis,
                phase: Math.random() * Math.PI * 2,
                spinSpeed: 0.5 + Math.random() * 1.5
            });

            // Set core initial position (faces camera)
            dummy.position.copy(position);
            dummy.quaternion.identity();
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            this.coreMesh.setMatrixAt(i, dummy.matrix);
        }

        this.coreMesh.instanceMatrix.needsUpdate = true;

        this.scene.add(this.beamMesh);
        this.scene.add(this.coreMesh);

        decorationBudget.register('pulsar_lighthouse', {
            label: 'Pulsar Lighthouses',
            category: 'background3d',
            maxActive: this.pulsarCount * 2
        });

        this.deactivate();
    }

    activate(config?: PulsarLighthouseConfig) {
        if (config?.speed !== undefined) this.speedMultiplier = config.speed;
        if (this.active) return;
        this.active = true;
        this.beamMesh.visible = true;
        this.coreMesh.visible = true;
        decorationBudget.syncCount('pulsar_lighthouse', this.pulsarCount * 2);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.beamMesh.visible = false;
        this.coreMesh.visible = false;
        decorationBudget.syncCount('pulsar_lighthouse', 0);
    }

    update(delta: number, cameraX: number, playerSpeed: number = 8) {
        if (!this.active) return;

        // Speed dictates spin rate and shader intensity
        this.uSpeed.value = playerSpeed * this.speedMultiplier;

        // Accumulate time for spinning
        const spinDelta = delta * (1.0 + playerSpeed * 0.1) * this.speedMultiplier;
        this.timeOffset += spinDelta;

        const dummy = new THREE.Object3D();

        for (let i = 0; i < this.pulsarCount; i++) {
            const pulsar = this.pulsars[i];

            // Parallax scroll position slightly based on camera X
            // Deep background moves very slowly
            const parallaxX = pulsar.position.x + cameraX * 0.1;
            dummy.position.set(parallaxX, pulsar.position.y, pulsar.position.z);

            // Update core matrix
            dummy.quaternion.identity(); // Keep core facing forward
            dummy.updateMatrix();
            this.coreMesh.setMatrixAt(i, dummy.matrix);

            // Compute spinning beam rotations
            const angle = pulsar.phase + this.timeOffset * pulsar.spinSpeed;

            // Beam 1 (positive direction)
            dummy.quaternion.setFromAxisAngle(pulsar.axis, angle);
            dummy.updateMatrix();
            this.beamMesh.setMatrixAt(i * 2, dummy.matrix);

            // Beam 2 (negative direction, 180 degrees offset)
            dummy.quaternion.setFromAxisAngle(pulsar.axis, angle + Math.PI);
            dummy.updateMatrix();
            this.beamMesh.setMatrixAt(i * 2 + 1, dummy.matrix);
        }

        this.coreMesh.instanceMatrix.needsUpdate = true;
        this.beamMesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.beamMesh);
        this.scene.remove(this.coreMesh);

        this.beamMesh.geometry.dispose();
        if (Array.isArray(this.beamMesh.material)) {
            this.beamMesh.material.forEach(m => m.dispose());
        } else {
            this.beamMesh.material.dispose();
        }

        this.coreMesh.geometry.dispose();
        if (Array.isArray(this.coreMesh.material)) {
            this.coreMesh.material.forEach(m => m.dispose());
        } else {
            this.coreMesh.material.dispose();
        }

        decorationBudget.syncCount('pulsar_lighthouse', 0);
    }
}
