import type { WasmExports } from '../wasm_loader';

/** WASM memory handle shared by obstacle collision checks. */
export type CollisionWasmHandle = {
    exports: WasmExports | null;
    memory: Float32Array | null;
};

/** Collision backend for obstacle_system (AssemblyScript WASM with JS fallback). */
export interface CollisionPort {
    getWasm(): CollisionWasmHandle;
    setWasmMemory(memory: Float32Array | null): void;
}
