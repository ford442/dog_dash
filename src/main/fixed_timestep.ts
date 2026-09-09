/**
 * Fixed-timestep accumulator for the gameplay simulation.
 *
 * Gameplay systems (player motion, obstacles, combat, etc.) must integrate
 * against a constant step size so runs are reproducible independent of
 * display refresh rate. Purely visual systems (particles, screen shake,
 * shader `time` uniforms) should keep using wall-clock delta and are not
 * routed through this accumulator.
 */

/** Simulation rate in Hz. Gameplay always advances in increments of SIM_STEP seconds. */
export const SIM_HZ = 60;
export const SIM_STEP = 1 / SIM_HZ;

/** Clamp on a single rendered frame's wall-clock delta (matches the previous per-frame clamp). */
export const MAX_FRAME_DELTA = 0.1;

/**
 * Spiral-of-death guard: the most sim steps `advanceAccumulator` will report
 * for a single frame. Any remaining accumulated time beyond that is dropped
 * rather than queued, so a slow frame produces visible slow-motion instead
 * of an ever-growing backlog of catch-up steps.
 */
export const MAX_STEPS_PER_FRAME = 8;

export interface AccumulatorResult {
    /** Number of fixed steps to run this frame (0..MAX_STEPS_PER_FRAME). */
    steps: number;
    /** Accumulator value after consuming `steps` worth of simulation time. */
    remainder: number;
}

/**
 * Pure step-count computation: given the current accumulator and the delta
 * to add this frame, returns how many SIM_STEP-sized steps to run and the
 * leftover accumulator (used as the render-interpolation alpha numerator).
 */
// Floating-point tolerance so repeated frame deltas that sum to *almost*
// exactly SIM_STEP (e.g. 144 frames of 1/144s at a 60Hz sim) still fire the
// step instead of drifting a whole step behind.
const EPSILON = 1e-9;

export function advanceAccumulator(accumulator: number, frameDelta: number): AccumulatorResult {
    let acc = accumulator + Math.max(0, frameDelta);
    let steps = 0;

    while (acc >= SIM_STEP - EPSILON && steps < MAX_STEPS_PER_FRAME) {
        acc -= SIM_STEP;
        steps++;
    }
    acc = Math.max(0, acc);

    // Spiral-of-death: drop any backlog beyond MAX_STEPS_PER_FRAME instead of
    // letting it carry forward and compound on the next frame.
    if (steps === MAX_STEPS_PER_FRAME && acc >= SIM_STEP) {
        acc = acc % SIM_STEP;
    }

    return { steps, remainder: acc };
}

/** Render-interpolation alpha in [0, 1] for the given leftover accumulator. */
export function interpolationAlpha(remainder: number): number {
    return Math.min(1, Math.max(0, remainder / SIM_STEP));
}
