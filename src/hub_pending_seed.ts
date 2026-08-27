/**
 * Persisted "start with this run seed" request across location.reload().
 * Kept separate from hub_screen so the boot path does not pull hub UI.
 */

import { type RunSeed, parseRunSeed, serializeRunSeed } from './run_seed';

const PENDING_SEED_KEY = 'dog_dash_pending_run_seed';

export function setPendingRunSeed(seed: RunSeed): void {
    try {
        localStorage.setItem(PENDING_SEED_KEY, serializeRunSeed(seed));
    } catch (e) {
        console.warn('Failed to store pending run seed:', e);
    }
}

/** Reads and clears the requested run seed. Null when none was set or invalid. */
export function consumePendingRunSeed(): RunSeed | null {
    try {
        const raw = localStorage.getItem(PENDING_SEED_KEY);
        if (raw === null) return null;
        localStorage.removeItem(PENDING_SEED_KEY);
        return parseRunSeed(raw);
    } catch {
        return null;
    }
}

/** Parse ?seed= from URL once (does not persist). */
export function parseSeedFromUrl(): RunSeed | null {
    if (typeof window === 'undefined') return null;
    try {
        const param = new URLSearchParams(window.location.search).get('seed');
        if (!param) return null;
        return parseRunSeed(param);
    } catch {
        return null;
    }
}
