/**
 * Resource Inventory — Plasma Caster crafting materials (Phase A foundation).
 *
 * Materials drop from scan / destroy / sling events on tagged flora & geology,
 * persist via SaveManager, and surface on the HUD as a "Resource Pop".
 */

/** Crafting material ids matching docs/plans/plan.md §VI economy. */
export type MaterialId =
    | 'luminousDust'
    | 'pureExtract'
    | 'taintedExtract'
    | 'pyroclastOre'
    | 'voidGem'
    | 'quantumSeed'
    | 'frostHeart'
    | 'magmaCore'
    | 'architectKey';

/** How a resource was obtained — drives drop-table selection. */
export type HarvestEvent = 'destroy' | 'scan' | 'sling';

export type MaterialRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface MaterialMeta {
    id: MaterialId;
    name: string;
    /** CSS / juice color for Resource Pop. */
    color: string;
    rarity: MaterialRarity;
}

/** Bag of craft materials persisted in save data. */
export type ResourceInventory = Record<MaterialId, number>;

export interface MaterialGrant {
    id: MaterialId;
    amount: number;
}

export interface HarvestOptions {
    /** Precision core shot → Pure Extract; sustained/overload → Tainted. */
    precision?: boolean;
}

interface DropEntry {
    id: MaterialId;
    /** Inclusive min/max grant amount when the roll succeeds. */
    min: number;
    max: number;
    /** 0–1 chance this entry drops (default 1). */
    chance?: number;
}

type EventDropTable = DropEntry[];

/** Per-species drop tables keyed by harvest event. */
const DROP_TABLES: Record<string, Partial<Record<HarvestEvent, EventDropTable>>> = {
    nebulaJellyMoss: {
        destroy: [
            { id: 'taintedExtract', min: 1, max: 2 },
            { id: 'luminousDust', min: 1, max: 3, chance: 0.6 }
        ],
        scan: [
            { id: 'luminousDust', min: 1, max: 1, chance: 0.35 }
        ]
    },
    fern: {
        destroy: [{ id: 'luminousDust', min: 1, max: 2 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.25 }]
    },
    rose: {
        destroy: [{ id: 'luminousDust', min: 1, max: 2 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.25 }]
    },
    lotus: {
        destroy: [{ id: 'luminousDust', min: 1, max: 3 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.3 }]
    },
    glowingFlower: {
        destroy: [{ id: 'luminousDust', min: 1, max: 2 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.3 }]
    },
    tree: {
        destroy: [{ id: 'luminousDust', min: 1, max: 2 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.15 }]
    },
    floweringTree: {
        destroy: [{ id: 'luminousDust', min: 2, max: 3 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.2 }]
    },
    shrub: {
        destroy: [{ id: 'luminousDust', min: 1, max: 1 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.15 }]
    },
    vine: {
        destroy: [{ id: 'luminousDust', min: 1, max: 2 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.2 }]
    },
    mushroom: {
        destroy: [{ id: 'luminousDust', min: 1, max: 2 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.25 }]
    },
    orb: {
        destroy: [{ id: 'luminousDust', min: 1, max: 1 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.2 }]
    },
    pinwheelFlower: {
        destroy: [{ id: 'luminousDust', min: 1, max: 2 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.25 }],
        sling: [{ id: 'luminousDust', min: 1, max: 2 }]
    },
    sporeCloud: {
        destroy: [{ id: 'luminousDust', min: 2, max: 4 }],
        scan: [{ id: 'luminousDust', min: 1, max: 2, chance: 0.5 }]
    },
    vacuumKelp: {
        destroy: [
            { id: 'luminousDust', min: 1, max: 2 },
            { id: 'quantumSeed', min: 1, max: 1, chance: 0.15 }
        ],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.2 }]
    },
    voidRootBall: {
        destroy: [{ id: 'voidGem', min: 1, max: 2 }],
        scan: [{ id: 'voidGem', min: 1, max: 1, chance: 0.2 }]
    },
    magmaHeart: {
        // NOTE: magma hearts have no destruction mechanic yet — destroy table
        // is dormant until one exists; scan still works via DiscoveryManager.
        destroy: [
            { id: 'pyroclastOre', min: 1, max: 3 },
            { id: 'magmaCore', min: 1, max: 1, chance: 0.08 }
        ],
        scan: [{ id: 'pyroclastOre', min: 1, max: 1, chance: 0.25 }]
    },
    iceNeedleCluster: {
        destroy: [{ id: 'frostHeart', min: 1, max: 2 }],
        scan: [{ id: 'frostHeart', min: 1, max: 1, chance: 0.2 }]
    },
    gravityAnchor: {
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.15 }]
    },
    liquidMetalBlob: {
        destroy: [{ id: 'pyroclastOre', min: 1, max: 1 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.15 }]
    },
    // Fractured geodes (not always species-tagged — also keyed by type)
    fracturedGeode: {
        destroy: [
            { id: 'voidGem', min: 2, max: 4 },
            // Legendary jackpot — the only Architect Key source (crafts the chapter unlock).
            { id: 'architectKey', min: 1, max: 1, chance: 0.03 }
        ]
    },
    // Slingable kinds used as fallback when speciesId is absent
    puffball: {
        sling: [{ id: 'luminousDust', min: 1, max: 2 }]
    },
    chromaRock: {
        sling: [{ id: 'pyroclastOre', min: 1, max: 1, chance: 0.5 }]
    },
    wreckingBall: {
        sling: [{ id: 'pyroclastOre', min: 1, max: 2, chance: 0.4 }]
    },
    toyRocketWreck: {
        destroy: [{ id: 'luminousDust', min: 1, max: 2 }],
        scan: [{ id: 'luminousDust', min: 1, max: 1, chance: 0.3 }],
        sling: [{ id: 'luminousDust', min: 1, max: 2 }]
    }
};

export const MATERIAL_META: Record<MaterialId, MaterialMeta> = {
    luminousDust: { id: 'luminousDust', name: 'Luminous Dust', color: '#FFE066', rarity: 'common' },
    pureExtract: { id: 'pureExtract', name: 'Pure Extract', color: '#66FFCC', rarity: 'uncommon' },
    taintedExtract: { id: 'taintedExtract', name: 'Tainted Extract', color: '#AA66FF', rarity: 'uncommon' },
    pyroclastOre: { id: 'pyroclastOre', name: 'Pyroclast Ore', color: '#FF8844', rarity: 'common' },
    voidGem: { id: 'voidGem', name: 'Void Gem', color: '#8866FF', rarity: 'uncommon' },
    quantumSeed: { id: 'quantumSeed', name: 'Quantum Seed', color: '#44FFAA', rarity: 'rare' },
    frostHeart: { id: 'frostHeart', name: 'Frost Heart', color: '#88DDFF', rarity: 'rare' },
    magmaCore: { id: 'magmaCore', name: 'Magma Core', color: '#FF4422', rarity: 'legendary' },
    architectKey: { id: 'architectKey', name: "Architect's Key", color: '#FFD700', rarity: 'legendary' }
};

export const ALL_MATERIAL_IDS: MaterialId[] = Object.keys(MATERIAL_META) as MaterialId[];

export function createEmptyInventory(): ResourceInventory {
    const bag = {} as ResourceInventory;
    for (const id of ALL_MATERIAL_IDS) {
        bag[id] = 0;
    }
    return bag;
}

/** Coerce unknown save payload into a full ResourceInventory. */
export function normalizeInventory(raw: unknown): ResourceInventory {
    const bag = createEmptyInventory();
    if (!raw || typeof raw !== 'object') return bag;
    const src = raw as Record<string, unknown>;
    for (const id of ALL_MATERIAL_IDS) {
        const n = src[id];
        if (typeof n === 'number' && Number.isFinite(n) && n >= 0) {
            bag[id] = Math.floor(n);
        }
    }
    return bag;
}

function rollAmount(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Roll drop table for a tagged species / kind.
 * Jelly-Moss destroy uses precision flag to swap Pure vs Tainted Extract.
 */
export function rollMaterialDrops(
    tag: string,
    event: HarvestEvent,
    options: HarvestOptions = {}
): MaterialGrant[] {
    const table = DROP_TABLES[tag]?.[event];
    if (!table || table.length === 0) return [];

    const grants: MaterialGrant[] = [];

    for (const entry of table) {
        const chance = entry.chance ?? 1;
        if (Math.random() > chance) continue;

        let id = entry.id;
        // Jelly-Moss quality: precision core shot → Pure; sustained/overload → Tainted
        if (tag === 'nebulaJellyMoss' && event === 'destroy') {
            if (id === 'taintedExtract' || id === 'pureExtract') {
                id = options.precision ? 'pureExtract' : 'taintedExtract';
            }
        }

        const amount = rollAmount(entry.min, entry.max);
        if (amount > 0) {
            grants.push({ id, amount });
        }
    }

    // Guaranteed at least one material on destroy of a known flora/geo tag
    if (event === 'destroy' && grants.length === 0 && table.length > 0) {
        const fallback = table[0];
        let id = fallback.id;
        if (tag === 'nebulaJellyMoss') {
            id = options.precision ? 'pureExtract' : 'taintedExtract';
        }
        grants.push({ id, amount: Math.max(1, fallback.min) });
    }

    return grants;
}

export function getMaterialDisplayName(id: MaterialId): string {
    return MATERIAL_META[id]?.name ?? id;
}

export function getMaterialColor(id: MaterialId): string {
    return MATERIAL_META[id]?.color ?? '#FFFFFF';
}
