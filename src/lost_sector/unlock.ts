/**
 * When a save may fly the Lost Sectors and use the Quantum Compass. Both are
 * derived from the persistent map-fragment count (Derelict Buoy hacks), so
 * an unlock survives reloads and never depends on which seed was flown.
 */
import type { SaveManager } from '../save_manager';
import { LOST_SECTOR_FRAGMENTS, QUANTUM_COMPASS_FRAGMENTS } from './constants';

export type LostSectorUnlockState = {
    unlocked: boolean;
    fragments: number;
    needed: number;
    compassUnlocked: boolean;
    compassNeeded: number;
};

export function lostSectorUnlockState(
    save: Pick<SaveManager, 'getMapFragments' | 'hasQuantumCompass'>
): LostSectorUnlockState {
    const fragments = save.getMapFragments();
    return {
        unlocked: fragments >= LOST_SECTOR_FRAGMENTS,
        fragments,
        needed: LOST_SECTOR_FRAGMENTS,
        compassUnlocked: save.hasQuantumCompass(),
        compassNeeded: QUANTUM_COMPASS_FRAGMENTS
    };
}
