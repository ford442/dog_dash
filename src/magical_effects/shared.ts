/**
 * Magical Effects System for Dog Dash — shared types, palettes, and base class.
 */

import * as THREE from 'three';
import {
    createPastelRainbowNebulaMaterial,
    createDynamicAuroraMaterial,
    createSolarSailsMaterial
} from '../../shaders/magical_edition';

export const MagicalShaders = {
    createPastelRainbowNebulaMaterial,
    createDynamicAuroraMaterial,
    createSolarSailsMaterial
};

export enum MagicalEffectType {
    RAINBOW_TRAIL = 'rainbow_trail',
    BUTTERFLY_SWARM = 'butterfly_swarm',
    STARDUST_FIELD = 'stardust_field',
    HEART_BUBBLE = 'heart_bubble',
    GLITTER_BEAM = 'glitter_beam',
    CONFETTI_BURST = 'confetti_burst',
    HEART_RAIN = 'heart_rain',
    STAR_CASCADE = 'star_cascade',
    RAINBOW_SPIRAL = 'rainbow_spiral',
    SPARKLE_FIELD = 'sparkle_field'
}

export const PASTEL_RAINBOW = [
    0xffb3ba,
    0xffdfba,
    0xffffba,
    0xbaffc9,
    0xbae1ff,
    0xe6baff,
];

export const BUTTERFLY_COLORS = [
    0xffb6c1,
    0xdda0dd,
    0x87ceeb,
    0x98fb98,
    0xf0e68c,
    0xffa07a,
];

export const STARDUST_COLORS = [
    0xffffff,
    0xfffacd,
    0xffec8b,
    0xffd700,
    0xffa500,
];

export function getRainbowColor(t: number): number {
    const hue = t % 1;
    return new THREE.Color().setHSL(hue, 0.8, 0.7).getHex();
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

export function heartSDF(x: number, y: number): number {
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y;
}

export abstract class MagicalEffect {
    abstract type: MagicalEffectType;
    abstract isActive: boolean;
    duration: number;
    timeRemaining: number;
    elapsed: number;

    constructor(duration: number = 10) {
        this.duration = duration;
        this.timeRemaining = duration;
        this.elapsed = 0;
    }

    abstract update(dt: number): void;
    abstract destroy(): void;

    checkExpired(): boolean {
        if (this.duration > 0) {
            this.timeRemaining -= 0;
            return this.timeRemaining <= 0;
        }
        return false;
    }

    getProgress(): number {
        if (this.duration <= 0) return 0;
        return 1 - (this.timeRemaining / this.duration);
    }
}
