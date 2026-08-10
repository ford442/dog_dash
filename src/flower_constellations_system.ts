import * as THREE from 'three';
import { ConstellationManager } from './flower_constellations';
import type { AudioSystem } from './audio_system';
import type { ParticleSystem } from './particles';
import { DEPTH_LAYERS } from './depth_layers';

export class FlowerConstellationsSystem {
    private scene: THREE.Scene;
    private manager: ConstellationManager;
    private active: boolean = false;

    constructor(scene: THREE.Scene, audioSystem: AudioSystem, particleSystem: ParticleSystem) {
        this.scene = scene;
        this.manager = new ConstellationManager(scene, audioSystem, particleSystem);
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
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.manager.cleanup();
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active || !playerPos) return;
        this.manager.update(delta, playerPos);
        this.manager.checkPlayerProximity(playerPos);
        this.manager.cleanupFarFlowers(playerPos.x);
    }

    cleanup() {
        this.manager.cleanup();
    }
}
