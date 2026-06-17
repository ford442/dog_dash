/**
 * wasm_loader.ts
 * Unified WASM loader for Dog Dash.
 *
 * Supports two backends:
 *   - AssemblyScript (default)  — build/optimized.wasm
 *   - C++            (opt-in)   — build/game_cpp.wasm  (compiled via Emscripten)
 *
 * Feature flag
 * ─────────────
 * Set the Vite env variable VITE_CPP_WASM=true to opt into the C++ backend
 * (e.g. in a .env.development.local file or CI environment).
 * The loader automatically falls back to AssemblyScript if the C++ binary is
 * not found or fails to instantiate.
 *
 * Usage
 * ─────
 * import { loadWasm, WasmBackend, type WasmHandle } from './wasm_loader';
 *
 * const wasm = await loadWasm();          // respects VITE_CPP_WASM flag
 * const wasm = await loadWasm(WasmBackend.Cpp); // force C++
 *
 * // wasm.exports mirrors the AssemblyScript module API plus optional C++ extras
 * const ptr = wasm.exports.allocAsteroids(10);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const enum WasmBackend {
    AssemblyScript = 'assemblyscript',
    Cpp            = 'cpp',
}

/** The subset of WASM exports that both backends provide. */
export interface CoreWasmExports {
    memory: WebAssembly.Memory;
    allocAsteroids(count: number): number;
    checkCollision(playerX: number, playerY: number, playerRadius: number, objectCount: number): number;
    allocSporeClouds(count: number): number;
    checkSporeCollision(playerX: number, playerY: number, playerZ: number, playerRadius: number, objectCount: number): number;
    allocBossHitboxes(count: number): number;
    checkBossCollision(projX: number, projY: number, projRadius: number, hitboxCount: number): number;
    allocObjects(count: number): number;
    freeObjects(): void;
    getObjectPtr(): number;
}

/** Extra exports available only in the C++ backend. */
export interface CppExtrasExports {
    // Verlet physics
    allocPhysicsBodies(count: number): number;
    stepPhysics(count: number, dt: number, gravity: number): void;
    getBodyPositionX(index: number): number;
    getBodyPositionY(index: number): number;
    setBodyPosition(index: number, x: number, y: number): void;
    addBodyAcceleration(index: number, ax: number, ay: number): void;
    getBodyRadius(index: number): number;
    // Noise
    simplexNoise2D(x: number, y: number): number;
    simplexNoise3D(x: number, y: number, z: number): number;
    fractalNoise2D(x: number, y: number, octaves: number, lacunarity: number, gain: number): number;
    fractalNoise3D(x: number, y: number, z: number, octaves: number, lacunarity: number, gain: number): number;
}

export type WasmExports = CoreWasmExports & Partial<CppExtrasExports>;

export interface WasmHandle {
    /** Raw WASM export object. */
    exports: WasmExports;
    /** Float32Array view over the WASM linear memory (refreshed on growth). */
    memory: Float32Array;
    /** Which backend is currently active. */
    backend: WasmBackend;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Minimal WASI stubs required by Emscripten standalone WASM. */
function wasiImports() {
    return {
        wasi_snapshot_preview1: {
            fd_write:           () => 0,
            fd_read:            () => 0,
            fd_close:           () => 0,
            fd_seek:            () => 0,
            proc_exit:          () => { /* intentional no-op */ },
            environ_get:        () => 0,
            environ_sizes_get:  () => 0,
        },
    };
}

async function fetchAndInstantiate(
    url: string,
    importObject: WebAssembly.Imports,
): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
    }
    const buffer = await response.arrayBuffer();
    return WebAssembly.instantiate(buffer, importObject);
}

// ---------------------------------------------------------------------------
// Backend loaders
// ---------------------------------------------------------------------------

async function loadAssemblyScript(): Promise<WasmHandle> {
    const { instance } = await fetchAndInstantiate('./build/optimized.wasm', {
        env: { abort: () => console.warn('[WASM-AS] abort() called') },
    });
    const exports = instance.exports as unknown as WasmExports;
    console.log('✅ AssemblyScript WASM loaded');
    return {
        exports,
        memory: new Float32Array((exports.memory as WebAssembly.Memory).buffer),
        backend: WasmBackend.AssemblyScript,
    };
}

async function loadCpp(): Promise<WasmHandle> {
    const { instance } = await fetchAndInstantiate('./build/game_cpp.wasm', wasiImports());
    const exports = instance.exports as unknown as WasmExports;
    console.log('✅ C++ WASM loaded');
    return {
        exports,
        memory: new Float32Array((exports.memory as WebAssembly.Memory).buffer),
        backend: WasmBackend.Cpp,
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the WASM backend.
 *
 * @param backend  Override the backend to use.  Defaults to:
 *                 - C++            if `import.meta.env.VITE_CPP_WASM === 'true'`
 *                 - AssemblyScript otherwise
 *
 * If the requested backend fails to load, the loader falls back to
 * AssemblyScript automatically (C++ → AS fallback only).
 *
 * Returns `null` if both backends fail.
 */
export async function loadWasm(backend?: WasmBackend): Promise<WasmHandle | null> {
    const useCpp =
        backend === WasmBackend.Cpp ||
        (backend === undefined &&
            typeof import.meta !== 'undefined' &&
            (import.meta as Record<string, any>).env?.VITE_CPP_WASM === 'true');

    if (useCpp) {
        try {
            return await loadCpp();
        } catch (err) {
            console.warn('⚠️ C++ WASM unavailable, falling back to AssemblyScript:', err);
        }
    }

    try {
        return await loadAssemblyScript();
    } catch (err) {
        console.error('❌ Failed to load AssemblyScript WASM:', err);
        return null;
    }
}

/**
 * Refresh the Float32Array memory view on the handle.
 * Call this whenever WASM linear memory may have grown (e.g. after `alloc*`).
 */
export function refreshMemoryView(handle: WasmHandle): Float32Array {
    handle.memory = new Float32Array((handle.exports.memory as WebAssembly.Memory).buffer);
    return handle.memory;
}
