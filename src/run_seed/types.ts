export const RUN_SEED_SCHEMA_VERSION = 1;

export type RunModifier =
    | { kind: 'ng_plus'; tier: number }
    | { kind: 'architect'; brushes: string[] };

export type RunSeed = {
    version: typeof RUN_SEED_SCHEMA_VERSION;
    campaignId: 'campaign';
    rngSeed: number;
    modifiers: RunModifier[];
};
