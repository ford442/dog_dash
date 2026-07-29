import * as THREE from 'three';
import { CastleBackgroundManager } from './cloud_castles';

export class CloudCastlesSystem {
    scene: THREE.Scene;
    active: boolean = false;
    private manager: CastleBackgroundManager;
    private initialized: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.manager = new CastleBackgroundManager(scene);
        this.deactivate();
    }

    activate(config?: any) {
        if (this.active) return;
        this.active = true;

        // Unconditionally clear and spawn initial castles to fix level restarts,
        // and spawn them far ahead since the update loop handles the rest.
        this.manager.clear();

        // Let the update loop generate the first ones starting at current cameraX.
        // We set initialized so we know it's ready.
        this.initialized = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;

        this.manager.clear();
        this.initialized = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        // The manager handles parallax and spawning based on playerX
        // which typically corresponds closely to cameraX in Dog Dash.
        this.manager.update(delta, cameraX);
    }

    cleanup() {
        this.manager.clear();
        this.initialized = false;
    }
}
