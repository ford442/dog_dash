import * as THREE from 'three';
import { LEVEL_CONFIG, type LevelConfig } from '../level_config';

const CAMPAIGN_CHAPTERS = [1, 2, 3, 4, 5, 6] as const;
const _a = new THREE.Color();
const _b = new THREE.Color();

/**
 * Which campaign chapter's art (rock palette, formation enemy) a level uses.
 *
 * Campaign levels 1–6 use their own. Endless chapters (101+), Lost Sectors
 * (301+) and Architect courses copy or pick an `enemyTintColor`, so they get
 * the campaign chapter with the nearest tint (Endless copies its twin's tint
 * exactly). No tint → chapter 1. Visual only.
 */
export function artChapterFor(level: number, config?: LevelConfig): number {
    if (level >= 1 && level <= 6) return level;
    const tint = config?.enemyTintColor;
    if (tint === undefined) return 1;
    _a.set(tint);
    let best = 1;
    let bestDist = Infinity;
    for (const ch of CAMPAIGN_CHAPTERS) {
        const t = LEVEL_CONFIG[ch]?.enemyTintColor;
        if (t === undefined) continue;
        _b.set(t);
        const d = (_a.r - _b.r) ** 2 + (_a.g - _b.g) ** 2 + (_a.b - _b.b) ** 2;
        if (d < bestDist) {
            bestDist = d;
            best = ch;
        }
    }
    return best;
}
