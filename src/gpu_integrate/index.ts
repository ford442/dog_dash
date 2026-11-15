/**
 * gpu_integrate/index.ts
 * Process-wide manager for the visual-particle GPU integrate.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * A compute pass that advances the *visual* SoA of ParticleSystem and
 * DebrisSystem (kinematics + instance matrices). Those systems are cosmetic:
 * nothing in collision, SpatialIndex, harvest or the replay snapshot reads
 * them. Gameplay authority stays on AssemblyScript/JS.
 *
 * ── What this is NOT ────────────────────────────────────────────────────────
 * Not part of `gpu_chores` (those are compact/reduce helpers only), not a
 * collision or Verlet port, and never a second `requestDevice`.
 *
 * ── Gating ──────────────────────────────────────────────────────────────────
 * Opt-in with `?gpu_integrate` until it has been profiled on real hardware.
 * `?no_gpu_compute` (or `?gpu_integrate=0`) always keeps the JS integrate.
 * A lost device or any kernel error drops each system back to JS
 * automatically. Breadcrumbs land on `window.gpuIntegrate`.
 */

import { adoptRendererDevice } from '../gpu_chores';
import { getWebGpuProbeResult, isWebGpuDeviceLost, onWebGpuDeviceLost } from '../webgpu_probe';
import { createWebGpuIntegrateKernel } from './webgpu_kernel';
import type { IntegrateKernel, IntegrateKind } from './types';

export { IntegrateBinding } from './binding';
export { createF32ReferenceKernel } from './f32_reference';
export type { IntegrateKernel, IntegrateKind, IntegrateResult } from './types';

/** A system that can run its integrate on a kernel. */
export interface IntegrableSystem {
    readonly integrateKind: IntegrateKind;
    readonly maxParticles: number;
    /** Hand over a kernel (or null to stay on / return to JS). */
    setIntegrateKernel(kernel: IntegrateKernel | null): void;
    /** 'webgpu' | 'f32-reference' while on a kernel, else 'js'. */
    readonly integrateBackend: string;
}

export type GpuIntegratePreference = 'on' | 'off';

export interface GpuIntegrateBreadcrumb {
    preference: GpuIntegratePreference;
    reason: string;
    systems: Record<string, string>;
}

declare global {
    interface Window {
        gpuIntegrate?: GpuIntegrateBreadcrumb;
    }
}

export function readGpuIntegratePreference(
    search = typeof window !== 'undefined' ? window.location?.search ?? '' : ''
): GpuIntegratePreference {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    if (params.has('no_gpu_compute')) return 'off';
    if (!params.has('gpu_integrate')) return 'off';
    const v = params.get('gpu_integrate');
    return v === '0' || v === 'false' ? 'off' : 'on';
}

export class GpuIntegrateManager {
    readonly preference: GpuIntegratePreference;
    reason: string;
    private readonly systems: IntegrableSystem[] = [];
    private device: GPUDevice | null = null;
    private detached = false;
    private unsubscribeLost: (() => void) | null = null;

    constructor(preference: GpuIntegratePreference) {
        this.preference = preference;
        this.reason = preference === 'off'
            ? 'off (opt in with ?gpu_integrate; ?no_gpu_compute forces JS)'
            : 'waiting for renderer device';
    }

    register(system: IntegrableSystem): void {
        if (this.systems.includes(system)) return;
        this.systems.push(system);
        if (this.device && !this.detached) void this.createFor(system, this.device);
        this.publish();
    }

    /** Adopts the renderer's device. Never requests one. */
    attachRenderer(renderer: unknown): void {
        if (this.preference === 'off') return this.publish();

        const probe = getWebGpuProbeResult();
        if (probe && !probe.ok) {
            this.reason = `WebGPU boot probe failed (${probe.stage}); integrate stays on JS`;
            return this.publish();
        }
        if (isWebGpuDeviceLost()) {
            this.reason = 'WebGPU device lost; integrate stays on JS';
            return this.publish();
        }
        const device = adoptRendererDevice(renderer);
        if (!device) {
            this.reason = 'renderer exposes no WebGPU device';
            return this.publish();
        }

        this.device = device;
        this.reason = 'adopted renderer WebGPU device';
        this.unsubscribeLost = onWebGpuDeviceLost((lost) => {
            this.detach(`WebGPU device lost (${lost.reason}); integrate fell back to JS`);
        });
        for (const system of this.systems) void this.createFor(system, device);
        this.publish();
    }

    /** Drops every kernel; systems resume on the JS integrate next step. */
    detach(reason: string): void {
        this.detached = true;
        this.device = null;
        this.reason = reason;
        this.unsubscribeLost?.();
        this.unsubscribeLost = null;
        for (const system of this.systems) system.setIntegrateKernel(null);
        this.publish();
    }

    private async createFor(system: IntegrableSystem, device: GPUDevice): Promise<void> {
        try {
            const kernel = await createWebGpuIntegrateKernel(device, system.integrateKind, system.maxParticles);
            if (this.detached || this.device !== device) {
                kernel.dispose();
                return;
            }
            system.setIntegrateKernel(kernel);
        } catch (error) {
            this.reason = `${system.integrateKind} kernel failed to build: ${(error as Error)?.message ?? error}`;
            console.warn(`[gpu-integrate] ${this.reason}`);
        }
        this.publish();
    }

    publish(): void {
        if (typeof window === 'undefined') return;
        const systems: Record<string, string> = {};
        for (const s of this.systems) systems[s.integrateKind] = s.integrateBackend;
        window.gpuIntegrate = { preference: this.preference, reason: this.reason, systems };
    }
}

let manager: GpuIntegrateManager | null = null;

export function getGpuIntegrate(): GpuIntegrateManager {
    if (!manager) {
        manager = new GpuIntegrateManager(readGpuIntegratePreference());
        manager.publish();
    }
    return manager;
}

/** Test seam. */
export function resetGpuIntegrate(): void {
    manager = null;
}
