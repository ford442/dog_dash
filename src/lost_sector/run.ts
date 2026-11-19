/**
 * Lost Sectors as runs. A sector flight is an ordinary run seed
 * (`campaignId: 'lost'`, a fresh `rngSeed`, the sector id in a `lost_sector`
 * modifier), so it is seeded, replayable and ghost-matched like any other
 * run: the same seed spawns the same buoys, rocks and creatures.
 */
import { RUN_SEED_SCHEMA_VERSION, type RunModifier, type RunSeed } from '../run_seed/types';
import { isLostSectorId, type LostSectorId } from './constants';
import { createLostSectorLayout, type LostSectorLayout } from './layout';

type LostSectorModifier = Extract<RunModifier, { kind: 'lost_sector' }>;

export function lostSectorRunSeed(id: LostSectorId, rngSeed: number): RunSeed {
    return {
        version: RUN_SEED_SCHEMA_VERSION,
        campaignId: 'lost',
        rngSeed: rngSeed >>> 0,
        modifiers: [{ kind: 'lost_sector', sectorId: id }]
    };
}

/** The sector a `'lost'` run seed names, or null when it names none (or an unknown one). */
export function resolveLostSector(run: RunSeed): LostSectorId | null {
    if (run.campaignId !== 'lost') return null;
    const mods = run.modifiers.filter((m): m is LostSectorModifier => m.kind === 'lost_sector');
    if (mods.length !== 1) return null;
    return isLostSectorId(mods[0].sectorId) ? mods[0].sectorId : null;
}

/** Layout for a run seed `resolveLostSector` accepts. Throws on any other: callers resolve first. */
export function createLostSectorRunLayout(run: RunSeed): LostSectorLayout {
    const id = resolveLostSector(run);
    if (!id) throw new Error('[lost_sector] Run seed names no Lost Sector.');
    return createLostSectorLayout(id);
}
