// noise.cpp
// Fast Simplex Noise for Dog Dash procedural generation.
//
// Implements 2-D and 3-D OpenSimplex / Improved-Perlin simplex noise after
// Stefan Gustavson's public-domain reference (simplex-noise.pdf, 2005) and
// Ken Perlin's improved permutation table.
//
// Exposed functions (extern "C"):
//   float simplexNoise2D(float x, float y)          → [-1, 1]
//   float simplexNoise3D(float x, float y, float z)  → [-1, 1]
//   float fractalNoise2D(float x, float y, int octaves, float lacunarity, float gain)
//   float fractalNoise3D(float x, float y, float z, int octaves, float lacunarity, float gain)

#include "noise.h"
#include <cmath>

// ---------------------------------------------------------------------------
// Permutation table (Ken Perlin's reference)
// ---------------------------------------------------------------------------
static const int PERM_BASE[256] = {
    151,160,137, 91, 90, 15,131, 13,201, 95, 96, 53,194,233,  7,225,
    140, 36,103, 30, 69,142,  8, 99, 37,240, 21, 10, 23,190,  6,148,
    247,120,234, 75,  0, 26,197, 62, 94,252,219,203,117, 35, 11, 32,
     57,177, 33, 88,237,149, 56, 87,174, 20,125,136,171,168, 68,175,
     74,165, 71,134,139, 48, 27,166, 77,146,158,231, 83,111,229,122,
     60,211,133,230,220,105, 92, 41, 55, 46,245, 40,244,102,143, 54,
     65, 25, 63,161,  1,216, 80, 73,209, 76,132,187,208, 89, 18,169,
    200,196,135,130,116,188,159, 86,164,100,109,198,173,186,  3, 64,
     52,217,226,250,124,123,  5,202, 38,147,118,126,255, 82, 85,212,
    207,206, 59,227, 47, 16, 58, 17,182,189, 28, 42,223,183,170,213,
    119,248,152,  2, 44,154,163, 70,221,153,101,155,167, 43,172,  9,
    129, 22, 39,253, 19, 98,108,110, 79,113,224,232,178,185,112,104,
    218,246, 97,228,251, 34,242,193,238,210,144, 12,191,179,162,241,
     81, 51,145,235,249, 14,239,107, 49,192,214, 31,181,199,106,157,
    184, 84,204,176,115,121, 50, 45,127,  4,150,254,138,236,205, 93,
    222,114, 67, 29, 24, 72,243,141,128,195, 78, 66,215, 61,156,180
};

static int perm[512];
static int perm12[512];

static bool s_permInitialized = false;
static void initPerm() {
    if (s_permInitialized) return;
    for (int i = 0; i < 512; ++i) {
        perm[i]   = PERM_BASE[i & 255];
        perm12[i] = perm[i] % 12;
    }
    s_permInitialized = true;
}

// ---------------------------------------------------------------------------
// 2-D Simplex Noise helpers
// ---------------------------------------------------------------------------
static const float GRAD3[12][3] = {
    { 1, 1, 0},{ -1, 1, 0},{ 1,-1, 0},{ -1,-1, 0},
    { 1, 0, 1},{ -1, 0, 1},{ 1, 0,-1},{ -1, 0,-1},
    { 0, 1, 1},{  0,-1, 1},{ 0, 1,-1},{  0,-1,-1}
};

static inline float dot2(const float g[3], float x, float y) {
    return g[0] * x + g[1] * y;
}

float simplexNoise2D(float xin, float yin) {
    initPerm();

    const float F2 = 0.5f * (sqrtf(3.0f) - 1.0f);
    const float G2 = (3.0f - sqrtf(3.0f)) / 6.0f;

    const float s  = (xin + yin) * F2;
    const int   i  = static_cast<int>(floorf(xin + s));
    const int   j  = static_cast<int>(floorf(yin + s));
    const float t  = static_cast<float>(i + j) * G2;
    const float X0 = static_cast<float>(i) - t;
    const float Y0 = static_cast<float>(j) - t;
    const float x0 = xin - X0;
    const float y0 = yin - Y0;

    int i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else          { i1 = 0; j1 = 1; }

    const float x1 = x0 - static_cast<float>(i1) + G2;
    const float y1 = y0 - static_cast<float>(j1) + G2;
    const float x2 = x0 - 1.0f + 2.0f * G2;
    const float y2 = y0 - 1.0f + 2.0f * G2;

    const int ii = i & 255;
    const int jj = j & 255;
    const int gi0 = perm12[ii      + perm[jj     ]];
    const int gi1 = perm12[ii + i1 + perm[jj + j1]];
    const int gi2 = perm12[ii +  1 + perm[jj +  1]];

    float n0 = 0.0f, n1 = 0.0f, n2 = 0.0f;
    float t0 = 0.5f - x0 * x0 - y0 * y0;
    if (t0 >= 0.0f) { t0 *= t0; n0 = t0 * t0 * dot2(GRAD3[gi0], x0, y0); }
    float t1 = 0.5f - x1 * x1 - y1 * y1;
    if (t1 >= 0.0f) { t1 *= t1; n1 = t1 * t1 * dot2(GRAD3[gi1], x1, y1); }
    float t2 = 0.5f - x2 * x2 - y2 * y2;
    if (t2 >= 0.0f) { t2 *= t2; n2 = t2 * t2 * dot2(GRAD3[gi2], x2, y2); }

    // Scale to [-1, 1]
    return 70.0f * (n0 + n1 + n2);
}

// ---------------------------------------------------------------------------
// 3-D Simplex Noise helpers
// ---------------------------------------------------------------------------
static inline float dot3(const float g[3], float x, float y, float z) {
    return g[0] * x + g[1] * y + g[2] * z;
}

float simplexNoise3D(float xin, float yin, float zin) {
    initPerm();

    const float F3 = 1.0f / 3.0f;
    const float G3 = 1.0f / 6.0f;

    const float s  = (xin + yin + zin) * F3;
    const int   i  = static_cast<int>(floorf(xin + s));
    const int   j  = static_cast<int>(floorf(yin + s));
    const int   k  = static_cast<int>(floorf(zin + s));
    const float t  = static_cast<float>(i + j + k) * G3;

    const float x0 = xin - (static_cast<float>(i) - t);
    const float y0 = yin - (static_cast<float>(j) - t);
    const float z0 = zin - (static_cast<float>(k) - t);

    int i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
        if      (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
        else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
        else               { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
        if      (y0 < z0)  { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
        else if (x0 < z0)  { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
        else               { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }

    const float x1 = x0 - static_cast<float>(i1) + G3;
    const float y1 = y0 - static_cast<float>(j1) + G3;
    const float z1 = z0 - static_cast<float>(k1) + G3;
    const float x2 = x0 - static_cast<float>(i2) + 2.0f * G3;
    const float y2 = y0 - static_cast<float>(j2) + 2.0f * G3;
    const float z2 = z0 - static_cast<float>(k2) + 2.0f * G3;
    const float x3 = x0 - 1.0f + 3.0f * G3;
    const float y3 = y0 - 1.0f + 3.0f * G3;
    const float z3 = z0 - 1.0f + 3.0f * G3;

    const int ii = i & 255;
    const int jj = j & 255;
    const int kk = k & 255;
    const int gi0 = perm12[ii      + perm[jj      + perm[kk     ]]];
    const int gi1 = perm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
    const int gi2 = perm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
    const int gi3 = perm12[ii +  1 + perm[jj +  1 + perm[kk +  1]]];

    float n0 = 0.0f, n1 = 0.0f, n2 = 0.0f, n3 = 0.0f;
    float t0 = 0.6f - x0*x0 - y0*y0 - z0*z0;
    if (t0 >= 0.0f) { t0 *= t0; n0 = t0 * t0 * dot3(GRAD3[gi0], x0, y0, z0); }
    float t1 = 0.6f - x1*x1 - y1*y1 - z1*z1;
    if (t1 >= 0.0f) { t1 *= t1; n1 = t1 * t1 * dot3(GRAD3[gi1], x1, y1, z1); }
    float t2 = 0.6f - x2*x2 - y2*y2 - z2*z2;
    if (t2 >= 0.0f) { t2 *= t2; n2 = t2 * t2 * dot3(GRAD3[gi2], x2, y2, z2); }
    float t3 = 0.6f - x3*x3 - y3*y3 - z3*z3;
    if (t3 >= 0.0f) { t3 *= t3; n3 = t3 * t3 * dot3(GRAD3[gi3], x3, y3, z3); }

    // Scale to [-1, 1]
    return 32.0f * (n0 + n1 + n2 + n3);
}

// ---------------------------------------------------------------------------
// Fractal (fBm) helpers
// ---------------------------------------------------------------------------
float fractalNoise2D(float x, float y, int octaves, float lacunarity, float gain) {
    float value     = 0.0f;
    float amplitude = 1.0f;
    float frequency = 1.0f;
    float max_value = 0.0f;

    for (int i = 0; i < octaves; ++i) {
        value     += simplexNoise2D(x * frequency, y * frequency) * amplitude;
        max_value += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return value / max_value;
}

float fractalNoise3D(float x, float y, float z, int octaves, float lacunarity, float gain) {
    float value     = 0.0f;
    float amplitude = 1.0f;
    float frequency = 1.0f;
    float max_value = 0.0f;

    for (int i = 0; i < octaves; ++i) {
        value     += simplexNoise3D(x * frequency, y * frequency, z * frequency) * amplitude;
        max_value += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return value / max_value;
}
