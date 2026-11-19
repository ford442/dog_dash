/**
 * Extractor Beam — Plasma Caster alternate fire (hold **E** / touch 🧪).
 *
 * Sim-side state machine. While held with energy to spare the beam sweeps a
 * forward cone, locks the nearest living target from the GeologicalWorld
 * (no second global list), and siphons it via `tickExtract`. While locked the
 * ship is *rooted*: weapons off, scroll + thrust efficiency down, enemies
 * drift toward it. Targets survive and are remembered as spent.
 *
 * No THREE, no RNG, no clocks; the caller passes `SIM_STEP`. Target
 * identity is any object (the THREE.Object3D in the live game, plain
 * objects in unit tests).
 */

import {
    EXTRACT_YIELDS,
    tickExtract,
    type ExtractSpecies
} from './yields';
import type { MaterialId } from '../resource_inventory';

export interface ExtractCandidate<T extends object = object> {
    ref: T;
    species: ExtractSpecies;
    x: number;
    y: number;
    z: number;
}

/** Forward cone the beam can lock within. */
export const EXTRACT_RANGE = 22;
export const EXTRACT_CONE_HALF_ANGLE = Math.PI / 5; // 36°
/** Targets this far off the gameplay plane are background and ignored. */
export const EXTRACT_MAX_DEPTH = 8;
/** Below this energy the beam sputters out. */
export const EXTRACT_MIN_ENERGY = 1;

/** Rooted-ship tuning (kid-scaled; plan.md says "roots the ship in place"). */
export const EXTRACT_SCROLL_MUL = 0.3;
export const EXTRACT_THRUST_MUL = 0.45;
export const EXTRACT_ATTRACT_RADIUS = 28;

/**
 * Pick the nearest candidate inside the forward (+X) cone. Pure; exported
 * for unit tests. `isSpent` filters targets already siphoned dry.
 */
export function pickExtractTarget<T extends object>(
    shipX: number,
    shipY: number,
    shipZ: number,
    candidates: readonly ExtractCandidate<T>[],
    isSpent: (ref: T) => boolean = () => false
): ExtractCandidate<T> | null {
    const cosHalf = Math.cos(EXTRACT_CONE_HALF_ANGLE);
    let best: ExtractCandidate<T> | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
        if (Math.abs(c.z - shipZ) > EXTRACT_MAX_DEPTH) continue;
        const dx = c.x - shipX;
        const dy = c.y - shipY;
        const dist = Math.hypot(dx, dy);
        if (dist > EXTRACT_RANGE) continue;
        // Inside the ship's own hull counts as in-cone (point-blank siphon).
        if (dist > 1.5 && dx / dist < cosHalf) continue;
        if (isSpent(c.ref)) continue;
        if (dist < bestDist) {
            bestDist = dist;
            best = c;
        }
    }
    return best;
}

export interface ExtractorStepInput<T extends object> {
    dt: number;
    held: boolean;
    energy: number;
    shipX: number;
    shipY: number;
    shipZ: number;
    candidates: readonly ExtractCandidate<T>[];
}

export interface ExtractorStepResult<T extends object> {
    /** Beam is on (held with energy), with or without a lock. */
    beaming: boolean;
    /** Locked target this step (null while searching). */
    target: ExtractCandidate<T> | null;
    /** Energy to drain this step. */
    energyDrain: number;
    /** Materials banked this step (0 or more of `material`). */
    granted: number;
    material: MaterialId | null;
    /** 0..1 siphon progress on the locked target. */
    progress: number;
    /** Locked target was emptied this step. */
    depleted: boolean;
    /** Beam was held but sputtered for lack of energy. */
    outOfEnergy: boolean;
}

export class ExtractorBeam<T extends object = object> {
    private drawn = new WeakMap<T, number>();
    private spent = new WeakSet<T>();
    private locked: ExtractCandidate<T> | null = null;
    private beaming = false;

    /** Locked on a target as of the last step → ship is rooted this step. */
    isRooted(): boolean {
        return this.locked !== null;
    }

    /** Held with energy as of the last step → weapons are disabled. */
    isBeaming(): boolean {
        return this.beaming;
    }

    getTarget(): ExtractCandidate<T> | null {
        return this.locked;
    }

    isSpent(ref: T): boolean {
        return this.spent.has(ref);
    }

    /** Siphon progress (0..1) on a target, for HUD readouts. */
    progressOf(ref: T, species: ExtractSpecies): number {
        return (this.drawn.get(ref) ?? 0) / EXTRACT_YIELDS[species].capacity;
    }

    reset(): void {
        this.drawn = new WeakMap<T, number>();
        this.spent = new WeakSet<T>();
        this.locked = null;
        this.beaming = false;
    }

    step(input: ExtractorStepInput<T>): ExtractorStepResult<T> {
        const idle: ExtractorStepResult<T> = {
            beaming: false,
            target: null,
            energyDrain: 0,
            granted: 0,
            material: null,
            progress: 0,
            depleted: false,
            outOfEnergy: false
        };

        if (!input.held) {
            this.locked = null;
            this.beaming = false;
            return idle;
        }
        if (input.energy < EXTRACT_MIN_ENERGY) {
            this.locked = null;
            this.beaming = false;
            return { ...idle, outOfEnergy: true };
        }

        this.beaming = true;
        // Sticky lock: keep the current target while it stays in the cone,
        // so a second moss drifting closer does not steal a half-done siphon.
        const isSpent = (ref: T) => this.spent.has(ref);
        const prevRef = this.locked?.ref;
        const kept = prevRef
            ? input.candidates.find((c) => c.ref === prevRef)
            : undefined;
        const target = (kept && pickExtractTarget(input.shipX, input.shipY, input.shipZ, [kept], isSpent))
            ?? pickExtractTarget(input.shipX, input.shipY, input.shipZ, input.candidates, isSpent);
        this.locked = target;
        if (!target) return { ...idle, beaming: true };

        const y = EXTRACT_YIELDS[target.species];
        const prev = this.drawn.get(target.ref) ?? 0;
        const tick = tickExtract(target.species, prev, input.dt);
        this.drawn.set(target.ref, tick.drawn);
        if (tick.depleted) {
            this.spent.add(target.ref);
            this.locked = null;
        }
        return {
            beaming: true,
            target,
            energyDrain: Math.min(input.energy, y.energyPerSec * input.dt),
            granted: tick.granted,
            material: y.material,
            progress: tick.progress,
            depleted: tick.depleted,
            outOfEnergy: false
        };
    }
}
