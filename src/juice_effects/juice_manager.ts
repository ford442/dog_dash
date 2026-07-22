import * as THREE from 'three';
import { ParticleSystem } from '../particles';
import { ShakeType, BurstType } from './shared';
import { ScreenShakeController } from './screen_shake';
import { HitPauseController } from './hit_pause';
import { FlashEffectsController } from './flash_effects';
import { BurstEffectsController } from './burst_effects';
import { FloatingTextController } from './floating_text';

/**
 * Facade over shake / hit-pause / flash / burst / floating-text controllers.
 * Public API matches the former monolithic JuiceManager.
 */
export class JuiceManager {
    private shake: ScreenShakeController;
    private hitPauseCtrl: HitPauseController;
    private flash: FlashEffectsController;
    private bursts: BurstEffectsController;
    private floatingText: FloatingTextController;
    private time: number = 0;

    constructor(camera: THREE.Camera, _scene: THREE.Scene, particleSystem: ParticleSystem) {
        this.shake = new ScreenShakeController(camera);
        this.hitPauseCtrl = new HitPauseController();
        this.flash = new FlashEffectsController();

        const host = {
            shakeScreen: (type: ShakeType, duration?: number) => this.shake.shakeScreen(type, duration),
            hitPause: (duration: number) => this.hitPauseCtrl.hitPause(duration),
            flashRainbow: (duration?: number) => this.flash.flashRainbow(duration),
            flashRed: (duration?: number) => this.flash.flashRed(duration)
        };

        this.bursts = new BurstEffectsController(particleSystem, host);
        this.floatingText = new FloatingTextController(camera, host);
    }

    shakeScreen(type: ShakeType, duration?: number): void {
        this.shake.shakeScreen(type, duration);
    }

    updateCameraBasePosition(position: THREE.Vector3): void {
        this.shake.updateCameraBasePosition(position);
    }

    hitPause(duration: number): void {
        this.hitPauseCtrl.hitPause(duration);
    }

    processHitPause(dt: number): number {
        return this.hitPauseCtrl.processHitPause(dt);
    }

    isPaused(): boolean {
        return this.hitPauseCtrl.isPaused();
    }

    flashChromatic(intensity: number, duration: number, color?: THREE.Color): void {
        this.flash.flashChromatic(intensity, duration, color);
    }

    setGravLensDistortion(intensity: number): void {
        this.flash.setGravLensDistortion(intensity);
    }

    flashWhite(duration: number): void {
        this.flash.flashWhite(duration);
    }

    flashRed(duration: number = 0.5): void {
        this.flash.flashRed(duration);
    }

    flashRainbow(duration: number = 0.8): void {
        this.flash.flashRainbow(duration);
    }

    spawnBurst(position: THREE.Vector3, type: BurstType, count?: number): void {
        this.bursts.spawnBurst(position, type, count);
    }

    spawnSparkles(position: THREE.Vector3, color: THREE.Color, count: number = 5): void {
        this.bursts.spawnSparkles(position, color, count);
    }

    burstCollect(position: THREE.Vector3): void {
        this.bursts.burstCollect(position);
    }

    burstExplosion(position: THREE.Vector3, size: 'small' | 'medium' | 'large' = 'medium'): void {
        this.bursts.burstExplosion(position, size);
    }

    burstMagic(position: THREE.Vector3): void {
        this.bursts.burstMagic(position);
    }

    burstDamage(position: THREE.Vector3): void {
        this.bursts.burstDamage(position);
    }

    burstLevelUp(position: THREE.Vector3): void {
        this.bursts.burstLevelUp(position);
    }

    showFloatingText(
        text: string,
        position: THREE.Vector3,
        color: string = 'gold',
        size: number = 24
    ): void {
        this.floatingText.showFloatingText(text, position, color, size);
    }

    showScoreText(score: number, position: THREE.Vector3): void {
        this.floatingText.showScoreText(score, position);
    }

    showComboText(combo: number, position: THREE.Vector3): void {
        this.floatingText.showComboText(combo, position);
    }

    showHealthChange(amount: number, position: THREE.Vector3): void {
        this.floatingText.showHealthChange(amount, position);
    }

    showResourcePop(
        materialName: string,
        amount: number,
        position: THREE.Vector3,
        color: string = 'gold'
    ): void {
        this.floatingText.showResourcePop(materialName, amount, position, color);
    }

    update(deltaTime: number): number {
        this.time += deltaTime;

        const modifiedDelta = this.hitPauseCtrl.processHitPause(deltaTime);

        if (modifiedDelta > 0) {
            this.shake.update(modifiedDelta);
        }

        this.flash.update(deltaTime, this.time);
        this.floatingText.update(deltaTime);

        return modifiedDelta;
    }

    reset(): void {
        this.shake.reset();
        this.hitPauseCtrl.reset();
        this.flash.reset();
        this.floatingText.reset();
        this.time = 0;
    }

    dispose(): void {
        this.reset();
        this.floatingText.dispose();
        this.flash.dispose();
    }

    setFloatingTextEnabled(enabled: boolean): void {
        this.floatingText.setEnabled(enabled);
    }

    getCurrentShakeIntensity(): number {
        return this.shake.getCurrentShakeIntensity();
    }
}
