// spatial_hash.cpp
// Uniform-grid spatial hash for sphere queries — research mirror of
// assembly/spatial_hash.ts. Broad phase first; SIMD only narrows candidates
// gathered from cells.
//
// Parity rules (keep in lockstep with the AS source until a change is
// deliberately being researched — winners get ported back to AS):
//   - same constants (HASH_BITS, MAX_CELL_SPAN, DEFAULT_CELL, MAX_RESULTS)
//   - same cell math (floor in f64, f32 invCell) and hash (wrapping i32 mul)
//   - same bucket / node traversal order, so hit ids come back in the same order
//   - same buffer layout and pointer-returning alloc contract: JS must call
//     refreshMemoryView() after allocEntities / rebuildGrid / queries, since
//     any of them can grow linear memory.
//
// Deliberate differences (research tree only, documented in WASM_BACKENDS.md):
//   - allocation failure keeps the old buffer instead of aborting the module
//   - grown `visited` stamps are zeroed (AS relies on fresh heap memory)
//
// See docs/WASM_BACKENDS.md.

#include "spatial_hash.h"
#include <cmath>
#include <cstdlib>
#include <cstring>

#if defined(__wasm_simd128__)
#include <wasm_simd128.h>
#endif

namespace {

constexpr int ENTITY_STRIDE = 6; // x, y, z, radius, layer, id (f32)

constexpr int HASH_BITS = 12; // 4096 buckets
constexpr int HASH_SIZE = 1 << HASH_BITS;
constexpr int HASH_MASK = HASH_SIZE - 1;

constexpr int MAX_CELL_SPAN = 8;
constexpr float DEFAULT_CELL = 8.0f;
constexpr int MAX_RESULTS = 1024;

float* g_entities = nullptr;
int g_entitiesCapacity = 0;
int g_entityCount = 0;

int32_t* g_buckets = nullptr; // head node index per bucket, -1 empty
int32_t* g_nodes = nullptr;   // pairs: entityIndex, next
int g_nodesCapacity = 0;
int g_nodeCount = 0;

int32_t* g_visited = nullptr;
int g_visitedCapacity = 0;
int32_t g_visitStamp = 1;

int32_t* g_results = nullptr;
int g_resultCount = 0;

// SoA scratch for the narrow phase, padded to a multiple of 4 lanes.
float* g_soaX = nullptr;
float* g_soaY = nullptr;
float* g_soaZ = nullptr;
float* g_soaR = nullptr;
int32_t* g_soaId = nullptr;
int g_soaCapacity = 0;

float g_cellSize = DEFAULT_CELL;
float g_invCell = 1.0f / DEFAULT_CELL;
bool g_gridReady = false;

/** realloc that leaves `ptr` untouched on failure. */
template <typename T>
bool growBuffer(T*& ptr, size_t elems) {
    void* next = std::realloc(ptr, elems * sizeof(T));
    if (next == nullptr) return false;
    ptr = static_cast<T*>(next);
    return true;
}

void ensureBuckets() {
    if (g_buckets != nullptr) return;
    g_buckets = static_cast<int32_t*>(std::malloc(HASH_SIZE * sizeof(int32_t)));
    if (g_buckets == nullptr) return;
    for (int i = 0; i < HASH_SIZE; ++i) g_buckets[i] = -1;
}

void ensureResults() {
    if (g_results != nullptr) return;
    g_results = static_cast<int32_t*>(std::malloc(MAX_RESULTS * sizeof(int32_t)));
}

void ensureVisited(int count) {
    if (count <= g_visitedCapacity && g_visited != nullptr) return;
    const int oldCap = g_visited != nullptr ? g_visitedCapacity : 0;
    if (!growBuffer(g_visited, static_cast<size_t>(count > 0 ? count : 1))) return;
    if (count > oldCap) {
        std::memset(g_visited + oldCap, 0, static_cast<size_t>(count - oldCap) * sizeof(int32_t));
    }
    g_visitedCapacity = count;
}

void ensureSoa(int count) {
    const int padded = (count + 3) & ~3;
    if (padded <= g_soaCapacity && g_soaX != nullptr) return;
    const size_t n = static_cast<size_t>(padded > 0 ? padded : 4);
    if (!growBuffer(g_soaX, n) || !growBuffer(g_soaY, n) || !growBuffer(g_soaZ, n) ||
        !growBuffer(g_soaR, n) || !growBuffer(g_soaId, n)) {
        return;
    }
    g_soaCapacity = padded;
}

void ensureNodes(int needed) {
    if (needed <= g_nodesCapacity && g_nodes != nullptr) return;
    if (!growBuffer(g_nodes, static_cast<size_t>(needed) * 2)) return;
    g_nodesCapacity = needed;
}

inline const float* entityBase(int index) {
    return g_entities + index * ENTITY_STRIDE;
}

inline int hashCell(int ix, int iy, int iz) {
    // Large primes; wrapping i32 multiply (unsigned to avoid UB), power-of-two mask.
    const uint32_t h = (static_cast<uint32_t>(ix) * 73856093u) ^
                       (static_cast<uint32_t>(iy) * 19349663u) ^
                       (static_cast<uint32_t>(iz) * 83492791u);
    return static_cast<int>(h & static_cast<uint32_t>(HASH_MASK));
}

inline int cellOf(float v) {
    return static_cast<int>(std::floor(static_cast<double>(v) * static_cast<double>(g_invCell)));
}

void bumpStamp() {
    ++g_visitStamp;
    if (g_visitStamp == 0) {
        g_visitStamp = 1;
        if (g_visited != nullptr) {
            std::memset(g_visited, 0, static_cast<size_t>(g_visitedCapacity) * sizeof(int32_t));
        }
    }
}

int gatherCandidates(float qx, float qy, float qz, float qr, int layerMask) {
    ensureVisited(g_entityCount);
    ensureSoa(g_entityCount);
    bumpStamp();
    int gathered = 0;

    if (!g_gridReady || g_entityCount == 0 || g_entities == nullptr) return 0;
    if (g_visitedCapacity < g_entityCount || g_soaCapacity < g_entityCount) return 0;

    const int minX = cellOf(qx - qr);
    const int maxX = cellOf(qx + qr);
    const int minY = cellOf(qy - qr);
    const int maxY = cellOf(qy + qr);
    const int minZ = cellOf(qz - qr);
    const int maxZ = cellOf(qz + qr);

    for (int iz = minZ; iz <= maxZ; ++iz) {
        for (int iy = minY; iy <= maxY; ++iy) {
            for (int ix = minX; ix <= maxX; ++ix) {
                int node = g_buckets[hashCell(ix, iy, iz)];
                while (node != -1) {
                    const int ei = g_nodes[node * 2];
                    node = g_nodes[node * 2 + 1];
                    if (ei < 0 || ei >= g_entityCount) continue;
                    if (g_visited[ei] == g_visitStamp) continue;
                    g_visited[ei] = g_visitStamp;

                    const float* e = entityBase(ei);
                    const int layer = static_cast<int>(e[4]);
                    if ((layer & layerMask) == 0) continue;

                    g_soaX[gathered] = e[0];
                    g_soaY[gathered] = e[1];
                    g_soaZ[gathered] = e[2];
                    g_soaR[gathered] = e[3];
                    g_soaId[gathered] = static_cast<int32_t>(e[5]);
                    ++gathered;
                }
            }
        }
    }
    return gathered;
}

inline void writeHit(int32_t id) {
    if (g_resultCount >= MAX_RESULTS) return;
    g_results[g_resultCount++] = id;
}

int narrowPhaseScalar(int gathered, float qx, float qy, float qz, float qr) {
    ensureResults();
    g_resultCount = 0;
    if (g_results == nullptr) return 0;
    for (int i = 0; i < gathered; ++i) {
        const float dx = qx - g_soaX[i];
        const float dy = qy - g_soaY[i];
        const float dz = qz - g_soaZ[i];
        const float rad = qr + g_soaR[i];
        if (dx * dx + dy * dy + dz * dz < rad * rad) writeHit(g_soaId[i]);
    }
    return g_resultCount;
}

#if defined(__wasm_simd128__)
int narrowPhaseSimd(int gathered, float qx, float qy, float qz, float qr) {
    ensureResults();
    g_resultCount = 0;
    if (g_results == nullptr || gathered <= 0) return 0;

    const int padded = (gathered + 3) & ~3;
    // Pad leftover lanes so they cannot false-hit (radius 0, far away).
    for (int p = gathered; p < padded; ++p) {
        g_soaX[p] = 1.0e9f;
        g_soaY[p] = 1.0e9f;
        g_soaZ[p] = 1.0e9f;
        g_soaR[p] = 0.0f;
        g_soaId[p] = -1;
    }

    const v128_t qxv = wasm_f32x4_splat(qx);
    const v128_t qyv = wasm_f32x4_splat(qy);
    const v128_t qzv = wasm_f32x4_splat(qz);
    const v128_t qrv = wasm_f32x4_splat(qr);

    for (int i = 0; i < padded; i += 4) {
        const v128_t xs = wasm_v128_load(g_soaX + i);
        const v128_t ys = wasm_v128_load(g_soaY + i);
        const v128_t zs = wasm_v128_load(g_soaZ + i);
        const v128_t rs = wasm_v128_load(g_soaR + i);

        const v128_t dx = wasm_f32x4_sub(qxv, xs);
        const v128_t dy = wasm_f32x4_sub(qyv, ys);
        const v128_t dz = wasm_f32x4_sub(qzv, zs);
        const v128_t distSq = wasm_f32x4_add(
            wasm_f32x4_add(wasm_f32x4_mul(dx, dx), wasm_f32x4_mul(dy, dy)),
            wasm_f32x4_mul(dz, dz));
        const v128_t rad = wasm_f32x4_add(qrv, rs);
        const v128_t radSq = wasm_f32x4_mul(rad, rad);
        const int hitMask = static_cast<int>(wasm_i32x4_bitmask(wasm_f32x4_lt(distSq, radSq)));

        if ((hitMask & 1) != 0 && i < gathered) writeHit(g_soaId[i]);
        if ((hitMask & 2) != 0 && i + 1 < gathered) writeHit(g_soaId[i + 1]);
        if ((hitMask & 4) != 0 && i + 2 < gathered) writeHit(g_soaId[i + 2]);
        if ((hitMask & 8) != 0 && i + 3 < gathered) writeHit(g_soaId[i + 3]);
    }
    return g_resultCount;
}
#else
int narrowPhaseSimd(int gathered, float qx, float qy, float qz, float qr) {
    // Debug / native host build: no v128. simdSupported() reports 0 so the
    // loader does not mark the handle as SIMD.
    return narrowPhaseScalar(gathered, qx, qy, qz, qr);
}
#endif

} // namespace

uintptr_t allocEntities(int count) {
    if (count < 0) count = 0;
    g_entityCount = count;
    g_gridReady = false;
    if (count == 0) return reinterpret_cast<uintptr_t>(g_entities);
    if (count > g_entitiesCapacity) {
        if (!growBuffer(g_entities, static_cast<size_t>(count) * ENTITY_STRIDE)) {
            // Keep the old buffer; clamp so queries never read past it.
            g_entityCount = g_entitiesCapacity;
            return reinterpret_cast<uintptr_t>(g_entities);
        }
        g_entitiesCapacity = count;
    }
    return reinterpret_cast<uintptr_t>(g_entities);
}

uintptr_t getEntityPtr() {
    return reinterpret_cast<uintptr_t>(g_entities);
}

int getEntityCount() {
    return g_entityCount;
}

uintptr_t getQueryResultPtr() {
    ensureResults();
    return reinterpret_cast<uintptr_t>(g_results);
}

int getQueryCount() {
    return g_resultCount;
}

int simdSupported() {
#if defined(__wasm_simd128__)
    return 1;
#else
    return 0;
#endif
}

void rebuildGrid(float newCellSize) {
    g_cellSize = newCellSize > 0.1f ? newCellSize : DEFAULT_CELL;
    g_invCell = 1.0f / g_cellSize;
    ensureBuckets();
    ensureResults();
    if (g_buckets == nullptr) {
        g_gridReady = false;
        return;
    }

    for (int b = 0; b < HASH_SIZE; ++b) g_buckets[b] = -1;
    g_nodeCount = 0;

    if (g_entityCount == 0 || g_entities == nullptr) {
        g_gridReady = true;
        return;
    }

    // Worst case: each entity in MAX_CELL_SPAN^3 cells (capped below).
    constexpr int maxPerEntity = MAX_CELL_SPAN * MAX_CELL_SPAN * MAX_CELL_SPAN;
    ensureNodes(g_entityCount * maxPerEntity);

    for (int i = 0; i < g_entityCount; ++i) {
        const float* e = entityBase(i);
        const float x = e[0];
        const float y = e[1];
        const float z = e[2];
        const float r = e[3];

        int minX = cellOf(x - r);
        int maxX = cellOf(x + r);
        int minY = cellOf(y - r);
        int maxY = cellOf(y + r);
        int minZ = cellOf(z - r);
        int maxZ = cellOf(z + r);

        if (maxX - minX + 1 > MAX_CELL_SPAN) {
            const int c = cellOf(x);
            minX = c - (MAX_CELL_SPAN >> 1);
            maxX = minX + MAX_CELL_SPAN - 1;
        }
        if (maxY - minY + 1 > MAX_CELL_SPAN) {
            const int c = cellOf(y);
            minY = c - (MAX_CELL_SPAN >> 1);
            maxY = minY + MAX_CELL_SPAN - 1;
        }
        if (maxZ - minZ + 1 > MAX_CELL_SPAN) {
            const int c = cellOf(z);
            minZ = c - (MAX_CELL_SPAN >> 1);
            maxZ = minZ + MAX_CELL_SPAN - 1;
        }

        for (int iz = minZ; iz <= maxZ; ++iz) {
            for (int iy = minY; iy <= maxY; ++iy) {
                for (int ix = minX; ix <= maxX; ++ix) {
                    // Same as AS: only breaks the innermost loop.
                    if (g_nodeCount >= g_nodesCapacity) break;
                    const int bucket = hashCell(ix, iy, iz);
                    g_nodes[g_nodeCount * 2] = i;
                    g_nodes[g_nodeCount * 2 + 1] = g_buckets[bucket];
                    g_buckets[bucket] = g_nodeCount;
                    ++g_nodeCount;
                }
            }
        }
    }
    g_gridReady = true;
}

int queryRadius(float x, float y, float z, float r, int layerMask) {
    const int gathered = gatherCandidates(x, y, z, r, layerMask);
    return narrowPhaseScalar(gathered, x, y, z, r);
}

int queryRadiusSimd(float x, float y, float z, float r, int layerMask) {
    const int gathered = gatherCandidates(x, y, z, r, layerMask);
    return narrowPhaseSimd(gathered, x, y, z, r);
}

int queryRadiusFirst(float x, float y, float z, float r, int layerMask) {
    const int n = queryRadius(x, y, z, r, layerMask);
    if (n <= 0) return -1;
    return g_results[0];
}
