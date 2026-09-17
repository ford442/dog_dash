/**
 * Queryable env-system metadata for Endless Dash / architect brushes.
 *
 * Deferred env flags are declared once in `ENV_SYSTEM_MANIFEST` via
 * `defineEnvSystem` (load + budget + biome/role tags). This table merges
 * those fields with descriptors for deferred-level and eager systems that
 * are not on the env manifest.
 */
import type { SystemKey } from './level_deferred_registry';
import { ENV_SYSTEM_MANIFEST } from './level_manager/env_manifest';
import type { Biome, EnvRole, PaletteTag, EnvSystemDescriptorFields } from './level_manager/define_env_system';

export type { Biome, EnvRole, PaletteTag };

/** `butterflySwarm` is eager (bootstrap-owned, no dynamic import) so it has no `SystemKey`. */
export type EnvDescriptorKey = SystemKey | 'butterflySwarm' | 'clouds' | 'fossilizedSpaceWhales';

export interface EnvSystemDescriptor extends EnvSystemDescriptorFields {
    readonly key: EnvDescriptorKey;
}

/** Metadata-only helper for systems that are not deferred env flags. */
function defineEnvDescriptor(descriptor: EnvSystemDescriptor): EnvSystemDescriptor {
    return descriptor;
}

function descriptorsFromManifest(): Record<string, EnvSystemDescriptor> {
    const table: Record<string, EnvSystemDescriptor> = {};
    for (const entry of ENV_SYSTEM_MANIFEST) {
        table[entry.flag] = {
            key: entry.flag,
            label: entry.label,
            role: entry.role,
            biomes: entry.biomes,
            paletteTags: entry.paletteTags,
            difficultyWeight: entry.difficultyWeight,
            tutorialId: entry.tutorialId
        };
    }
    return table;
}

const MANIFEST_DESCRIPTORS = descriptorsFromManifest();

const LEVEL_AND_EAGER_DESCRIPTORS = {
    boss: defineEnvDescriptor({
        key: 'boss',
        label: 'Boss',
        role: 'boss',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
        paletteTags: ['monochrome', 'warm'],
        difficultyWeight: 5
    }),
    chromaShift: defineEnvDescriptor({
        key: 'chromaShift',
        label: 'Chroma Shift',
        role: 'hazard',
        biomes: ['nebula'],
        paletteTags: ['neon'],
        difficultyWeight: 3
    }),
    stormGeode: defineEnvDescriptor({
        key: 'stormGeode',
        label: 'Storm Geode',
        role: 'hazard',
        biomes: ['nebula', 'industrial', 'biological'],
        paletteTags: ['warm', 'monochrome'],
        difficultyWeight: 3
    }),
    industrialGeometry: defineEnvDescriptor({
        key: 'industrialGeometry',
        label: 'Industrial Geometry',
        role: 'hazard',
        biomes: ['industrial', 'biological'],
        paletteTags: ['warm', 'monochrome'],
        difficultyWeight: 3
    }),
    starlightKoi: defineEnvDescriptor({
        key: 'starlightKoi',
        label: 'Starlight Koi',
        role: 'flavor',
        biomes: ['biological', 'crystalline'],
        paletteTags: ['iridescent', 'cool'],
        difficultyWeight: 1
    }),
    bubbleCoral: defineEnvDescriptor({
        key: 'bubbleCoral',
        label: 'Rainbow Bubble Coral',
        role: 'flavor',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline'],
        paletteTags: ['iridescent', 'pastel'],
        difficultyWeight: 1
    }),
    slingables: defineEnvDescriptor({
        key: 'slingables',
        label: 'Slingable Objects',
        role: 'traversal',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline'],
        paletteTags: ['neon', 'warm'],
        difficultyWeight: 2
    }),
    liquidMetal: defineEnvDescriptor({
        key: 'liquidMetal',
        label: 'Liquid Metal',
        role: 'flavor',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
        paletteTags: ['monochrome', 'iridescent'],
        difficultyWeight: 1
    }),
    crystalChimes: defineEnvDescriptor({
        key: 'crystalChimes',
        label: 'Crystal Chimes',
        role: 'flavor',
        biomes: ['nebula', 'industrial', 'biological'],
        paletteTags: ['cool', 'iridescent'],
        difficultyWeight: 1
    }),
    gravLens: defineEnvDescriptor({
        key: 'gravLens',
        label: 'Grav Lens',
        role: 'traversal',
        biomes: ['nebula'],
        paletteTags: ['cool', 'monochrome'],
        difficultyWeight: 3
    }),
    derelictBuoys: defineEnvDescriptor({
        key: 'derelictBuoys',
        label: 'Derelict Buoys',
        role: 'flavor',
        biomes: ['industrial', 'biological'],
        paletteTags: ['warm', 'monochrome'],
        difficultyWeight: 2
    }),
    dataMonoliths: defineEnvDescriptor({
        key: 'dataMonoliths',
        label: 'Data Monoliths',
        role: 'flavor',
        biomes: ['industrial', 'biological'],
        paletteTags: ['cool', 'monochrome'],
        difficultyWeight: 2
    }),
    magicPaintbrush: defineEnvDescriptor({
        key: 'magicPaintbrush',
        label: 'Magic Paintbrush',
        role: 'flavor',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
        paletteTags: ['pastel', 'neon'],
        difficultyWeight: 1
    }),
    clouds: defineEnvDescriptor({
        key: 'clouds',
        label: 'Multi-Layered Cloudscapes',
        role: 'backdrop',
        biomes: ['candy', 'nebula'],
        paletteTags: ['cool', 'pastel'],
        difficultyWeight: 1
    }),
    butterflySwarm: defineEnvDescriptor({
        key: 'butterflySwarm',
        label: 'Butterfly Swarm',
        role: 'flavor',
        biomes: ['nebula', 'industrial', 'biological', 'crystalline', 'candy'],
        paletteTags: ['pastel'],
        difficultyWeight: 1
    })
} as const satisfies Record<string, EnvSystemDescriptor>;

export const ENV_SYSTEM_DESCRIPTORS: Record<EnvDescriptorKey, EnvSystemDescriptor> = {
    ...MANIFEST_DESCRIPTORS,
    ...LEVEL_AND_EAGER_DESCRIPTORS
} as Record<EnvDescriptorKey, EnvSystemDescriptor>;

type DescriptorKeys = keyof typeof ENV_SYSTEM_DESCRIPTORS;
type AssertDescriptorCoverage = Exclude<EnvDescriptorKey, DescriptorKeys> extends never
    ? Exclude<DescriptorKeys, EnvDescriptorKey> extends never
        ? true
        : never
    : never;
const _descriptorCoverage: AssertDescriptorCoverage = true;
void _descriptorCoverage;

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
