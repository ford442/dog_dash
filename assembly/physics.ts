// physics.ts
// AssemblyScript port of cpp/src/physics.cpp — Verlet-integration physics for
// Dog Dash soft-body cores (Nebula Jelly-Moss). Ported to bring the Option A
// soft-body consumer (src/jelly_moss_softbody.ts) into the default
// (AssemblyScript) build — see docs/WASM_BACKENDS.md.
//
// Body memory layout (8 floats = 32 bytes per body), matching cpp/src/physics.cpp:
//   [0] x        current position X
//   [1] y        current position Y
//   [2] prevX    previous position X
//   [3] prevY    previous position Y
//   [4] accX     accumulated acceleration X (reset each step)
//   [5] accY     accumulated acceleration Y (reset each step)
//   [6] mass     body mass (reserved for future force calculations)
//   [7] radius   collision radius

const BODY_FLOATS: i32 = 8;
const BODY_BYTES: i32 = BODY_FLOATS * 4;

let bodiesPtr: usize = 0;
let bodiesCapacity: i32 = 0;

// ---------------------------------------------------------------------------
// Buffer management
// ---------------------------------------------------------------------------
export function allocPhysicsBodies(count: i32): usize {
  const requiredBytes = count * BODY_BYTES;
  if (count > bodiesCapacity) {
    if (bodiesCapacity == 0) {
      bodiesPtr = heap.alloc(requiredBytes);
    } else {
      bodiesPtr = heap.realloc(bodiesPtr, requiredBytes);
    }
    bodiesCapacity = count;
  }
  return bodiesPtr;
}

// ---------------------------------------------------------------------------
// Simulation step
// ---------------------------------------------------------------------------
export function stepPhysics(count: i32, dt: f32, gravity: f32): void {
  if (bodiesPtr == 0 || count <= 0) return;

  const dt2: f32 = dt * dt;

  for (let i = 0; i < count; i++) {
    const base: usize = bodiesPtr + <usize>(i * BODY_BYTES);

    const x: f32 = load<f32>(base);
    const y: f32 = load<f32>(base + 4);
    const px: f32 = load<f32>(base + 8);
    const py: f32 = load<f32>(base + 12);

    // Apply gravity to accumulated Y acceleration
    const ax: f32 = load<f32>(base + 16);
    const ay: f32 = load<f32>(base + 20) + gravity;

    // Verlet integration: pos_new = 2*pos - pos_prev + acc * dt^2
    store<f32>(base, 2.0 * x - px + ax * dt2);
    store<f32>(base + 4, 2.0 * y - py + ay * dt2);

    // Shift: prev = current
    store<f32>(base + 8, x);
    store<f32>(base + 12, y);

    // Reset per-step acceleration
    store<f32>(base + 16, 0.0);
    store<f32>(base + 20, 0.0);
  }
}

// ---------------------------------------------------------------------------
// Per-body accessors (used from JS when direct memory views are impractical)
// ---------------------------------------------------------------------------
export function getBodyPositionX(index: i32): f32 {
  if (bodiesPtr == 0 || index < 0 || index >= bodiesCapacity) return 0.0;
  return load<f32>(bodiesPtr + <usize>(index * BODY_BYTES));
}

export function getBodyPositionY(index: i32): f32 {
  if (bodiesPtr == 0 || index < 0 || index >= bodiesCapacity) return 0.0;
  return load<f32>(bodiesPtr + <usize>(index * BODY_BYTES) + 4);
}

export function setBodyPosition(index: i32, x: f32, y: f32): void {
  if (bodiesPtr == 0 || index < 0 || index >= bodiesCapacity) return;
  // Move the body to (x, y) without a velocity impulse (prev = current).
  const base: usize = bodiesPtr + <usize>(index * BODY_BYTES);
  store<f32>(base, x);
  store<f32>(base + 4, y);
  store<f32>(base + 8, x);
  store<f32>(base + 12, y);
}

export function addBodyAcceleration(index: i32, ax: f32, ay: f32): void {
  if (bodiesPtr == 0 || index < 0 || index >= bodiesCapacity) return;
  const base: usize = bodiesPtr + <usize>(index * BODY_BYTES);
  store<f32>(base + 16, load<f32>(base + 16) + ax);
  store<f32>(base + 20, load<f32>(base + 20) + ay);
}

export function getBodyRadius(index: i32): f32 {
  if (bodiesPtr == 0 || index < 0 || index >= bodiesCapacity) return 0.0;
  return load<f32>(bodiesPtr + <usize>(index * BODY_BYTES) + 28);
}
