import * as THREE from 'three';
import {
    MeshBasicNodeMaterial,
    MeshPhysicalNodeMaterial // Using Node material for consistency if we update distortion later, but currently standard MeshPhysical
} from 'three/webgpu';
import {
    time,
    positionLocal,
    uv,
    vec2,
    vec3,
    vec4,
    color,
    uniform,
    mix,
    sin,
    cos,
    float
} from 'three/tsl';

// Generate a simple noise normal map for distortion
function createNoiseNormalMap() {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size * 4; i += 4) {
        // Generate random normals (mostly pointing up Z)
        // x, y deviation -0.5 to 0.5 mapped to 0-255
        const x = Math.random() * 255;
        const y = Math.random() * 255;
        const z = 255; // Pointing up

        data[i] = x;
        data[i + 1] = y;
        data[i + 2] = z;
        data[i + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
}

const distortionMap = createNoiseNormalMap();
const HEAT_COLOR = new THREE.Color(0xff4400);

/**
 * Creates a TSL material for fiery plasma streaks.
 */
function createPlasmaMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const uTime = time;
    const vUv = uv();

    // Box Geometry is (0.05, 0.05, 5). Z is length.
    // UVs map 0..1 across faces.
    // We want a gradient along the length (usually U or V depending on mapping).
    // For BoxGeometry, it's tricky because it has multiple faces.
    // However, since it's a thin streak, we can just use positionLocal.z to drive pattern.

    const pos = positionLocal;

    // Create a moving noise pattern along the length (Z axis)
    const noise = sin(pos.z.mul(5.0).add(uTime.mul(20.0))) // Fast movement
                 .add(sin(pos.z.mul(2.0).sub(uTime.mul(10.0)))); // Interference

    // Color Gradient: Core (Yellow/White) vs Edge (Red/Orange)
    const colorCore = color(0xffddaa);
    const colorEdge = color(0xff2200);

    const mixFactor = noise.mul(0.5).add(0.5); // 0..1
    const finalColor = mix(colorEdge, colorCore, mixFactor);

    // Opacity pulse
    const pulse = sin(uTime.mul(5.0)).add(1.0).mul(0.5);
    const alpha = float(0.8).add(pulse.mul(0.2));

    mat.colorNode = vec4(finalColor, alpha);

    return mat;
}

export class ReEntrySystem {
    scene: THREE.Scene;
    camera: THREE.Camera;
    active: boolean = false;

    // Components
    heatDistortionMesh: THREE.Mesh;
    heatGlowMesh: THREE.Mesh;
    plasmaStreaks: THREE.InstancedMesh;
    streakDummy: THREE.Object3D;

    // Data
    streakCount: number = 50;
    streakPositions: Float32Array;
    streakSpeeds: Float32Array;

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.camera = camera;

        // 1. Heat Distortion Mesh (Physical Material with Transmission)
        // This provides the "wobbly" look by refracting the background
        const distMat = new THREE.MeshPhysicalMaterial({
            color: 0xffaa00, // Slight orange tint to the glass
            roughness: 0.2,
            metalness: 0.0,
            transmission: 0.95, // High transmission = glass-like
            thickness: 0.5,
            ior: 1.1, // Slight refraction
            normalMap: distortionMap, // The noise map drives distortion
            normalScale: new THREE.Vector2(0.5, 0.5),
            transparent: true,
            opacity: 0.0, // Start invisible
            depthWrite: false,
            side: THREE.DoubleSide
        });

        // Full screen quad attached to camera
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.heatDistortionMesh = new THREE.Mesh(geometry, distMat);
        this.heatDistortionMesh.position.set(0, 0, -1.2);
        this.heatDistortionMesh.scale.set(5, 4, 1);
        this.camera.add(this.heatDistortionMesh);

        // 2. Heat Glow Mesh (Additive Color Overlay)
        // This provides the intense orange color wash
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.heatGlowMesh = new THREE.Mesh(geometry, glowMat);
        this.heatGlowMesh.position.set(0, 0, -1.1); // Slightly in front of distortion
        this.heatGlowMesh.scale.set(5, 4, 1);
        this.camera.add(this.heatGlowMesh);

        // 3. Plasma Streaks (Fast moving lines)
        const streakGeo = new THREE.BoxGeometry(0.05, 0.05, 5);
        // Use TSL Material
        const streakMat = createPlasmaMaterial();

        this.plasmaStreaks = new THREE.InstancedMesh(streakGeo, streakMat, this.streakCount);
        this.streakDummy = new THREE.Object3D();
        this.streakPositions = new Float32Array(this.streakCount * 3);
        this.streakSpeeds = new Float32Array(this.streakCount);

        // Initialize Streaks
        for (let i = 0; i < this.streakCount; i++) {
            this.streakSpeeds[i] = 40 + Math.random() * 40;
        }

        this.plasmaStreaks.visible = false;
        this.scene.add(this.plasmaStreaks);
    }

    activate() {
        this.active = true;
        this.plasmaStreaks.visible = true;
    }

    deactivate() {
        this.active = false;
    }

    update(delta: number, cameraX: number, cameraY: number, player?: THREE.Object3D) {
        const matDist = this.heatDistortionMesh.material as THREE.MeshPhysicalMaterial;
        const matGlow = this.heatGlowMesh.material as THREE.MeshBasicMaterial;

        // Fade Logic
        const targetOpacity = this.active ? 1.0 : 0.0;

        // We use a custom property on the material to track "intensity" for fading
        // because opacity behaves differently for Physical vs Basic
        let intensity = matGlow.opacity; // Use glow opacity as the master intensity

        if (Math.abs(intensity - targetOpacity) > 0.01) {
            intensity += (targetOpacity - intensity) * delta * 2.0;
        } else {
            intensity = targetOpacity;
            if (!this.active && intensity <= 0.01) {
                this.plasmaStreaks.visible = false;
                matDist.opacity = 0;
                matGlow.opacity = 0;
                return;
            }
        }

        // Apply Intensity
        // Distortion: Opacity controls visibility.
        // Note: transmission works best when opacity is 1? No, transparent=true allows fading.
        matDist.opacity = intensity;

        // Glow: Max 0.3 opacity to not blind player
        matGlow.opacity = intensity * 0.3;

        // Animate Distortion (Scroll the normal map)
        if (matDist.normalMap) {
            matDist.normalMap.offset.x -= delta * 0.5; // Scroll horizontally
            matDist.normalMap.offset.y -= delta * 0.2; // And slightly vertically
        }

        // Pulse the Glow
        const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;
        matGlow.opacity = intensity * 0.3 * pulse;

        if (player) {
            this.updateShipTint(player, intensity);
        }

        // Update Streaks
        const spawnX = cameraX + 40;
        const limitX = cameraX - 10;

        for (let i = 0; i < this.streakCount; i++) {
            let x = this.streakPositions[i * 3];
            let y = this.streakPositions[i * 3 + 1];
            let z = this.streakPositions[i * 3 + 2];

            if (x === 0 && y === 0 && z === 0) {
                 x = cameraX + (Math.random() - 0.5) * 40;
                 y = cameraY + (Math.random() - 0.5) * 30;
                 z = (Math.random() - 0.5) * 20;
                 this.streakPositions[i * 3 + 1] = y;
                 this.streakPositions[i * 3 + 2] = z;
            }

            x -= this.streakSpeeds[i] * delta;

            if (x < limitX) {
                x = spawnX + Math.random() * 20;
                y = cameraY + (Math.random() - 0.5) * 30;
                z = (Math.random() - 0.5) * 30;
                this.streakSpeeds[i] = 50 + Math.random() * 50;

                this.streakPositions[i * 3 + 1] = y;
                this.streakPositions[i * 3 + 2] = z;
            }

            this.streakPositions[i * 3] = x;

            this.streakDummy.position.set(x, y, z);

            // Stretch based on speed
            this.streakDummy.scale.z = 1.0 + (this.streakSpeeds[i] / 50.0);

            // Align with motion (X axis)
            this.streakDummy.rotation.set(0, Math.PI / 2, 0);

            this.streakDummy.updateMatrix();
            this.plasmaStreaks.setMatrixAt(i, this.streakDummy.matrix);
        }

        this.plasmaStreaks.instanceMatrix.needsUpdate = true;
    }

    updateShipTint(player: THREE.Object3D, intensity: number) {
        player.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                // Handle both standard materials and potentially node materials if compatible
                const mat = child.material as any;

                // Only affect materials that support emissive
                if (mat.emissive && mat.emissive instanceof THREE.Color) {

                    // Store original state if not already stored
                    if (child.userData.originalEmissive === undefined) {
                        child.userData.originalEmissive = mat.emissive.clone();
                        child.userData.originalEmissiveIntensity = mat.emissiveIntensity ?? 1.0;
                    }

                    if (intensity > 0.01) {
                        // Lerp from original emissive to heat color
                        // We use the original as the base to avoid drifting
                        mat.emissive.lerpColors(child.userData.originalEmissive, HEAT_COLOR, intensity * 0.8);

                        // Boost intensity to simulate glowing hot metal
                        const baseInt = child.userData.originalEmissiveIntensity;
                        mat.emissiveIntensity = baseInt + (intensity * 2.0); // Add up to 2.0 intensity

                    } else {
                        // Restore original state
                        mat.emissive.copy(child.userData.originalEmissive);
                        mat.emissiveIntensity = child.userData.originalEmissiveIntensity;
                    }
                }
            }
        });
    }
}
