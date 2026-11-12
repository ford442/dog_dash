/**
 * wasm_loader.ts
 * Unified WASM loader for Dog Dash.
 *
 * Supported product backend:
 *   - AssemblyScript (default)  — public/build/optimized.wasm
 *     Provides collision, Verlet soft-body physics, and fractal noise —
 *     everything gameplay needs, always built (see docs/WASM_BACKENDS.md).
 *
 * Experimental research tree (not a shipping target; not required for
 * onboarding; see docs/WASM_BACKENDS.md):
 *   - C++ / Emscripten          — public/build/game_cpp.wasm
 *     Opt-in via VITE_CPP_WASM=true (researcher flag). Mirrors the AS
 *     spatial-hash ABI; the loader FAILS CLOSED on a C++ binary that lacks
 *     SPATIAL_HASH_EXPORTS (console.error + window.wasmBackendRejected) and
 *     loads AssemblyScript instead, so a stale research binary can never
 *     silently push collision onto the JS brute-force path.
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

/**
 * Collision exports. Legacy linear scans and the spatial hash exist on both
 * binaries (C++ mirrors assembly/spatial_hash.ts; the loader rejects a C++
 * binary without it). `allocObjects` / `freeObjects` / `getObjectPtr` are
 * AssemblyScript-only and unused by gameplay.
 */
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
    /**
     * Uniform-grid spatial hash (AssemblyScript shipping path; mirrored by the C++
     * research tree). Typed optional so hand-built test handles stay valid; loadWasm()
     * only returns a C++ handle that has all of SPATIAL_HASH_EXPORTS.
     */
    allocEntities?(count: number): number;
    getEntityPtr?(): number;
    getEntityCount?(): number;
    rebuildGrid?(cellSize: number): void;
    queryRadius?(x: number, y: number, z: number, r: number, layerMask: number): number;
    queryRadiusSimd?(x: number, y: number, z: number, r: number, layerMask: number): number;
    queryRadiusFirst?(x: number, y: number, z: number, r: number, layerMask: number): number;
    getQueryResultPtr?(): number;
    getQueryCount?(): number;
    simdSupported?(): number;
}

/**
 * Verlet soft-body physics + fractal noise exports. Ported into
 * `assembly/index.ts` (see docs/WASM_BACKENDS.md — decision: AssemblyScript
 * is the single supported, always-built backend), so these are present in
 * the default build. The experimental `cpp/` tree still mirrors this API for
 * research use (SIMD prototyping, native profiling); `Partial` keeps callers
 * null-safe against an older cached binary either way.
 *
 * Gameplay consumers: `jelly_moss_softbody.ts` and Vacuum Kelp
 * (`geological/vacuum_kelp.ts`) share `verlet_body_pool.ts`; `biome_noise.ts`
 * uses fractal noise.
 */
export interface PhysicsNoiseExports {
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

export type WasmExports = CoreWasmExports & Partial<PhysicsNoiseExports>;

/**
 * Spatial-hash ABI `SpatialIndex` drives. A C++ research binary missing any of
 * these is rejected at load (see loadCpp). Keep in sync with cpp/build.sh
 * EXPORTED_FUNCTIONS and scripts/spatial_hash_fixture.mjs.
 */
export const SPATIAL_HASH_EXPORTS = [
    'allocEntities',
    'getEntityPtr',
    'getEntityCount',
    'rebuildGrid',
    'queryRadius',
    'queryRadiusSimd',
    'queryRadiusFirst',
    'getQueryResultPtr',
    'getQueryCount',
    'simdSupported',
] as const;

/** Names from SPATIAL_HASH_EXPORTS that `exports` does not provide as functions. */
export function missingSpatialHashExports(exports: object): string[] {
    const record = exports as Record<string, unknown>;
    return SPATIAL_HASH_EXPORTS.filter((name) => typeof record[name] !== 'function');
}

export interface WasmHandle {
    /** Raw WASM export object. */
    exports: WasmExports;
    /** Float32Array view over the WASM linear memory (refreshed on growth). */
    memory: Float32Array;
    /** Int32 view of the same buffer (query result ids). Refreshed with memory. */
    i32Memory: Int32Array;
    /** Which backend is currently active. */
    backend: WasmBackend;
    /** True when this process validated v128 and the module exported SIMD query. */
    simd: boolean;
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

function publishWasmBackendBreadcrumb(backend: WasmBackend | null): void {
    if (typeof window === 'undefined') return;
    window.wasmBackend = backend;
}

function publishWasmRejectedBreadcrumb(reason: string | null): void {
    if (typeof window === 'undefined') return;
    window.wasmBackendRejected = reason;
}

declare global {
    interface Window {
        wasmBackend?: string | null;
        /** Why a requested backend was refused (e.g. stale C++ binary without the spatial hash); null when none was. */
        wasmBackendRejected?: string | null;
    }
}

function wrapInstance(exports: WasmExports, backend: WasmBackend): WasmHandle {
    const buffer = (exports.memory as WebAssembly.Memory).buffer;
    return {
        exports,
        memory: new Float32Array(buffer),
        i32Memory: new Int32Array(buffer),
        backend,
        // simdSupported() is 0 on C++ debug builds (no -msimd128): queryRadiusSimd is scalar there.
        simd:
            detectWasmSimd() &&
            typeof exports.queryRadiusSimd === 'function' &&
            (typeof exports.simdSupported !== 'function' || exports.simdSupported() !== 0),
    };
}

async function loadAssemblyScript(): Promise<WasmHandle> {
    if (!detectWasmSimd()) {
        throw new Error('WebAssembly SIMD (v128) is required for optimized.wasm; using JS collision fallback');
    }
    const { instance } = await fetchAndInstantiate('./build/optimized.wasm', {
        env: { abort: () => console.warn('[WASM-AS] abort() called') },
    });
    const exports = instance.exports as unknown as WasmExports;
    console.log('✅ AssemblyScript WASM loaded (spatial hash, SIMD=', detectWasmSimd(), ')');
    return wrapInstance(exports, WasmBackend.AssemblyScript);
}

async function loadCpp(): Promise<WasmHandle> {
    const { instance } = await fetchAndInstantiate('./build/game_cpp.wasm', cppImports());
    const raw = instance.exports as Record<string, unknown>;
    const missing = missingSpatialHashExports(raw);
    if (missing.length > 0) {
        // Fail closed: a binary that cannot drive SpatialIndex would silently
        // move collision to the JS brute-force path and look like parity.
        const reason = `cpp: game_cpp.wasm is missing spatial-hash exports (${missing.join(', ')}); rebuild with npm run build:cpp-wasm`;
        console.error(`❌ Rejected experimental C++ WASM — ${reason}`);
        publishWasmRejectedBreadcrumb(reason);
        throw new Error(reason);
    }
    // Emscripten standalone reactor: run static init before the first call.
    if (typeof raw._initialize === 'function') (raw._initialize as () => void)();
    const exports = raw as unknown as WasmExports;
    console.log('✅ C++ WASM loaded (experimental research binary, spatial hash present)');
    return wrapInstance(exports, WasmBackend.Cpp);
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
 * If the requested C++ backend fails to load — or is rejected for missing
 * SPATIAL_HASH_EXPORTS (`window.wasmBackendRejected` says why) — the loader
 * falls back to AssemblyScript. Returns `null` if AssemblyScript also fails (callers must
 * tolerate null exports — obstacle checks use a JS fallback).
 */
export async function loadWasm(backend?: WasmBackend): Promise<WasmHandle | null> {
    const useCpp =
        backend === WasmBackend.Cpp ||
        (backend === undefined &&
            typeof import.meta !== 'undefined' &&
            (import.meta as Record<string, any>).env?.VITE_CPP_WASM === 'true');

    publishWasmRejectedBreadcrumb(null);
    if (useCpp) {
        try {
            const handle = await loadCpp();
            publishWasmBackendBreadcrumb(handle.backend);
            return handle;
        } catch (err) {
            console.warn('⚠️ Experimental C++ WASM unavailable, falling back to AssemblyScript:', err);
            if (typeof window !== 'undefined' && !window.wasmBackendRejected) {
                publishWasmRejectedBreadcrumb(`cpp: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    try {
        const handle = await loadAssemblyScript();
        publishWasmBackendBreadcrumb(handle.backend);
        return handle;
    } catch (err) {
        console.error('❌ Failed to load AssemblyScript WASM:', err);
        publishWasmBackendBreadcrumb(null);
        return null;
    }
}

/**
 * Refresh the Float32Array memory view on the handle.
 * Call this whenever WASM linear memory may have grown (e.g. after `alloc*`).
 */
export function refreshMemoryView(handle: WasmHandle): Float32Array {
    const buffer = (handle.exports.memory as WebAssembly.Memory).buffer;
    handle.memory = new Float32Array(buffer);
    handle.i32Memory = new Int32Array(buffer);
    return handle.memory;
}

/**
 * Feature-detect v128. The shipping `asc --enable simd` module will not
 * instantiate on engines without SIMD; callers then use the JS fallback.
 */
export function detectWasmSimd(): boolean {
    const bytes = new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
        10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
    ]);
    try {
        return WebAssembly.validate(bytes);
    } catch {
        return false;
    }
}
