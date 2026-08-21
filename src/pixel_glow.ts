import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import PostProcessing from 'three/src/renderers/common/PostProcessing.js';
import { pass, float } from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { pixelationPass } from 'three/examples/jsm/tsl/display/PixelationPassNode.js';

export class PixelGlowSystem {
    active: boolean = false;
    postProcessing: PostProcessing | null = null;

    constructor() {
        this.deactivate();
    }

    activate(renderer: any, scene: THREE.Scene, camera: THREE.Camera) {
        if (!this.postProcessing) {
            this.postProcessing = new PostProcessing(renderer as any);

            const scenePass = pass(scene, camera);

            // Apply pixelation effect to make it look retro
            // pixelSize, normalEdgeStrength, depthEdgeStrength
            const pixelation = pixelationPass(scene, camera, float(4), float(1.5), float(0.2));

            // Apply bloom to the pixelated output for a neon glow
            // node, strength, radius, threshold
            const bloomPass = bloom(pixelation, 1.5, 0.4, 0.2);

            this.postProcessing.outputNode = bloomPass as any;
        }
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
    }

    toggle() {
        this.active = !this.active;
        console.log(this.active ? '🌌 Retro Pixel-Glow Mode ENABLED' : '🌌 Retro Pixel-Glow Mode DISABLED');
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;
        // Animation or dynamic adjustments can go here if needed.
    }

    cleanup() {
        this.deactivate();
        if (this.postProcessing) {
            this.postProcessing.dispose();
            this.postProcessing = null;
        }
    }
}
