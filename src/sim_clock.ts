/**
 * Simulation clock: total gameplay time in seconds, advanced by exactly
 * SIM_STEP inside every `stepSimulation` call.
 *
 * Anything that changes gameplay outcomes (fire cooldowns, patrol paths,
 * timed score multipliers, the `time` argument the loop phases receive)
 * must read this instead of `performance.now()` / `Date.now()` /
 * `clock.getElapsedTime()` — wall-clock time differs between a 30 Hz and a
 * 144 Hz display and between a live run and a headless replay. Purely
 * visual bobbing / twinkling may keep using wall-clock time.
 */

let simTime = 0;

/** Seconds of simulated gameplay since the run began. */
export function getSimTime(): number {
    return simTime;
}

/** Milliseconds variant for code that previously compared `Date.now()` values. */
export function getSimTimeMs(): number {
    return simTime * 1000;
}

export function advanceSimClock(step: number): void {
    simTime += step;
}

export function resetSimClock(): void {
    simTime = 0;
    timers = [];
    timerSeq = 0;
}

interface SimTimer {
    due: number;
    seq: number;
    fn: () => void;
}

let timers: SimTimer[] = [];
let timerSeq = 0;

/**
 * setTimeout for gameplay: runs `fn` at the start of the first sim step at
 * or after `delaySeconds` of *simulated* time. Use it for anything that
 * changes outcomes (i-frame windows, staggered boss volleys, delayed
 * grants) — a wall-clock timer would end early during hit-pause, fire while
 * paused, and land on a different step at 30 Hz vs 144 Hz or in a headless
 * replay. Cosmetic flashes may keep using setTimeout.
 */
export function scheduleSim(delaySeconds: number, fn: () => void): void {
    timers.push({ due: simTime + Math.max(0, delaySeconds), seq: timerSeq++, fn });
}

/** Called by stepSimulation right after advancing the clock. Fires in (due, scheduling-order) order. */
export function runDueSimTimers(): void {
    if (timers.length === 0) return;
    const due = timers.filter((t) => t.due <= simTime + 1e-9);
    if (due.length === 0) return;
    timers = timers.filter((t) => t.due > simTime + 1e-9);
    due.sort((a, b) => a.due - b.due || a.seq - b.seq);
    for (const t of due) t.fn();
}

export function pendingSimTimerCount(): number {
    return timers.length;
}
