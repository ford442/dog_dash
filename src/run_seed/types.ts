export const RUN_SEED_SCHEMA_VERSION = 1;

/**
 * One brush on an Architect Lab course, as a run seed carries it. The boot
 * path only checks the shape loosely (`codec.ts`); `src/architect/schema.ts`
 * validates it fully before the course is built.
 */
export type ArchitectPlacementSeed = {
    brushId: string;
    density: number;
    x?: number;
};

export type RunModifier =
    | { kind: 'ng_plus'; tier: number }
    | { kind: 'architect'; placements: ArchitectPlacementSeed[] };

/**
 * `'endless'` runs fly the Endless Dash chapter sequence generated from `rngSeed` (src/endless/).
 * `'architect'` runs fly the Architect Lab sandbox described by their `architect` modifier (src/architect/).
 */
export type RunCampaignId = 'campaign' | 'endless' | 'architect';

export type RunSeed = {
    version: typeof RUN_SEED_SCHEMA_VERSION;
    campaignId: RunCampaignId;
    rngSeed: number;
    modifiers: RunModifier[];
};
