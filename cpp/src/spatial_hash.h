// spatial_hash.h — public API for spatial_hash.cpp
//
// Research mirror of assembly/spatial_hash.ts (the shipping AssemblyScript
// collision path). Export names, argument order, buffer layout and query
// semantics match the AS module so src/wasm_loader.ts / src/spatial_index.ts
// can drive either binary. See docs/WASM_BACKENDS.md.
//
// Entity AOS layout (f32 × 6 = 24 bytes): x, y, z, radius, layer, id
// Query results: i32 ids at getQueryResultPtr(), count from the query return.
#pragma once
#include <cstdint>

extern "C" {

/** Allocate / grow the entity AOS buffer. Returns byte pointer. JS must refreshMemoryView() after. */
uintptr_t allocEntities(int count);
uintptr_t getEntityPtr();
int getEntityCount();

uintptr_t getQueryResultPtr();
int getQueryCount();

/** 1 when the narrow phase was compiled with wasm SIMD128 (release build), else 0. */
int simdSupported();

void rebuildGrid(float cellSize);

/** Scalar narrow phase. Returns hit count; ids at getQueryResultPtr(). */
int queryRadius(float x, float y, float z, float r, int layerMask);
/** v128 narrow phase (scalar when built without -msimd128). */
int queryRadiusSimd(float x, float y, float z, float r, int layerMask);
/** First hit id or -1. */
int queryRadiusFirst(float x, float y, float z, float r, int layerMask);

} // extern "C"
