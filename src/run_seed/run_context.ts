import type { RunSeed } from './types';
import { SeededRng } from './rng';

let activeSeed: RunSeed | null = null;
let rootRng: SeededRng | null = null;
const forkCache = new Map<string, SeededRng>();

/** Fixed seed for the pre-run "attract" RNG (menu/attract screen, before beginGameplay). */
const ATTRACT_RNG_SEED = 0xa77ac7;
let attractWarned = false;

export function beginRun(seed: RunSeed): void {
    activeSeed = seed;
    rootRng = new SeededRng(seed.rngSeed, 'root');
    forkCache.clear();
}

export function getRunSeed(): RunSeed {
    if (!activeSeed) {
        throw new Error('[run_seed] beginRun() must be called before getRunSeed()');
    }
    return activeSeed;
}

export function tryGetRunSeed(): RunSeed | null {
    return activeSeed;
}

export function getRunRng(): SeededRng {
    if (!rootRng) {
        // Per-frame spawners (obstacles, candy belts, foliage streaming) tick on the
        // menu/attract screen before beginGameplay() calls beginRun(). Throwing there
        // floods the rAF loop, so hand out a fixed-seed attract RNG instead. It is NOT
        // a run: tryGetRunSeed() stays null, and beginRun() discards it and its forks.
        if (!attractWarned) {
            attractWarned = true;
            console.warn('[run_seed] getRunRng() called before beginRun(); using attract RNG until the run starts.');
        }
        rootRng = new SeededRng(ATTRACT_RNG_SEED, 'attract');
    }
    return rootRng;
}

/** Cached named substream for stable call order across systems. */
export function getRunRngFork(name: string): SeededRng {
    let fork = forkCache.get(name);
    if (!fork) {
        fork = getRunRng().fork(name);
        forkCache.set(name, fork);
    }
    return fork;
}
