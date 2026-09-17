/**
 * Optional post stack from Three's own addons. Off by default (`?fx=1`).
 * Disabled when `prefers-reduced-motion: reduce`.
 *
 * WebGPU uses TSL `PostProcessing` + `three/addons/tsl/display/BloomNode`
 * (the addons tree). The WebGL `EffectComposer` under
 * `three/addons/postprocessing` is not used — that would need a WebGL context.
 */

import * as THREE from 'three';
import PostProcessing from 'three/src/renderers/common/PostProcessing.js';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { prefersReducedMotion } from './audio_settings';
import { wantsOptionalPostFx } from './pixel_ratio';

export class OptionalPostFx {
    postProcessing: PostProcessing | null = null;
    enabled = false;

    constructor() {
        this.enabled = typeof window !== 'undefined' && wantsOptionalPostFx() && !prefersReducedMotion();
    }

    activate(renderer: unknown, scene: THREE.Scene, camera: THREE.Camera): void {
        if (this.postProcessing || prefersReducedMotion()) return;
        const pp = new PostProcessing(renderer as never);
        const scenePass = pass(scene, camera);
        const beauty = scenePass.getTextureNode();
        const bloomPass = bloom(beauty, 0.32, 0.22, 0.82);
        pp.outputNode = bloomPass as never;
        this.postProcessing = pp;
    }

    render(): void {
        this.postProcessing?.render();
    }

    dispose(): void {
        this.postProcessing?.dispose();
        this.postProcessing = null;
    }
}

export const optionalPostFx = new OptionalPostFx();
