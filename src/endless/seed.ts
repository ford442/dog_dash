/**
 * Endless Dash seed codes: the short string players type or share
 * (`#endless=0K3F9QA`). A code is the base-36 spelling of the run's 32-bit
 * `rngSeed`, so the same code yields the same chapter sequence and the same
 * gameplay streams on every machine.
 *
 * Boot-path module (startRun reads the URL hash): keep it free of the
 * generator and the hub UI.
 */
import { RUN_SEED_SCHEMA_VERSION, type RunSeed } from '../run_seed';

const CODE_LENGTH = 7; // 36^7 > 2^32
const CODE_PATTERN = /^[0-9A-Z]{1,7}$/;
const HASH_PARAM = /(?:^|[#&?])endless=([^&#\s]*)/i;

export function formatEndlessCode(seed: number): string {
    return (seed >>> 0).toString(36).toUpperCase().padStart(CODE_LENGTH, '0');
}

/**
 * Seed from a typed code or a pasted link containing `#endless=CODE`.
 * Ignores case, spaces and dashes. Null when it is not a valid code.
 */
export function parseEndlessCode(raw: unknown): number | null {
    if (typeof raw !== 'string') return null;
    let text = raw.trim();
    const param = HASH_PARAM.exec(text);
    if (param) text = param[1];
    text = text.replace(/[\s-]/g, '').toUpperCase();
    if (!CODE_PATTERN.test(text)) return null;
    const value = parseInt(text, 36);
    if (!Number.isSafeInteger(value) || value > 0xffffffff) return null;
    return value >>> 0;
}

export function endlessRunSeed(seed: number): RunSeed {
    return { version: RUN_SEED_SCHEMA_VERSION, campaignId: 'endless', rngSeed: seed >>> 0, modifiers: [] };
}

/** `base` is the page URL without a hash, e.g. `location.origin + location.pathname`. */
export function endlessShareLink(seed: number, base: string): string {
    return `${base}#endless=${formatEndlessCode(seed)}`;
}

/**
 * Reads `#endless=CODE` from the page URL and strips it, so the next reload
 * (game over, hub "Blast Off") goes back to the campaign. Null when absent.
 */
export function consumeEndlessSeedFromHash(): RunSeed | null {
    if (typeof window === 'undefined' || !window.location.hash) return null;
    try {
        const seed = parseEndlessCode(window.location.hash);
        if (seed === null) return null;
        history.replaceState(null, '', window.location.pathname + window.location.search);
        return endlessRunSeed(seed);
    } catch {
        return null;
    }
}

/** ISO-8601 week of `date` in UTC: weeks start Monday; week 1 holds the year's first Thursday. */
export function isoWeek(date: Date): { year: number; week: number } {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
    return { year: d.getUTCFullYear(), week };
}

/** FNV-1a, 32-bit. */
function hashString(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** This week's shared seed: a pure function of the UTC ISO week, so everyone flies the same one. */
export function weeklyEndlessSeed(date: Date): number {
    const { year, week } = isoWeek(date);
    return hashString(`endless-weekly:${year}-W${week}`);
}
