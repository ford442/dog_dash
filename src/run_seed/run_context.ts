import type { RunSeed } from './types';
import { SeededRng } from './rng';

let activeSeed: RunSeed | null = null;
let rootRng: SeededRng | null = null;
const forkCache = new Map<string, SeededRng>();

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
        throw new Error('[run_seed] beginRun() must be called before getRunRng()');
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
