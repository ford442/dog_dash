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
    | { kind: 'architect'; placements: ArchitectPlacementSeed[] }
    | { kind: 'lost_sector'; sectorId: string };

/**
 * `'endless'` runs fly the Endless Dash chapter sequence generated from `rngSeed` (src/endless/).
 * `'architect'` runs fly the Architect Lab sandbox described by their `architect` modifier (src/architect/).
 * `'lost'` runs fly the authored Lost Sector named by their `lost_sector` modifier (src/lost_sector/).
 */
export type RunCampaignId = 'campaign' | 'endless' | 'architect' | 'lost';

export type RunSeed = {
    version: typeof RUN_SEED_SCHEMA_VERSION;
    campaignId: RunCampaignId;
    rngSeed: number;
    modifiers: RunModifier[];
};
