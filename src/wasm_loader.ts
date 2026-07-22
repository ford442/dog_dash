/**
 * wasm_loader.ts
 * Unified WASM loader for Dog Dash.
 *
 * Supported product backend:
 *   - AssemblyScript (default)  — public/build/optimized.wasm
 *
 * Experimental (not required for onboarding; see docs/WASM_BACKENDS.md):
 *   - C++ / Emscripten          — public/build/game_cpp.wasm
 *     Opt-in via VITE_CPP_WASM=true; falls back to AssemblyScript if missing.
 *
 * Usage
 * ─────
 * import { loadWasm, type WasmHandle, type WasmExports } from './wasm_loader';
 *
 * const wasm = await loadWasm();          // AssemblyScript by default
 * const ptr = wasm?.exports.allocAsteroids(10);
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

/** Extra exports available only in the experimental C++ backend (unused by gameplay today). */
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

/** Minimal imports required by Emscripten standalone WASM. */
function cppImports(): WebAssembly.Imports {
    return {
        env: {
            emscripten_notify_memory_growth: () => { /* no-op; refresh via refreshMemoryView() */ },
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
    const { instance } = await fetchAndInstantiate('./build/game_cpp.wasm', cppImports());
    const exports = instance.exports as unknown as WasmExports;
    console.log('✅ C++ WASM loaded (experimental)');
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
 *                 - C++ (experimental) if `import.meta.env.VITE_CPP_WASM === 'true'`
 *                 - AssemblyScript otherwise (supported product path)
 *
 * If the requested C++ backend fails to load, the loader falls back to
 * AssemblyScript. Returns `null` if AssemblyScript also fails (callers must
 * tolerate null exports — obstacle checks use a JS fallback).
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
            console.warn('⚠️ Experimental C++ WASM unavailable, falling back to AssemblyScript:', err);
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
