import * as THREE from 'three';
import { CastleBackgroundManager } from './cloud_castles';
import { decorationBudget } from './decoration_budget';

export class CloudCastlesSystem {
    scene: THREE.Scene;
    active: boolean = false;
    private manager: CastleBackgroundManager;
    private initialized: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.manager = new CastleBackgroundManager(scene);
        // Generous documented estimate, not a precisely derived ceiling:
        // maintainCastles() only enforces a floor (>=3 ahead of any layer within
        // spawnRange=300, >=2 background-layer castles behind within the same
        // range) and spawns one castle at a time to top up under that floor.
        // Population is bounded indirectly by cleanupFarCastles() removing
        // anything whose rendered (parallax-adjusted) position drifts more than
        // cleanupRange=400 from the player, which — given per-layer parallax
        // speeds of 0.02-0.1 — keeps every layer's lifetime in a comparable
        // window. Typical steady-state population sits in the high single
        // digits to low teens; 20 leaves real headroom without silently
        // under-reporting.
        decorationBudget.register('cloud_castles', {
            label: 'Cloud castles',
            category: 'background3d',
            maxActive: 20
        });
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
