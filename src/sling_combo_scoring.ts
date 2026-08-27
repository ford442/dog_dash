/** Quality level of a sling action */
export type SlingQuality = 'perfect' | 'good' | 'messy';

/** Score bonus per quality tier */
export const QUALITY_SCORE: Record<SlingQuality, number> = {
    perfect: 150,
    good: 75,
    messy: 25
};

/** Combo multipliers applied to score bonuses */
export function comboMultiplier(combo: number): number {
    if (combo >= 7) return 4;
    if (combo >= 5) return 2.5;
    if (combo >= 3) return 1.5;
    return 1;
}

/** Rounded sling score bonus for a quality tier at the current combo chain length. */
export function computeSlingScoreBonus(
    quality: SlingQuality,
    combo: number,
    bonusMultiplier: number = 1
): number {
    const baseScore = QUALITY_SCORE[quality];
    return Math.round(baseScore * comboMultiplier(combo) * bonusMultiplier);
}
