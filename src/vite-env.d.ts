/// <reference types="vite/client" />

declare module 'three/webgpu' {
    export * from 'three';
    import { WebGLRenderer, WebGLRendererParameters, MeshStandardMaterial, MeshPhysicalMaterial, PointsMaterial, MeshBasicMaterial } from 'three';

    // Minimal mock for WebGPURenderer as it's not in standard @types/three yet or might differ.
    // `device`/`context` let us hand the renderer the GPUDevice our boot probe
    // already created, so the page never runs a second adapter/device request
    // (see src/webgpu_probe.ts).
    export interface WebGPURendererParameters extends WebGLRendererParameters {
        device?: GPUDevice;
        context?: GPUCanvasContext | WebGLRenderingContext;
        forceWebGL?: boolean;
    }

    export class WebGPURenderer extends WebGLRenderer {
        constructor(parameters?: WebGPURendererParameters);
        /** Resolves once the backend has finished initialising. */
        init(): Promise<void>;
        /** Active backend; `backend.device` is the live GPUDevice. */
        readonly backend?: { device?: GPUDevice | null };
    }

    // Node materials (often just extended versions or using node logic)
    export class MeshBasicNodeMaterial extends MeshBasicMaterial {
        colorNode?: any;
        positionNode?: any;
    }

    export class PointsNodeMaterial extends PointsMaterial {
        colorNode?: any;
        positionNode?: any;
        sizeNode?: any;
    }

    export class MeshStandardNodeMaterial extends MeshStandardMaterial {
        colorNode?: any;
        positionNode?: any;
        emissiveNode?: any;
        roughnessNode?: any;
        metalnessNode?: any;
    }

    export class MeshPhysicalNodeMaterial extends MeshPhysicalMaterial {
        colorNode?: any;
        positionNode?: any;
        emissiveNode?: any;
        roughnessNode?: any;
        metalnessNode?: any;
        clearcoatNode?: any;
        clearcoatRoughnessNode?: any;
    }
}
