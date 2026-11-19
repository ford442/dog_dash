/**
 * Extractor Beam yield table (docs/plans/plan.md §V, Plasma Caster alt-fire).
 *
 * The beam siphons `EXTRACT_UNITS_PER_SEC` "extract units" from a living
 * target. Every `unitsPerGrant` units bank one material into the bag; a
 * target holds `capacity` units and is then spent (it survives — the beam
 * never destroys). Jelly-moss: 100 units at 10/s → 5 Pure Extract over 10 s.
 *
 * Pure: no THREE, no RNG. Yields are deterministic, so they need no
 * `gameplayRandom` stream at all.
 */

import type { MaterialId } from '../resource_inventory';

export type ExtractSpecies = 'nebulaJellyMoss' | 'fracturedGeode' | 'vacuumKelp' | 'magmaHeart';

export interface ExtractYield {
    material: MaterialId;
    /** Total extract units the target holds before it is spent. */
    capacity: number;
    /** Extract units per banked material. */
    unitsPerGrant: number;
    /** Ship energy drained per second while siphoning this target. */
    energyPerSec: number;
    /** Kid-facing label for the HUD progress readout. */
    label: string;
}

/** Siphon rate (plan.md: "10 units/sec"). */
export const EXTRACT_UNITS_PER_SEC = 10;

/**
 * Plan.md asks for 50% shields over a full moss siphon; kid-tuned to ship
 * energy instead (30 of 100 over 10 s), never hearts.
 */
export const EXTRACT_YIELDS: Readonly<Record<ExtractSpecies, ExtractYield>> = {
    nebulaJellyMoss: {
        material: 'pureExtract',
        capacity: 100,
        unitsPerGrant: 20,
        energyPerSec: 3,
        label: 'Pure Extract'
    },
    fracturedGeode: {
        material: 'voidGem',
        capacity: 60,
        unitsPerGrant: 30,
        energyPerSec: 2.5,
        label: 'Void Gem'
    },
    vacuumKelp: {
        material: 'luminousDust',
        capacity: 40,
        unitsPerGrant: 10,
        energyPerSec: 2,
        label: 'Luminous Dust'
    },
    magmaHeart: {
        material: 'pyroclastOre',
        capacity: 40,
        unitsPerGrant: 20,
        energyPerSec: 4,
        label: 'Pyroclast Ore'
    }
};

/** Total materials a fresh target yields when siphoned to empty. */
export function fullExtractYield(species: ExtractSpecies): number {
    const y = EXTRACT_YIELDS[species];
    return Math.floor(y.capacity / y.unitsPerGrant);
}

export interface ExtractTick {
    /** Extract units drawn so far (clamped to capacity). */
    drawn: number;
    /** Whole materials banked by this tick. */
    granted: number;
    /** Target is now spent. */
    depleted: boolean;
    /** 0..1 fraction of capacity drawn. */
    progress: number;
}

/**
 * Advance a siphon by `dt` seconds from `prevDrawn` units. Grants are the
 * number of `unitsPerGrant` boundaries crossed, so the total over a full
 * siphon is exactly `fullExtractYield` regardless of step size.
 */
export function tickExtract(species: ExtractSpecies, prevDrawn: number, dt: number): ExtractTick {
    const y = EXTRACT_YIELDS[species];
    const start = Math.max(0, Math.min(y.capacity, prevDrawn));
    const drawn = Math.min(y.capacity, start + EXTRACT_UNITS_PER_SEC * Math.max(0, dt));
    const granted = Math.floor(drawn / y.unitsPerGrant + 1e-9) - Math.floor(start / y.unitsPerGrant + 1e-9);
    return {
        drawn,
        granted,
        depleted: drawn >= y.capacity - 1e-9,
        progress: drawn / y.capacity
    };
}
