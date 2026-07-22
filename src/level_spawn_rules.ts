/**
 * Pure spawn predicates for level-gated flora/fauna.
 * Kept free of Three.js so the gameplay loop never sync-imports heavy manager modules.
 */
import type { LevelEnvironments, BubbleCoralEnvironmentConfig } from './level_config';

export type BubbleCoralPlacement = 'wall' | 'reef' | 'tunnel';

const MAX_BUBBLE_CORAL_CLUSTERS = 12;

/** True when koi should appear for this level's environment mix. */
export function shouldSpawnStarlightKoi(
    environments: { biological?: boolean; aquaticLife?: boolean; nebula?: boolean } | undefined,
    density: number | undefined
): boolean {
    if (!density || density <= 0) return false;
    const env = environments || {};
    return !!(env.biological || env.aquaticLife || env.nebula);
}

export function shouldSpawnBubbleCoral(
    environments: LevelEnvironments | undefined,
    density: number | undefined
): boolean {
    if (!density || density <= 0) return false;
    const env = environments || {};
    if (env.bubbleCoral) return true;
    return !!(env.waterfall || env.aquaticLife || env.biological);
}

export function getBubbleCoralPlacement(
    environments: LevelEnvironments | undefined,
    levelType?: string
): BubbleCoralPlacement {
    const env = environments || {};
    if (env.waterfall) return 'wall';
    if (levelType === 'tunnel' || levelType === 'organic_tunnel') return 'tunnel';
    if (env.aquaticLife || env.biological) return 'reef';
    return 'reef';
}

export function resolveBubbleCoralClusterCount(
    baseDensity: number,
    envConfig?: BubbleCoralEnvironmentConfig | boolean
): number {
    const mult = typeof envConfig === 'object' ? (envConfig.density ?? 1) : 1;
    return Math.min(MAX_BUBBLE_CORAL_CLUSTERS, Math.max(1, Math.floor(baseDensity * mult)));
}
