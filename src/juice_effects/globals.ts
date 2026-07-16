import * as THREE from 'three';
import { JuiceManager } from './juice_manager';
import { ShakeType, BurstType } from './shared';

/** Global juice manager instance for easy access */
let globalJuiceManager: JuiceManager | null = null;

/**
 * Set the global juice manager instance
 */
export function setGlobalJuiceManager(manager: JuiceManager): void {
    globalJuiceManager = manager;
}

/**
 * Get the global juice manager instance
 */
export function getGlobalJuiceManager(): JuiceManager | null {
    return globalJuiceManager;
}

/**
 * Quick shake function (requires global manager to be set)
 */
export function quickShake(type: ShakeType): void {
    globalJuiceManager?.shakeScreen(type);
}

/**
 * Quick burst function (requires global manager to be set)
 */
export function quickBurst(position: THREE.Vector3, type: BurstType): void {
    globalJuiceManager?.spawnBurst(position, type);
}

/**
 * Quick floating text (requires global manager to be set)
 */
export function quickText(text: string, position: THREE.Vector3, color?: string): void {
    globalJuiceManager?.showFloatingText(text, position, color);
}
