import * as THREE from 'three';
import { CandyParallaxLayer } from './candy_parallax';

export class CandyFieldSystem {
    scene: THREE.Scene;
    layers: CandyParallaxLayer[] = [];
    active: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initLayers();
    }

    private initLayers() {
        // Foreground layer - Gummy asteroids
        this.layers.push(new CandyParallaxLayer(this.scene, {
            count: 12,
            z: 10,
            zRange: 5,
            width: 120,
            type: 'gummy'
        }));

        // Mid layer - Lollipops and jellybeans
        this.layers.push(new CandyParallaxLayer(this.scene, {
            count: 25,
            z: -10,
            zRange: 8,
            width: 180,
            type: 'mixed'
        }));

        // Background layer - Cotton candy clouds
        this.layers.push(new CandyParallaxLayer(this.scene, {
            count: 40,
            z: -35,
            zRange: 10,
            width: 250,
            type: 'cotton_candy'
        }));

        this.setVisible(false);
    }

    setVisible(visible: boolean) {
        this.layers.forEach(l => {
            l.mesh.visible = visible;
        });
        this.active = visible;
    }

    activate() {
        if (this.active) return;
        this.setVisible(true);
    }

    deactivate() {
        if (!this.active) return;
        this.setVisible(false);
    }

    update(delta: number, cameraX: number) {
        if (!this.active) return;
        this.layers.forEach(l => l.update(delta, cameraX));
    }
}
