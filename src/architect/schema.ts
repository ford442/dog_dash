/**
 * Architect seed JSON: the versioned course file players export, paste and
 * share. Pasted text is untrusted (an XSS / DoS surface if it reached
 * `LEVEL_CONFIG` as-is), so it only ever enters through `parseArchitectSeed`:
 * a size cap before `JSON.parse`, then a strict zod schema with an allowlist
 * of brush ids, bounded numbers and no unknown keys. Nothing in a seed is
 * code; brushes are looked up in `BRUSH_REGISTRY`, never evaluated.
 *
 * Unknown or future `v` values fail closed: a seed from a newer build is
 * refused rather than half-read.
 */
import { z } from 'zod';
import { BRUSH_IDS, type BrushPlacement } from './brushes';
import {
    ARCHITECT_MAX_PLACEMENTS,
    ARCHITECT_MAX_SEED_CHARS,
    ARCHITECT_SEED_VERSION,
    SANDBOX_MAX_LENGTH
} from './constants';

/** Course RNG seed: the same base-36 code Endless Dash uses (`formatEndlessCode`). */
const SEED_CODE = /^[0-9A-Z]{1,7}$/;

export const BrushPlacementSchema = z.strictObject({
    brushId: z.enum(BRUSH_IDS),
    density: z.number().min(0).max(1),
    x: z.number().min(0).max(SANDBOX_MAX_LENGTH).optional()
});

export const ArchitectSeedSchema = z.strictObject({
    v: z.literal(ARCHITECT_SEED_VERSION),
    rngSeed: z.string()
        .regex(SEED_CODE, 'must be a seed code like 0K3F9QA')
        .refine((code) => parseInt(code, 36) <= 0xffffffff, 'is out of range'),
    placements: z.array(BrushPlacementSchema).max(ARCHITECT_MAX_PLACEMENTS)
});

export type ArchitectSeed = {
    v: typeof ARCHITECT_SEED_VERSION;
    rngSeed: string;
    placements: BrushPlacement[];
};

export type ArchitectSeedResult = { ok: true; seed: ArchitectSeed } | { ok: false; errors: string[] };

const MAX_REPORTED_ERRORS = 5;

function describeIssues(error: z.ZodError): string[] {
    return error.issues.slice(0, MAX_REPORTED_ERRORS).map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'seed';
        return `${path}: ${issue.message}`;
    });
}

/** Validates an already-parsed value (a run seed's placements, a stored draft). */
export function validateArchitectSeed(raw: unknown): ArchitectSeedResult {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const v = (raw as { v?: unknown }).v;
        if (typeof v === 'number' && v > ARCHITECT_SEED_VERSION) {
            return { ok: false, errors: [`This course was built with a newer version of Space Dash (v${v}).`] };
        }
    }
    const result = ArchitectSeedSchema.safeParse(raw);
    if (!result.success) return { ok: false, errors: describeIssues(result.error) };
    // Drop `x: undefined` so the canonical form round-trips through JSON unchanged.
    const placements = result.data.placements.map(({ brushId, density, x }) =>
        x === undefined ? { brushId, density } : { brushId, density, x }
    );
    return { ok: true, seed: { v: result.data.v, rngSeed: result.data.rngSeed, placements } };
}

/** Parses pasted seed text. Never throws. */
export function parseArchitectSeed(text: unknown): ArchitectSeedResult {
    if (typeof text !== 'string') return { ok: false, errors: ['Paste a course seed (JSON text).'] };
    if (text.length > ARCHITECT_MAX_SEED_CHARS) {
        return { ok: false, errors: [`That seed is too big (over ${ARCHITECT_MAX_SEED_CHARS} characters).`] };
    }
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return { ok: false, errors: ['That is not valid seed JSON.'] };
    }
    return validateArchitectSeed(raw);
}

/** Canonical seed text (stable key order), as the Lab exports it. */
export function serializeArchitectSeed(seed: ArchitectSeed): string {
    return JSON.stringify({
        v: seed.v,
        rngSeed: seed.rngSeed,
        placements: seed.placements.map(({ brushId, density, x }) =>
            x === undefined ? { brushId, density } : { brushId, density, x }
        )
    });
}

export function seedCodeToNumber(code: string): number {
    return parseInt(code, 36) >>> 0;
}
