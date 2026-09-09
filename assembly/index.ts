// ---------------------------------------------------------------------------
// Ported C++ algorithms (see docs/WASM_BACKENDS.md — decision: AssemblyScript
// is the single supported, always-built backend). `cpp/` is kept only as an
// experimental research tree (SIMD prototyping, native profiling) and is no
// longer required for either of these to ship.
// ---------------------------------------------------------------------------
export * from './noise';
export * from './physics';

// --- GENERIC OBJECT ALLOCATOR ---
let objectsPtr: usize = 0;
let objectsCapacity: i32 = 0;

export function allocObjects(count: i32): usize {
  const requiredBytes = count * 16; // 4 floats (x, y, z, radius) per object
  if (count > objectsCapacity) {
    if (objectsCapacity == 0) {
      objectsPtr = heap.alloc(requiredBytes);
    } else {
      objectsPtr = heap.realloc(objectsPtr, requiredBytes);
    }
    objectsCapacity = count;
  }
  return objectsPtr;
}

export function freeObjects(): void {
  if (objectsPtr != 0) {
    heap.free(objectsPtr);
    objectsPtr = 0;
    objectsCapacity = 0;
  }
}

export function getObjectPtr(): usize {
  return objectsPtr;
}

// Memory management for asteroid data
// We use a global buffer to store the asteroid data (x, y, radius)
// This prevents overwriting the stack or other globals at offset 0

// Current pointer to the asteroid data buffer
let asteroidsPtr: usize = 0;
// Current capacity of the buffer (in number of asteroids)
let asteroidsCapacity: i32 = 0;

// Current pointer to the spore cloud data buffer (x, y, z, radius)
let sporeCloudsPtr: usize = 0;
let sporeCloudsCapacity: i32 = 0;

// Allocates space for a given number of asteroids.
// Returns the pointer/offset to the beginning of the buffer.
export function allocAsteroids(count: i32): usize {
  // 3 floats per asteroid * 4 bytes = 12 bytes
  const requiredBytes = count * 12;

  // If we need more space than currently allocated, resize
  if (count > asteroidsCapacity) {
    if (asteroidsCapacity == 0) {
       // Initial allocation
       asteroidsPtr = heap.alloc(requiredBytes);
    } else {
       // Reallocate (might move the pointer)
       asteroidsPtr = heap.realloc(asteroidsPtr, requiredBytes);
    }
    asteroidsCapacity = count;
  }
  return asteroidsPtr;
}

// Allocates space for a given number of Spore Clouds.
// Returns the pointer/offset to the beginning of the buffer.
export function allocSporeClouds(count: i32): usize {
  // 4 floats per cloud (x, y, z, radius) * 4 bytes = 16 bytes
  const requiredBytes = count * 16;

  if (count > sporeCloudsCapacity) {
    if (sporeCloudsCapacity == 0) {
       sporeCloudsPtr = heap.alloc(requiredBytes);
    } else {
       sporeCloudsPtr = heap.realloc(sporeCloudsPtr, requiredBytes);
    }
    sporeCloudsCapacity = count;
  }
  return sporeCloudsPtr;
}

// Checks for collision between a player circle and a list of circular objects (Asteroids).
// Returns the index of the collided object, or -1 if no collision found.
export function checkCollision(playerX: f32, playerY: f32, playerRadius: f32, objectCount: i32): i32 {
  // If no objects or no memory allocated, return no collision
  if (objectCount == 0 || asteroidsPtr == 0) {
    return -1;
  }

  let ptr = asteroidsPtr;

  for (let i = 0; i < objectCount; i++) {
    // Data is stored as sets of 3 floats: [x, y, radius]
    let objX = load<f32>(ptr);
    let objY = load<f32>(ptr + 4);
    let objR = load<f32>(ptr + 8);

    // Calculate distance squared (more efficient than square root)
    let dx = playerX - objX;
    let dy = playerY - objY;
    let distSq = dx * dx + dy * dy;

    // Check collision
    let radii = playerRadius + objR;
    if (distSq < radii * radii) {
      return i; // Collision detected! Return the index.
    }

    // Move to next object
    ptr += 12;
  }
  return -1; // No collision
}

// Checks for collision with Spore Clouds in 3D (Spherical collision)
// Used for "Collecting" or entering clouds
export function checkSporeCollision(playerX: f32, playerY: f32, playerZ: f32, playerRadius: f32, objectCount: i32): i32 {
  if (objectCount == 0 || sporeCloudsPtr == 0) {
    return -1;
  }

  let ptr = sporeCloudsPtr;

  for (let i = 0; i < objectCount; i++) {
    // Data is stored as sets of 4 floats: [x, y, z, radius]
    let objX = load<f32>(ptr);
    let objY = load<f32>(ptr + 4);
    let objZ = load<f32>(ptr + 8);
    let objR = load<f32>(ptr + 12);

    let dx = playerX - objX;
    let dy = playerY - objY;
    let dz = playerZ - objZ;
    let distSq = dx * dx + dy * dy + dz * dz;

    let radii = playerRadius + objR;
    if (distSq < radii * radii) {
      return i; // Collision detected
    }

    ptr += 16;
  }
  return -1;
}

// ============================================================================
// BOSS (Nebula Kraken) COLLISION DETECTION
// ============================================================================
// Checks projectile hits against boss hitboxes.
// Boss data: [x, y, radius] per hitbox (same format as asteroids).
// Used for checking weapon projectiles against squid body/tentacle segments.

let bossHitboxPtr: usize = 0;
let bossHitboxCapacity: i32 = 0;

// Allocates space for boss hitbox data.
// Returns the pointer/offset to the beginning of the buffer.
export function allocBossHitboxes(count: i32): usize {
  const requiredBytes = count * 12; // 3 floats * 4 bytes

  if (count > bossHitboxCapacity) {
    if (bossHitboxCapacity == 0) {
      bossHitboxPtr = heap.alloc(requiredBytes);
    } else {
      bossHitboxPtr = heap.realloc(bossHitboxPtr, requiredBytes);
    }
    bossHitboxCapacity = count;
  }
  return bossHitboxPtr;
}

// Checks for collision between a projectile circle and boss hitbox circles.
// Returns the index of the hit hitbox, or -1 if no collision.
export function checkBossCollision(projX: f32, projY: f32, projRadius: f32, hitboxCount: i32): i32 {
  if (hitboxCount == 0 || bossHitboxPtr == 0) {
    return -1;
  }

  let ptr = bossHitboxPtr;

  for (let i = 0; i < hitboxCount; i++) {
    let hbX = load<f32>(ptr);
    let hbY = load<f32>(ptr + 4);
    let hbR = load<f32>(ptr + 8);

    let dx = projX - hbX;
    let dy = projY - hbY;
    let distSq = dx * dx + dy * dy;

    let radii = projRadius + hbR;
    if (distSq < radii * radii) {
      return i;
    }

    ptr += 12;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// GPU CHORES — visual-only helper ops (see docs/GPU_CHORES.md)
//
// These are NOT part of the gameplay/physics path. They compute derived,
// non-authoritative values (draw lists, HUD meters) from data JS already owns.
// Nothing here reads or writes the asteroid / spore / boss hitbox buffers, so
// collision determinism is unaffected.
//
// Accumulation is done in f64 so results match the JS reference backend in
// src/gpu_chores/js_backend.ts bit for bit.
// ---------------------------------------------------------------------------

let choreValuesPtr: usize = 0;
let choreValuesCapacity: i32 = 0;

let choreIndicesPtr: usize = 0;
let choreIndicesCapacity: i32 = 0;

// Allocates the f32 input buffer chores read from.
export function allocChoreValues(count: i32): usize {
  const requiredBytes = count * 4;

  if (count > choreValuesCapacity) {
    if (choreValuesCapacity == 0) {
      choreValuesPtr = heap.alloc(requiredBytes);
    } else {
      choreValuesPtr = heap.realloc(choreValuesPtr, requiredBytes);
    }
    choreValuesCapacity = count;
  }
  return choreValuesPtr;
}

// Allocates the i32 index buffer choresCompact writes into.
export function allocChoreIndices(count: i32): usize {
  const requiredBytes = count * 4;

  if (count > choreIndicesCapacity) {
    if (choreIndicesCapacity == 0) {
      choreIndicesPtr = heap.alloc(requiredBytes);
    } else {
      choreIndicesPtr = heap.realloc(choreIndicesPtr, requiredBytes);
    }
    choreIndicesCapacity = count;
  }
  return choreIndicesPtr;
}

// Writes the index of every value greater than `epsilon` into the index
// buffer, preserving input order. Returns the number of indices written.
export function choresCompact(count: i32, epsilon: f64): i32 {
  if (count <= 0 || choreValuesPtr == 0 || choreIndicesPtr == 0) {
    return 0;
  }

  const limit = min(min(count, choreValuesCapacity), choreIndicesCapacity);
  let kept = 0;

  for (let i = 0; i < limit; i++) {
    const value = <f64>load<f32>(choreValuesPtr + (<usize>i << 2));
    if (value > epsilon) {
      store<i32>(choreIndicesPtr + (<usize>kept << 2), i);
      kept++;
    }
  }
  return kept;
}

// Reduces the value buffer. op: 0 = sum, 1 = max, 2 = min.
export function choresReduce(count: i32, op: i32): f64 {
  if (count <= 0 || choreValuesPtr == 0) {
    return 0;
  }

  const limit = min(count, choreValuesCapacity);
  if (limit <= 0) {
    return 0;
  }

  if (op == 0) {
    let sum: f64 = 0;
    for (let i = 0; i < limit; i++) {
      sum += <f64>load<f32>(choreValuesPtr + (<usize>i << 2));
    }
    return sum;
  }

  let acc = <f64>load<f32>(choreValuesPtr);
  if (op == 1) {
    for (let i = 1; i < limit; i++) {
      const value = <f64>load<f32>(choreValuesPtr + (<usize>i << 2));
      if (value > acc) acc = value;
    }
  } else {
    for (let i = 1; i < limit; i++) {
      const value = <f64>load<f32>(choreValuesPtr + (<usize>i << 2));
      if (value < acc) acc = value;
    }
  }
  return acc;
}
