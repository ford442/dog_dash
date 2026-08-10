import * as THREE from 'three';
import type { ShakeType, BurstType } from '../juice_effects';

/** Screen shake, bursts, and floating combat text. */
export interface JuicePort {
    shakeScreen(type: ShakeType, duration?: number): void;
    spawnBurst(position: THREE.Vector3, type: BurstType, count?: number): void;
    showFloatingText(text: string, position: THREE.Vector3, color?: string, size?: number): void;
    showScoreText(score: number, position: THREE.Vector3): void;
}
