/**
 * Resource Harvester — rolls drop tables, writes to SaveManager inventory,
 * and notifies HUD / juice listeners for Resource Pop feedback.
 */

import * as THREE from 'three';
import type { InventoryPort } from './ports';
import {
    type HarvestEvent,
    type HarvestOptions,
    type MaterialGrant,
    type MaterialId,
    rollMaterialDrops
} from './resource_inventory';

export interface MaterialCollectedEvent {
    id: MaterialId;
    amount: number;
    total: number;
    /** World position for floating Resource Pop juice (optional). */
    position?: THREE.Vector3;
    event: HarvestEvent;
}

/**
 * Central harvest pipeline for scan / destroy / sling material grants.
 */
export class ResourceHarvester {
    private readonly inventory: InventoryPort;

    /** Fired once per material grant (after inventory write). */
    onMaterialCollected?: (evt: MaterialCollectedEvent) => void;

    constructor(inventory: InventoryPort) {
        this.inventory = inventory;
    }

    /**
     * Roll drops for a tagged species/kind and persist them.
     * Returns the grants that were actually added.
     */
    harvest(
        tag: string,
        event: HarvestEvent,
        position?: THREE.Vector3,
        options: HarvestOptions = {}
    ): MaterialGrant[] {
        if (!tag) return [];

        const grants = rollMaterialDrops(tag, event, options);
        if (grants.length === 0) return [];

        const applied: MaterialGrant[] = [];
        for (const grant of grants) {
            const total = this.inventory.addMaterial(grant.id, grant.amount);
            applied.push(grant);
            this.onMaterialCollected?.({
                id: grant.id,
                amount: grant.amount,
                total,
                position: position?.clone(),
                event
            });
        }
        return applied;
    }

    /** Direct grant (quests, debug, boss rewards) without a drop table. */
    grant(
        id: MaterialId,
        amount: number,
        event: HarvestEvent = 'destroy',
        position?: THREE.Vector3
    ): number {
        if (amount <= 0) return this.inventory.getMaterialCount(id);
        const total = this.inventory.addMaterial(id, amount);
        this.onMaterialCollected?.({
            id,
            amount,
            total,
            position: position?.clone(),
            event
        });
        return total;
    }
}
