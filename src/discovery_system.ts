import * as THREE from 'three';
import { SaveManager } from './save_manager';
import { BESTIARY_ENTRIES, type BestiaryEntryId } from './bestiary_data';

// Display names for catalogable species, keyed by the `userData.speciesId`
// tag applied by foliage, geological, friend, and rare creature spawners.
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
    nebulaJellyMoss: 'Nebula Jelly-Moss',
    fracturedGeode: 'Fractured Geode',
    // Geological species (now scannable for objectives)
    voidRootBall: 'Void Root Ball',
    magmaHeart: 'Magma Heart',
    iceNeedleCluster: 'Ice Needle Cluster',
    gravityAnchor: 'Gravity Anchor',
    gravLens: 'Grav-Lens',
    dreamPortal: 'Dream Portal Door',
    dreamLantern: 'Dream Lantern',
    derelictBuoy: 'Derelict Buoy',
    dataMonolith: 'Data Monolith',
    sporeCloud: 'Spore Cloud',
    vacuumKelp: 'Vacuum Kelp',
    liquidMetalBlob: 'Liquid Metal Blob',
    // Space friends
    spaceKitty: 'Space Kitty',
    moonBunny: 'Moon Bunny',
    wishLantern: 'Wish Lantern',
    astroTarsier: 'Astro Tarsier',
    cosmicOtter: 'Cosmic Otter',
    astroPenguin: 'Astro Penguin',
    trappedKitty: 'Trapped Space Kitty',
    trappedBunny: 'Trapped Moon Bunny',
    trappedTarsier: 'Trapped Astro Tarsier',
    trappedOtter: 'Trapped Cosmic Otter',
    trappedPenguin: 'Trapped Astro Penguin',
    moonPup: 'Moon Pup',
    rescuedKitty: 'Rescued Space Kitty',
    rescuedBunny: 'Rescued Moon Bunny',
    rescuedTarsier: 'Rescued Astro Tarsier',
    rescuedOtter: 'Rescued Cosmic Otter',
    rescuedPenguin: 'Rescued Astro Penguin',
    rescuedMoonPup: 'Rescued Moon Pup',
    // Rare creatures
    tarsierGuardian: 'Crystal Tarsier Guardian',
    livingGeodeTitan: 'Living Geode Titan',
    moonJelly: 'Moon Jelly',
    auroraRay: 'Aurora Ray',
    nebulaPuffer: 'Nebula Puffer',
    toyRocketWreck: 'Toy Rocket Wreck',
    lunarLemur: 'Lunar Lemur',
    trappedLemur: 'Trapped Lunar Lemur',
    rescuedLemur: 'Rescued Lunar Lemur',
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

    private getScanPosition(obj: THREE.Object3D): THREE.Vector3 {
        const scanPosition = obj.userData?.scanPosition;
        if (scanPosition instanceof THREE.Vector3) {
            return scanPosition;
        }
        return obj.getWorldPosition(new THREE.Vector3());
    }

    update(playerPosition: THREE.Vector3, levelObjects: THREE.Object3D[]) {
        for (const obj of levelObjects) {
            const speciesId = obj.userData?.speciesId as string | undefined;
            if (!speciesId || this.discoveredThisRun.has(speciesId)) continue;

            if (this.getScanPosition(obj).distanceTo(playerPosition) <= SCAN_RADIUS) {
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

    getCatalogedCountThisRun(): number {
        return this.catalogedThisRun.size;
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
