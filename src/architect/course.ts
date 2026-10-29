/**
 * Architect seed → playable sandbox: one 500–800 m chapter whose
 * `LevelConfig` starts from a campaign twin with every system switched off
 * (the same base Endless chapters use), plus the asteroid stream, plus
 * whatever the brushes switch on. Pure and RNG-free: the same seed always
 * builds the same config, and the run's gameplay streams come from
 * `rngSeed` exactly like any other run.
 *
 * The budget is checked here, not in the UI, so a pasted or tampered seed
 * that skips the Lab is refused at run start too.
 */
import type { Biome, EnvDescriptorKey } from '../env_system_descriptors';
import type { ChapterSpan } from '../journey_layout';
import { LEVEL_CONFIG, type LevelConfig } from '../level_config';
import { BIOME_INSTANCE_CAP, CAMPAIGN_CHAPTER_BIOME, manifestInstances } from '../endless/catalog';
import { baseConfig } from '../endless/generator';
import { BRUSH_IDS, BRUSH_REGISTRY, totalBrushCost, type BrushId, type BrushPlacement } from './brushes';
import { ARCHITECT_MAX_PLACEMENTS, SANDBOX_MAX_LENGTH, SANDBOX_MIN_LENGTH } from './constants';
import { seedCodeToNumber, type ArchitectSeed } from './schema';

/** Campaign chapter the sandbox borrows sky, foliage, speed and music from (Nebula Drift). */
export const SANDBOX_TWIN_CHAPTER = 2;
const SANDBOX_BIOME: Biome = CAMPAIGN_CHAPTER_BIOME[SANDBOX_TWIN_CHAPTER];

/** Systems every sandbox runs before any brush: the base asteroid stream. */
export const SANDBOX_BASE_KEYS: readonly EnvDescriptorKey[] = ['asteroidField'];

/** Cap on summed brush `decorationCost` (the Lab's brush meter). */
export const ARCHITECT_BRUSH_BUDGET = 100;

/** Manifest decoration instances a sandbox may switch on: the twin biome's campaign worst case. */
export const ARCHITECT_INSTANCE_CAP = BIOME_INSTANCE_CAP[SANDBOX_BIOME];

/** Empty sandbox past the last brush, so its effect plays out before the finish. */
const RUN_OUT = 150;

export type CourseBudget = {
    brushCost: number;
    brushCap: number;
    instances: number;
    instanceCap: number;
    /** Why the course may not start; empty when it may. */
    problems: string[];
};

export type SandboxCourse = {
    seed: ArchitectSeed;
    rngSeed: number;
    span: ChapterSpan;
    /** World X of each placement, in placement order. */
    placementX: number[];
    config: LevelConfig;
    budget: CourseBudget;
};

/** Course length: past the furthest pinned brush plus run-out, rounded to 50 m, within 500–800 m. */
export function sandboxLength(placements: readonly BrushPlacement[]): number {
    const furthest = placements.reduce((max, p) => Math.max(max, p.x ?? 0), 0);
    const length = Math.ceil((furthest + RUN_OUT) / 50) * 50;
    return Math.min(SANDBOX_MAX_LENGTH, Math.max(SANDBOX_MIN_LENGTH, length));
}

/** Metres from the start for each placement: its own `x`, or spread evenly among the unpinned ones. */
export function placementOffsets(placements: readonly BrushPlacement[], length: number): number[] {
    const unpinned = placements.filter((p) => p.x === undefined).length;
    let k = 0;
    return placements.map((p) => {
        const x = p.x ?? Math.round((length * ++k) / (unpinned + 1));
        return Math.min(length, Math.max(0, x));
    });
}

/** Distinct env systems a course switches on, base stream included. */
export function courseSystems(placements: readonly BrushPlacement[]): EnvDescriptorKey[] {
    const keys = new Set<EnvDescriptorKey>(SANDBOX_BASE_KEYS);
    for (const p of placements) {
        for (const key of BRUSH_REGISTRY[p.brushId].systems) keys.add(key);
    }
    return [...keys];
}

export function courseBudget(placements: readonly BrushPlacement[]): CourseBudget {
    const brushCost = totalBrushCost(placements);
    const instances = courseSystems(placements).reduce((sum, key) => sum + manifestInstances(key), 0);
    const problems: string[] = [];
    if (placements.length > ARCHITECT_MAX_PLACEMENTS) {
        problems.push(`Too many brushes (${placements.length} / ${ARCHITECT_MAX_PLACEMENTS}).`);
    }
    if (brushCost > ARCHITECT_BRUSH_BUDGET) {
        problems.push(`Brush cost ${brushCost} is over the budget of ${ARCHITECT_BRUSH_BUDGET}.`);
    }
    if (instances > ARCHITECT_INSTANCE_CAP) {
        problems.push(`${instances} decorations are over the cap of ${ARCHITECT_INSTANCE_CAP}.`);
    }
    for (const id of BRUSH_IDS) {
        const max = BRUSH_REGISTRY[id].maxPerCourse;
        const count = placements.filter((p) => p.brushId === id).length;
        if (max !== undefined && count > max) problems.push(`Only ${max} ${BRUSH_REGISTRY[id].label} per course.`);
    }
    return { brushCost, brushCap: ARCHITECT_BRUSH_BUDGET, instances, instanceCap: ARCHITECT_INSTANCE_CAP, problems };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export function buildSandboxCourse(seed: ArchitectSeed): SandboxCourse {
    const twin = LEVEL_CONFIG[SANDBOX_TWIN_CHAPTER];
    const length = sandboxLength(seed.placements);
    const span: ChapterSpan = { startX: 0, endX: length, length };
    const offsets = placementOffsets(seed.placements, length);
    const placementX = offsets.map((x) => span.startX + x);

    const config = baseConfig(twin, `Course ${seed.rngSeed}`, span);
    // Base asteroid stream at the lighter rate Endless uses when asteroids are not the featured hazard.
    config.environments!.asteroidField = { rate: round2((twin.environments?.asteroidField?.rate ?? 2.0) * 0.6) };

    const seen: Partial<Record<BrushId, number>> = {};
    seed.placements.forEach((p, i) => {
        const nth = seen[p.brushId] ?? 0;
        seen[p.brushId] = nth + 1;
        BRUSH_REGISTRY[p.brushId].apply(config, p.density, { x: placementX[i], span, nth });
    });
    config.objective ??= { type: 'survive', target: 1, description: 'Reach the finish flag' };

    return {
        seed,
        rngSeed: seedCodeToNumber(seed.rngSeed),
        span,
        placementX,
        config,
        budget: courseBudget(seed.placements)
    };
}
