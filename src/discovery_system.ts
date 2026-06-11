import * as THREE from 'three';
import { SaveManager } from './save_manager';

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
