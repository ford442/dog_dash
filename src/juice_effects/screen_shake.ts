import * as THREE from 'three';
import { ShakeType, SHAKE_CONFIGS, type ActiveShake } from './shared';

/**
 * Camera screen-shake controller.
 *
 * Shake is a render-only offset: update() only computes it on wall-clock
 * time, and the game loop adds it to the camera around the draw call
 * (applyToCamera / removeFromCamera). The camera's real position belongs to
 * the fixed-step sim (`camera_system.ts`) and is read by gameplay — level
 * streaming, cleanup and slingables key off `camera.position.x` — so a
 * wall-clock wobble must never be left in it between frames.
 */
export class ScreenShakeController {
    private camera: THREE.Camera;
    private cameraShakeOffset: THREE.Vector3 = new THREE.Vector3();
    private appliedOffset: THREE.Vector3 = new THREE.Vector3();
    private applied = false;
    private activeShakes: ActiveShake[] = [];

    constructor(camera: THREE.Camera) {
        this.camera = camera;
    }

    shakeScreen(type: ShakeType, duration?: number): void {
        const config = SHAKE_CONFIGS[type];

        const shake: ActiveShake = {
            intensity: config.intensity,
            duration: duration ?? config.duration,
            maxDuration: duration ?? config.duration,
            frequency: config.frequency,
            decay: config.decay,
            time: 0,
            offset: new THREE.Vector3()
        };

        this.activeShakes.push(shake);

        if (this.activeShakes.length > 3) {
            this.activeShakes.shift();
        }
    }

    update(dt: number): void {
        this.cameraShakeOffset.set(0, 0, 0);
        if (this.activeShakes.length === 0) return;

        for (let i = this.activeShakes.length - 1; i >= 0; i--) {
            const shake = this.activeShakes[i];
            shake.time += dt;
            shake.duration -= dt;

            if (shake.duration <= 0) {
                this.activeShakes.splice(i, 1);
                continue;
            }

            const progress = shake.duration / shake.maxDuration;
            const currentIntensity = shake.intensity * Math.pow(progress, shake.decay);

            const t = shake.time * shake.frequency;
            this.cameraShakeOffset.x += Math.sin(t) * Math.cos(t * 1.3) * currentIntensity;
            this.cameraShakeOffset.y += Math.cos(t * 0.8) * Math.sin(t * 1.7) * currentIntensity;
            this.cameraShakeOffset.z += Math.sin(t * 0.5) * currentIntensity * 0.5;
        }
    }

    /** Offsets the camera for the draw call. Always pair with removeFromCamera(). */
    applyToCamera(): void {
        if (this.applied) return;
        this.appliedOffset.copy(this.cameraShakeOffset);
        this.camera.position.add(this.appliedOffset);
        this.applied = true;
    }

    removeFromCamera(): void {
        if (!this.applied) return;
        this.camera.position.sub(this.appliedOffset);
        this.applied = false;
    }

    reset(): void {
        this.removeFromCamera();
        this.activeShakes = [];
        this.cameraShakeOffset.set(0, 0, 0);
    }

    getCurrentShakeIntensity(): number {
        if (this.activeShakes.length === 0) return 0;

        let totalIntensity = 0;
        for (const shake of this.activeShakes) {
            const progress = shake.duration / shake.maxDuration;
            totalIntensity += progress * shake.intensity;
        }

        return Math.min(1, totalIntensity / 0.5);
    }
}
