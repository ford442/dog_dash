/**
 * Lost Sector ids, level slots and fragment thresholds. Tiny on purpose: the
 * boot path (run seed codec, artifact hacks, startRun) imports it, while the
 * authored configs and hub tab load in their own chunk.
 */

/** Authored secret chapters (plan §III). String ids keep campaign 1–6 untouched. */
export type LostSectorId = 'lost-garden' | 'lost-kelp';

export const LOST_SECTOR_IDS: readonly LostSectorId[] = ['lost-garden', 'lost-kelp'];

/**
 * Level index each sector runs as: clear of the campaign (1–6), Endless
 * (101+) and the Architect Lab (200), so no `levelIndex === N` set piece fires.
 */
export const LOST_SECTOR_LEVEL_INDEX: Readonly<Record<LostSectorId, number>> = {
    'lost-garden': 301,
    'lost-kelp': 302
};

/** Map fragments that reveal the Lost Sectors in the hub. */
export const LOST_SECTOR_FRAGMENTS = 3;

/** Map fragments that bring the Quantum Compass HUD pip online. */
export const QUANTUM_COMPASS_FRAGMENTS = 5;

export function isLostSectorId(value: unknown): value is LostSectorId {
    return typeof value === 'string' && (LOST_SECTOR_IDS as readonly string[]).includes(value);
}
