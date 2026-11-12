// bench_spatial_hash.cpp — native queryRadius microbench (research only).
//
// Measures rebuildGrid + queryRadius on large uniform entity sets so layout /
// cell-size / SIMD experiments in cpp/src/spatial_hash.cpp can be compared on
// the same machine. Winners get ported back to assembly/spatial_hash.ts and
// re-checked against the golden fixture; numbers here never gate CI.
//
//   bench_spatial_hash [entities=4000] [queries=20000] [cell=8]

#include "spatial_hash.h"

#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>

namespace {

uint32_t g_seed = 0x5eedu;
float rnd() {
    g_seed = g_seed * 1664525u + 1013904223u;
    return static_cast<float>(g_seed) / 4294967296.0f;
}

double nowMs() {
    using clock = std::chrono::steady_clock;
    return std::chrono::duration<double, std::milli>(clock::now().time_since_epoch()).count();
}

} // namespace

int main(int argc, char** argv) {
    const int entities = argc > 1 ? std::atoi(argv[1]) : 4000;
    const int queries = argc > 2 ? std::atoi(argv[2]) : 20000;
    const float cell = argc > 3 ? static_cast<float>(std::atof(argv[3])) : 8.0f;

    // Endless-style corridor: long in X, shallow in Y/Z.
    float* buf = reinterpret_cast<float*>(allocEntities(entities));
    if (buf == nullptr || getEntityCount() != entities) {
        std::fprintf(stderr, "allocEntities(%d) failed\n", entities);
        return 1;
    }
    for (int i = 0; i < entities; ++i) {
        float* o = buf + i * 6;
        o[0] = rnd() * 2000.0f;
        o[1] = rnd() * 60.0f - 30.0f;
        o[2] = rnd() * 20.0f - 10.0f;
        o[3] = 0.3f + rnd() * 3.0f;
        o[4] = static_cast<float>(1 << (i % 4));
        o[5] = static_cast<float>(i);
    }

    const int rebuildIters = 50;
    double t0 = nowMs();
    for (int i = 0; i < rebuildIters; ++i) rebuildGrid(cell);
    const double rebuildMs = (nowMs() - t0) / rebuildIters;

    long long hits = 0;
    t0 = nowMs();
    for (int i = 0; i < queries; ++i) {
        hits += queryRadius(rnd() * 2000.0f, rnd() * 60.0f - 30.0f, rnd() * 20.0f - 10.0f, 1.5f, 0xF);
    }
    const double queryMs = nowMs() - t0;

    std::printf("entities=%d cell=%.2f  rebuildGrid=%.3f ms  queryRadius=%.3f us/query  (%d queries, %lld hits, simd=%d)\n",
                entities, cell, rebuildMs, queryMs * 1000.0 / queries, queries, hits, simdSupported());
    return 0;
}
