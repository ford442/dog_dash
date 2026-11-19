/**
 * Solar-wind vector fields — the traversal verb behind Solar Sail Ferns
 * (docs/plans/plan.md §I, kid-scaled for a side-scroller).
 *
 * Each *unfolded* fern whose field contains the player contributes one
 * acceleration vector along its blade facing. Overlapping fields vector-sum;
 * the sum is capped so a dense lane cannot fling the ship out of bounds.
 *
 * Forward (+X) wind rides as a scroll-speed multiplier that lingers for
 * `SAIL_RIDE_SECONDS` after leaving the last field: 1.25× for one sail,
 * +0.15× per extra overlapping sail, capped at 1.8×. Vertical wind nudges
 * `currentSpeedY` directly (clamped to the flight model's max speeds).
 *
 * Pure: no THREE, no RNG, no clocks — the sim passes `SIM_STEP` as `dt`.
 */

/** Acceleration (world units/s²) one sail field applies to the ship. */
export interface SailForce {
    x: number;
    y: number;
}

/** Lingering sail-ride buff carried on `playerState` between steps. */
export interface SailRideState {
    /** Peak scroll multiplier earned on this ride (1 = no buff). */
    multiplier: number;
    /** Seconds the buff keeps running after the last field is left. */
    timer: number;
}

export interface SailForceLimits {
    maxSpeedY: number;
    maxDescentSpeed: number;
}

export interface SailForceResult {
    ride: SailRideState;
    /** New vertical speed after this step's vertical wind. */
    currentSpeedY: number;
    /** Effective scroll multiplier to apply this step (fades over the last second). */
    scrollMultiplier: number;
    /** Number of fields that pushed this step. */
    activeSails: number;
}

export const SAIL_RIDE_BASE_MULT = 1.25;
export const SAIL_RIDE_PER_EXTRA = 0.15;
export const SAIL_RIDE_MAX_MULT = 1.8;
export const SAIL_RIDE_SECONDS = 5;
/** The buff eases back to 1× over this many seconds at the end of the timer. */
export const SAIL_RIDE_FADE_SECONDS = 1;
/** Cap on the summed vertical acceleration of all overlapping fields. */
export const SAIL_MAX_VERTICAL_ACCEL = 20;
/** Peak acceleration one fully-unfolded fern applies at its centre. */
export const SAIL_FIELD_ACCEL = 14;

/** Scroll multiplier target for `n` overlapping forward-pushing sails. */
export function sailRideMultiplier(sailCount: number): number {
    if (sailCount <= 0) return 1;
    return Math.min(
        SAIL_RIDE_MAX_MULT,
        SAIL_RIDE_BASE_MULT + SAIL_RIDE_PER_EXTRA * (sailCount - 1)
    );
}

export function createSailRideState(): SailRideState {
    return { multiplier: 1, timer: 0 };
}

/** Effective multiplier for a ride state (eases to 1× during the fade window). */
export function effectiveSailMultiplier(ride: SailRideState): number {
    if (ride.timer <= 0 || ride.multiplier <= 1) return 1;
    const fade = Math.min(1, ride.timer / SAIL_RIDE_FADE_SECONDS);
    return 1 + (ride.multiplier - 1) * fade;
}

/**
 * Apply one step of solar wind. `forces` are the fields currently containing
 * the player (already filtered to unfolded ferns by the caller).
 */
export function applySailForces(
    forces: readonly SailForce[],
    dt: number,
    prev: SailRideState,
    currentSpeedY: number,
    limits: SailForceLimits
): SailForceResult {
    let sumX = 0;
    let sumY = 0;
    let forward = 0;
    for (const f of forces) {
        sumX += f.x;
        sumY += f.y;
        if (f.x > 0) forward++;
    }

    let ride: SailRideState;
    if (forward > 0 && sumX > 0) {
        const target = sailRideMultiplier(forward);
        // Keep the best multiplier earned on this ride while it is still running,
        // so drifting from 3 overlapping sails into 1 does not yank speed away.
        const carried = prev.timer > 0 ? prev.multiplier : 1;
        ride = { multiplier: Math.max(target, carried), timer: SAIL_RIDE_SECONDS };
    } else {
        // Epsilon so 300 × (1/60) ends a 5 s ride on the exact step.
        const timer = prev.timer - dt;
        ride = timer > 1e-9 ? { multiplier: prev.multiplier, timer } : createSailRideState();
    }

    // Wind may push up to the flight model's limits but never clamps speed it
    // did not add (bounce pads / air tokens / anchors can exceed them).
    const accelY = Math.max(-SAIL_MAX_VERTICAL_ACCEL, Math.min(SAIL_MAX_VERTICAL_ACCEL, sumY));
    let speedY = currentSpeedY;
    if (accelY !== 0) {
        speedY = Math.max(
            Math.min(-limits.maxDescentSpeed, currentSpeedY),
            Math.min(Math.max(limits.maxSpeedY, currentSpeedY), currentSpeedY + accelY * dt)
        );
    }

    return {
        ride,
        currentSpeedY: speedY,
        scrollMultiplier: effectiveSailMultiplier(ride),
        activeSails: forces.length
    };
}

/**
 * Field acceleration for one fern. `windAngle` is the blade facing in the XY
 * plane (0 = straight down-lane, +X); `unfold` is 0..1 and the field is off
 * below `SAIL_UNFOLD_ACTIVE`. Distance falloff is linear to the field edge.
 */
export const SAIL_UNFOLD_ACTIVE = 0.6;

export function sailFieldForce(
    windAngle: number,
    unfold: number,
    dist: number,
    radius: number
): SailForce | null {
    if (unfold < SAIL_UNFOLD_ACTIVE || radius <= 0 || dist >= radius) return null;
    const falloff = 1 - dist / radius;
    const strength = SAIL_FIELD_ACCEL * falloff * unfold;
    return { x: Math.cos(windAngle) * strength, y: Math.sin(windAngle) * strength };
}

/**
 * Deterministic per-fern blade facing from its spawn position — no RNG draw,
 * so adding the field does not shift the `flora` stream. Range ±0.55 rad
 * (always forward-leaning: cos > 0.85).
 */
export function sailWindAngle(x: number, y: number): number {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const frac = s - Math.floor(s);
    return (frac * 2 - 1) * 0.55;
}
