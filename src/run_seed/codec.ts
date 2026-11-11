import { RUN_SEED_SCHEMA_VERSION, type RunCampaignId, type RunModifier, type RunSeed } from './types';

const CAMPAIGN_IDS: readonly RunCampaignId[] = ['campaign', 'endless', 'architect'];
/** Mirrors `ARCHITECT_MAX_PLACEMENTS`; the architect chunk re-checks every placement with its schema. */
const MAX_ARCHITECT_PLACEMENTS = 24;

function randomUint32(): number {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return buf[0] >>> 0;
    }
    return ((Date.now() ^ (typeof performance !== 'undefined' ? performance.now() : 0)) >>> 0) || 1;
}

export function createDefaultRunSeed(): RunSeed {
    return {
        version: RUN_SEED_SCHEMA_VERSION,
        campaignId: 'campaign',
        rngSeed: randomUint32(),
        modifiers: []
    };
}

function isValidModifier(raw: unknown): raw is RunModifier {
    if (!raw || typeof raw !== 'object') return false;
    const m = raw as Record<string, unknown>;
    if (m.kind === 'ng_plus') {
        return typeof m.tier === 'number' && Number.isFinite(m.tier);
    }
    if (m.kind === 'architect') {
        return Array.isArray(m.placements)
            && m.placements.length <= MAX_ARCHITECT_PLACEMENTS
            && m.placements.every((p) => !!p && typeof p === 'object' && !Array.isArray(p));
    }
    return false;
}

function normalizeRunSeed(raw: Record<string, unknown>): RunSeed | null {
    if (raw.version !== RUN_SEED_SCHEMA_VERSION) return null;
    if (!CAMPAIGN_IDS.includes(raw.campaignId as RunCampaignId)) return null;
    const campaignId = raw.campaignId as RunCampaignId;
    const rngSeed = Number(raw.rngSeed);
    if (!Number.isFinite(rngSeed)) return null;
    const modifiers: RunModifier[] = [];
    if (Array.isArray(raw.modifiers)) {
        for (const m of raw.modifiers) {
            if (!isValidModifier(m)) return null;
            modifiers.push(m);
        }
    }
    return {
        version: RUN_SEED_SCHEMA_VERSION,
        campaignId,
        rngSeed: rngSeed >>> 0,
        modifiers
    };
}

export function serializeRunSeed(seed: RunSeed): string {
    return JSON.stringify(seed);
}

export function parseRunSeed(raw: string): RunSeed | null {
    if (!raw || typeof raw !== 'string') return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;
        const result = normalizeRunSeed(parsed as Record<string, unknown>);
        if (!result) {
            console.warn('[run_seed] Invalid or unsupported seed:', raw.slice(0, 80));
        }
        return result;
    } catch {
        console.warn('[run_seed] Failed to parse seed JSON');
        return null;
    }
}

/** Compare two seeds for ghost replay eligibility. */
export function seedsMatch(a: RunSeed, b: RunSeed): boolean {
    if (a.version !== b.version) return false;
    if (a.campaignId !== b.campaignId) return false;
    if (a.rngSeed !== b.rngSeed) return false;
    if (a.modifiers.length !== b.modifiers.length) return false;
    return JSON.stringify(a.modifiers) === JSON.stringify(b.modifiers);
}
