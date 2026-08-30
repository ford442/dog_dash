/**
 * Crafting System — Plasma Caster economy (Phase B).
 *
 * Recipes turn harvested materials (see resource_inventory.ts) into a
 * next-run loadout persisted on SaveData.loadout, applied once at boot in
 * src/main/startup.ts. The Space Base hub renders the craft bay tab from
 * RECIPES. Keep the economy shallow: 6–10 recipes max.
 */

import type { MaterialGrant, ResourceInventory } from './resource_inventory';
import type { SaveManager } from './save_manager';

export type RecipeId =
    | 'stellarFuel'
    | 'glitchGrenade'
    | 'hullPatch'
    | 'magmaLance'
    | 'cryoRounds'
    | 'phaseShifter'
    | 'architectKey';

export interface Recipe {
    id: RecipeId;
    icon: string;
    name: string;
    desc: string;
    cost: MaterialGrant[];
    /** Kid-friendly summary of what you get. */
    effectText: string;
}

export const RECIPES: Recipe[] = [
    {
        id: 'stellarFuel',
        icon: '🚀',
        name: 'Stellar Fuel',
        desc: 'Super sparkle juice for your boosters!',
        cost: [{ id: 'luminousDust', amount: 10 }],
        effectText: 'Next run: +1 boost charge and longer boosts'
    },
    {
        id: 'glitchGrenade',
        icon: '💥',
        name: 'Glitch Grenade ×3',
        desc: 'A wobbly bomb that poofs nearby baddies!',
        cost: [
            { id: 'luminousDust', amount: 6 },
            { id: 'taintedExtract', amount: 2 }
        ],
        effectText: 'Next run: 3 grenades (press G or tap the 💥 counter)'
    },
    {
        id: 'hullPatch',
        icon: '🛡️',
        name: 'Hull Patch',
        desc: 'Patch up your rocket with void crystal!',
        cost: [
            { id: 'luminousDust', amount: 8 },
            { id: 'voidGem', amount: 3 }
        ],
        effectText: 'Next run: +1 max heart'
    },
    {
        id: 'magmaLance',
        icon: '🔥',
        name: 'Magma Lance',
        desc: 'Melted volcano power for your blaster!',
        cost: [
            { id: 'pyroclastOre', amount: 8 },
            { id: 'magmaCore', amount: 1 }
        ],
        effectText: 'Next run: boss damage ×1.5'
    },
    {
        id: 'cryoRounds',
        icon: '❄️',
        name: 'Cryo Rounds',
        desc: 'Ice-cold shots that never overheat!',
        cost: [
            { id: 'frostHeart', amount: 5 },
            { id: 'pureExtract', amount: 3 }
        ],
        effectText: 'Next run: blaster heat −40%'
    },
    {
        id: 'phaseShifter',
        icon: '🌀',
        name: 'Phase Shifter',
        desc: 'Blink through space like a ghost pup!',
        cost: [
            { id: 'quantumSeed', amount: 4 },
            { id: 'voidGem', amount: 1 }
        ],
        effectText: 'Next run: roll recharges 2× faster + full boost'
    },
    {
        id: 'architectKey',
        icon: '🗝️',
        name: 'Architect Key',
        desc: 'The master key to every chapter of the journey!',
        cost: [
            { id: 'architectKey', amount: 1 },
            { id: 'quantumSeed', amount: 2 }
        ],
        effectText: 'Instant: unlock all chapters forever'
    }
];

export function getRecipe(id: RecipeId): Recipe | undefined {
    return RECIPES.find(r => r.id === id);
}

/** Cost entries the bag cannot currently cover (amount = how many short). */
export function getMissingMaterials(inv: ResourceInventory, recipe: Recipe): MaterialGrant[] {
    return recipe.cost
        .map(c => ({ id: c.id, amount: c.amount - (inv[c.id] || 0) }))
        .filter(c => c.amount > 0);
}

export function canCraft(inv: ResourceInventory, recipe: Recipe): boolean {
    return getMissingMaterials(inv, recipe).length === 0;
}

/** Grenade ammo granted per craft (shown on the HUD counter). */
export { GRENADES_PER_CRAFT } from './crafting_constants';

/**
 * Crafts a recipe: deducts materials from the persistent bag and queues the
 * result for the next run (SaveData.loadout). The Architect Key applies
 * instantly instead. Returns false when materials are insufficient —
 * nothing is deducted in that case.
 */
export function craftRecipe(save: SaveManager, id: RecipeId): boolean {
    const recipe = getRecipe(id);
    if (!recipe) return false;
    if (!canCraft(save.getResources(), recipe)) return false;

    for (const c of recipe.cost) {
        if (!save.spendMaterial(c.id, c.amount)) return false; // unreachable after canCraft, kept for safety
    }

    if (id === 'architectKey') {
        save.unlockAllLevels();
    } else {
        save.grantCrafted(id, 1);
    }
    return true;
}
