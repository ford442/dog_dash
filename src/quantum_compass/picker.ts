/**
 * Quantum Compass target rules, pure (no THREE, no DOM) so the "nearest of
 * N" picker is unit-tested directly. Candidates come from a layer-masked
 * `SpatialIndex` query, never from walking the scene.
 */

/** Species the compass tracks without an explicit `userData.rareResource` tag. */
export const RARE_SPECIES: Readonly<Record<string, string>> = {
    magmaHeart: 'Magma Core',
    iceNeedleCluster: 'Frost Heart',
    fracturedGeode: 'Geode',
    derelictBuoy: 'Buoy'
};

export type RareTagged = { speciesId?: unknown; rareResource?: unknown };

/** True for `userData.rareResource === true` or an allowlisted species. */
export function isRareResource(userData: RareTagged | null | undefined): boolean {
    if (!userData) return false;
    if (userData.rareResource === true) return true;
    return typeof userData.speciesId === 'string' && Object.hasOwn(RARE_SPECIES, userData.speciesId);
}

/** Kid-readable name for the HUD pip. */
export function rareLabel(userData: RareTagged | null | undefined): string {
    const id = userData?.speciesId;
    if (typeof id === 'string' && Object.hasOwn(RARE_SPECIES, id)) return RARE_SPECIES[id];
    return 'Treasure';
}

export type RareCandidate = { x: number; y: number; z: number };

export type PickOptions = {
    /** Ignore candidates further than this behind the player (they scroll away). Default 4. */
    behindTolerance?: number;
};

/**
 * Index of the nearest candidate to (ox, oy, oz), or -1 when none qualify.
 * Candidates more than `behindTolerance` behind the player on X, or with a
 * non-finite position, are skipped. Ties keep the earlier candidate, so the
 * pick is stable for a given query order.
 */
export function pickNearestRare(
    ox: number,
    oy: number,
    oz: number,
    candidates: readonly RareCandidate[],
    options: PickOptions = {}
): number {
    const behind = options.behindTolerance ?? 4;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.z)) continue;
        if (c.x < ox - behind) continue;
        const dx = c.x - ox;
        const dy = c.y - oy;
        const dz = c.z - oz;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

/** Screen-plane heading (radians, 0 = right, +π/2 = up) from the player to a target. */
export function headingTo(ox: number, oy: number, tx: number, ty: number): number {
    return Math.atan2(ty - oy, tx - ox);
}
