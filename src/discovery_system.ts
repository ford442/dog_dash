import * as THREE from 'three';
import { SaveManager } from './save_manager';
import { BESTIARY_ENTRIES, type BestiaryEntryId } from './bestiary';

// Display names for catalogable flora species, keyed by the `userData.speciesId`
// tag applied in level_manager.spawnOpenFoliage()
export const SPECIES_NAMES: Record<string, string> = {
    fern: 'Star Dust Fern',
    rose: 'Nebula Rose',
    lotus: 'Subwoofer Lotus',
    glowingFlower: 'Glowing Flower',
    tree: 'Flowering Tree',
    floweringTree: 'Sunset Tree',
    shrub: 'Helix Shrub',
    vine: 'Wisteria Vine',
    mushroom: 'Puffball Mushroom',
    orb: 'Floating Orb',
};

const SCAN_RADIUS = 12;

export class DiscoveryManager {
    private discoveredThisRun = new Set<string>();
    private saveManager: SaveManager;

    /** Fired the first time a species is scanned in the current run */
    onSpeciesDiscovered?: (speciesId: string, name: string, totalThisRun: number, isNewEver: boolean) => void;

    constructor(saveManager: SaveManager) {
        this.saveManager = saveManager;
    }

    reset() {
        this.discoveredThisRun.clear();
    }

    getDiscoveredCount(): number {
        return this.discoveredThisRun.size;
    }

    update(playerPosition: THREE.Vector3, levelObjects: THREE.Object3D[]) {
        for (const obj of levelObjects) {
            const speciesId = obj.userData?.speciesId as string | undefined;
            if (!speciesId || this.discoveredThisRun.has(speciesId)) continue;

            if (obj.position.distanceTo(playerPosition) <= SCAN_RADIUS) {
                this.discoveredThisRun.add(speciesId);
                const isNewEver = this.saveManager.discoverSpecies(speciesId);
                const name = SPECIES_NAMES[speciesId] || speciesId;

                if (this.onSpeciesDiscovered) {
                    this.onSpeciesDiscovered(speciesId, name, this.discoveredThisRun.size, isNewEver);
                }
            }
        }
    }
}

/**
 * Generalized "Weird Life Log" cataloging — the bestiary equivalent of
 * DiscoveryManager. Each rare creature can be cataloged at most once per
 * run via a non-lethal interaction (see BESTIARY_ENTRIES for the conditions
 * and the "memory" bonus each entry grants on future runs).
 */
export class CreatureCatalogManager {
    private catalogedThisRun = new Set<BestiaryEntryId>();
    private saveManager: SaveManager;

    /** Fired the first time a creature is cataloged in the current run. */
    onCreatureCataloged?: (id: BestiaryEntryId, name: string, isNewEver: boolean) => void;

    constructor(saveManager: SaveManager) {
        this.saveManager = saveManager;
    }

    reset() {
        this.catalogedThisRun.clear();
    }

    /** Records a non-lethal encounter with a bestiary creature. */
    catalog(id: BestiaryEntryId): void {
        if (this.catalogedThisRun.has(id)) return;
        this.catalogedThisRun.add(id);

        const isNewEver = this.saveManager.catalogCreature(id);
        const entry = BESTIARY_ENTRIES[id];
        this.onCreatureCataloged?.(id, entry.name, isNewEver);
    }
}
