/**
 * Architect Lab editor state: the course being painted, its live budget,
 * export / import of the seed JSON and the playtest run seed. Constructed
 * only when the Lab opens (hub_screen → dynamic import of hub_tab); nothing
 * here touches `GameContext`.
 *
 * The draft survives reloads (a playtest is a reload) in localStorage. A
 * stored draft goes through the same schema as a pasted seed, so a corrupt
 * or stale one is dropped, not trusted.
 */
import type { RunSeed } from '../run_seed/types';
import { formatEndlessCode } from '../endless/seed';
import { BRUSH_REGISTRY, type BrushId, type BrushPlacement } from './brushes';
import { ARCHITECT_MAX_PLACEMENTS, ARCHITECT_SEED_VERSION, SANDBOX_MAX_LENGTH } from './constants';
import { buildSandboxCourse, sandboxLength, type SandboxCourse } from './course';
import { parseArchitectSeed, serializeArchitectSeed, type ArchitectSeed } from './schema';
import { architectRunSeed } from './run';

const DRAFT_KEY = 'dog_dash_architect_draft';

/** Gap between a new brush and the furthest one already placed. */
const PLACE_STEP = 100;
const FIRST_X = 80;

/** Picking a seed is UI, not gameplay: the run itself is seeded from it. */
function randomSeedCode(): string {
    const [value] = crypto.getRandomValues(new Uint32Array(1));
    return formatEndlessCode(value);
}

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

export type ImportResult = { ok: true } | { ok: false; errors: string[] };

export type AddResult = { ok: true; index: number } | { ok: false; reason: string };

export class ArchitectManager {
    private rngSeed: string;
    private placements: BrushPlacement[];
    private readonly storage: Storage | null;

    constructor(storage: Storage | null = ArchitectManager.defaultStorage()) {
        this.storage = storage;
        const draft = this.loadDraft();
        this.rngSeed = draft?.rngSeed ?? randomSeedCode();
        this.placements = draft?.placements ?? [];
    }

    private static defaultStorage(): Storage | null {
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch {
            return null;
        }
    }

    get seed(): ArchitectSeed {
        return {
            v: ARCHITECT_SEED_VERSION,
            rngSeed: this.rngSeed,
            placements: this.placements.map((p) => ({ ...p }))
        };
    }

    /** The sandbox as it would fly right now, with its live budget. */
    get course(): SandboxCourse {
        return buildSandboxCourse(this.seed);
    }

    get count(): number {
        return this.placements.length;
    }

    placement(index: number): BrushPlacement | undefined {
        const p = this.placements[index];
        return p ? { ...p } : undefined;
    }

    /** Why `brushId` cannot be added right now, or null when it can. */
    cannotAdd(brushId: BrushId): string | null {
        if (this.placements.length >= ARCHITECT_MAX_PLACEMENTS) {
            return `The course is full (${ARCHITECT_MAX_PLACEMENTS} brushes).`;
        }
        const def = BRUSH_REGISTRY[brushId];
        const max = def.maxPerCourse;
        if (max !== undefined && this.placements.filter((p) => p.brushId === brushId).length >= max) {
            return `Only ${max} ${def.label} per course.`;
        }
        return null;
    }

    /** Adds a brush just past the furthest one (anchored brushes need a spot of their own). */
    add(brushId: BrushId, density = 0.5): AddResult {
        const reason = this.cannotAdd(brushId);
        if (reason) return { ok: false, reason };
        const furthest = this.placements.reduce((max, p) => Math.max(max, p.x ?? 0), -Infinity);
        const x = Number.isFinite(furthest) ? Math.min(SANDBOX_MAX_LENGTH - 50, furthest + PLACE_STEP) : FIRST_X;
        this.placements.push({ brushId, density: clamp(density, 0, 1), x });
        this.saveDraft();
        return { ok: true, index: this.placements.length - 1 };
    }

    remove(index: number): void {
        if (index < 0 || index >= this.placements.length) return;
        this.placements.splice(index, 1);
        this.saveDraft();
    }

    setX(index: number, x: number): void {
        const p = this.placements[index];
        if (!p || !Number.isFinite(x)) return;
        p.x = Math.round(clamp(x, 0, SANDBOX_MAX_LENGTH));
        this.saveDraft();
    }

    setDensity(index: number, density: number): void {
        const p = this.placements[index];
        if (!p || !Number.isFinite(density)) return;
        p.density = Math.round(clamp(density, 0, 1) * 100) / 100;
        this.saveDraft();
    }

    /** New course RNG: same brushes, different asteroid / spawn rolls. */
    rerollSeed(): void {
        this.rngSeed = randomSeedCode();
        this.saveDraft();
    }

    clear(): void {
        this.placements = [];
        this.saveDraft();
    }

    /** Course length the current brushes produce. */
    get length(): number {
        return sandboxLength(this.placements);
    }

    exportText(): string {
        return serializeArchitectSeed(this.seed);
    }

    /** Replaces the course with pasted seed text. Invalid text changes nothing (fails closed). */
    importText(text: string): ImportResult {
        const parsed = parseArchitectSeed(text.trim());
        if (!parsed.ok) return parsed;
        this.rngSeed = parsed.seed.rngSeed;
        this.placements = parsed.seed.placements;
        this.saveDraft();
        return { ok: true };
    }

    /** Run seed for a playtest, or the first reason the course may not start. */
    playtest(): { ok: true; run: RunSeed } | { ok: false; reason: string } {
        if (this.placements.length === 0) return { ok: false, reason: 'Add a brush to the course first.' };
        const { budget } = this.course;
        if (budget.problems.length > 0) return { ok: false, reason: budget.problems[0] };
        return { ok: true, run: architectRunSeed(this.seed) };
    }

    private loadDraft(): ArchitectSeed | null {
        if (!this.storage) return null;
        try {
            const raw = this.storage.getItem(DRAFT_KEY);
            if (raw === null) return null;
            const parsed = parseArchitectSeed(raw);
            if (parsed.ok) return parsed.seed;
            this.storage.removeItem(DRAFT_KEY);
        } catch {
            // Private mode / blocked storage: start a fresh course.
        }
        return null;
    }

    private saveDraft(): void {
        if (!this.storage) return;
        try {
            this.storage.setItem(DRAFT_KEY, this.exportText());
        } catch {
            // Storage full or blocked: the draft just won't survive a reload.
        }
    }
}
