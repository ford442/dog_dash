import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getRecipe,
    getMissingMaterials,
    canCraft,
    GRENADES_PER_CRAFT
} from '../../src/crafting_system.ts';
import type { ResourceInventory } from '../../src/resource_inventory.ts';

const emptyBag = {} as ResourceInventory;

test('getRecipe returns known recipe ids', () => {
    assert.equal(getRecipe('glitchGrenade')?.name, 'Glitch Grenade ×3');
    assert.equal(getRecipe('stellarFuel')?.cost[0].id, 'luminousDust');
    assert.equal(getRecipe('not-a-recipe' as 'stellarFuel'), undefined);
});

test('getMissingMaterials reports shortfall amounts', () => {
    const recipe = getRecipe('glitchGrenade')!;
    const bag = { luminousDust: 4, taintedExtract: 0 } as ResourceInventory;
    const missing = getMissingMaterials(bag, recipe);

    assert.deepEqual(missing, [
        { id: 'luminousDust', amount: 2 },
        { id: 'taintedExtract', amount: 2 }
    ]);
    assert.equal(canCraft(bag, recipe), false);
});

test('canCraft is true when bag covers recipe cost', () => {
    const recipe = getRecipe('stellarFuel')!;
    const bag = { luminousDust: 10 } as ResourceInventory;
    assert.equal(getMissingMaterials(bag, recipe).length, 0);
    assert.equal(canCraft(bag, recipe), true);
    assert.equal(canCraft(emptyBag, recipe), false);
});

test('GRENADES_PER_CRAFT matches HUD grenade counter', () => {
    assert.equal(GRENADES_PER_CRAFT, 3);
});
