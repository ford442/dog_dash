import * as THREE from 'three';
import { time, vec3, color, uniform, sin, float, uv, length, smoothstep, positionWorld, distance, positionLocal, cos, mix } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { ParticleSystem } from './particles';

export interface DayNightCycleConfig {
    cycleDuration?: number;
}

export class DayNightCycleSystem {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    active: boolean = false;
    particleSystem?: ParticleSystem;

    private starLayers: { mesh: THREE.InstancedMesh, speed: number }[] = [];
    private overlayMesh: THREE.Mesh;
    private starCountPerLayer: number = 300;
    private starBounds = { x: 300, y: 200 };
    private dummy: THREE.Object3D;

    private cycleDuration: number = 30.0;
    private cycleTimer: number = 0;
    private uCycleProgress: any;
    private uPlayerPos: any;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, particleSystem?: ParticleSystem) {
        this.scene = scene;
        this.camera = camera;
        this.particleSystem = particleSystem;
        this.dummy = new THREE.Object3D();
        this.uCycleProgress = uniform(0.0);
        this.uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));

        // Create 3 layers of stars for parallax
        const layerConfigs = [
            { speed: 0.1, size: 0.3, z: -100, color: 0x88ccff },
            { speed: 0.3, size: 0.5, z: -80, color: 0xffffff },
            { speed: 0.6, size: 0.8, z: -60, color: 0xffddaa }
        ];

        layerConfigs.forEach((layerConf) => {
            const starGeo = new THREE.PlaneGeometry(layerConf.size, layerConf.size);
            const starMat = new MeshBasicNodeMaterial({
                transparent: true,
                depthWrite: false,
                side: THREE.FrontSide,
                blending: THREE.AdditiveBlending
            });

            // TSL for twinkling stars
            const distFromCenter = length(uv().sub(0.5));
            const starAlpha = float(1.0).sub(distFromCenter.mul(2.0)).max(0.0).pow(1.5);

            // Twinkle based on time + local position to offset the phase
            const starTwinkle = sin(time.mul(3.0).add(uv().x.mul(10.0))).mul(0.5).add(0.5);

            // Only show stars when it's night (uCycleProgress near 1.0)
            const nightMask = smoothstep(0.3, 0.8, this.uCycleProgress);

            // Player glow interaction
            const distToPlayer = distance(positionWorld, this.uPlayerPos);
            const glowIntensity = smoothstep(50.0, 0.0, distToPlayer).mul(0.5);
            const finalTwinkle = starTwinkle.add(glowIntensity);

            starMat.colorNode = color(layerConf.color).mul(finalTwinkle).mul(nightMask);
            starMat.opacityNode = starAlpha.mul(nightMask).mul(0.8);

            const starMesh = new THREE.InstancedMesh(starGeo, starMat, this.starCountPerLayer);
            starMesh.frustumCulled = false;
            starMesh.renderOrder = -3;

            for (let i = 0; i < this.starCountPerLayer; i++) {
                this.dummy.position.set(
                    (Math.random() - 0.5) * this.starBounds.x * 2.0,
                    (Math.random() - 0.5) * this.starBounds.y * 2.0,
                    layerConf.z - Math.random() * 10
                );

                const scale = Math.random() * 0.8 + 0.2;
                this.dummy.scale.set(scale, scale, 1.0);
                this.dummy.rotation.z = Math.random() * Math.PI * 2;

                this.dummy.updateMatrix();
                starMesh.setMatrixAt(i, this.dummy.matrix);
            }
            starMesh.instanceMatrix.needsUpdate = true;
            this.scene.add(starMesh);
            this.starLayers.push({ mesh: starMesh, speed: layerConf.speed });
        });

        // 2. Create Night Overlay Mesh
        // Fullscreen overlay to darken the screen, but use multiply blending to tint the sky
        const overlayGeo = new THREE.PlaneGeometry(2, 2);
        const overlayMat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.MultiplyBlending // Darken the scene underneath instead of opaque overlay
        });

        // Overlay becomes darker and more blue-tinted at night
        // With MultiplyBlending, (1,1,1) is no change, (0.2, 0.3, 0.5) darkens to night blue
        const dayColor = vec3(1.0, 1.0, 1.0);
        const nightColor = vec3(0.1, 0.15, 0.3);
        const cycleBlend = smoothstep(0.2, 0.9, this.uCycleProgress);

        overlayMat.colorNode = mix(dayColor, nightColor, cycleBlend);

        // Keep alpha high so multiply works effectively
        overlayMat.opacityNode = float(1.0);

        this.overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
        this.overlayMesh.renderOrder = 998; // Just under the HUD
        this.overlayMesh.position.set(0, 0, -0.5); // Just in front of the camera

        // Ensure it's attached to the camera so it follows it
        this.camera.add(this.overlayMesh);

        this.deactivate();
    }

    activate(config?: DayNightCycleConfig | boolean) {
        if (this.active) return;
        this.active = true;

        if (config && typeof config === 'object' && config.cycleDuration) {
            this.cycleDuration = config.cycleDuration;
        } else {
            this.cycleDuration = 30.0;
        }

        this.cycleTimer = 0;
        this.uCycleProgress.value = 0.0;

        this.starLayers.forEach(l => l.mesh.visible = true);
        this.overlayMesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;

        this.starLayers.forEach(l => l.mesh.visible = false);
        this.overlayMesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        // Update cycle timer
        this.cycleTimer += delta;

        // Oscillate progress between 0 and 1
        // (sin(t) + 1) / 2
        const progress = (Math.sin((this.cycleTimer / this.cycleDuration) * Math.PI * 2 - Math.PI/2) + 1.0) / 2.0;
        this.uCycleProgress.value = progress;

        // Wrap stars around the camera, applying parallax based on cameraX
        const margin = this.starBounds.x;
        const limitBack = cameraX - margin;
        const limitFront = cameraX + margin;

        this.starLayers.forEach(layer => {
            let needsUpdate = false;

            // Move layer based on cameraX and parallax speed
            // Since we're moving the instances, we just shift them relative to the camera
            // A speed of 0.1 means it follows the camera closely (moves little relative to screen)
            // A speed of 1.0 means it stays stuck in world space

            for (let i = 0; i < this.starCountPerLayer; i++) {
                layer.mesh.getMatrixAt(i, this.dummy.matrix);
                this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);

                // Wrap around
                if (this.dummy.position.x < limitBack) {
                    this.dummy.position.x += this.starBounds.x * 2.0;
                    this.dummy.position.y = (Math.random() - 0.5) * this.starBounds.y * 2.0;
                    needsUpdate = true;
                } else if (this.dummy.position.x > limitFront) {
                    this.dummy.position.x -= this.starBounds.x * 2.0;
                    this.dummy.position.y = (Math.random() - 0.5) * this.starBounds.y * 2.0;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    this.dummy.updateMatrix();
                    layer.mesh.setMatrixAt(i, this.dummy.matrix);
                }
            }

            if (needsUpdate) {
                layer.mesh.instanceMatrix.needsUpdate = true;
            }

            // Apply parallax by positioning the entire mesh
            // The mesh shifts with the camera, but scaled by speed
            layer.mesh.position.x = cameraX * (1 - layer.speed);
        });

        // Periodically emit sparkle particles at night
        if (this.particleSystem && progress > 0.6 && Math.random() < 0.1 && playerPos) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 30,
                (Math.random() - 0.5) * 10 - 10
            );
            this.particleSystem.emit(
                playerPos.clone().add(offset),
                0xffffff,
                1,
                2.0 + Math.random() * 2.0,
                0.5,
                1.5
            );
        }
    }

    cleanup() {
        this.starLayers.forEach(layer => {
            this.scene.remove(layer.mesh);
            layer.mesh.geometry.dispose();
            (layer.mesh.material as any).dispose?.();
        });
        this.starLayers = [];

        this.camera.remove(this.overlayMesh);
        this.overlayMesh.geometry.dispose();
        (this.overlayMesh.material as any).dispose?.();
    }
}
