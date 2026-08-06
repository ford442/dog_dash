export type BossPhase = 'entering' | 'phase1' | 'phase2' | 'phase3' | 'defeated';

export { STAR_EATER_PITCHER_NAME as BOSS_DISPLAY_NAME } from '../boss_display_names';

export const PHASE_NAMES: Record<BossPhase, string> = {
    entering: 'APPROACH',
    phase1: 'SUCTION',
    phase2: 'ENRAGED',
    phase3: 'DESPERATION',
    defeated: 'DEFEATED'
};

export interface BossConfig {
    spawnX: number;
    arenaWidth: number;
    health: number;
}

export interface BossHitboxEntry {
    x: number;
    y: number;
    radius: number;
    /** 'boss' = uvula weak point; number = minion index */
    target: 'boss' | number;
    dealsDamage: boolean;
}
