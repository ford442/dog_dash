import type { MaterialId } from '../resource_inventory';

/** Crafting material bag — backed by SaveManager at bootstrap. */
export interface InventoryPort {
    addMaterial(id: MaterialId, amount: number): number;
    getMaterialCount(id: MaterialId): number;
}
