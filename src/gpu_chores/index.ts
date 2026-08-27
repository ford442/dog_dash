/**
 * gpu_chores/index.ts
 * Adapter and process-wide accessor for the GPU chores layer.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * "Chores" are small, data-parallel, *non-authoritative* helper ops:
 *   • `compact` — build a draw list of instances worth rendering
 *   • `reduce`  — peak / sum / min for HUD and juice meters
 *
 * ── What this is NOT ────────────────────────────────────────────────────────
 * This is not a particle simulation port. Positions, velocities, lifetimes,
 * collision, gravity and spore gameplay state stay on the AssemblyScript/CPU
 * path and remain the single source of truth. A GPU integrate step is a
 * separate, parity-gated piece of work — see docs/GPU_CHORES.md.
 *
 * ── Backend order ───────────────────────────────────────────────────────────
 * WebGPU (async, cosmetic only) → AssemblyScript/WASM (sync) → JS (sync).
 * Synchronous ops never touch the GPU, so there is never a frame where a
 * WebGPU compute pass and a renderer both own the same particle SoA.
 *
 * ── Kill switch ─────────────────────────────────────────────────────────────
 * `?no_gpu_compute` forces the JS tier and disables WebGPU adoption entirely.
 * `?chores=js|wasm|webgpu` pins a preference. Breadcrumbs land on
 * `window.gpuChores`.
 */

import type {
    AsyncChoresBackend,
    ChoresBackendId,
    ChoresBreadcrumb,
    ChoresPreference,
    GpuChores,
    ReduceOp,
    SyncChoresBackend
} from './types';
import { createJsChoresBackend } from './js_backend';
import { createWasmChoresBackend, supportsChores, type ChoresWasmExports } from './wasm_backend';
import { adoptRendererDevice, createWebGpuChoresBackend } from './webgpu_backend';

export type {
    AsyncChoresBackend,
    ChoresBackendId,
    ChoresBreadcrumb,
    ChoresPreference,
    GpuChores,
    ReduceOp,
    SyncChoresBackend
};
export { adoptRendererDevice } from './webgpu_backend';

declare global {
    interface Window {
        gpuChores?: ChoresBreadcrumb;
    }
}

const DEFAULT_EPSILON = 0;

function readPreference(): ChoresPreference {
    if (typeof window === 'undefined') return 'auto';

    const params = new URLSearchParams(window.location.search);
    if (params.has('no_gpu_compute')) return 'js';

    const pinned = params.get('chores')?.toLowerCase();
    if (pinned === 'js' || pinned === 'wasm' || pinned === 'webgpu') return pinned;
    return 'auto';
}

class ChoresAdapter implements GpuChores {
    private sync: SyncChoresBackend;
    private async: AsyncChoresBackend | null = null;
    private preference: ChoresPreference;

    reason = 'not initialised';
    readonly ops = { compact: 0, reduce: 0, reduceAsync: 0 };

    constructor(preference: ChoresPreference) {
        this.preference = preference;
        this.sync = createJsChoresBackend();
        this.reason = preference === 'js'
            ? 'disabled by ?no_gpu_compute / ?chores=js'
            : 'no renderer device adopted yet';
    }

    get backend(): ChoresBackendId {
        return this.async ? 'webgpu' : this.sync.id;
    }

    get syncBackend(): 'wasm' | 'js' {
        return this.sync.id;
    }

    get gpuDisabled(): boolean {
        return this.preference === 'js' || this.preference === 'wasm';
    }

    /**
     * Attaches the AssemblyScript tier. Safe to call with a WASM build that
     * predates the chore exports — it is simply ignored.
     */
    attachWasm(exports: unknown): void {
        if (this.preference === 'js') return;
        if (!supportsChores(exports)) return;
        this.sync = createWasmChoresBackend(exports as ChoresWasmExports);
        this.publish();
    }

    /**
     * Adopts the renderer's existing `GPUDevice` for cosmetic reductions.
     * Never requests a device: if renderer boot failed there is nothing to
     * adopt and the chores layer stays on the CPU tiers.
     */
    attachRenderer(renderer: unknown): void {
        if (this.gpuDisabled) {
            this.reason = 'disabled by ?no_gpu_compute / pinned CPU backend';
            this.publish();
            return;
        }

        const device = adoptRendererDevice(renderer);
        if (!device) {
            this.reason = 'renderer exposes no WebGPU device (WebGL or failed boot)';
            this.publish();
            return;
        }

        try {
            this.async = createWebGpuChoresBackend(device);
            this.reason = 'adopted renderer WebGPU device';
        } catch (error) {
            this.async = null;
            this.reason = `WebGPU chores pipeline failed: ${(error as Error)?.message ?? error}`;
        }
        this.publish();
    }

    compact(values: Float32Array, count: number, out: Uint32Array, epsilon = DEFAULT_EPSILON): number {
        this.ops.compact++;
        return this.sync.compact(values, count, out, epsilon);
    }

    reduce(values: Float32Array, count: number, op: ReduceOp): number {
        this.ops.reduce++;
        return this.sync.reduce(values, count, op);
    }

    async reduceAsync(values: Float32Array, count: number, op: ReduceOp): Promise<number> {
        this.ops.reduceAsync++;
        if (!this.async) return this.sync.reduce(values, count, op);

        try {
            return await this.async.reduceAsync(values, count, op);
        } catch (error) {
            // A lost device must degrade to CPU, never stall a HUD readout.
            this.async = null;
            this.reason = `WebGPU chores disabled after error: ${(error as Error)?.message ?? error}`;
            this.publish();
            return this.sync.reduce(values, count, op);
        }
    }

    dispose(): void {
        this.async?.dispose();
        this.async = null;
        this.publish();
    }

    publish(): void {
        if (typeof window === 'undefined') return;
        window.gpuChores = {
            backend: this.backend,
            syncBackend: this.syncBackend,
            gpuDisabled: this.gpuDisabled,
            reason: this.reason,
            ops: this.ops
        };
    }
}

let adapter: ChoresAdapter | null = null;

/** Process-wide chores adapter. Created lazily on first use. */
export function getGpuChores(): GpuChores & {
    attachWasm(exports: unknown): void;
    attachRenderer(renderer: unknown): void;
    dispose(): void;
} {
    if (!adapter) {
        adapter = new ChoresAdapter(readPreference());
        adapter.publish();
    }
    return adapter;
}

/** Test seam: rebuild the adapter with an explicit preference. */
export function createGpuChoresAdapter(preference: ChoresPreference = 'auto'): ChoresAdapter {
    return new ChoresAdapter(preference);
}

/** Test seam: drop the process-wide adapter. */
export function resetGpuChores(): void {
    adapter?.dispose();
    adapter = null;
}
