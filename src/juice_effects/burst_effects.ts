import * as THREE from 'three';
import { ParticleSystem } from '../particles';
import { ShakeType, BurstType, BURST_CONFIGS } from './shared';

/** Host hooks for combo bursts that also trigger shake / pause / flash. */
export interface BurstJuiceHost {
    shakeScreen(type: ShakeType, duration?: number): void;
    hitPause(duration: number): void;
    flashRainbow(duration?: number): void;
    flashRed(duration?: number): void;
}

/** Particle burst presets. */
export class BurstEffectsController {
    private particleSystem: ParticleSystem;
    private host: BurstJuiceHost;

    constructor(particleSystem: ParticleSystem, host: BurstJuiceHost) {
        this.particleSystem = particleSystem;
        this.host = host;
    }

    spawnBurst(position: THREE.Vector3, type: BurstType, count?: number): void {
        const config = BURST_CONFIGS[type];
        const particleCount = count ?? config.count;

        for (let i = 0; i < particleCount; i++) {
            const color = config.colors[Math.floor(Math.random() * config.colors.length)];
            const speedVariation = 0.7 + Math.random() * 0.6;
            const sizeVariation = 0.8 + Math.random() * 0.4;

            this.particleSystem.emit(
                position,
                color,
                1,
                config.speed * speedVariation,
                config.size * sizeVariation,
                config.spread
            );
        }

        if (type === BurstType.MAGIC || type === BurstType.LEVEL_UP) {
            this.spawnSparkles(position, new THREE.Color(0xFFD700), 8);
        }
    }

    spawnSparkles(position: THREE.Vector3, color: THREE.Color, count: number = 5): void {
        for (let i = 0; i < count; i++) {
            this.particleSystem.emit(
                position,
                color.getHex(),
                1,
                1.5 + Math.random() * 2.0,
                0.2 + Math.random() * 0.3,
                0.5
            );
        }
    }

    burstCollect(position: THREE.Vector3): void {
        this.spawnBurst(position, BurstType.COLLECT);
        this.host.shakeScreen(ShakeType.LIGHT, 0.1);
    }

    burstExplosion(position: THREE.Vector3, size: 'small' | 'medium' | 'large' = 'medium'): void {
        const countMultiplier = size === 'small' ? 0.5 : size === 'large' ? 2.0 : 1.0;
        this.spawnBurst(position, BurstType.EXPLOSION, Math.floor(20 * countMultiplier));

        const shakeType = size === 'small' ? ShakeType.LIGHT : size === 'large' ? ShakeType.HEAVY : ShakeType.MEDIUM;
        this.host.shakeScreen(shakeType);
        this.host.hitPause(size === 'large' ? 0.15 : 0.08);
    }

    burstMagic(position: THREE.Vector3): void {
        this.spawnBurst(position, BurstType.MAGIC);
        this.host.flashRainbow(0.5);
        this.host.shakeScreen(ShakeType.MEDIUM, 0.4);
    }

    burstDamage(position: THREE.Vector3): void {
        this.spawnBurst(position, BurstType.DAMAGE);
        this.host.flashRed(0.4);
        this.host.shakeScreen(ShakeType.EARTHQUAKE);
        this.host.hitPause(0.2);
    }

    burstLevelUp(position: THREE.Vector3): void {
        this.spawnBurst(position, BurstType.LEVEL_UP, 60);
        this.host.flashRainbow(1.0);
        this.host.shakeScreen(ShakeType.HEAVY, 0.8);
        this.host.hitPause(0.25);
    }
}
