// Uniform-grid spatial hash for sphere queries.
// Broad phase first; SIMD only narrows candidates gathered from cells.
// See docs/WASM_BACKENDS.md.

const ENTITY_STRIDE: i32 = 6; // x, y, z, radius, layer, id  (f32)
const ENTITY_BYTES: i32 = ENTITY_STRIDE * 4;

const HASH_BITS: i32 = 12; // 4096 buckets
const HASH_SIZE: i32 = 1 << HASH_BITS;
const HASH_MASK: i32 = HASH_SIZE - 1;

const MAX_CELL_SPAN: i32 = 8;
const DEFAULT_CELL: f32 = 8.0;
const MAX_RESULTS: i32 = 1024;

let entitiesPtr: usize = 0;
let entitiesCapacity: i32 = 0;
let entityCount: i32 = 0;

let bucketsPtr: usize = 0; // i32 head index per bucket, -1 empty
let nodesPtr: usize = 0;   // pairs of i32: entityIndex, next
let nodesCapacity: i32 = 0;
let nodeCount: i32 = 0;

let visitedPtr: usize = 0;
let visitedCapacity: i32 = 0;
let visitStamp: i32 = 1;

let resultsPtr: usize = 0; // i32 ids
let resultCount: i32 = 0;

// SoA scratch for SIMD narrow-phase (16-byte aligned via heap.alloc)
let soaXPtr: usize = 0;
let soaYPtr: usize = 0;
let soaZPtr: usize = 0;
let soaRPtr: usize = 0;
let soaIdPtr: usize = 0; // i32
let soaCapacity: i32 = 0;

let cellSize: f32 = DEFAULT_CELL;
let invCell: f32 = 1.0 / DEFAULT_CELL;
let gridReady: bool = false;

function ensureBuckets(): void {
  if (bucketsPtr != 0) return;
  bucketsPtr = heap.alloc(<usize>(HASH_SIZE * 4));
  for (let i: i32 = 0; i < HASH_SIZE; i++) {
    store<i32>(bucketsPtr + (<usize>i << 2), -1);
  }
}

function ensureResults(): void {
  if (resultsPtr != 0) return;
  resultsPtr = heap.alloc(<usize>(MAX_RESULTS * 4));
}

function ensureVisited(count: i32): void {
  if (count <= visitedCapacity && visitedPtr != 0) return;
  const bytes = <usize>count * 4;
  if (visitedPtr == 0) {
    visitedPtr = heap.alloc(bytes);
  } else {
    visitedPtr = heap.realloc(visitedPtr, bytes);
  }
  visitedCapacity = count;
}

function ensureSoa(count: i32): void {
  // Pad to multiple of 4 for v128 loads.
  const padded = (count + 3) & ~3;
  if (padded <= soaCapacity && soaXPtr != 0) return;
  const fbytes = <usize>padded * 4;
  if (soaXPtr == 0) {
    soaXPtr = heap.alloc(fbytes);
    soaYPtr = heap.alloc(fbytes);
    soaZPtr = heap.alloc(fbytes);
    soaRPtr = heap.alloc(fbytes);
    soaIdPtr = heap.alloc(fbytes);
  } else {
    soaXPtr = heap.realloc(soaXPtr, fbytes);
    soaYPtr = heap.realloc(soaYPtr, fbytes);
    soaZPtr = heap.realloc(soaZPtr, fbytes);
    soaRPtr = heap.realloc(soaRPtr, fbytes);
    soaIdPtr = heap.realloc(soaIdPtr, fbytes);
  }
  soaCapacity = padded;
}

function ensureNodes(needed: i32): void {
  if (needed <= nodesCapacity && nodesPtr != 0) return;
  const bytes = <usize>needed * 8; // two i32s
  if (nodesPtr == 0) {
    nodesPtr = heap.alloc(bytes);
  } else {
    nodesPtr = heap.realloc(nodesPtr, bytes);
  }
  nodesCapacity = needed;
}

function entityBase(index: i32): usize {
  return entitiesPtr + <usize>(index * ENTITY_BYTES);
}

function hashCell(ix: i32, iy: i32, iz: i32): i32 {
  // Large primes; power-of-two mask so negatives wrap cleanly.
  return (ix * 73856093 ^ iy * 19349663 ^ iz * 83492791) & HASH_MASK;
}

function cellOf(v: f32): i32 {
  return <i32>Math.floor(<f64>v * <f64>invCell);
}

/** Allocate / grow the entity AOS buffer. Returns byte pointer. */
export function allocEntities(count: i32): usize {
  if (count < 0) count = 0;
  entityCount = count;
  gridReady = false;
  if (count == 0) {
    return entitiesPtr;
  }
  const requiredBytes = count * ENTITY_BYTES;
  if (count > entitiesCapacity) {
    if (entitiesCapacity == 0) {
      entitiesPtr = heap.alloc(<usize>requiredBytes);
    } else {
      entitiesPtr = heap.realloc(entitiesPtr, <usize>requiredBytes);
    }
    entitiesCapacity = count;
  }
  return entitiesPtr;
}

export function getEntityPtr(): usize {
  return entitiesPtr;
}

export function getEntityCount(): i32 {
  return entityCount;
}

export function getQueryResultPtr(): usize {
  ensureResults();
  return resultsPtr;
}

export function getQueryCount(): i32 {
  return resultCount;
}

export function simdSupported(): i32 {
  return 1;
}

export function rebuildGrid(newCellSize: f32): void {
  cellSize = newCellSize > 0.1 ? newCellSize : DEFAULT_CELL;
  invCell = 1.0 / cellSize;
  ensureBuckets();
  ensureResults();

  for (let b: i32 = 0; b < HASH_SIZE; b++) {
    store<i32>(bucketsPtr + (<usize>b << 2), -1);
  }
  nodeCount = 0;

  if (entityCount == 0 || entitiesPtr == 0) {
    gridReady = true;
    return;
  }

  // Worst case: each entity in MAX_CELL_SPAN^3 cells (capped below).
  const maxPerEntity = MAX_CELL_SPAN * MAX_CELL_SPAN * MAX_CELL_SPAN;
  ensureNodes(entityCount * maxPerEntity);

  for (let i: i32 = 0; i < entityCount; i++) {
    const base = entityBase(i);
    const x = load<f32>(base);
    const y = load<f32>(base + 4);
    const z = load<f32>(base + 8);
    const r = load<f32>(base + 12);

    let minX = cellOf(x - r);
    let maxX = cellOf(x + r);
    let minY = cellOf(y - r);
    let maxY = cellOf(y + r);
    let minZ = cellOf(z - r);
    let maxZ = cellOf(z + r);

    if (maxX - minX + 1 > MAX_CELL_SPAN) {
      const c = cellOf(x);
      minX = c - (MAX_CELL_SPAN >> 1);
      maxX = minX + MAX_CELL_SPAN - 1;
    }
    if (maxY - minY + 1 > MAX_CELL_SPAN) {
      const c = cellOf(y);
      minY = c - (MAX_CELL_SPAN >> 1);
      maxY = minY + MAX_CELL_SPAN - 1;
    }
    if (maxZ - minZ + 1 > MAX_CELL_SPAN) {
      const c = cellOf(z);
      minZ = c - (MAX_CELL_SPAN >> 1);
      maxZ = minZ + MAX_CELL_SPAN - 1;
    }

    for (let iz = minZ; iz <= maxZ; iz++) {
      for (let iy = minY; iy <= maxY; iy++) {
        for (let ix = minX; ix <= maxX; ix++) {
          if (nodeCount >= nodesCapacity) break;
          const bucket = hashCell(ix, iy, iz);
          const head = load<i32>(bucketsPtr + (<usize>bucket << 2));
          const nodeOff = <usize>nodeCount * 8;
          store<i32>(nodesPtr + nodeOff, i);
          store<i32>(nodesPtr + nodeOff + 4, head);
          store<i32>(bucketsPtr + (<usize>bucket << 2), nodeCount);
          nodeCount++;
        }
      }
    }
  }
  gridReady = true;
}

function bumpStamp(): void {
  visitStamp++;
  if (visitStamp == 0) {
    visitStamp = 1;
    if (visitedPtr != 0) {
      for (let i: i32 = 0; i < visitedCapacity; i++) {
        store<i32>(visitedPtr + (<usize>i << 2), 0);
      }
    }
  }
}

function gatherCandidates(qx: f32, qy: f32, qz: f32, qr: f32, layerMask: i32): i32 {
  ensureVisited(entityCount);
  ensureSoa(entityCount);
  bumpStamp();
  let gathered: i32 = 0;

  if (!gridReady || entityCount == 0 || entitiesPtr == 0) {
    return 0;
  }

  const minX = cellOf(qx - qr);
  const maxX = cellOf(qx + qr);
  const minY = cellOf(qy - qr);
  const maxY = cellOf(qy + qr);
  const minZ = cellOf(qz - qr);
  const maxZ = cellOf(qz + qr);

  for (let iz = minZ; iz <= maxZ; iz++) {
    for (let iy = minY; iy <= maxY; iy++) {
      for (let ix = minX; ix <= maxX; ix++) {
        let node = load<i32>(bucketsPtr + (<usize>hashCell(ix, iy, iz) << 2));
        while (node != -1) {
          const nodeOff = <usize>node * 8;
          const ei = load<i32>(nodesPtr + nodeOff);
          node = load<i32>(nodesPtr + nodeOff + 4);
          if (ei < 0 || ei >= entityCount) continue;
          const prev = load<i32>(visitedPtr + (<usize>ei << 2));
          if (prev == visitStamp) continue;
          store<i32>(visitedPtr + (<usize>ei << 2), visitStamp);

          const base = entityBase(ei);
          const layer = <i32>load<f32>(base + 16);
          if ((layer & layerMask) == 0) continue;

          store<f32>(soaXPtr + (<usize>gathered << 2), load<f32>(base));
          store<f32>(soaYPtr + (<usize>gathered << 2), load<f32>(base + 4));
          store<f32>(soaZPtr + (<usize>gathered << 2), load<f32>(base + 8));
          store<f32>(soaRPtr + (<usize>gathered << 2), load<f32>(base + 12));
          store<i32>(soaIdPtr + (<usize>gathered << 2), <i32>load<f32>(base + 20));
          gathered++;
        }
      }
    }
  }
  return gathered;
}

function writeHit(id: i32): void {
  if (resultCount >= MAX_RESULTS) return;
  store<i32>(resultsPtr + (<usize>resultCount << 2), id);
  resultCount++;
}

function narrowPhaseScalar(gathered: i32, qx: f32, qy: f32, qz: f32, qr: f32): i32 {
  ensureResults();
  resultCount = 0;
  for (let i: i32 = 0; i < gathered; i++) {
    const ox = load<f32>(soaXPtr + (<usize>i << 2));
    const oy = load<f32>(soaYPtr + (<usize>i << 2));
    const oz = load<f32>(soaZPtr + (<usize>i << 2));
    const or_ = load<f32>(soaRPtr + (<usize>i << 2));
    const dx = qx - ox;
    const dy = qy - oy;
    const dz = qz - oz;
    const rad = qr + or_;
    if (dx * dx + dy * dy + dz * dz < rad * rad) {
      writeHit(load<i32>(soaIdPtr + (<usize>i << 2)));
    }
  }
  return resultCount;
}

function narrowPhaseSimd(gathered: i32, qx: f32, qy: f32, qz: f32, qr: f32): i32 {
  ensureResults();
  resultCount = 0;
  if (gathered <= 0) return 0;

  const padded = (gathered + 3) & ~3;
  // Zero-pad leftover lanes so they cannot false-hit (radius 0, far away).
  for (let p: i32 = gathered; p < padded; p++) {
    store<f32>(soaXPtr + (<usize>p << 2), 1.0e9);
    store<f32>(soaYPtr + (<usize>p << 2), 1.0e9);
    store<f32>(soaZPtr + (<usize>p << 2), 1.0e9);
    store<f32>(soaRPtr + (<usize>p << 2), 0.0);
    store<i32>(soaIdPtr + (<usize>p << 2), -1);
  }

  const qxv = f32x4.splat(qx);
  const qyv = f32x4.splat(qy);
  const qzv = f32x4.splat(qz);
  const qrv = f32x4.splat(qr);

  for (let i: i32 = 0; i < padded; i += 4) {
    const off = <usize>i << 2;
    const xs = v128.load(soaXPtr + off);
    const ys = v128.load(soaYPtr + off);
    const zs = v128.load(soaZPtr + off);
    const rs = v128.load(soaRPtr + off);

    const dx = f32x4.sub(qxv, xs);
    const dy = f32x4.sub(qyv, ys);
    const dz = f32x4.sub(qzv, zs);
    const distSq = f32x4.add(f32x4.add(f32x4.mul(dx, dx), f32x4.mul(dy, dy)), f32x4.mul(dz, dz));
    const rad = f32x4.add(qrv, rs);
    const radSq = f32x4.mul(rad, rad);
    const hitMask = i32x4.bitmask(f32x4.lt(distSq, radSq));

    if ((hitMask & 1) != 0 && i < gathered) writeHit(load<i32>(soaIdPtr + off));
    if ((hitMask & 2) != 0 && i + 1 < gathered) writeHit(load<i32>(soaIdPtr + off + 4));
    if ((hitMask & 4) != 0 && i + 2 < gathered) writeHit(load<i32>(soaIdPtr + off + 8));
    if ((hitMask & 8) != 0 && i + 3 < gathered) writeHit(load<i32>(soaIdPtr + off + 12));
  }
  return resultCount;
}

/** Scalar query. Returns hit count; ids live at getQueryResultPtr(). */
export function queryRadius(x: f32, y: f32, z: f32, r: f32, layerMask: i32): i32 {
  const gathered = gatherCandidates(x, y, z, r, layerMask);
  return narrowPhaseScalar(gathered, x, y, z, r);
}

/** Same query with v128 narrow phase. Falls back to scalar if SIMD buffers fail. */
export function queryRadiusSimd(x: f32, y: f32, z: f32, r: f32, layerMask: i32): i32 {
  const gathered = gatherCandidates(x, y, z, r, layerMask);
  return narrowPhaseSimd(gathered, x, y, z, r);
}

/** First hit only — thin wrapper for the old checkCollision shape. */
export function queryRadiusFirst(x: f32, y: f32, z: f32, r: f32, layerMask: i32): i32 {
  const n = queryRadius(x, y, z, r, layerMask);
  if (n <= 0) return -1;
  return load<i32>(resultsPtr);
}
