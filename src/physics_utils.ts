import { WasmHandle } from './wasm_loader';

const DEFAULT_GROUND_LEVEL = -50;

export function checkPlatformCollision(x: number, y: number, groundLevel = DEFAULT_GROUND_LEVEL, radius = 0.3) {
    if (y - radius <= groundLevel) {
        return { collided: true, groundY: groundLevel };
    }
    return { collided: false, groundY: null };
}

/**
 * JS fallback for 2D circle vs circle (matches WASM `checkCollision` semantics).
 * Returns the index of the first hit, or -1.
 */
export function checkCircleCollisionJs(
    playerX: number,
    playerY: number,
    playerRadius: number,
    objects: { x: number; y: number; radius: number }[]
): number {
    for (let i = 0; i < objects.length; i++) {
        const o = objects[i];
        const dx = o.x - playerX;
        const dy = o.y - playerY;
        const r = o.radius + playerRadius;
        if (dx * dx + dy * dy < r * r) return i;
    }
    return -1;
}

/**
 * JS fallback for 3D sphere vs sphere (matches WASM `checkSporeCollision` semantics).
 * Returns the index of the first hit, or -1.
 */
export function checkSphereCollisionJs(
    playerX: number,
    playerY: number,
    playerZ: number,
    playerRadius: number,
    objects: { x: number; y: number; z: number; radius: number }[]
): number {
    for (let i = 0; i < objects.length; i++) {
        const o = objects[i];
        const dx = o.x - playerX;
        const dy = o.y - playerY;
        const dz = o.z - playerZ;
        const r = o.radius + playerRadius;
        if (dx * dx + dy * dy + dz * dz < r * r) return i;
    }
    return -1;
}

/**
 * Writes an array of 3D objects with radii to the generic WASM allocator.
 * Automatically handles memory view resizing.
 */
export function writeObjectsToWasm(wasm: WasmHandle, objects: { position: { x: number, y: number, z?: number }, userData?: { radius?: number }, radius?: number }[]): number {
    if (!wasm.exports.allocObjects) return 0;

    const count = objects.length;
    if (count === 0) return 0;

    const ptr = wasm.exports.allocObjects(count);

    // Guard: Re-create Float32Array view if WASM memory grew
    if (!wasm.memory || wasm.memory.buffer !== wasm.exports.memory.buffer) {
        wasm.memory = new Float32Array(wasm.exports.memory.buffer);
    }

    const startIdx = ptr >>> 2; // Convert byte offset to Float32 index
    for (let i = 0; i < count; i++) {
        const obj = objects[i];
        const offset = startIdx + (i * 4); // 4 floats per object (x,y,z,r)

        wasm.memory[offset] = obj.position.x;
        wasm.memory[offset + 1] = obj.position.y;
        wasm.memory[offset + 2] = obj.position.z || 0;
        wasm.memory[offset + 3] = obj.radius !== undefined ? obj.radius : (obj.userData?.radius || 1.0);
    }

    return count;
}

/** Writes boss hitbox circles into the WASM allocBossHitboxes buffer. */
export function writeBossHitboxesToWasm(
    wasm: WasmHandle,
    hitboxes: { x: number; y: number; radius: number }[]
): number {
    if (!wasm.exports.allocBossHitboxes || hitboxes.length === 0) return 0;

    const ptr = wasm.exports.allocBossHitboxes(hitboxes.length);

    if (!wasm.memory || wasm.memory.buffer !== wasm.exports.memory.buffer) {
        wasm.memory = new Float32Array(wasm.exports.memory.buffer);
    }

    const startIdx = ptr >>> 2;
    for (let i = 0; i < hitboxes.length; i++) {
        const offset = startIdx + i * 3;
        wasm.memory[offset] = hitboxes[i].x;
        wasm.memory[offset + 1] = hitboxes[i].y;
        wasm.memory[offset + 2] = hitboxes[i].radius;
    }

    return hitboxes.length;
}
