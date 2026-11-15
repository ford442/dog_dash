/**
 * Browser entry for the WGSL parity spec. Bundled by esbuild at test time
 * (tests/gpu/integrate_parity.spec.ts) and injected into a blank page.
 *
 * The *test harness* requests its own adapter/device here — that is allowed
 * in a test page. Production `src/gpu_integrate/` never does.
 */

import { runScenario } from '../gpu_integrate/scenario';
import { createWebGpuIntegrateKernel } from '../../src/gpu_integrate/webgpu_kernel';
import type { IntegrateKernel } from '../../src/gpu_integrate';

declare global {
    interface Window {
        runGpuIntegrateParity?: () => Promise<unknown>;
    }
}

window.runGpuIntegrateParity = async () => {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) return { skipped: 'no WebGPU adapter' };
    const device = await adapter.requestDevice();
    const uncaptured: string[] = [];
    device.addEventListener('uncapturederror', (e) => {
        uncaptured.push((e as GPUUncapturedErrorEvent).error.message);
    });

    const kernels: IntegrateKernel[] = [];
    const backends: string[] = [];
    const snapshots = await runScenario({
        async attach(particles, debris) {
            const kp = await createWebGpuIntegrateKernel(device, 'particles', particles.maxParticles);
            const kd = await createWebGpuIntegrateKernel(device, 'debris', debris.maxParticles);
            particles.setIntegrateKernel(kp);
            debris.setIntegrateKernel(kd);
            kernels.push(kp, kd);
            backends.push(particles.integrateBackend, debris.integrateBackend);
        },
        async afterStep(particles, debris) {
            // Make the async readback deterministic for the comparison: wait
            // for it, then draw it, exactly as a later frame would.
            await Promise.all(kernels.map(k => k.settled()));
            particles.syncIntegrateDraw();
            debris.syncIntegrateDraw();
        }
    });

    return {
        adapter: `${adapter.info?.vendor ?? ''} ${adapter.info?.architecture ?? ''} ${adapter.info?.description ?? ''}`.trim(),
        backends,
        failed: kernels.map(k => k.failed),
        uncaptured,
        snapshots
    };
};
