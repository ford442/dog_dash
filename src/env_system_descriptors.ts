/**
 * Self-registering metadata for every level-environment system in the game.
 *
 * This is the machine-readable counterpart to `level_env_registry.ts` /
 * `level_deferred_registry.ts`: those two files answer "how do I load and
 * activate system X", this one answers "where does system X belong" —
 * which biome(s) it reads coherently in, what role it plays in a chapter
 * (backdrop / traversal / hazard / flavor / boss), its rough palette, and
 * how much it contributes to per-chapter difficulty.
 *
 * Every system already has exactly one declaration site — its entry in
 * `DEFERRED_ENV_REGISTRY` or `DEFERRED_LEVEL_REGISTRY` — so descriptors are
 * declared once here, in the same order, rather than requiring an edit to
 * ~40 separate implementation modules for metadata that has nothing to do
 * with how those modules render. `defineEnvSystem()` is the registration
 * call each system "declares" itself with; `ENV_SYSTEM_DESCRIPTORS` is the
 * queryable table a future generator (Endless Dash) reads instead of
 * hand-cross-referencing `LEVEL_CONFIG` across 6 levels.
 *
 * Keep in sync with `DEFERRED_ENV_FLAGS`, `EAGER_ENV_FLAGS`, and
 * `DEFERRED_LEVEL_SYSTEM_KEYS` in `level_deferred_registry.ts` — the
 * compile-time assertion below fails the build if a key is added to either
 * side without a matching update to the other. `tests/unit/env_system_descriptors.test.ts`
 * runtime-checks the same invariant plus descriptor field sanity.
 */
import type { SystemKey } from './level_deferred_registry';

/** Recipe biomes a generated Endless Dash chapter can draw from (see issue: Endless Dash). */
export type Biome = 'nebula' | 'industrial' | 'biological' | 'crystalline' | 'candy';

/** The slot a system fills inside a `ChapterRecipe`. */
export type EnvRole = 'backdrop' | 'traversal' | 'hazard' | 'flavor' | 'boss';

/**
 * Coarse visual-coherence tags. A generator should avoid stacking backdrops
 * whose tag sets don't overlap (e.g. `pastel` + `neon` reads as "fighting").
 * Deliberately coarse — this is a coherence heuristic, not a color system.
 */
export type PaletteTag = 'warm' | 'cool' | 'pastel' | 'neon' | 'iridescent' | 'monochrome';

/** `butterflySwarm` is eager (bootstrap-owned, no dynamic import) so it has no `SystemKey`. */
export type EnvDescriptorKey = SystemKey | 'butterflySwarm';

export interface EnvSystemDescriptor {
    /** Matches the key this descriptor is registered under in `ENV_SYSTEM_DESCRIPTORS`. */
    readonly key: EnvDescriptorKey;
    /** Human label for debug UI / generator logs. */
    readonly label: string;
    readonly role: EnvRole;
    /** Biomes this system reads coherently in. Order carries no meaning. */
    readonly biomes: readonly Biome[];
    readonly paletteTags: readonly PaletteTag[];
    /** Relative contribution to per-chapter difficulty: 1 lightest .. 5 heaviest. */
    readonly difficultyWeight: 1 | 2 | 3 | 4 | 5;
    /**
     * `tutorial_system` step id that must have been shown before this system
     * can appear in a generated chapter. Omitted where no gating tutorial
     * exists yet — left for a future pass once Endless Dash actually
     * consumes it (see issue: Endless Dash — "a traversal system the player
     * has been taught").
     */
    readonly tutorialId?: string;
}

/** Identity registration call — each system "declares" its descriptor through this. */
function defineEnvSystem(descriptor: EnvSystemDescriptor): EnvSystemDescriptor {
    return descriptor;
}

// ---------------------------------------------------------------------------
// Deferred env-flag systems (mirrors DEFERRED_ENV_FLAGS order in level_deferred_registry.ts)
// ---------------------------------------------------------------------------

export const ENV_SYSTEM_DESCRIPTORS: Record<EnvDescriptorKey, EnvSystemDescriptor> = {
    skyRailTerminal: defineEnvSystem({
        key: 'skyRailTerminal',
        label: 'Sky Rail Terminal',
        role: 'traversal',
        biomes: ['industrial'],
        paletteTags: ['cool'],
        difficultyWeight: 2
    }),
    candyPlanetRing: defineEnvSystem({
        key: 'candyPlanetRing',
        label: 'Candy Planet Ring',
        role: 'backdrop',
        biomes: ['candy', 'nebula'],
        paletteTags: ['pastel', 'neon'],
        difficultyWeight: 1
    }),
    blackHole: defineEnvSystem({
        key: 'blackHole',
        label: 'Black Hole',
        role: 'hazard',
        biomes: ['nebula'],
        paletteTags: ['monochrome', 'cool'],
        difficultyWeight: 4
    }),
    industrial: defineEnvSystem({
        key: 'industrial',
        label: 'Industrial Background',
        role: 'backdrop',
        biomes: ['industrial'],
        paletteTags: ['warm', 'monochrome'],
        difficultyWeight: 1
    }),
    waterfall: defineEnvSystem({
        key: 'waterfall',
        label: 'Waterfall',
        role: 'backdrop',
        biomes: ['crystalline'],
        paletteTags: ['cool'],
        difficultyWeight: 1
    }),
    biological: defineEnvSystem({
        key: 'biological',
        label: 'Biological Background',
        role: 'backdrop',
        biomes: ['biological'],
        paletteTags: ['iridescent', 'cool'],
        difficultyWeight: 1
    }),
    cosmicDust: defineEnvSystem({
        key: 'cosmicDust',
        label: 'Cosmic Dust',
        role: 'backdrop',
        biomes: ['nebula', 'biological'],
        paletteTags: ['cool', 'iridescent'],
        difficultyWeight: 1
    }),
    moonPalace: defineEnvSystem({
        key: 'moonPalace',
        label: 'Moon Palace',
        role: 'backdrop',
        biomes: ['crystalline'],
        paletteTags: ['cool', 'monochrome'],
        difficultyWeight: 1
    }),
    planetaryHorizon: defineEnvSystem({
        key: 'planetaryHorizon',
        label: 'Planetary Horizon',
        role: 'backdrop',
        biomes: ['nebula'],
        paletteTags: ['warm', 'cool'],
        difficultyWeight: 1
    }),
    reEntry: defineEnvSystem({
        key: 'reEntry',
        label: 'Re-Entry',
        role: 'hazard',
        biomes: ['nebula'],
        paletteTags: ['warm'],
        difficultyWeight: 3
    }),
    aquaticLife: defineEnvSystem({
        key: 'aquaticLife',
        label: 'Aquatic Life',
        role: 'flavor',
        biomes: ['crystalline'],
        paletteTags: ['cool'],
        difficultyWeight: 1
    }),
    ghostDebris: defineEnvSystem({
        key: 'ghostDebris',
        label: 'Ghost Debris',
        role: 'hazard',
        biomes: ['nebula'],
        paletteTags: ['monochrome', 'cool'],
        difficultyWeight: 3
    }),
    voidJellyfish: defineEnvSystem({
        key: 'voidJellyfish',
        label: 'Void Jellyfish',
        role: 'flavor',
        biomes: ['biological', 'crystalline'],
        paletteTags: ['iridescent', 'cool'],
        difficultyWeight: 1
    }),
    meteorShower: defineEnvSystem({
        key: 'meteorShower',
        label: 'Meteor Shower',
        role: 'hazard',
        biomes: ['nebula'],
        paletteTags: ['warm'],
        difficultyWeight: 3
    }),
    wishLanterns: defineEnvSystem({
        key: 'wishLanterns',
        label: 'Wish Lanterns',
        role: 'flavor',
        biomes: ['candy'],
        paletteTags: ['warm', 'pastel'],
        difficultyWeight: 1
    }),
    dancingJellyMoss: defineEnvSystem({
        key: 'dancingJellyMoss',
        label: 'Dancing Jelly Moss',
        role: 'flavor',
        biomes: ['candy', 'biological'],
        paletteTags: ['iridescent', 'pastel'],
        difficultyWeight: 1
    }),
    spacePetsSwarm: defineEnvSystem({
        key: 'spacePetsSwarm',
        label: 'Space Pets Swarm',
        role: 'flavor',
        biomes: ['candy'],
        paletteTags: ['pastel'],
        difficultyWeight: 1
    }),
    weather: defineEnvSystem({
        key: 'weather',
        label: 'Weather',
        role: 'backdrop',
        biomes: ['crystalline'],
        paletteTags: ['cool', 'monochrome'],
        difficultyWeight: 2
    }),
    dynamicStarfield: defineEnvSystem({
        key: 'dynamicStarfield',
        label: 'Dynamic Starfield',
        role: 'backdrop',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
        paletteTags: ['monochrome', 'cool'],
        difficultyWeight: 1
    }),
    dayNightCycle: defineEnvSystem({
        key: 'dayNightCycle',
        label: 'Day/Night Cycle',
        role: 'backdrop',
        biomes: ['candy'],
        paletteTags: ['warm', 'cool'],
        difficultyWeight: 1
    }),
    galacticCore: defineEnvSystem({
        key: 'galacticCore',
        label: 'Galactic Core',
        role: 'backdrop',
        biomes: ['crystalline'],
        paletteTags: ['warm', 'iridescent'],
        difficultyWeight: 2
    }),
    dreamPortals: defineEnvSystem({
        key: 'dreamPortals',
        label: 'Dream Portals',
        role: 'flavor',
        biomes: ['candy', 'nebula', 'crystalline'],
        paletteTags: ['iridescent', 'pastel'],
        difficultyWeight: 1
    }),
    singingGeodes: defineEnvSystem({
        key: 'singingGeodes',
        label: 'Singing Geodes',
        role: 'flavor',
        biomes: ['biological', 'crystalline'],
        paletteTags: ['cool', 'iridescent'],
        difficultyWeight: 1
    }),
    cloudCastles: defineEnvSystem({
        key: 'cloudCastles',
        label: 'Cloud Castles',
        role: 'flavor',
        biomes: ['candy', 'biological'],
        paletteTags: ['pastel'],
        difficultyWeight: 1
    }),
    grappleIsles: defineEnvSystem({
        key: 'grappleIsles',
        label: 'Grapple Isles',
        role: 'traversal',
        biomes: ['candy'],
        paletteTags: ['pastel', 'neon'],
        difficultyWeight: 2
    }),
    windCurrents: defineEnvSystem({
        key: 'windCurrents',
        label: 'Wind Currents',
        role: 'traversal',
        biomes: ['nebula'],
        paletteTags: ['cool'],
        difficultyWeight: 2
    }),
    timeShiftZones: defineEnvSystem({
        key: 'timeShiftZones',
        label: 'Time Shift Zones',
        role: 'traversal',
        biomes: ['industrial'],
        paletteTags: ['neon', 'cool'],
        difficultyWeight: 3
    }),
    flowerConstellations: defineEnvSystem({
        key: 'flowerConstellations',
        label: 'Flower Constellations',
        role: 'flavor',
        biomes: ['candy', 'nebula'],
        paletteTags: ['pastel', 'neon'],
        difficultyWeight: 1
    }),
    bouncePads: defineEnvSystem({
        key: 'bouncePads',
        label: 'Bounce Pads',
        role: 'traversal',
        biomes: ['industrial'],
        paletteTags: ['neon', 'warm'],
        difficultyWeight: 2
    }),
    spaceGarden: defineEnvSystem({
        key: 'spaceGarden',
        label: 'Space Garden',
        role: 'flavor',
        biomes: ['candy'],
        paletteTags: ['pastel'],
        difficultyWeight: 1
    }),
    comboCorridor: defineEnvSystem({
        key: 'comboCorridor',
        label: 'Combo Corridor',
        role: 'traversal',
        biomes: ['industrial', 'biological'],
        paletteTags: ['neon'],
        difficultyWeight: 2
    }),
    aerialGuardPatrol: defineEnvSystem({
        key: 'aerialGuardPatrol',
        label: 'Aerial Guard Patrol',
        role: 'hazard',
        biomes: ['industrial'],
        paletteTags: ['monochrome', 'warm'],
        difficultyWeight: 3
    }),
    airTokens: defineEnvSystem({
        key: 'airTokens',
        label: 'Air Tokens',
        role: 'traversal',
        biomes: ['candy'],
        paletteTags: ['neon', 'pastel'],
        difficultyWeight: 2
    }),
    shootingStars: defineEnvSystem({
        key: 'shootingStars',
        label: 'Shooting Stars',
        role: 'flavor',
        biomes: ['candy', 'nebula'],
        paletteTags: ['warm', 'neon'],
        difficultyWeight: 1
    }),
    pastelNebula: defineEnvSystem({
        key: 'pastelNebula',
        label: 'Pastel Nebula',
        role: 'backdrop',
        biomes: ['candy'],
        paletteTags: ['pastel'],
        difficultyWeight: 1
    }),
    nebula: defineEnvSystem({
        key: 'nebula',
        label: 'Nebula',
        role: 'backdrop',
        biomes: ['nebula', 'biological'],
        paletteTags: ['cool', 'iridescent'],
        difficultyWeight: 1
    }),
    nebulaRibbons: defineEnvSystem({
        key: 'nebulaRibbons',
        label: 'Nebula Ribbons',
        role: 'backdrop',
        biomes: ['nebula', 'biological', 'crystalline'],
        paletteTags: ['cool', 'iridescent'],
        difficultyWeight: 1
    }),
    godRays: defineEnvSystem({
        key: 'godRays',
        label: 'God Rays',
        role: 'backdrop',
        biomes: ['candy', 'nebula', 'biological'],
        paletteTags: ['warm'],
        difficultyWeight: 1
    }),
    aurora: defineEnvSystem({
        key: 'aurora',
        label: 'Aurora',
        role: 'backdrop',
        biomes: ['crystalline'],
        paletteTags: ['cool', 'iridescent'],
        difficultyWeight: 1
    }),
    lightning: defineEnvSystem({
        key: 'lightning',
        label: 'Lightning',
        role: 'hazard',
        biomes: ['candy', 'nebula', 'biological'],
        paletteTags: ['monochrome', 'neon'],
        difficultyWeight: 2
    }),
    asteroidField: defineEnvSystem({
        key: 'asteroidField',
        label: 'Asteroid Field',
        role: 'hazard',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
        paletteTags: ['monochrome', 'warm'],
        difficultyWeight: 2
    }),
    candyField: defineEnvSystem({
        key: 'candyField',
        label: 'Candy Field',
        role: 'backdrop',
        biomes: ['candy', 'nebula'],
        paletteTags: ['pastel', 'neon'],
        difficultyWeight: 1
    }),

    // -----------------------------------------------------------------------
    // Non-env deferred systems (density / objective / spawn-rule driven —
    // DEFERRED_LEVEL_SYSTEM_KEYS in level_deferred_registry.ts)
    // -----------------------------------------------------------------------

    boss: defineEnvSystem({
        key: 'boss',
        label: 'Boss',
        role: 'boss',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
        paletteTags: ['monochrome', 'warm'],
        difficultyWeight: 5
    }),
    chromaShift: defineEnvSystem({
        key: 'chromaShift',
        label: 'Chroma Shift',
        role: 'hazard',
        biomes: ['nebula'],
        paletteTags: ['neon'],
        difficultyWeight: 3
    }),
    stormGeode: defineEnvSystem({
        key: 'stormGeode',
        label: 'Storm Geode',
        role: 'hazard',
        biomes: ['nebula', 'industrial', 'biological'],
        paletteTags: ['warm', 'monochrome'],
        difficultyWeight: 3
    }),
    industrialGeometry: defineEnvSystem({
        key: 'industrialGeometry',
        label: 'Industrial Geometry',
        role: 'hazard',
        biomes: ['industrial', 'biological'],
        paletteTags: ['warm', 'monochrome'],
        difficultyWeight: 3
    }),
    starlightKoi: defineEnvSystem({
        key: 'starlightKoi',
        label: 'Starlight Koi',
        role: 'flavor',
        biomes: ['biological', 'crystalline'],
        paletteTags: ['iridescent', 'cool'],
        difficultyWeight: 1
    }),
    bubbleCoral: defineEnvSystem({
        key: 'bubbleCoral',
        label: 'Rainbow Bubble Coral',
        role: 'flavor',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline'],
        paletteTags: ['iridescent', 'pastel'],
        difficultyWeight: 1
    }),
    slingables: defineEnvSystem({
        key: 'slingables',
        label: 'Slingable Objects',
        role: 'traversal',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline'],
        paletteTags: ['neon', 'warm'],
        difficultyWeight: 2
    }),
    liquidMetal: defineEnvSystem({
        key: 'liquidMetal',
        label: 'Liquid Metal',
        role: 'flavor',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
        paletteTags: ['monochrome', 'iridescent'],
        difficultyWeight: 1
    }),
    crystalChimes: defineEnvSystem({
        key: 'crystalChimes',
        label: 'Crystal Chimes',
        role: 'flavor',
        biomes: ['nebula', 'industrial', 'biological'],
        paletteTags: ['cool', 'iridescent'],
        difficultyWeight: 1
    }),
    gravLens: defineEnvSystem({
        key: 'gravLens',
        label: 'Grav Lens',
        role: 'traversal',
        biomes: ['nebula'],
        paletteTags: ['cool', 'monochrome'],
        difficultyWeight: 3
    }),
    derelictBuoys: defineEnvSystem({
        key: 'derelictBuoys',
        label: 'Derelict Buoys',
        role: 'flavor',
        biomes: ['industrial', 'biological'],
        paletteTags: ['warm', 'monochrome'],
        difficultyWeight: 2
    }),
    dataMonoliths: defineEnvSystem({
        key: 'dataMonoliths',
        label: 'Data Monoliths',
        role: 'flavor',
        biomes: ['industrial', 'biological'],
        paletteTags: ['cool', 'monochrome'],
        difficultyWeight: 2
    }),
    magicPaintbrush: defineEnvSystem({
        key: 'magicPaintbrush',
        label: 'Magic Paintbrush',
        role: 'flavor',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
        paletteTags: ['pastel', 'neon'],
        difficultyWeight: 1
    }),

    // -----------------------------------------------------------------------
    // Eager (bootstrap-owned) systems
    // -----------------------------------------------------------------------

    butterflySwarm: defineEnvSystem({
        key: 'butterflySwarm',
        label: 'Butterfly Swarm',
        role: 'flavor',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
        paletteTags: ['pastel'],
        difficultyWeight: 1
    })
};

// Compile-time: descriptor keys must exactly match EnvDescriptorKey.
type DescriptorKeys = keyof typeof ENV_SYSTEM_DESCRIPTORS;
type AssertDescriptorCoverage = Exclude<EnvDescriptorKey, DescriptorKeys> extends never
    ? Exclude<DescriptorKeys, EnvDescriptorKey> extends never
        ? true
        : never
    : never;
const _descriptorCoverage: AssertDescriptorCoverage = true;
void _descriptorCoverage;

// ---------------------------------------------------------------------------
// Query API
// ---------------------------------------------------------------------------

export function getEnvSystemDescriptor(key: EnvDescriptorKey): EnvSystemDescriptor {
    return ENV_SYSTEM_DESCRIPTORS[key];
}

export function allEnvSystemDescriptors(): EnvSystemDescriptor[] {
    return Object.values(ENV_SYSTEM_DESCRIPTORS);
}

export function envSystemsForBiome(biome: Biome): EnvSystemDescriptor[] {
    return allEnvSystemDescriptors().filter((d) => d.biomes.includes(biome));
}

export function envSystemsForRole(role: EnvRole): EnvSystemDescriptor[] {
    return allEnvSystemDescriptors().filter((d) => d.role === role);
}

export function envSystemsForRoleInBiome(role: EnvRole, biome: Biome): EnvSystemDescriptor[] {
    return allEnvSystemDescriptors().filter((d) => d.role === role && d.biomes.includes(biome));
}
