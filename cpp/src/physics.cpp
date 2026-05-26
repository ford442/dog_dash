// physics.cpp
// Verlet-integration physics for Dog Dash debris / projectiles.
//
// Body memory layout (8 floats = 32 bytes per body):
//   [0] x        current position X
//   [1] y        current position Y
//   [2] prevX    previous position X
//   [3] prevY    previous position Y
//   [4] accX     accumulated acceleration X (reset each step)
//   [5] accY     accumulated acceleration Y (reset each step)
//   [6] mass     body mass (reserved for future force calculations)
//   [7] radius   collision radius

#include "physics.h"
#include <cstdlib>
#include <cmath>

#define BODY_FLOATS 8

static float* g_bodiesPtr      = nullptr;
static int    g_bodiesCapacity = 0;

// ---------------------------------------------------------------------------
// Buffer management
// ---------------------------------------------------------------------------
uintptr_t allocPhysicsBodies(int count) {
    if (count > g_bodiesCapacity) {
        free(g_bodiesPtr);
        g_bodiesPtr      = static_cast<float*>(calloc(static_cast<size_t>(count) * BODY_FLOATS, sizeof(float)));
        g_bodiesCapacity = count;
    }
    return reinterpret_cast<uintptr_t>(g_bodiesPtr);
}

// ---------------------------------------------------------------------------
// Simulation step
// ---------------------------------------------------------------------------
void stepPhysics(int count, float dt, float gravity) {
    if (g_bodiesPtr == nullptr || count <= 0) return;

    const float dt2 = dt * dt;

    for (int i = 0; i < count; ++i) {
        float* b = &g_bodiesPtr[i * BODY_FLOATS];

        const float x  = b[0];
        const float y  = b[1];
        const float px = b[2];
        const float py = b[3];

        // Apply gravity to accumulated Y acceleration
        const float ax = b[4];
        const float ay = b[5] + gravity;

        // Verlet integration: pos_new = 2*pos - pos_prev + acc * dt^2
        b[0] = 2.0f * x - px + ax * dt2;
        b[1] = 2.0f * y - py + ay * dt2;

        // Shift: prev = current
        b[2] = x;
        b[3] = y;

        // Reset per-step acceleration
        b[4] = 0.0f;
        b[5] = 0.0f;
    }
}

// ---------------------------------------------------------------------------
// Per-body accessors (used from JS when direct memory views are impractical)
// ---------------------------------------------------------------------------
float getBodyPositionX(int index) {
    if (g_bodiesPtr == nullptr || index < 0 || index >= g_bodiesCapacity) return 0.0f;
    return g_bodiesPtr[index * BODY_FLOATS + 0];
}

float getBodyPositionY(int index) {
    if (g_bodiesPtr == nullptr || index < 0 || index >= g_bodiesCapacity) return 0.0f;
    return g_bodiesPtr[index * BODY_FLOATS + 1];
}

void setBodyPosition(int index, float x, float y) {
    if (g_bodiesPtr == nullptr || index < 0 || index >= g_bodiesCapacity) return;
    // Move the body to (x,y) without a velocity impulse
    float* b = &g_bodiesPtr[index * BODY_FLOATS];
    b[2] = b[0] = x;
    b[3] = b[1] = y;
}

void addBodyAcceleration(int index, float ax, float ay) {
    if (g_bodiesPtr == nullptr || index < 0 || index >= g_bodiesCapacity) return;
    g_bodiesPtr[index * BODY_FLOATS + 4] += ax;
    g_bodiesPtr[index * BODY_FLOATS + 5] += ay;
}

float getBodyRadius(int index) {
    if (g_bodiesPtr == nullptr || index < 0 || index >= g_bodiesCapacity) return 0.0f;
    return g_bodiesPtr[index * BODY_FLOATS + 7];
}
