import { WasmHandle } from './wasm_loader';

const DEFAULT_GROUND_LEVEL = -50;

export function checkPlatformCollision(x: number, y: number, groundLevel = DEFAULT_GROUND_LEVEL, radius = 0.3) {
    if (y - radius <= groundLevel) {
        return { collided: true, groundY: groundLevel };
    }
    return { collided: false, groundY: null };
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
