// noise.h — public API for noise.cpp
#pragma once

extern "C" {

// 2-D / 3-D Simplex noise — returns a value in [-1, 1]
float simplexNoise2D(float x, float y);
float simplexNoise3D(float x, float y, float z);

// Fractal (fBm) wrappers — returns a value in roughly [-1, 1]
// octaves    : number of noise octaves  (e.g. 4–6)
// lacunarity : frequency multiplier per octave (e.g. 2.0)
// gain       : amplitude multiplier per octave (e.g. 0.5)
float fractalNoise2D(float x, float y, int octaves, float lacunarity, float gain);
float fractalNoise3D(float x, float y, float z, int octaves, float lacunarity, float gain);

} // extern "C"
