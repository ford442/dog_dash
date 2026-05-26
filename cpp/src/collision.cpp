// collision.cpp
// C++ WASM collision detection for Dog Dash.
// Mirrors the AssemblyScript assembly/index.ts API exactly so both backends
// expose the same JS-callable interface.
//
// Memory layout (matches AS version):
//   Asteroids    : [x, y, radius]     — 3 x f32 = 12 bytes per entry
//   Spore Clouds : [x, y, z, radius]  — 4 x f32 = 16 bytes per entry
//   Boss Hitboxes: [x, y, radius]     — 3 x f32 = 12 bytes per entry

#include "collision.h"
#include <cstdlib>
#include <cstring>

// ---------------------------------------------------------------------------
// Asteroid buffer
// ---------------------------------------------------------------------------
static float* g_asteroidsPtr      = nullptr;
static int    g_asteroidsCapacity = 0;

uintptr_t allocAsteroids(int count) {
    if (count > g_asteroidsCapacity) {
        free(g_asteroidsPtr);
        g_asteroidsPtr      = static_cast<float*>(malloc(static_cast<size_t>(count) * 3 * sizeof(float)));
        g_asteroidsCapacity = count;
    }
    return reinterpret_cast<uintptr_t>(g_asteroidsPtr);
}

int checkCollision(float playerX, float playerY, float playerRadius, int objectCount) {
    if (objectCount == 0 || g_asteroidsPtr == nullptr) return -1;

    for (int i = 0; i < objectCount; ++i) {
        const float objX = g_asteroidsPtr[i * 3 + 0];
        const float objY = g_asteroidsPtr[i * 3 + 1];
        const float objR = g_asteroidsPtr[i * 3 + 2];

        const float dx     = playerX - objX;
        const float dy     = playerY - objY;
        const float distSq = dx * dx + dy * dy;
        const float radii  = playerRadius + objR;

        if (distSq < radii * radii) return i;
    }
    return -1;
}

// ---------------------------------------------------------------------------
// Spore Cloud buffer
// ---------------------------------------------------------------------------
static float* g_sporeCloudsPtr      = nullptr;
static int    g_sporeCloudsCapacity = 0;

uintptr_t allocSporeClouds(int count) {
    if (count > g_sporeCloudsCapacity) {
        free(g_sporeCloudsPtr);
        g_sporeCloudsPtr      = static_cast<float*>(malloc(static_cast<size_t>(count) * 4 * sizeof(float)));
        g_sporeCloudsCapacity = count;
    }
    return reinterpret_cast<uintptr_t>(g_sporeCloudsPtr);
}

int checkSporeCollision(float playerX, float playerY, float playerZ,
                        float playerRadius, int objectCount) {
    if (objectCount == 0 || g_sporeCloudsPtr == nullptr) return -1;

    for (int i = 0; i < objectCount; ++i) {
        const float objX = g_sporeCloudsPtr[i * 4 + 0];
        const float objY = g_sporeCloudsPtr[i * 4 + 1];
        const float objZ = g_sporeCloudsPtr[i * 4 + 2];
        const float objR = g_sporeCloudsPtr[i * 4 + 3];

        const float dx     = playerX - objX;
        const float dy     = playerY - objY;
        const float dz     = playerZ - objZ;
        const float distSq = dx * dx + dy * dy + dz * dz;
        const float radii  = playerRadius + objR;

        if (distSq < radii * radii) return i;
    }
    return -1;
}

// ---------------------------------------------------------------------------
// Boss Hitbox buffer
// ---------------------------------------------------------------------------
static float* g_bossHitboxPtr      = nullptr;
static int    g_bossHitboxCapacity = 0;

uintptr_t allocBossHitboxes(int count) {
    if (count > g_bossHitboxCapacity) {
        free(g_bossHitboxPtr);
        g_bossHitboxPtr      = static_cast<float*>(malloc(static_cast<size_t>(count) * 3 * sizeof(float)));
        g_bossHitboxCapacity = count;
    }
    return reinterpret_cast<uintptr_t>(g_bossHitboxPtr);
}

int checkBossCollision(float projX, float projY, float projRadius, int hitboxCount) {
    if (hitboxCount == 0 || g_bossHitboxPtr == nullptr) return -1;

    for (int i = 0; i < hitboxCount; ++i) {
        const float hbX = g_bossHitboxPtr[i * 3 + 0];
        const float hbY = g_bossHitboxPtr[i * 3 + 1];
        const float hbR = g_bossHitboxPtr[i * 3 + 2];

        const float dx     = projX - hbX;
        const float dy     = projY - hbY;
        const float distSq = dx * dx + dy * dy;
        const float radii  = projRadius + hbR;

        if (distSq < radii * radii) return i;
    }
    return -1;
}
