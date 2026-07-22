import * as THREE from 'three';
import { ShakeType, SHAKE_CONFIGS, type ActiveShake } from './shared';

/** Camera screen-shake controller. */
export class ScreenShakeController {
    private camera: THREE.Camera;
    private cameraBasePosition: THREE.Vector3;
    private cameraShakeOffset: THREE.Vector3 = new THREE.Vector3();
    private activeShakes: ActiveShake[] = [];

    constructor(camera: THREE.Camera) {
        this.camera = camera;
        this.cameraBasePosition = camera.position.clone();
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
        if (this.activeShakes.length === 0) {
            if (this.cameraShakeOffset.lengthSq() > 0.0001) {
                this.cameraShakeOffset.set(0, 0, 0);
                this.camera.position.copy(this.cameraBasePosition);
            }
            return;
        }

        const combinedOffset = new THREE.Vector3();

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
            const x = Math.sin(t) * Math.cos(t * 1.3) * currentIntensity;
            const y = Math.cos(t * 0.8) * Math.sin(t * 1.7) * currentIntensity;
            const z = Math.sin(t * 0.5) * currentIntensity * 0.5;

            combinedOffset.x += x;
            combinedOffset.y += y;
            combinedOffset.z += z;
        }

        this.cameraShakeOffset.copy(combinedOffset);
        this.camera.position.copy(this.cameraBasePosition).add(combinedOffset);
    }

    updateCameraBasePosition(position: THREE.Vector3): void {
        this.cameraBasePosition.copy(position);
        if (this.activeShakes.length > 0) {
            this.camera.position.copy(this.cameraBasePosition).add(this.cameraShakeOffset);
        }
    }

    reset(): void {
        this.activeShakes = [];
        this.camera.position.copy(this.cameraBasePosition);
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
