import * as THREE from 'three';
import { time, vec3, color, uniform, sin, float, uv, length, smoothstep } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

export interface DayNightCycleConfig {
    cycleDuration?: number;
}

export class DayNightCycleSystem {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    active: boolean = false;

    private starMesh: THREE.InstancedMesh;
    private overlayMesh: THREE.Mesh;
    private starCount: number = 500;
    private starBounds = { x: 200, y: 150 };
    private dummy: THREE.Object3D;

    private cycleDuration: number = 30.0;
    private cycleTimer: number = 0;
    private uCycleProgress: any;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.scene = scene;
        this.camera = camera;
        this.dummy = new THREE.Object3D();
        this.uCycleProgress = uniform(0.0);

        // 1. Create Stars InstancedMesh
        const starGeo = new THREE.PlaneGeometry(0.5, 0.5);
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
        // Night mask: progress -> 0 at day, 1 at night
        const nightMask = smoothstep(0.3, 0.8, this.uCycleProgress);

        starMat.colorNode = color(0xffffff).mul(starTwinkle).mul(nightMask);
        starMat.opacityNode = starAlpha.mul(nightMask).mul(0.8);

        this.starMesh = new THREE.InstancedMesh(starGeo, starMat, this.starCount);
        this.starMesh.frustumCulled = false;
        this.starMesh.renderOrder = -3; // Background but above deep sky

        for (let i = 0; i < this.starCount; i++) {
            this.dummy.position.set(
                (Math.random() - 0.5) * this.starBounds.x * 2.0,
                (Math.random() - 0.5) * this.starBounds.y * 2.0,
                -80 - Math.random() * 40
            );

            const scale = Math.random() * 0.8 + 0.2;
            this.dummy.scale.set(scale, scale, 1.0);

            this.dummy.rotation.z = Math.random() * Math.PI * 2;

            this.dummy.updateMatrix();
            this.starMesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.starMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.starMesh);

        // 2. Create Night Overlay Mesh
        // Fullscreen overlay to darken the screen
        const overlayGeo = new THREE.PlaneGeometry(2, 2);
        const overlayMat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        // Overlay becomes darker and more blue-tinted at night
        const overlayColor = vec3(0.0, 0.05, 0.15); // Deep night blue
        const overlayAlpha = smoothstep(0.2, 0.9, this.uCycleProgress).mul(0.6); // Max 60% opacity

        overlayMat.colorNode = overlayColor;
        overlayMat.opacityNode = overlayAlpha;

        this.overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
        this.overlayMesh.renderOrder = 999; // Render over almost everything
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

        this.starMesh.visible = true;
        this.overlayMesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;

        this.starMesh.visible = false;
        this.overlayMesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        // Update cycle timer
        this.cycleTimer += delta;

        // Oscillate progress between 0 and 1
        // (sin(t) + 1) / 2
        const progress = (Math.sin((this.cycleTimer / this.cycleDuration) * Math.PI * 2 - Math.PI/2) + 1.0) / 2.0;
        this.uCycleProgress.value = progress;

        // Wrap stars around the camera
        const margin = this.starBounds.x;
        const limitBack = cameraX - margin;
        const limitFront = cameraX + margin;

        let needsUpdate = false;

        for (let i = 0; i < this.starCount; i++) {
            this.starMesh.getMatrixAt(i, this.dummy.matrix);
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
                this.starMesh.setMatrixAt(i, this.dummy.matrix);
            }
        }

        if (needsUpdate) {
            this.starMesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        this.scene.remove(this.starMesh);
        this.starMesh.geometry.dispose();
        (this.starMesh.material as any).dispose?.();

        this.camera.remove(this.overlayMesh);
        this.overlayMesh.geometry.dispose();
        (this.overlayMesh.material as any).dispose?.();
    }
}
