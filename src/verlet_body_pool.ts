/**
 * Shared WASM Verlet body pool.
 *
 * Jelly-Moss cores and Vacuum Kelp strands both write springs in TS and
 * integrate through the single `allocPhysicsBodies` / `stepPhysics` buffer in
 * `assembly/physics.ts`. One pool owns that buffer so the two consumers never
 * clobber each other's indices.
 *
 * JS fallback (no WASM physics exports): consumers stay on shader sway.
 */

import {
    refreshMemoryView,
    type WasmExports,
    type WasmHandle
} from './wasm_loader';

const DEFAULT_CAPACITY = 72;

export type VerletConsumer = {
    id: string;
    /** Pack live bodies starting at `cursor`; return the next free index. */
    repack: (cursor: number) => number;
};

function hasSoftBodyPhysics(exports: WasmExports | null | undefined): boolean {
    return !!(
        exports &&
        typeof exports.allocPhysicsBodies === 'function' &&
        typeof exports.stepPhysics === 'function' &&
        typeof exports.getBodyPositionX === 'function' &&
        typeof exports.getBodyPositionY === 'function' &&
        typeof exports.setBodyPosition === 'function' &&
        typeof exports.addBodyAcceleration === 'function'
    );
}

export class VerletBodyPool {
    private handle: WasmHandle | null = null;
    private consumers: VerletConsumer[] = [];
    private liveCount = 0;
    private capacity = 0;

    get isReady(): boolean {
        return !!this.handle && hasSoftBodyPhysics(this.handle.exports);
    }

    get exports(): WasmExports | null {
        return this.handle?.exports ?? null;
    }

    get bodyCount(): number {
        return this.liveCount;
    }

    bindWasm(handle: WasmHandle | null): void {
        this.handle = null;
        this.capacity = 0;
        this.liveCount = 0;
        if (handle && hasSoftBodyPhysics(handle.exports)) {
            this.handle = handle;
            this.ensureCapacity(DEFAULT_CAPACITY);
        }
        this.relayout();
        this.publishBreadcrumb();
    }

    register(consumer: VerletConsumer): void {
        this.consumers = this.consumers.filter((c) => c.id !== consumer.id);
        this.consumers.push(consumer);
        this.relayout();
    }

    unregister(id: string): void {
        this.consumers = this.consumers.filter((c) => c.id !== id);
        this.relayout();
    }

    relayout(): void {
        if (!this.isReady) {
            this.liveCount = 0;
            this.publishBreadcrumb();
            return;
        }
        let cursor = 0;
        for (const consumer of this.consumers) {
            cursor = consumer.repack(cursor);
        }
        this.liveCount = cursor;
        this.ensureCapacity(Math.max(cursor, DEFAULT_CAPACITY));
        this.publishBreadcrumb();
    }

    step(delta: number, gravity = 0): void {
        if (!this.isReady || this.liveCount <= 0) return;
        const dt = Math.min(0.05, Math.max(0.001, delta));
        this.handle!.exports.stepPhysics!(this.liveCount, dt, gravity);
    }

    ensureCapacity(needed: number): boolean {
        if (!this.handle || !hasSoftBodyPhysics(this.handle.exports)) return false;
        if (needed <= this.capacity) return true;
        try {
            this.handle.exports.allocPhysicsBodies!(needed);
            refreshMemoryView(this.handle);
            this.capacity = needed;
            return true;
        } catch (err) {
            console.warn('[verlet-pool] allocPhysicsBodies failed:', err);
            this.handle = null;
            this.publishBreadcrumb();
            return false;
        }
    }

    private publishBreadcrumb(): void {
        if (typeof window === 'undefined') return;
        window.verletBodyPoolReady = this.isReady;
        window.verletBodyPoolCount = this.liveCount;
    }
}

export const verletBodyPool = new VerletBodyPool();

declare global {
    interface Window {
        verletBodyPoolReady?: boolean;
        verletBodyPoolCount?: number;
    }
}
