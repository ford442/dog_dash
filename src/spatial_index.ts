/**
 * Gameplay spatial index: one uniform-grid rebuild per fixed sim step,
 * then radius queries. WASM AssemblyScript is the live path; JS brute-force
 * is used when the module is missing (no WebGPU-style silent fallback — this
 * is the documented null-WASM collision path).
 */
import type { WasmBackend, WasmExports, WasmHandle } from './wasm_loader';
import { refreshMemoryView } from './wasm_loader';

/** Bit flags stored in the entity `layer` float (integer-valued). */
export const CollisionLayer = {
    Obstacle: 1 << 0,
    Collectible: 1 << 1,
    Creature: 1 << 2,
    Tether: 1 << 3,
    Boss: 1 << 4,
    Spore: 1 << 5,
    Projectile: 1 << 6,
} as const;

export type CollisionLayerMask = number;

export type SpatialKind =
    | 'obstacle'
    | 'patternEnemy'
    | 'squid'
    | 'spore'
    | 'collectible'
    | 'creature'
    | 'tether'
    | 'boss'
    | 'projectile';

export type SpatialRecord = {
    slot: number;
    layer: number;
    index: number;
    kind: SpatialKind;
    ref?: object;
};

export type SpatialHandle = {
    exports: WasmExports | null;
    memory: Float32Array | null;
    backend?: WasmBackend | null;
};

const ENTITY_STRIDE = 6;
export const DEFAULT_CELL_SIZE = 8;

export class SpatialIndex {
    readonly records: SpatialRecord[] = [];
    private xs: number[] = [];
    private ys: number[] = [];
    private zs: number[] = [];
    private rs: number[] = [];
    private layers: number[] = [];
    private handle: WasmHandle | null = null;
    private useSimd = false;
    private built = false;
    private scratchHits: SpatialRecord[] = [];

    bindWasm(handle: WasmHandle | null): void {
        this.handle = handle;
        this.useSimd = !!(handle && handle.simd && typeof handle.exports.queryRadiusSimd === 'function');
        this.built = false;
    }

    begin(): void {
        this.records.length = 0;
        this.xs.length = 0;
        this.ys.length = 0;
        this.zs.length = 0;
        this.rs.length = 0;
        this.layers.length = 0;
        this.built = false;
    }

    add(
        x: number,
        y: number,
        z: number,
        radius: number,
        layer: number,
        index: number,
        kind: SpatialKind,
        ref?: object
    ): number {
        const slot = this.records.length;
        this.records.push({ slot, layer, index, kind, ref });
        this.xs.push(x);
        this.ys.push(y);
        this.zs.push(z);
        this.rs.push(radius);
        this.layers.push(layer);
        return slot;
    }

    count(): number {
        return this.records.length;
    }

    getHandle(): WasmHandle | null {
        return this.handle;
    }

    commit(cellSize: number = DEFAULT_CELL_SIZE): void {
        const n = this.records.length;
        const wasm = this.handle;
        if (wasm && typeof wasm.exports.allocEntities === 'function') {
            const ptr = wasm.exports.allocEntities(n);
            refreshMemoryView(wasm);
            if (n > 0 && ptr !== undefined) {
                const mem = wasm.memory;
                const start = ptr >>> 2;
                for (let i = 0; i < n; i++) {
                    const o = start + i * ENTITY_STRIDE;
                    mem[o] = this.xs[i];
                    mem[o + 1] = this.ys[i];
                    mem[o + 2] = this.zs[i];
                    mem[o + 3] = this.rs[i];
                    mem[o + 4] = this.layers[i];
                    mem[o + 5] = i;
                }
            }
            wasm.exports.rebuildGrid!(cellSize);
            refreshMemoryView(wasm);
            this.built = true;
            return;
        }
        this.built = true;
    }

    query(x: number, y: number, z: number, radius: number, layerMask: number): SpatialRecord[] {
        this.scratchHits = [];
        if (!this.built || this.records.length === 0) return this.scratchHits;

        const wasm = this.handle;
        if (wasm && typeof wasm.exports.queryRadius === 'function' && wasm.exports.allocEntities) {
            const fn = this.useSimd && wasm.exports.queryRadiusSimd
                ? wasm.exports.queryRadiusSimd
                : wasm.exports.queryRadius;
            const hitCount = fn(x, y, z, radius, layerMask);
            refreshMemoryView(wasm);
            const resPtr = wasm.exports.getQueryResultPtr ? wasm.exports.getQueryResultPtr() : 0;
            const i32 = wasm.i32Memory;
            const start = resPtr >> 2;
            for (let i = 0; i < hitCount; i++) {
                const id = i32[start + i];
                const rec = this.records[id];
                if (rec) this.scratchHits.push(rec);
            }
            return this.scratchHits;
        }

        return this.queryJs(x, y, z, radius, layerMask);
    }

    queryFirst(x: number, y: number, z: number, radius: number, layerMask: number): SpatialRecord | null {
        const hits = this.query(x, y, z, radius, layerMask);
        return hits.length > 0 ? hits[0] : null;
    }

    queryNearest(x: number, y: number, z: number, radius: number, layerMask: number): SpatialRecord | null {
        const hits = this.query(x, y, z, radius, layerMask);
        if (hits.length === 0) return null;
        let best: SpatialRecord | null = null;
        let bestD = Infinity;
        for (const hit of hits) {
            const i = hit.slot;
            const dx = this.xs[i] - x;
            const dy = this.ys[i] - y;
            const dz = this.zs[i] - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bestD) {
                bestD = d;
                best = hit;
            }
        }
        return best;
    }

    /** Brute-force fixture used by tests and the null-WASM path. */
    queryJs(x: number, y: number, z: number, radius: number, layerMask: number): SpatialRecord[] {
        const out: SpatialRecord[] = [];
        for (let i = 0; i < this.records.length; i++) {
            if ((this.layers[i] & layerMask) === 0) continue;
            const dx = this.xs[i] - x;
            const dy = this.ys[i] - y;
            const dz = this.zs[i] - z;
            const r = radius + this.rs[i];
            if (dx * dx + dy * dy + dz * dz < r * r) out.push(this.records[i]);
        }
        return out;
    }
}

export function asWasmHandle(h: SpatialHandle, backend: WasmBackend | null = null): WasmHandle | null {
    if (!h.exports) return null;
    const buffer = h.exports.memory.buffer;
    return {
        exports: h.exports,
        memory: h.memory ?? new Float32Array(buffer),
        i32Memory: new Int32Array(buffer),
        backend: (backend ?? h.backend ?? 'assemblyscript') as WasmBackend,
        simd: typeof h.exports.queryRadiusSimd === 'function',
    };
}
