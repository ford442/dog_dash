/**
 * Architect courses as runs. A playtest is an ordinary run seed
 * (`campaignId: 'architect'`, the course RNG as `rngSeed`, the placements in
 * an `architect` modifier), so it launches, records ghosts and matches them
 * like any other run. Loaded on demand by `startRun()`; the boot chunk never
 * pulls in zod or the brush table.
 */
import { RUN_SEED_SCHEMA_VERSION, type RunModifier, type RunSeed } from '../run_seed/types';
import type { JourneyLayout } from '../journey_layout';
import { formatEndlessCode } from '../endless/seed';
import { ARCHITECT_SEED_VERSION } from './constants';
import { buildSandboxCourse, type SandboxCourse } from './course';
import { createArchitectLayout } from './layout';
import { seedCodeToNumber, validateArchitectSeed, type ArchitectSeed } from './schema';

type ArchitectModifier = Extract<RunModifier, { kind: 'architect' }>;

export function architectRunSeed(seed: ArchitectSeed): RunSeed {
    return {
        version: RUN_SEED_SCHEMA_VERSION,
        campaignId: 'architect',
        rngSeed: seedCodeToNumber(seed.rngSeed),
        modifiers: [{ kind: 'architect', placements: seed.placements.map((p) => ({ ...p })) }]
    };
}

export type ArchitectRunResolution =
    | { ok: true; course: SandboxCourse }
    | { ok: false; reason: string };

/**
 * The course an architect run seed describes, checked as strictly as a
 * pasted seed: schema first, then the budget. Fails closed with a reason
 * the HUD can show.
 */
export function resolveArchitectRun(run: RunSeed): ArchitectRunResolution {
    const mods = run.modifiers.filter((m): m is ArchitectModifier => m.kind === 'architect');
    if (run.campaignId !== 'architect' || mods.length !== 1) {
        return { ok: false, reason: 'This run seed has no Architect course in it.' };
    }
    const parsed = validateArchitectSeed({
        v: ARCHITECT_SEED_VERSION,
        rngSeed: formatEndlessCode(run.rngSeed),
        placements: mods[0].placements
    });
    if (!parsed.ok) return { ok: false, reason: `Course seed is invalid — ${parsed.errors[0]}` };
    const course = buildSandboxCourse(parsed.seed);
    if (course.budget.problems.length > 0) {
        return { ok: false, reason: `Course is over budget — ${course.budget.problems[0]}` };
    }
    return { ok: true, course };
}

/** Layout for a run seed `resolveArchitectRun` accepts. Throws on any other: callers resolve first. */
export function createArchitectRunLayout(run: RunSeed): JourneyLayout {
    const resolved = resolveArchitectRun(run);
    if (!resolved.ok) throw new Error(`[architect] ${resolved.reason}`);
    return createArchitectLayout(resolved.course);
}
