import * as THREE from 'three';
import { ConstellationManager } from './flower_constellations';
import type { AudioPort } from './ports';
import type { ParticleSystem } from './particles';
import { DEPTH_LAYERS } from './depth_layers';
import { decorationBudget } from './decoration_budget';

export class FlowerConstellationsSystem {
    private scene: THREE.Scene;
    private manager: ConstellationManager;
    private active: boolean = false;

    constructor(scene: THREE.Scene, audioSystem: AudioPort, particleSystem: ParticleSystem) {
        this.scene = scene;
        this.manager = new ConstellationManager(scene, audioSystem, particleSystem);
        // level_config.ts only ever passes `true` (density multiplier 1.0) for this
        // flag — Math.floor(15 * 1.0) = 15 is the real max observed anywhere.
        decorationBudget.register('flower_constellations', {
            label: 'Flower constellations',
            category: 'foliage',
            maxActive: 15
        });
        this.deactivate();
    }

    activate(config?: boolean | { density?: number }, levelLength: number = 2000) {
        if (this.active) return;
        this.active = true;

        const densityMultiplier = (typeof config === 'object' && config.density) ? config.density : 1.0;

        // Ensure old ones are cleared
        this.manager.cleanup();

        // Ensure we scatter them in the appropriate Z range and across the current level span
        const dreamyStart = 0;
        const dreamyEnd = levelLength;

        // Generate constellations using the original logic matching `DEPTH_LAYERS.BACKGROUND`
        const count = Math.floor(15 * densityMultiplier);
        this.manager.generateConstellation(count, dreamyStart, dreamyEnd, DEPTH_LAYERS.BACKGROUND.min, DEPTH_LAYERS.BACKGROUND.max);
        decorationBudget.syncCount('flower_constellations', this.manager.getFlowerCount());
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.manager.cleanup();
        decorationBudget.syncCount('flower_constellations', 0);
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active || !playerPos) return;
        this.manager.update(delta, playerPos);
        this.manager.checkPlayerProximity(playerPos);
        this.manager.cleanupFarFlowers(playerPos.x);
    }

    cleanup() {
        this.manager.cleanup();
        decorationBudget.syncCount('flower_constellations', 0);
    }
}
