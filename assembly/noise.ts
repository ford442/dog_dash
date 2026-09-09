// noise.ts
// AssemblyScript port of cpp/src/noise.cpp — Fast Simplex Noise for Dog Dash
// procedural generation (biome density streaming).
//
// Ported from Stefan Gustavson's public-domain simplex noise reference
// (simplex-noise.pdf, 2005) and Ken Perlin's improved permutation table, to
// bring `fractalNoise2D`/`fractalNoise3D` into the default (AssemblyScript)
// build — see docs/WASM_BACKENDS.md. Values and control flow mirror
// cpp/src/noise.cpp exactly so both backends stay bit-shape compatible.
//
// Exported functions:
//   simplexNoise2D(x, y)          -> [-1, 1]
//   simplexNoise3D(x, y, z)       -> [-1, 1]
//   fractalNoise2D(x, y, octaves, lacunarity, gain)
//   fractalNoise3D(x, y, z, octaves, lacunarity, gain)

// ---------------------------------------------------------------------------
// Permutation table (Ken Perlin's reference)
// ---------------------------------------------------------------------------
const PERM_BASE: StaticArray<i32> = [
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
];

// 12 gradients, flattened (x, y, z) triples.
const GRAD3: StaticArray<f32> = [
   1, 1, 0,   -1, 1, 0,   1,-1, 0,   -1,-1, 0,
   1, 0, 1,   -1, 0, 1,   1, 0,-1,   -1, 0,-1,
   0, 1, 1,    0,-1, 1,   0, 1,-1,    0,-1,-1
];

const perm: StaticArray<i32> = new StaticArray<i32>(512);
const perm12: StaticArray<i32> = new StaticArray<i32>(512);

for (let i = 0; i < 512; i++) {
  perm[i] = PERM_BASE[i & 255];
  perm12[i] = perm[i] % 12;
}

// @ts-ignore: decorator valid in AssemblyScript
@inline
function gradDot2(gi: i32, x: f32, y: f32): f32 {
  const idx = gi * 3;
  return GRAD3[idx] * x + GRAD3[idx + 1] * y;
}

// @ts-ignore: decorator valid in AssemblyScript
@inline
function gradDot3(gi: i32, x: f32, y: f32, z: f32): f32 {
  const idx = gi * 3;
  return GRAD3[idx] * x + GRAD3[idx + 1] * y + GRAD3[idx + 2] * z;
}

// ---------------------------------------------------------------------------
// 2-D Simplex Noise
// ---------------------------------------------------------------------------
export function simplexNoise2D(xin: f32, yin: f32): f32 {
  const F2: f32 = 0.5 * (Mathf.sqrt(3.0) - 1.0);
  const G2: f32 = (3.0 - Mathf.sqrt(3.0)) / 6.0;

  const s: f32 = (xin + yin) * F2;
  const i: i32 = <i32>Mathf.floor(xin + s);
  const j: i32 = <i32>Mathf.floor(yin + s);
  const t: f32 = <f32>(i + j) * G2;
  const X0: f32 = <f32>i - t;
  const Y0: f32 = <f32>j - t;
  const x0: f32 = xin - X0;
  const y0: f32 = yin - Y0;

  let i1: i32, j1: i32;
  if (x0 > y0) { i1 = 1; j1 = 0; }
  else         { i1 = 0; j1 = 1; }

  const x1: f32 = x0 - <f32>i1 + G2;
  const y1: f32 = y0 - <f32>j1 + G2;
  const x2: f32 = x0 - 1.0 + 2.0 * G2;
  const y2: f32 = y0 - 1.0 + 2.0 * G2;

  const ii: i32 = i & 255;
  const jj: i32 = j & 255;
  const gi0: i32 = perm12[ii      + perm[jj     ]];
  const gi1: i32 = perm12[ii + i1 + perm[jj + j1]];
  const gi2: i32 = perm12[ii +  1 + perm[jj +  1]];

  let n0: f32 = 0.0, n1: f32 = 0.0, n2: f32 = 0.0;
  let t0: f32 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0.0) { t0 *= t0; n0 = t0 * t0 * gradDot2(gi0, x0, y0); }
  let t1: f32 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0.0) { t1 *= t1; n1 = t1 * t1 * gradDot2(gi1, x1, y1); }
  let t2: f32 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0.0) { t2 *= t2; n2 = t2 * t2 * gradDot2(gi2, x2, y2); }

  // Scale to [-1, 1]
  return 70.0 * (n0 + n1 + n2);
}

// ---------------------------------------------------------------------------
// 3-D Simplex Noise
// ---------------------------------------------------------------------------
export function simplexNoise3D(xin: f32, yin: f32, zin: f32): f32 {
  const F3: f32 = 1.0 / 3.0;
  const G3: f32 = 1.0 / 6.0;

  const s: f32 = (xin + yin + zin) * F3;
  const i: i32 = <i32>Mathf.floor(xin + s);
  const j: i32 = <i32>Mathf.floor(yin + s);
  const k: i32 = <i32>Mathf.floor(zin + s);
  const t: f32 = <f32>(i + j + k) * G3;

  const x0: f32 = xin - (<f32>i - t);
  const y0: f32 = yin - (<f32>j - t);
  const z0: f32 = zin - (<f32>k - t);

  let i1: i32, j1: i32, k1: i32, i2: i32, j2: i32, k2: i32;
  if (x0 >= y0) {
    if      (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else                { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if      (y0 < z0)  { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0)  { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else                { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }

  const x1: f32 = x0 - <f32>i1 + G3;
  const y1: f32 = y0 - <f32>j1 + G3;
  const z1: f32 = z0 - <f32>k1 + G3;
  const x2: f32 = x0 - <f32>i2 + 2.0 * G3;
  const y2: f32 = y0 - <f32>j2 + 2.0 * G3;
  const z2: f32 = z0 - <f32>k2 + 2.0 * G3;
  const x3: f32 = x0 - 1.0 + 3.0 * G3;
  const y3: f32 = y0 - 1.0 + 3.0 * G3;
  const z3: f32 = z0 - 1.0 + 3.0 * G3;

  const ii: i32 = i & 255;
  const jj: i32 = j & 255;
  const kk: i32 = k & 255;
  const gi0: i32 = perm12[ii      + perm[jj      + perm[kk     ]]];
  const gi1: i32 = perm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
  const gi2: i32 = perm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
  const gi3: i32 = perm12[ii +  1 + perm[jj +  1 + perm[kk +  1]]];

  let n0: f32 = 0.0, n1: f32 = 0.0, n2: f32 = 0.0, n3: f32 = 0.0;
  let t0: f32 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 >= 0.0) { t0 *= t0; n0 = t0 * t0 * gradDot3(gi0, x0, y0, z0); }
  let t1: f32 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 >= 0.0) { t1 *= t1; n1 = t1 * t1 * gradDot3(gi1, x1, y1, z1); }
  let t2: f32 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 >= 0.0) { t2 *= t2; n2 = t2 * t2 * gradDot3(gi2, x2, y2, z2); }
  let t3: f32 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 >= 0.0) { t3 *= t3; n3 = t3 * t3 * gradDot3(gi3, x3, y3, z3); }

  // Scale to [-1, 1]
  return 32.0 * (n0 + n1 + n2 + n3);
}

// ---------------------------------------------------------------------------
// Fractal (fBm) wrappers
// ---------------------------------------------------------------------------
export function fractalNoise2D(x: f32, y: f32, octaves: i32, lacunarity: f32, gain: f32): f32 {
  let value: f32 = 0.0;
  let amplitude: f32 = 1.0;
  let frequency: f32 = 1.0;
  let maxValue: f32 = 0.0;

  for (let i = 0; i < octaves; i++) {
    value += simplexNoise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return value / maxValue;
}

export function fractalNoise3D(x: f32, y: f32, z: f32, octaves: i32, lacunarity: f32, gain: f32): f32 {
  let value: f32 = 0.0;
  let amplitude: f32 = 1.0;
  let frequency: f32 = 1.0;
  let maxValue: f32 = 0.0;

  for (let i = 0; i < octaves; i++) {
    value += simplexNoise3D(x * frequency, y * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return value / maxValue;
}
